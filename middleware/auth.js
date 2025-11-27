// middleware/auth.js
require('dotenv').config({ path: '.env.local' });
const jwt = require('jsonwebtoken');
const SECRET_KEY = process.env.JWT_SECRET;

// ตรวจสอบว่ามี JWT_SECRET หรือไม่
if (!SECRET_KEY) {
  console.error('⚠️  JWT_SECRET is not defined in .env.local');
  process.exit(1);
}

/**
 * Middleware ตรวจสอบ JWT Token
 * ใช้กับ route ที่ต้องการการ authentication
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      error: 'No token provided',
      message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน'
    });
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      // แยก error message ให้ชัดเจนขึ้น
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false,
          error: 'Token has expired',
          message: 'Token หมดอายุ กรุณาเข้าสู่ระบบใหม่'
        });
      } else if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({ 
          success: false,
          error: 'Invalid token',
          message: 'Token ไม่ถูกต้อง'
        });
      }
      return res.status(403).json({ 
        success: false,
        error: 'Token verification failed',
        message: 'การตรวจสอบ Token ล้มเหลว'
      });
    }
    
    // เก็บข้อมูล user จาก token payload
    req.user = decoded;
    next();
  });
}

/**
 * Middleware สำหรับตรวจสอบ Role (Advanced)
 * @param {Array} allowedRoles - ['admin', 'customer', 'restaurant']
 * @example app.get('/admin/dashboard', verifyToken, verifyRole(['admin']), handler)
 */
function verifyRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        error: 'Unauthorized',
        message: 'ไม่พบข้อมูลผู้ใช้'
      });
    }
    
    if (allowedRoles.includes(req.user.role)) {
      next();
    } else {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied: Insufficient permissions',
        message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้'
      });
    }
  };
}

// Export ทั้งสองแบบเพื่อความยืดหยุ่น
module.exports = verifyToken; // Default export (ใช้ตอนนี้)
module.exports.verifyToken = verifyToken; // Named export
module.exports.verifyRole = verifyRole; // Named export