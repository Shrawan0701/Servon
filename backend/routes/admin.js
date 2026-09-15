const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const adminAuth = require('../middleware/adminAuth');

// ─── ADMIN LOGIN ──────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM admin_users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const admin = result.rows[0];

        const isValid = await bcrypt.compare(
            password,
            admin.password_hash
        );

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                adminId: admin.id,
                role: 'admin'
            },
            process.env.JWT_SECRET,
            {
                expiresIn: '24h'
            }
        );

        res.json({
            success: true,
            token,
            admin: {
                id: admin.id,
                email: admin.email,
                name: admin.name
            }
        });

    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── GET ALL RESTAURANTS (main businesses only) ───────────────────────
router.get('/businesses', adminAuth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
                id,
                business_name,
                owner_name,
                email,
                phone,
                subscription_status,
                trial_start_date,
                trial_end_date,
                is_trial_used,
                referral_code,
                referred_by,
                is_main_branch,
                is_branch,
                parent_id,
                created_at
             FROM businesses
             WHERE is_branch = false OR is_branch IS NULL
             ORDER BY created_at DESC`
        );

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Get businesses error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── GET BRANCHES OF A BUSINESS ───────────────────────────────────────
router.get('/businesses/:id/branches', adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT
                id,
                business_name,
                branch_name,
                branch_code,
                is_main_branch,
                is_branch,
                parent_id,
                subscription_status,
                address,
                created_at
             FROM businesses
             WHERE parent_id = $1 OR (id = $1 AND is_main_branch = true)
             ORDER BY is_main_branch DESC, created_at ASC`,
            [id]
        );

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Get branches error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── CREATE BRANCH UNDER EXISTING BUSINESS ────────────────────────────
router.post('/businesses/:id/branches', adminAuth, async (req, res) => {
    const { id } = req.params;
    const { branchName, branchCode, ownerName, email, phone, password, address } = req.body;

    if (!branchName) {
        return res.status(400).json({ error: 'Branch name is required' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Verify parent business exists
        const parentCheck = await client.query(
            `SELECT id, business_name, owner_name, referral_code, password_hash
             FROM businesses WHERE id = $1`,
            [id]
        );

        if (parentCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Parent business not found' });
        }

        const parent = parentCheck.rows[0];

        // 2. Generate unique branch code
        let finalBranchCode = branchCode;
        if (!finalBranchCode) {
            finalBranchCode = `BR-${Date.now().toString(36).toUpperCase()}`;
        }

        // Check branch code uniqueness
        const codeCheck = await client.query(
            `SELECT id FROM businesses WHERE branch_code = $1`,
            [finalBranchCode]
        );
        if (codeCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Branch code already exists' });
        }

        // 3. Generate unique email if not provided
        const finalEmail = email || `branch-${finalBranchCode.toLowerCase()}@servon.com`;

        // Check email uniqueness
        const emailCheck = await client.query(
            `SELECT id FROM businesses WHERE email = $1`,
            [finalEmail]
        );
        if (emailCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Email already exists' });
        }

        // 4. Generate unique referral code for the branch
        const baseName = branchName.substring(0, 4).toUpperCase().replace(/\s/g, '');
        let newReferralCode;
        let codeExists = true;
        while (codeExists) {
            newReferralCode = baseName + Math.floor(1000 + Math.random() * 9000);
            const rc = await client.query(
                `SELECT id FROM businesses WHERE referral_code = $1`,
                [newReferralCode]
            );
            codeExists = rc.rows.length > 0;
        }

        // 5. Hash password (use parent's hash if not provided)
        const passwordHash = password
            ? await bcrypt.hash(password, 12)
            : parent.password_hash || await bcrypt.hash('branch_default_pwd', 12);

        // 6. Insert branch
        const result = await client.query(
            `INSERT INTO businesses
            (
                business_name,
                branch_name,
                branch_code,
                owner_name,
                email,
                phone,
                address,
                password_hash,
                subscription_status,
                parent_id,
                is_branch,
                is_main_branch,
                referral_code,
                created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9, true, false, $10, NOW())
            RETURNING id, business_name, branch_name, branch_code, parent_id, is_branch, subscription_status`,
            [
                branchName,
                branchName,
                finalBranchCode,
                ownerName || parent.owner_name,
                finalEmail,
                phone || '',
                address || null,
                passwordHash,
                id,
                newReferralCode
            ]
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create branch error:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// ─── CREATE MAIN RESTAURANT ───────────────────────────────────────────
router.post('/businesses', adminAuth, async (req, res) => {
    const {
        businessName,
        ownerName,
        email,
        phone,
        password,
        referralCode
    } = req.body;

    if (!businessName || !ownerName || !email || !phone || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const normalizedReferralCode = referralCode
            ? referralCode.trim().toUpperCase()
            : null;

        const existing = await client.query(
            `SELECT id FROM businesses WHERE email = $1 OR phone = $2`,
            [email, phone]
        );

        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Email or phone already registered' });
        }

        let referrerId = null;
        if (normalizedReferralCode) {
            const referrerResult = await client.query(
                `SELECT id FROM businesses WHERE UPPER(referral_code) = $1 LIMIT 1`,
                [normalizedReferralCode]
            );
            if (referrerResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Invalid referral code' });
            }
            referrerId = referrerResult.rows[0].id;
        }

        const baseName = businessName.substring(0, 4).toUpperCase().replace(/\s/g, '');
        let newReferralCode;
        let codeExists = true;
        while (codeExists) {
            newReferralCode = baseName + Math.floor(1000 + Math.random() * 9000);
            const rc = await client.query(
                `SELECT id FROM businesses WHERE referral_code = $1`,
                [newReferralCode]
            );
            codeExists = rc.rows.length > 0;
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await client.query(
            `INSERT INTO businesses
            (
                business_name,
                branch_name,
                owner_name,
                email,
                phone,
                password_hash,
                subscription_status,
                referral_code,
                referred_by,
                is_main_branch,
                is_trial_used,
                trial_start_date,
                trial_end_date
            )
            VALUES
            ($1, $1, $2, $3, $4, $5, 'TRIAL', $6, $7, true, true, NOW(), NOW() + INTERVAL '3 days')
            RETURNING
                id, business_name, owner_name, email, phone,
                subscription_status, referral_code, referred_by,
                is_main_branch, is_trial_used, trial_start_date, trial_end_date`,
            [
                businessName,
                ownerName,
                email,
                phone,
                passwordHash,
                newReferralCode,
                referrerId
            ]
        );

        const business = result.rows[0];

        if (referrerId) {
            await client.query(
                `INSERT INTO referrals (referrer_id, referred_id, status)
                 VALUES ($1, $2, 'PENDING')`,
                [referrerId, business.id]
            );
        }

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            data: business
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create business error:', error);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// ─── UPDATE RESTAURANT ────────────────────────────────────────────────
router.put('/businesses/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const {
        business_name,
        owner_name,
        email,
        phone,
        subscription_status
    } = req.body;

    try {
        const result = await pool.query(
            `UPDATE businesses
             SET
                business_name = $1,
                owner_name = $2,
                email = $3,
                phone = $4,
                subscription_status = $5,
                updated_at = NOW()
             WHERE id = $6
             RETURNING
                id, business_name, owner_name, email, phone, subscription_status`,
            [business_name, owner_name, email, phone, subscription_status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Business not found' });
        }

        res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        console.error('Update business error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── DELETE RESTAURANT ────────────────────────────────────────────────
router.delete('/businesses/:id', adminAuth, async (req, res) => {
    const { id } = req.params;

    try {
        // Prevent deleting main branch if branches exist
        const branches = await pool.query(
            `SELECT COUNT(*) as count FROM businesses WHERE parent_id = $1`,
            [id]
        );

        if (parseInt(branches.rows[0].count) > 0) {
            return res.status(400).json({
                error: 'Cannot delete main business with existing branches. Delete branches first.'
            });
        }

        const result = await pool.query(
            `DELETE FROM businesses WHERE id = $1 RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Business not found' });
        }

        res.json({ success: true, message: 'Business deleted' });

    } catch (error) {
        console.error('Delete business error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
// ─── UPDATE BRANCH ────────────────────────────────────────────────────
router.put('/branches/:id', adminAuth, async (req, res) => {
    const { id } = req.params;
    const { branchName, address, phone, email } = req.body;

    try {
        // Verify branch exists and is actually a branch
        const check = await pool.query(
            `SELECT id, is_branch FROM businesses WHERE id = $1`,
            [id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        if (!check.rows[0].is_branch) {
            return res.status(400).json({ error: 'Cannot update main business via this endpoint' });
        }

        // Build dynamic update
        const result = await pool.query(
            `UPDATE businesses
             SET
                business_name = COALESCE($1, business_name),
                branch_name = COALESCE($1, branch_name),
                address = COALESCE($2, address),
                phone = COALESCE($3, phone),
                email = COALESCE($4, email),
                updated_at = NOW()
             WHERE id = $5
             RETURNING id, business_name, branch_name, branch_code, 
                       address, phone, email, subscription_status, 
                       parent_id, is_branch`,
            [branchName, address, phone, email, id]
        );

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Update branch error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── TOGGLE BRANCH STATUS (ACTIVE / INACTIVE) ─────────────────────────
router.patch('/branches/:id/status', adminAuth, async (req, res) => {
    const { id } = req.params;
    const { subscription_status } = req.body;

    const validStatuses = ['ACTIVE', 'INACTIVE', 'TRIAL', 'EXPIRED'];
    if (!validStatuses.includes(subscription_status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        const result = await pool.query(
            `UPDATE businesses
             SET subscription_status = $1, updated_at = NOW()
             WHERE id = $2 AND is_branch = true
             RETURNING id, business_name, branch_name, subscription_status`,
            [subscription_status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Toggle branch status error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── DELETE BRANCH ────────────────────────────────────────────────────
router.delete('/branches/:id', adminAuth, async (req, res) => {
    const { id } = req.params;

    try {
        // Verify it's a branch (not a main business)
        const check = await pool.query(
            `SELECT id, is_branch, is_main_branch FROM businesses WHERE id = $1`,
            [id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Branch not found' });
        }

        if (!check.rows[0].is_branch) {
            return res.status(400).json({
                error: 'Cannot delete main business via this endpoint. Use DELETE /businesses/:id'
            });
        }

        // Delete (cascade will remove all related data)
        await pool.query(
            `DELETE FROM businesses WHERE id = $1`,
            [id]
        );

        res.json({
            success: true,
            message: 'Branch deleted successfully'
        });

    } catch (error) {
        console.error('Delete branch error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
module.exports = router;