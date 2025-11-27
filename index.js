const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ================== Database Config ==================
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3308,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'db_food_68319010058',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 30000
};

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'METjMXahPtaHtP5JmnGHzxL3gZYeDP23o';

// Create MySQL Pool
const pool = mysql.createPool(dbConfig);

// Test DB Connection
pool.getConnection()
  .then(connection => {
    console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ!');
    console.log('📊 Database:', dbConfig.database);
    connection.release();
  })
  .catch(err => {
    console.error('❌ เชื่อมต่อฐานข้อมูลไม่ได้:', err.message);
  });

// ================== Register ==================
app.post('/auth/register', async (req, res) => {
  const { username, password, email, phone, address, firstname, lastname } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ success: false, message: 'กรอกข้อมูลไม่ครบ' });
  }

  const connection = await pool.getConnection();

  try {
    const [checkUser] = await connection.query(
      'SELECT * FROM tbl_customers WHERE username = ?',
      [username]
    );

    if (checkUser.length > 0) {
      return res.status(400).json({ success: false, message: 'Username ซ้ำ' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const first = firstname || username;
    const last = lastname || '';

    const [result] = await connection.query(
      `INSERT INTO tbl_customers 
       (username, password, firstname, lastname, address, phone, email)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, first, last, address || null, phone || null, email]
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
  } finally {
    connection.release();
  }
});

// ================== Login ==================
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });
  }

  const connection = await pool.getConnection();

  try {
    const [users] = await connection.query(
      'SELECT * FROM tbl_customers WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
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
  } finally {
    connection.release();
  }
});

// ================== Middleware Auth ==================
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

// ================== GET Customers ==================
app.get('/customers', authenticateToken, async (req, res) => {
  try {
    const [customers] = await pool.query(
      `SELECT 
        customer_id, 
        username, 
        firstname, 
        lastname, 
        email 
       FROM tbl_customers`
    );

    res.json({ success: true, data: customers });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================== GET Menus + Restaurants ==================
app.get('/menus', async (req, res) => {
  try {
    const [menus] = await pool.query(`
      SELECT 
        m.menu_id,
        m.menu_name,
        m.description,
        m.price,
        r.restaurant_name
      FROM tbl_menus m
      JOIN tbl_restaurants r ON m.restaurant_id = r.restaurant_id
    `);

    res.json({ success: true, data: menus });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================== POST Orders ==================
app.post('/orders', authenticateToken, async (req, res) => {
  const { restaurant_id, menu_id, quantity } = req.body;

  if (!restaurant_id || !menu_id || !quantity) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [menus] = await connection.query(
      'SELECT price, menu_name FROM tbl_menus WHERE menu_id = ?',
      [menu_id]
    );

    if (menus.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'ไม่พบเมนู' });
    }

    const menu = menus[0];
    const total = menu.price * quantity;

    const [orderResult] = await connection.query(
      `INSERT INTO tbl_orders 
       (customer_id, restaurant_id, menu_id, quantity, total_price, status)
       VALUES (?, ?, ?, ?, ?, 'Processing')`,
      [req.user.customer_id, restaurant_id, menu_id, quantity, total]
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      data: {
        order_id: orderResult.insertId,
        menu_name: menu.menu_name,
        quantity,
        total_price: total
      }
    });

  } catch (err) {
    await connection.rollback();
    res.status(500).json({ success: false, error: err.message });
  } finally {
    connection.release();
  }
});

// ================== Order Summary ==================
app.get('/orders/summary', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        CONCAT(c.firstname, ' ', c.lastname) AS customer_name,
        SUM(o.total_price) AS total_amount
      FROM tbl_orders o
      JOIN tbl_customers c ON o.customer_id = c.customer_id
      WHERE o.customer_id = ?
    `, [req.user.customer_id]);

    res.json({ success: true, data: rows[0] });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================== Start Server ==================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});