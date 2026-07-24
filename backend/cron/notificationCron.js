// cron/notificationCron.js

const cron = require('node-cron');
const NotificationProcessor = require('../services/notificationProcessor');

// Run every hour
cron.schedule('0 * * * *', async () => {
    console.log('⏰ Running notification cron job...');
    console.log(`📅 Time: ${new Date().toLocaleString()}`);
    
    try {
        const result = await NotificationProcessor.processPendingNotifications();
        console.log(`✅ Cron job completed: ${result.processed} sent, ${result.failed} failed`);
    } catch (error) {
        console.error('❌ Cron job failed:', error);
    }
});

console.log('✅ Notification cron job scheduled (runs every hour)');

// For testing only - run immediately on start
// Uncomment below to test immediately
// setTimeout(async () => {
//     console.log('🧪 Running initial test...');
//     await NotificationProcessor.processPendingNotifications();
// }, 5000);