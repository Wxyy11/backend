const express = require('express');
const router = express.Router();
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'METjMXahPtaHtP5JmnGHzxL3gZYeDP23o';

// POST: เข้าสู่ระบบ (Login)
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ 
      success: false,
      message: 'กรุณากรอก username และ password' 
    });
  }

  try {
    const [users] = await db.query(
      'SELECT * FROM tbl_customers WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: 'Username หรือ Password ไม่ถูกต้อง' 
      });
    }

    const user = users[0];

    // ตรวจสอบ password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Username หรือ Password ไม่ถูกต้อง' 
      });
    }

    // สร้าง JWT token
    const token = jwt.sign(
      { 
        customer_id: user.customer_id,
        username: user.username 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ', 
      token: token,
      data: {
        customer_id: user.customer_id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('❌ Login Error:', error);
    res.status(500).json({ 
      success: false,
      message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ',
      error: error.message 
    });
  }
});

module.exports = router;