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


// ─── GET ALL RESTAURANTS ──────────────────────────────────────────────────────
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
                created_at
             FROM businesses
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


// ─── CREATE RESTAURANT ─────────────────────────────────────────────────────────
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
        return res.status(400).json({
            error: 'All fields are required'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Normalize referral code
        const normalizedReferralCode = referralCode
            ? referralCode.trim().toUpperCase()
            : null;


        // ─── 1. CHECK EXISTING EMAIL / PHONE ────────────────────────────────
        const existing = await client.query(
            `SELECT id
             FROM businesses
             WHERE email = $1 OR phone = $2`,
            [email, phone]
        );

        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');

            return res.status(409).json({
                error: 'Email or phone already registered'
            });
        }


        // ─── 2. VALIDATE REFERRAL CODE ─────────────────────────────────────
        let referrerId = null;

        if (normalizedReferralCode) {

            const referrerResult = await client.query(
                `SELECT id, business_name, referral_code
                 FROM businesses
                 WHERE UPPER(referral_code) = $1
                 LIMIT 1`,
                [normalizedReferralCode]
            );

            if (referrerResult.rows.length === 0) {
                await client.query('ROLLBACK');

                return res.status(400).json({
                    error: 'Invalid referral code'
                });
            }

            referrerId = referrerResult.rows[0].id;
        }


        // ─── 3. GENERATE NEW BUSINESS REFERRAL CODE ─────────────────────────
        const baseName = businessName
            .substring(0, 4)
            .toUpperCase()
            .replace(/\s/g, '');

        let newReferralCode;
        let codeExists = true;

        // Keep generating until we get a unique referral code
        while (codeExists) {

            newReferralCode =
                baseName + Math.floor(1000 + Math.random() * 9000);

            const codeCheck = await client.query(
                `SELECT id
                 FROM businesses
                 WHERE referral_code = $1`,
                [newReferralCode]
            );

            codeExists = codeCheck.rows.length > 0;
        }


        // ─── 4. HASH PASSWORD ───────────────────────────────────────────────
        const passwordHash = await bcrypt.hash(password, 12);


        // ─── 5. CREATE BUSINESS ─────────────────────────────────────────────
        const result = await client.query(
            `INSERT INTO businesses
            (
                business_name,
                owner_name,
                email,
                phone,
                password_hash,
                subscription_status,
                referral_code,
                referred_by,
                is_trial_used,
                trial_start_date,
                trial_end_date
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5,
                'TRIAL',
                $6,
                $7,
                true,
                NOW(),
                NOW() + INTERVAL '3 days'
            )
            RETURNING
                id,
                business_name,
                owner_name,
                email,
                phone,
                subscription_status,
                referral_code,
                referred_by,
                is_trial_used,
                trial_start_date,
                trial_end_date`,
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


        // ─── 6. CREATE REFERRAL RECORD ──────────────────────────────────────
        if (referrerId) {

            await client.query(
                `INSERT INTO referrals
                (
                    referrer_id,
                    referred_id,
                    status
                )
                VALUES
                (
                    $1,
                    $2,
                    'PENDING'
                )`,
                [
                    referrerId,
                    business.id
                ]
            );
        }


        // ─── 7. COMMIT EVERYTHING ───────────────────────────────────────────
        await client.query('COMMIT');


        console.log('========================================');
        console.log('✅ ADMIN BUSINESS CREATED');
        console.log('Business ID:', business.id);
        console.log('Business:', business.business_name);
        console.log('Referral Code:', business.referral_code);
        console.log('Referred By:', business.referred_by);
        console.log('Used Referral Code:', normalizedReferralCode);
        console.log('========================================');


        res.status(201).json({
            success: true,
            data: business
        });

    } catch (error) {

        await client.query('ROLLBACK');

        console.error('Create business error:', error);

        res.status(500).json({
            error: 'Server error'
        });

    } finally {
        client.release();
    }
});


// ─── UPDATE RESTAURANT ────────────────────────────────────────────────────────
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
                id,
                business_name,
                owner_name,
                email,
                phone,
                subscription_status`,
            [
                business_name,
                owner_name,
                email,
                phone,
                subscription_status,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Business not found'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {

        console.error('Update business error:', error);

        res.status(500).json({
            error: 'Server error'
        });
    }
});


// ─── DELETE RESTAURANT ────────────────────────────────────────────────────────
router.delete('/businesses/:id', adminAuth, async (req, res) => {

    const { id } = req.params;

    try {

        const result = await pool.query(
            `DELETE FROM businesses
             WHERE id = $1
             RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Business not found'
            });
        }

        res.json({
            success: true,
            message: 'Business deleted'
        });

    } catch (error) {

        console.error('Delete business error:', error);

        res.status(500).json({
            error: 'Server error'
        });
    }
});


module.exports = router;