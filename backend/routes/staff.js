const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

/**
 * GET /staff
 * Get all staff members for the authenticated business with current month payment status
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const businessId = req.businessId;
        const currentMonth = new Date().toISOString().slice(0, 7);

        const query = `
            SELECT 
                s.*,
                CASE 
                    WHEN sp.id IS NOT NULL THEN true 
                    ELSE false 
                END as salary_paid_current_month,
                sp.id as payment_id,
                sp.paid_date as payment_date,
                sp.notes as payment_notes
            FROM staff s
            LEFT JOIN salary_payments sp ON 
                s.id = sp.staff_id 
                AND sp.month = $2
            WHERE s.business_id = $1 
                AND s.is_active = true
            ORDER BY s.created_at DESC
        `;

        const result = await pool.query(query, [businessId, currentMonth]);
        
        const statsQuery = `
            SELECT 
                COUNT(*) as total_staff,
                COUNT(CASE WHEN sp.id IS NOT NULL THEN 1 END) as paid_this_month,
                COUNT(CASE WHEN sp.id IS NULL THEN 1 END) as pending_payment
            FROM staff s
            LEFT JOIN salary_payments sp ON 
                s.id = sp.staff_id 
                AND sp.month = $2
            WHERE s.business_id = $1 
                AND s.is_active = true
        `;
        
        const statsResult = await pool.query(statsQuery, [businessId, currentMonth]);

        res.json({
            staff: result.rows,
            stats: statsResult.rows[0]
        });
    } catch (error) {
        console.error('Error fetching staff:', error);
        res.status(500).json({ error: 'Failed to fetch staff members' });
    }
});

/**
 * GET /staff/:id
 * Get staff by ID with salary history
 */
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;
        const currentMonth = new Date().toISOString().slice(0, 7);

        const staffQuery = `
            SELECT * FROM staff 
            WHERE id = $1 AND business_id = $2 AND is_active = true
        `;
        const staffResult = await pool.query(staffQuery, [id, businessId]);

        if (staffResult.rows.length === 0) {
            return res.status(404).json({ error: 'Staff member not found' });
        }

        const staff = staffResult.rows[0];

        const salaryHistoryQuery = `
            SELECT * FROM salary_payments 
            WHERE staff_id = $1 
            ORDER BY month DESC
        `;
        const salaryHistoryResult = await pool.query(salaryHistoryQuery, [id]);

        const currentMonthQuery = `
            SELECT * FROM salary_payments 
            WHERE staff_id = $1 AND month = $2
        `;
        const currentMonthResult = await pool.query(currentMonthQuery, [id, currentMonth]);

        res.json({
            ...staff,
            salary_history: salaryHistoryResult.rows,
            current_month_paid: currentMonthResult.rows.length > 0,
            current_month_payment: currentMonthResult.rows[0] || null
        });
    } catch (error) {
        console.error('Error fetching staff details:', error);
        res.status(500).json({ error: 'Failed to fetch staff details' });
    }
});

/**
 * POST /staff
 * Create new staff member
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const businessId = req.businessId;
        const { name, email, phone, role, joining_date, monthly_salary } = req.body;

        if (!name || !phone || !role || !joining_date || monthly_salary === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (monthly_salary < 0) {
            return res.status(400).json({ error: 'Monthly salary cannot be negative' });
        }

        const query = `
            INSERT INTO staff (
                business_id, name, email, phone, role, 
                joining_date, monthly_salary
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;

        const values = [businessId, name, email, phone, role, joining_date, monthly_salary];
        const result = await pool.query(query, values);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating staff:', error);
        res.status(500).json({ error: 'Failed to create staff member' });
    }
});

/**
 * PUT /staff/:id
 * Update staff member
 */
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;
        const { name, email, phone, role, joining_date, monthly_salary, is_active } = req.body;

        const checkQuery = 'SELECT id FROM staff WHERE id = $1 AND business_id = $2';
        const checkResult = await pool.query(checkQuery, [id, businessId]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Staff member not found' });
        }

        const updates = [];
        const values = [];
        let paramCount = 1;

        if (name !== undefined) {
            updates.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (email !== undefined) {
            updates.push(`email = $${paramCount++}`);
            values.push(email);
        }
        if (phone !== undefined) {
            updates.push(`phone = $${paramCount++}`);
            values.push(phone);
        }
        if (role !== undefined) {
            updates.push(`role = $${paramCount++}`);
            values.push(role);
        }
        if (joining_date !== undefined) {
            updates.push(`joining_date = $${paramCount++}`);
            values.push(joining_date);
        }
        if (monthly_salary !== undefined) {
            if (monthly_salary < 0) {
                return res.status(400).json({ error: 'Monthly salary cannot be negative' });
            }
            updates.push(`monthly_salary = $${paramCount++}`);
            values.push(monthly_salary);
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramCount++}`);
            values.push(is_active);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(id);
        const query = `
            UPDATE staff 
            SET ${updates.join(', ')} 
            WHERE id = $${paramCount} AND business_id = $${paramCount + 1}
            RETURNING *
        `;

        values.push(businessId);
        const result = await pool.query(query, values);

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating staff:', error);
        res.status(500).json({ error: 'Failed to update staff member' });
    }
});

/**
 * DELETE /staff/:id
 * Delete staff member - HARD DELETE (direct removal from database)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;

        const checkQuery = 'SELECT id, name FROM staff WHERE id = $1 AND business_id = $2 AND is_active = true';
        const checkResult = await pool.query(checkQuery, [id, businessId]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Staff member not found or already deleted'
            });
        }

        const deleteQuery = 'DELETE FROM staff WHERE id = $1 AND business_id = $2 RETURNING id, name';
        const deleteResult = await pool.query(deleteQuery, [id, businessId]);

        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Failed to delete staff member' });
        }

        res.json({ 
            message: 'Staff member deleted successfully',
            deleted: deleteResult.rows[0]
        });

    } catch (error) {
        console.error('Error deleting staff:', error);
        res.status(500).json({ 
            error: 'Failed to delete staff member',
            details: error.message 
        });
    }
});

/**
 * POST /staff/:id/salary/pay
 * Mark salary as paid for current month
 */
router.post('/:id/salary/pay', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const businessId = req.businessId;
        const { amount, notes } = req.body;
        const currentMonth = new Date().toISOString().slice(0, 7);

        const staffQuery = 'SELECT monthly_salary FROM staff WHERE id = $1 AND business_id = $2 AND is_active = true';
        const staffResult = await pool.query(staffQuery, [id, businessId]);

        if (staffResult.rows.length === 0) {
            return res.status(404).json({ error: 'Staff member not found' });
        }

        const salaryAmount = amount || staffResult.rows[0].monthly_salary;

        const checkQuery = 'SELECT id FROM salary_payments WHERE staff_id = $1 AND month = $2';
        const checkResult = await pool.query(checkQuery, [id, currentMonth]);

        if (checkResult.rows.length > 0) {
            return res.status(400).json({ error: 'Salary already paid for this month' });
        }

        const insertQuery = `
            INSERT INTO salary_payments (staff_id, month, amount, notes)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;

        const result = await pool.query(insertQuery, [id, currentMonth, salaryAmount, notes]);

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error marking salary as paid:', error);
        res.status(500).json({ error: 'Failed to mark salary as paid' });
    }
});

module.exports = router;