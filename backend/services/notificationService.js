// services/notificationService.js

const { query } = require('../db/index');

class NotificationService {
    
    /**
     * 3.2.1: Queue a notification
     * @param {Object} data - Notification data
     * @param {string} data.businessId - Business ID
     * @param {string} data.type - Notification type
     * @param {string} data.title - Notification title
     * @param {string} data.message - Notification message
     * @param {Date} data.scheduledFor - When to send
     * @returns {Object} Created notification
     */
    static async queueNotification({ businessId, type, title, message, scheduledFor }) {
        console.log(`📬 Queuing notification: ${type} for business: ${businessId}`);
        
        const result = await query(
            `INSERT INTO notifications (
                business_id,
                type,
                title,
                message,
                scheduled_for,
                status,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
            RETURNING id, business_id, type, title, message, scheduled_for, status`,
            [businessId, type, title, message, scheduledFor || new Date()]
        );
        
        console.log(`✅ Notification queued with ID: ${result.rows[0].id}`);
        return result.rows[0];
    }
    
    /**
     * 3.2.2: Get pending notifications (for cron job)
     * @returns {Array} Pending notifications
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
     * @param {string} notificationId - Notification ID
     * @returns {Object} Updated notification
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
     * @param {string} notificationId - Notification ID
     * @param {string} error - Error message
     * @returns {Object} Updated notification
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
     * 3.2.5: Get unread notifications for business
     * @param {string} businessId - Business ID
     * @returns {Array} Unread notifications
     */
    static async getUnreadNotifications(businessId) {
        const result = await query(
            `SELECT 
                id,
                type,
                title,
                message,
                is_read,
                created_at
             FROM notifications 
             WHERE business_id = $1 
             AND is_read = false
             AND status = 'sent'
             ORDER BY created_at DESC`,
            [businessId]
        );
        
        return result.rows;
    }
    
    /**
     * 3.2.6: Mark notification as read
     * @param {string} notificationId - Notification ID
     * @returns {Object} Updated notification
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
     * 3.2.7: Get notification count for badge
     * @param {string} businessId - Business ID
     * @returns {number} Unread count
     */
    static async getUnreadCount(businessId) {
        const result = await query(
            `SELECT COUNT(*) as count 
             FROM notifications 
             WHERE business_id = $1 
             AND is_read = false
             AND status = 'sent'`,
            [businessId]
        );
        
        return parseInt(result.rows[0].count);
    }

    // ===== PUSH TOKEN MANAGEMENT =====

    /**
     * Save/register an Expo push token for a business
     */
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

    /**
     * Get all push tokens for a business
     */
    static async getPushTokens(businessId) {
        const result = await query(
            `SELECT token FROM push_tokens WHERE business_id = $1`,
            [businessId]
        );
        return result.rows.map(r => r.token);
    }

    /**
     * Remove a push token (e.g. on logout)
     */
    static async removePushToken(businessId, token) {
        await query(
            `DELETE FROM push_tokens WHERE business_id = $1 AND token = $2`,
            [businessId, token]
        );
    }
}

module.exports = NotificationService;