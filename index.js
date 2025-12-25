require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { swaggerUi, specs } = require("./swagger");

const app = express();

// ================== Middleware ==================
app.use(cors());
app.use(express.json());

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// ================== Database Config ==================
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'db_68319010061',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'SECRET_KEY';

// Create Pool
const pool = mysql.createPool(dbConfig);

// Test DB
pool.getConnection()
  .then(conn => {
    console.log('✅ Database connected:', dbConfig.database);
    conn.release();
  })
  .catch(err => {
    console.error('❌ DB Error:', err.message);
  });

// ================== Auth Middleware ==================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'ไม่มี Token' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ success: false, message: 'Token ไม่ถูกต้อง' });
    }
    req.user = user;
    next();
  });
};

// ================== Register ==================
/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: สมัครสมาชิก
 *     tags: [Auth]
 */
app.post('/auth/register', async (req, res) => {
  const { username, password, email } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ success: false, message: 'กรอกข้อมูลไม่ครบ' });
  }

  try {
    const [exists] = await pool.query(
      'SELECT * FROM tbl_customers WHERE username = ?',
      [username]
    );

    if (exists.length > 0) {
      return res.status(400).json({ success: false, message: 'Username ซ้ำ' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO tbl_customers (username, password, email)
       VALUES (?, ?, ?)`,
      [username, hashedPassword, email]
    );

    const token = jwt.sign(
      { customer_id: result.insertId, username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(201).json({
      success: true,
      message: 'ลงทะเบียนสำเร็จ',
      token
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================== Login ==================
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: เข้าสู่ระบบ
 *     tags: [Auth]
 */
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });
  }

  try {
    const [users] = await pool.query(
      'SELECT * FROM tbl_customers WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
    }

    const token = jwt.sign(
      { customer_id: user.customer_id, username: user.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ success: true, token });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================== Customers (Protected) ==================
app.get('/customers', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT customer_id, username, email FROM tbl_customers'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================== Start Server ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📘 Swagger Docs: http://localhost:${PORT}/api-docs`);
});
