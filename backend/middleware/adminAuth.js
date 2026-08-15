const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const authHeader = req.header('Authorization');
    console.log('🔍 Auth Header:', authHeader);
    
    const token = authHeader?.replace('Bearer ', '');
    console.log('🔍 Token extracted:', token);
    console.log('🔍 Token length:', token?.length);
    
    if (!token) {
        console.log('❌ No token provided');
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    try {
        console.log('🔍 Verifying token with JWT_SECRET:', process.env.JWT_SECRET);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ Token verified:', decoded);
        
        if (decoded.role !== 'admin') {
            console.log('❌ Not admin role');
            return res.status(403).json({ error: 'Admin access required.' });
        }
        
        req.adminId = decoded.adminId;
        next();
    } catch (error) {
        console.error('❌ Token verification error:', error.message);
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
};