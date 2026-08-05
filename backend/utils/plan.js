const PLANS = {
    monthly: {
        amount: 99900, // in paise (₹999)
        days: 30,
        label: 'Monthly',
        displayName: 'Monthly',
        description: 'Billed monthly',
    },
    quarterly: {
        amount: 250000, // in paise (₹2,500)
        days: 90,
        label: 'Quarterly',
        displayName: 'Quarterly',
        description: 'Billed quarterly (Save 37%)',
    },
    yearly: {
        amount: 600000, // in paise (₹6,000)
        days: 365,
        label: 'Yearly',
        displayName: 'Yearly',
        description: 'Billed yearly (Save 50%)',
    },
};

function getPlanDetails(planType) {
    return PLANS[planType] || PLANS.monthly;
}

function getSubscriptionEndDate(days) {
    const now = new Date();
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

function getPlanDisplayName(planType) {
    const plan = getPlanDetails(planType);
    return plan.displayName || plan.label || 'Monthly';
}

module.exports = {
    PLANS,
    getPlanDetails,
    getSubscriptionEndDate,
    getPlanDisplayName,
};