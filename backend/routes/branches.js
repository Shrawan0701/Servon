const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// ─── GET ALL BRANCHES ─────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
    try {
        const businessId = req.parentBusinessId || req.businessId;
        
        const result = await pool.query(
            `SELECT id, business_name, branch_name, branch_code, 
                    is_main_branch, is_branch, parent_id, created_at
             FROM businesses 
             WHERE (id = $1 OR parent_id = $1) AND is_active != false
             ORDER BY is_main_branch DESC, created_at ASC`,
            [businessId]
        );
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Branches error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── CREATE NEW BRANCH ────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
    try {
        const { branchName, branchCode, address, phone, email } = req.body;
        const parentId = req.parentBusinessId || req.businessId;
        
        if (!branchName) {
            return res.status(400).json({ error: 'Branch name is required' });
        }
        
        // Generate branch code if not provided
        let finalBranchCode = branchCode;
        if (!finalBranchCode) {
            finalBranchCode = `BR-${Date.now().toString(36).toUpperCase()}`;
        }
        
        // Check branch code uniqueness
        const codeCheck = await pool.query(
            `SELECT id FROM businesses WHERE branch_code = $1`,
            [finalBranchCode]
        );
        if (codeCheck.rows.length > 0) {
            return res.status(409).json({ error: 'Branch code already exists' });
        }
        
        const finalEmail = email || `branch-${finalBranchCode.toLowerCase()}@servon.com`;
        
        const result = await pool.query(
            `INSERT INTO businesses (
                id, business_name, branch_name, branch_code,
                owner_name, email, phone, password_hash,
                subscription_status, parent_id, is_branch, 
                is_main_branch, created_at
            ) VALUES (
                gen_random_uuid(), $1, $2, $3,
                $4, $5, $6, $7,
                'ACTIVE', $8, true, false, NOW()
            ) RETURNING id, business_name, branch_name, branch_code`,
            [
                branchName,
                branchName,
                finalBranchCode,
                req.business?.owner_name || 'Branch Manager',
                finalEmail,
                phone || '',
                'branch_placeholder_hash',
                parentId
            ]
        );
        
        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Create branch error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── GET SINGLE BRANCH ────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.parentBusinessId || req.businessId;
        
        const result = await pool.query(
            `SELECT id, business_name, branch_name, branch_code, 
                    address, phone, email, is_main_branch, created_at
             FROM businesses 
             WHERE id = $1 AND (id = $2 OR parent_id = $2)`,
            [id, businessId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Branch not found' });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Branch details error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── UPDATE BRANCH ────────────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { branchName, address, phone, email } = req.body;
        const businessId = req.parentBusinessId || req.businessId;
        
        const result = await pool.query(
            `UPDATE businesses 
             SET business_name = COALESCE($1, business_name),
                 branch_name = COALESCE($1, branch_name),
                 address = COALESCE($2, address),
                 phone = COALESCE($3, phone),
                 email = COALESCE($4, email),
                 updated_at = NOW()
             WHERE id = $5 AND (id = $6 OR parent_id = $6)
             RETURNING id, business_name, branch_name, branch_code`,
            [branchName, address, phone, email, id, businessId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Branch not found' });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update branch error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── DELETE BRANCH (Soft Delete) ──────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.parentBusinessId || req.businessId;
        
        // Don't allow deleting main branch
        const check = await pool.query(
            `SELECT is_main_branch FROM businesses WHERE id = $1`,
            [id]
        );
        
        if (check.rows[0]?.is_main_branch) {
            return res.status(400).json({ error: 'Cannot delete main branch' });
        }
        
        const result = await pool.query(
            `UPDATE businesses SET is_active = false 
             WHERE id = $1 AND parent_id = $2
             RETURNING id`,
            [id, businessId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Branch not found' });
        }
        
        res.json({ success: true, message: 'Branch deleted' });
    } catch (error) {
        console.error('Delete branch error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;