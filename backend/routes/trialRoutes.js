// routes/trialRoutes.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const TrialService = require('../services/trialService');
const NotificationService = require('../services/notificationService');

/**
 * Get trial status
 * GET /api/trial/status
 */
router.get('/status', auth, async (req, res) => {
    try {
        const businessId = req.businessId || req.query.businessId;
        
        if (!businessId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized. Please log in.'
            });
        }
        
        const status = await TrialService.checkTrialStatus(businessId);
        
        res.json({
            success: true,
            data: status
        });
        
    } catch (error) {
        console.error('Error checking trial status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check trial status',
            error: error.message
        });
    }
});

/**
 * Check if business has access
 * GET /api/trial/access
 */
router.get('/access', auth, async (req, res) => {
    try {
        const businessId = req.businessId;
        
        if (!businessId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized. Please log in.'
            });
        }
        
        const hasAccess = await TrialService.hasAccess(businessId);
        
        res.json({
            success: true,
            data: { hasAccess }
        });
        
    } catch (error) {
        console.error('Error checking access:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check access',
            error: error.message
        });
    }
});

/**
 * Get days remaining in trial
 * GET /api/trial/days-remaining
 */
router.get('/days-remaining', auth, async (req, res) => {
    try {
        const businessId = req.businessId;
        
        if (!businessId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized. Please log in.'
            });
        }
        
        const daysRemaining = await TrialService.getDaysRemaining(businessId);
        
        res.json({
            success: true,
            data: { daysRemaining }
        });
        
    } catch (error) {
        console.error('Error getting days remaining:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get days remaining',
            error: error.message
        });
    }
});

/**
 * Get unread notifications
 * GET /api/trial/notifications
 */
router.get('/notifications', auth, async (req, res) => {
    try {
        const businessId = req.businessId;
        
        if (!businessId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized. Please log in.'
            });
        }
        
        const notifications = await NotificationService.getUnreadNotifications(businessId);
        const count = await NotificationService.getUnreadCount(businessId);
        
        res.json({
            success: true,
            data: {
                notifications,
                unreadCount: count
            }
        });
        
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications',
            error: error.message
        });
    }
});

/**
 * Mark notification as read
 * PUT /api/trial/notifications/:id/read
 */
router.put('/notifications/:id/read', auth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const notification = await NotificationService.markAsRead(id);
        
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }
        
        res.json({
            success: true,
            data: notification
        });
        
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notification as read',
            error: error.message
        });
    }
});

module.exports = router;