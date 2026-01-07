// config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config({ quiet: true }); // เพิ่ม quiet: true

const configdb = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3308,
    user: process.env.DB_USER || 'root',
    // ⚠️ แก้ตรงนี้: รองรับทั้ง DB_PASSWORD และ DB_PASS
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'db_68319010061',
    
    // Connection Pool Settings
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 30000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

const pool = mysql.createPool(configdb);

// ทดสอบการเชื่อมต่อ (ไม่ block การรัน)
pool.getConnection()
    .then(connection => {
        console.log('--- 🚀 Database Connection Status ---');
        console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ!');
        console.log('📊 Database:', configdb.database);
        console.log('🌐 Host:', configdb.host + ':' + configdb.port);
        connection.release();
        console.log('------------------------------------');
    })
    .catch(err => {
        console.error('--- ❌ CRITICAL DB ERROR ---');
        console.error('ไม่สามารถเชื่อมต่อฐานข้อมูลได้');
        console.error('รายละเอียด Error:', err.message);
        console.error('Error Code:', err.code);
        console.error('-----------------------------');
        // ⚠️ ไม่ควรใช้ process.exit(1) บน Vercel
        // เพราะจะทำให้ Function crash
    });

module.exports = pool;