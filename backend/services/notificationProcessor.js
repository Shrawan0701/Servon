// services/notificationProcessor.js

const NotificationService = require('./notificationService');

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
                    // Here you would send push notification
                    // For now, just mark as sent
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