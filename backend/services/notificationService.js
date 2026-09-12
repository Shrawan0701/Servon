// services/notificationService.js

const { query } = require('../db/index');

class NotificationService {
    
    /**
     * 3.2.1: Queue a notification
     */
    static async queueNotification({ businessId, branchId, type, title, message, scheduledFor }) {
        console.log(`📬 Queuing notification: ${type} for business: ${businessId}, branch: ${branchId || businessId}`);
        
        // ✅ Use branchId if provided, fall back to businessId
        const finalBranchId = branchId || businessId;
        
        const result = await query(
            `INSERT INTO notifications (
                business_id,
                branch_id,
                type,
                title,
                message,
                scheduled_for,
                status,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW())
            RETURNING id, business_id, branch_id, type, title, message, scheduled_for, status`,
            [businessId, finalBranchId, type, title, message, scheduledFor || new Date()]
        );
        
        console.log(`✅ Notification queued with ID: ${result.rows[0].id} for branch ${finalBranchId}`);
        return result.rows[0];
    }
    
    /**
     * 3.2.2: Get pending notifications (for cron job)
     */
    static async getPendingNotifications() {
        const result = await query(
            `SELECT * FROM notifications 
             WHERE status = 'pending' 
             AND scheduled_for <= NOW()
             ORDER BY scheduled_for ASC`
        );
        
        return result.rows;
    }
    
    /**
     * 3.2.3: Mark notification as sent
     */
    static async markAsSent(notificationId) {
        const result = await query(
            `UPDATE notifications 
             SET 
                status = 'sent',
                sent_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [notificationId]
        );
        
        return result.rows[0];
    }
    
    /**
     * 3.2.4: Mark notification as failed
     */
    static async markAsFailed(notificationId, error) {
        const result = await query(
            `UPDATE notifications 
             SET 
                status = 'failed'
             WHERE id = $1
             RETURNING *`,
            [notificationId]
        );
        
        console.error(`❌ Notification ${notificationId} failed: ${error}`);
        return result.rows[0];
    }
    
    /**
     * 3.2.5: Get unread notifications for a specific branch
     * ✅ Uses strict branch_id filter
     */
    static async getUnreadNotifications(businessId) {
        // ✅ businessId is now the filterId (branch ID or business ID)
        const result = await query(
            `SELECT 
                id,
                branch_id,
                type,
                title,
                message,
                is_read,
                created_at
             FROM notifications 
             WHERE branch_id = $1 
             AND is_read = false
             AND status = 'sent'
             ORDER BY created_at DESC`,
            [businessId]  // ✅ Filter by branch_id
        );
        
        return result.rows;
    }
    
    /**
     * 3.2.6: Mark notification as read
     */
    static async markAsRead(notificationId) {
        const result = await query(
            `UPDATE notifications 
             SET is_read = true 
             WHERE id = $1
             RETURNING *`,
            [notificationId]
        );
        
        return result.rows[0];
    }
    
    /**
     * 3.2.7: Get unread count for badge
     * ✅ Uses strict branch_id filter
     */
    static async getUnreadCount(businessId) {
        const result = await query(
            `SELECT COUNT(*) as count 
             FROM notifications 
             WHERE branch_id = $1 
             AND is_read = false
             AND status = 'sent'`,
            [businessId]  // ✅ Filter by branch_id
        );
        
        return parseInt(result.rows[0].count);
    }

    // ===== PUSH TOKEN MANAGEMENT =====

    static async savePushToken(businessId, token, platform = 'unknown') {
        const result = await query(
            `INSERT INTO push_tokens (business_id, token, platform)
             VALUES ($1, $2, $3)
             ON CONFLICT (business_id, token)
             DO UPDATE SET platform = EXCLUDED.platform, created_at = NOW()
             RETURNING *`,
            [businessId, token, platform]
        );
        return result.rows[0];
    }

    static async getPushTokens(businessId) {
        const result = await query(
            `SELECT token FROM push_tokens WHERE business_id = $1`,
            [businessId]
        );
        return result.rows.map(r => r.token);
    }

    static async removePushToken(businessId, token) {
        await query(
            `DELETE FROM push_tokens WHERE business_id = $1 AND token = $2`,
            [businessId, token]
        );
    }
}

module.exports = NotificationService;