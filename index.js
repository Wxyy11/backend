require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const SECRET_KEY = process.env.JWT_SECRET;

const verifyToken = require('./middleware/auth');
app.use(express.json());

// Database connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Route ทดสอบการเชื่อมต่อ
app.get('/ping', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT NOW() AS now');
    res.json({ status: 'ok', time: rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET users (protected) - เพิ่ม username
app.get('/users', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, username, firstname, fullname, lastname FROM tbl_users');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Query failed' });
  }
});

// GET user by id (protected) - เพิ่ม username
app.get('/users/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query(
      'SELECT id, username, firstname, fullname, lastname FROM tbl_users WHERE id = ?',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Query failed' });
  }
});

// POST: สร้างผู้ใช้ใหม่ พร้อม username และ hash password
app.post('/users', async (req, res) => {
  const { username, firstname, fullname, lastname, password } = req.body;

  try {
    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // ตรวจสอบว่า username ซ้ำหรือไม่
    const [existing] = await db.query('SELECT id FROM tbl_users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // เข้ารหัส password
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO tbl_users (username, firstname, fullname, lastname, password) VALUES (?, ?, ?, ?, ?)',
      [username, firstname, fullname, lastname, hashedPassword]
    );

    res.json({ 
      id: result.insertId, 
      username, 
      firstname, 
      fullname, 
      lastname 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Insert failed' });
  }
});

// POST: เข้าสู่ระบบ (Login)
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const [rows] = await db.query('SELECT * FROM tbl_users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = rows[0];

    // ตรวจสอบรหัสผ่าน
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // สร้าง JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username,
        fullname: user.fullname, 
        lastname: user.lastname 
      },
      SECRET_KEY,
      { expiresIn: '1h' }
    );

    res.json({ 
      message: 'Login successful', 
      token,
      user: {
        id: user.id,
        username: user.username,
        firstname: user.firstname,
        fullname: user.fullname,
        lastname: user.lastname
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// PUT: อัปเดตข้อมูลผู้ใช้ - เพิ่ม username
app.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, firstname, fullname, lastname, password } = req.body;

  try {
    // ถ้ามีการเปลี่ยน username ให้ตรวจสอบว่าซ้ำหรือไม่
    if (username) {
      const [existing] = await db.query(
        'SELECT id FROM tbl_users WHERE username = ? AND id != ?',
        [username, id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Username already exists' });
      }
    }

    let query = 'UPDATE tbl_users SET firstname = ?, fullname = ?, lastname = ?';
    const params = [firstname, fullname, lastname];

    // เพิ่ม username ถ้ามีส่งมา
    if (username) {
      query = 'UPDATE tbl_users SET username = ?, firstname = ?, fullname = ?, lastname = ?';
      params.unshift(username);
    }

    // ถ้ามี password ใหม่ให้ hash แล้วอัปเดตด้วย
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(id);

    const [result] = await db.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// DELETE /users/:id - ลบผู้ใช้
app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM tbl_users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// เริ่มเซิร์ฟเวอร์
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));