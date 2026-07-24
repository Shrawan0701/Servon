// services/trialService.js

const {query} = require('../db/index')// Your database connection
const notificationService = require('./notificationService');

const TRIAL_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

class TrialService {
    
    /**
     * 3.1: Start trial for a new business
     * @param {string} businessId - The business ID
     * @returns {Object} Trial details
     */
    static async startTrial(businessId) {
        console.log(`🚀 Starting trial for business: ${businessId}`);
        
        const startDate = new Date();
        const endDate = new Date(startDate.getTime() + (TRIAL_DAYS * MS_PER_DAY));
        
        // Update business with trial dates
        const result = await query(
            `UPDATE businesses 
             SET 
                trial_start_date = $1, 
                trial_end_date = $2,
                subscription_status = 'TRIAL',
                is_trial_used = true
             WHERE id = $3
             RETURNING id, business_name, email, trial_start_date, trial_end_date, subscription_status`,
            [startDate, endDate, businessId]
        );
        
        if (result.rows.length === 0) {
            throw new Error('Business not found');
        }
        
        const business = result.rows[0];
        console.log(`✅ Trial started for ${business.business_name}, ends on: ${endDate}`);
        
        // Queue notifications for the trial
        await this.queueTrialNotifications(businessId);
        
        return {
            businessId: business.id,
            businessName: business.business_name,
            startDate: business.trial_start_date,
            endDate: business.trial_end_date,
            daysRemaining: TRIAL_DAYS
        };
    }
    
    /**
     * 3.2: Queue trial notifications
     * @param {string} businessId - The business ID
     */
    static async queueTrialNotifications(businessId) {
        console.log(`📬 Queuing notifications for business: ${businessId}`);
        
        const now = new Date();
        
        // 1. Welcome notification (immediate)
        await notificationService.queueNotification({
            businessId: businessId,
            type: 'trial_started',
            title: '🎉 Free Trial Activated!',
            message: 'Enjoy 3 days of full access to Servon. Explore all features!',
            scheduledFor: now
        });
        
        // 2. Reminder notification (Day 2 - 24 hours from now)
        const reminderDate = new Date(now.getTime() + (1 * MS_PER_DAY));
        await notificationService.queueNotification({
            businessId: businessId,
            type: 'trial_reminder',
            title: '⏳ Your Trial Ends Tomorrow',
            message: "Don't miss out! Subscribe now to continue using Servon.",
            scheduledFor: reminderDate
        });
        
        // 3. Expiring notification (Day 3 - 48 hours from now)
        const expiringDate = new Date(now.getTime() + (2 * MS_PER_DAY));
        await notificationService.queueNotification({
            businessId: businessId,
            type: 'trial_expiring',
            title: '⚠️ Your Trial Expires Today!',
            message: 'Your 3-day trial ends today. Subscribe to keep access.',
            scheduledFor: expiringDate
        });
        
        console.log(`✅ Notifications queued for business: ${businessId}`);
    }
    
    /**
     * 3.3: Check trial status
     * @param {string} businessId - The business ID
     * @returns {Object} Trial status
     */
    static async checkTrialStatus(businessId) {
        console.log(`🔍 Checking trial status for business: ${businessId}`);
        
        const result = await query(
            `SELECT 
                id,
                business_name,
                email,
                subscription_status,
                trial_start_date,
                trial_end_date,
                is_trial_used
             FROM businesses 
             WHERE id = $1`,
            [businessId]
        );
        
        if (result.rows.length === 0) {
            throw new Error('Business not found');
        }
        
        const business = result.rows[0];
        
        // If business never started a trial
        if (!business.trial_start_date || !business.is_trial_used) {
            return {
                businessId: business.id,
                businessName: business.business_name,
                status: 'no_trial',
                isActive: false,
                daysRemaining: 0,
                canStartTrial: true
            };
        }
        
        const now = new Date();
        const endDate = new Date(business.trial_end_date);
        const daysRemaining = Math.ceil((endDate - now) / MS_PER_DAY);
        
        // Check if trial expired
        if (daysRemaining <= 0 && business.subscription_status === 'TRIAL') {
            // Auto-handle expired trial
            await this.handleTrialExpired(businessId);
            return {
                businessId: business.id,
                businessName: business.business_name,
                status: 'expired',
                isActive: false,
                daysRemaining: 0,
                canStartTrial: false
            };
        }
        
        // Paid subscription
        if (business.subscription_status === 'ACTIVE') {
            return {
                businessId: business.id,
                businessName: business.business_name,
                status: 'active',
                isActive: true,
                daysRemaining: 999,
                canStartTrial: false
            };
        }
        
        // Active trial
        return {
            businessId: business.id,
            businessName: business.business_name,
            status: 'trial',
            isActive: true,
            trialStart: business.trial_start_date,
            trialEnd: business.trial_end_date,
            daysRemaining: Math.max(0, daysRemaining),
            canStartTrial: false
        };
    }
    
    /**
     * 3.4: Handle expired trial
     * @param {string} businessId - The business ID
     */
    static async handleTrialExpired(businessId) {
        console.log(`⏰ Trial expired for business: ${businessId}`);
        
        const result = await query(
            `UPDATE businesses 
             SET subscription_status = 'EXPIRED'
             WHERE id = $1
             RETURNING id, business_name, email`,
            [businessId]
        );
        
        if (result.rows.length === 0) {
            throw new Error('Business not found');
        }
        
        const business = result.rows[0];
        
        // Send expired notification
        await notificationService.queueNotification({
            businessId: businessId,
            type: 'trial_expired',
            title: '🔒 Your Trial Has Expired',
            message: 'Please subscribe to continue using Servon.',
            scheduledFor: new Date()
        });
        
        console.log(`✅ Business ${business.business_name} marked as EXPIRED`);
        return business;
    }
    
    /**
     * 3.5: Check if business has access
     * @param {string} businessId - The business ID
     * @returns {boolean} True if has access
     */
    static async hasAccess(businessId) {
        const status = await this.checkTrialStatus(businessId);
        
        // Allow access if: active trial OR paid subscription
        if (status.isActive || status.status === 'active') {
            return true;
        }
        
        return false;
    }
    
    /**
     * 3.6: Get days remaining in trial
     * @param {string} businessId - The business ID
     * @returns {number} Days remaining
     */
    static async getDaysRemaining(businessId) {
        const status = await this.checkTrialStatus(businessId);
        return status.daysRemaining || 0;
    }
}

module.exports = TrialService;