// services/notificationProcessor.js

const NotificationService = require('./notificationService');
const sendPush = require('./utils/pushNotify');
const { getIO } = require('../socket');

class NotificationProcessor {
    
    static async processPendingNotifications() {
        console.log('🔄 Processing pending notifications...');
        
        try {
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
                    // ✅ Emit to BOTH business room AND branch room
                    try {
                        const io = getIO();
                        io.to(`business_${notification.business_id}`).emit('new_notification', notification);
                        
                        // ✅ Also emit to branch-specific room
                        if (notification.branch_id && notification.branch_id !== notification.business_id) {
                            io.to(`branch_${notification.branch_id}`).emit('new_notification', notification);
                        }
                    } catch (socketErr) {
                        console.warn('Socket emit failed:', socketErr.message);
                    }

                    // ✅ Send push to branch-specific tokens
                    try {
                        const pushTarget = notification.branch_id || notification.business_id;
                        const tokens = await NotificationService.getPushTokens(pushTarget);
                        if (tokens.length > 0) {
                            await sendPush(tokens, notification.title || 'Servon', notification.message);
                        }
                    } catch (pushErr) {
                        console.warn('Push send failed:', pushErr.message);
                    }

                    await NotificationService.markAsSent(notification.id);
                    processed++;
                    console.log(`✅ Sent notification: ${notification.id} (${notification.type}) for branch ${notification.branch_id}`);
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