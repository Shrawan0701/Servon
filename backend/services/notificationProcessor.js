// services/notificationProcessor.js

const NotificationService = require('./notificationService');
const sendPush = require('./utils/pushNotify');
const { getIO } = require('../socket');

class NotificationProcessor {
    
    /**
     * Process all pending notifications
     * This should be called by a cron job every hour
     */
    static async processPendingNotifications() {
        console.log('🔄 Processing pending notifications...');
        
        try {
            // Get all pending notifications
            const notifications = await NotificationService.getPendingNotifications();
            
            if (notifications.length === 0) {
                console.log('No pending notifications to process');
                return { processed: 0, failed: 0 };
            }
            
            console.log(`📬 Found ${notifications.length} pending notifications`);
            
            let processed = 0;
            let failed = 0;
            
            for (const notification of notifications) {
                try {
                    // 1) Emit socket event to business room for real-time in-app notification
                    try {
                        const io = getIO();
                        io.to(`business_${notification.business_id}`).emit('new_notification', notification);
                    } catch (socketErr) {
                        console.warn('Socket emit failed:', socketErr.message);
                    }

                    // 2) Send push notification to the business owner's device(s)
                    try {
                        const tokens = await NotificationService.getPushTokens(notification.business_id);
                        if (tokens.length > 0) {
                            await sendPush(tokens, notification.title || 'Servon', notification.message);
                        }
                    } catch (pushErr) {
                        console.warn('Push send failed:', pushErr.message);
                    }

                    await NotificationService.markAsSent(notification.id);
                    processed++;
                    console.log(`✅ Sent notification: ${notification.id} (${notification.type})`);
                } catch (error) {
                    console.error(`❌ Failed to send notification ${notification.id}:`, error);
                    await NotificationService.markAsFailed(notification.id, error.message);
                    failed++;
                }
            }
            
            console.log(`✅ Processed ${processed} notifications, ${failed} failed`);
            return { processed, failed };
            
        } catch (error) {
            console.error('❌ Error processing notifications:', error);
            throw error;
        }
    }
}

module.exports = NotificationProcessor;