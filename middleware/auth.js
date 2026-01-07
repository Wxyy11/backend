const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'METjMXahPtaHtP5JmnGHzxL3gZYeDP23o';

function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'ไม่พบ Token กรุณาเข้าสู่ระบบ'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false,
          message: 'Token หมดอายุ กรุณาเข้าสู่ระบบใหม่'
        });
      }
      return res.status(403).json({ 
        success: false,
        message: 'Token ไม่ถูกต้อง'
      });
    }
    
    req.user = decoded;
    next();
  });
}

module.exports = verifyToken;