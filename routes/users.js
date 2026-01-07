const express = require("express");
const router = express.Router();
const db = require("../config/db");
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/auth');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'METjMXahPtaHtP5JmnGHzxL3gZYeDP23o';

// ==================== CUSTOMERS API (ใช้ tbl_customers เท่านั้น) ====================

/**
 * @openapi
 * /api/users/register:
 *   post:
 *     tags: [Users]
 *     summary: Register new user
 */
router.post('/register', async (req, res) => {
  const { username, password, email, phone, address, full_name } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ 
      success: false, 
      message: 'กรุณากรอก username, password และ email' 
    });
  }

  const connection = await db.getConnection();
  
  try {
    // ตรวจสอบ username ซ้ำ
    const [existingUsers] = await connection.query(
      'SELECT * FROM tbl_customers WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username นี้ถูกใช้งานแล้ว' 
      });
    }

    // ตรวจสอบ email ซ้ำ
    const [existingEmails] = await connection.query(
      'SELECT * FROM tbl_customers WHERE email = ?',
      [email]
    );

    if (existingEmails.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email นี้ถูกใช้งานแล้ว' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const customerFullName = full_name || username;

    // บันทึกข้อมูล
    const [result] = await connection.query(
      `INSERT INTO tbl_customers (username, password, email, phone, address, full_name, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [username, hashedPassword, email, phone || null, address || null, customerFullName]
    );

    // สร้าง Token
    const token = jwt.sign(
      { 
        customer_id: result.insertId, 
        username: username 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'ลงทะเบียนสำเร็จ',
      token: token,
      data: {
        customer_id: result.insertId,
        username: username,
        email: email,
        full_name: customerFullName
      }
    });

  } catch (error) {
    console.error('❌ Register Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการลงทะเบียน',
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: Get all users
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const [customers] = await db.query(
      `SELECT customer_id, username, full_name, email, phone, address, created_at 
       FROM tbl_customers 
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      message: 'ดึงข้อมูลผู้ใช้สำเร็จ',
      total: customers.length,
      data: customers
    });

  } catch (error) {
    console.error('❌ Get Users Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      error: error.message 
    });
  }
});

/**
 * @openapi
 * /api/users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get user profile
 */
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT customer_id, username, full_name, email, phone, address FROM tbl_customers WHERE customer_id = ?',
      [req.user.customer_id]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'ไม่พบข้อมูลผู้ใช้' 
      });
    }

    res.json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error('❌ Profile Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาด',
      error: error.message 
    });
  }
});

/**
 * @openapi
 * /api/users/profile:
 *   put:
 *     tags: [Users]
 *     summary: Update user profile
 */
router.put('/profile', verifyToken, async (req, res) => {
  const { full_name, email, phone, address } = req.body;
  
  const connection = await db.getConnection();
  
  try {
    await connection.query(
      `UPDATE tbl_customers 
       SET full_name = ?, email = ?, phone = ?, address = ?
       WHERE customer_id = ?`,
      [full_name, email, phone, address, req.user.customer_id]
    );

    res.json({
      success: true,
      message: 'อัพเดทข้อมูลสำเร็จ'
    });

  } catch (error) {
    console.error('❌ Update Profile Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล',
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID
 */
router.get('/:id', verifyToken, async (req, res) => {
  const customerId = req.params.id;

  try {
    const [users] = await db.query(
      'SELECT customer_id, username, full_name, email, phone, address, created_at FROM tbl_customers WHERE customer_id = ?',
      [customerId]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'ไม่พบข้อมูลผู้ใช้' 
      });
    }

    res.json({
      success: true,
      data: users[0]
    });

  } catch (error) {
    console.error('❌ Get User by ID Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาด',
      error: error.message 
    });
  }
});

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Update user by ID
 */
router.put('/:id', verifyToken, async (req, res) => {
  const customerId = req.params.id;
  const { full_name, email, phone, address } = req.body;
  
  const connection = await db.getConnection();
  
  try {
    const [users] = await connection.query(
      'SELECT customer_id FROM tbl_customers WHERE customer_id = ?',
      [customerId]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'ไม่พบข้อมูลผู้ใช้' 
      });
    }

    await connection.query(
      `UPDATE tbl_customers 
       SET full_name = ?, email = ?, phone = ?, address = ?
       WHERE customer_id = ?`,
      [full_name, email, phone, address, customerId]
    );

    res.json({
      success: true,
      message: 'อัพเดทข้อมูลผู้ใช้สำเร็จ',
      data: {
        customer_id: parseInt(customerId),
        full_name,
        email,
        phone,
        address
      }
    });

  } catch (error) {
    console.error('❌ Update User Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล',
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete user by ID
 */
router.delete('/:id', verifyToken, async (req, res) => {
  const customerId = req.params.id;

  const connection = await db.getConnection();
  
  try {
    const [users] = await connection.query(
      'SELECT customer_id, username FROM tbl_customers WHERE customer_id = ?',
      [customerId]
    );

    if (users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'ไม่พบข้อมูลผู้ใช้' 
      });
    }

    await connection.query(
      'DELETE FROM tbl_customers WHERE customer_id = ?',
      [customerId]
    );

    res.json({
      success: true,
      message: 'ลบข้อมูลผู้ใช้สำเร็จ',
      data: {
        customer_id: parseInt(customerId),
        username: users[0].username
      }
    });

  } catch (error) {
    console.error('❌ Delete User Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'เกิดข้อผิดพลาดในการลบข้อมูล',
      error: error.message 
    });
  } finally {
    connection.release();
  }
});

module.exports = router;