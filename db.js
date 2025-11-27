const path = require('path');
const envPath = path.resolve(__dirname, '..', '.env');

// โหลด .env แบบระบุ path ชัดเจน
require('dotenv').config({ path: envPath });

const mysql = require('mysql2/promise');

// Debug: แสดงค่าที่อ่านได้
console.log('\n' + '='.repeat(60));
console.log('🔍 ตรวจสอบค่า Environment Variables:');
console.log('='.repeat(60));
console.log('DB_HOST     :', process.env.DB_HOST || 'ไม่พบ');
console.log('DB_PORT     :', process.env.DB_PORT || 'ไม่พบ', '(Type:', typeof process.env.DB_PORT + ')');
console.log('DB_USER     :', process.env.DB_USER || 'ไม่พบ');
console.log('DB_PASS     :', process.env.DB_PASS ? '***มี***' : 'ไม่พบ');
console.log('DB_NAME     :', process.env.DB_NAME || 'ไม่พบ');
console.log('='.repeat(60) + '\n');

// แปลง Port เป็น Number อย่างชัดเจน
const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT.trim()) : 3308;

console.log('📌 Port ที่จะใช้:', dbPort, '(Type:', typeof dbPort + ')');

// ตรวจสอบค่าที่จำเป็น
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
  console.error('❌ ไม่พบค่า Environment Variables ที่จำเป็น!');
  console.error('💡 กรุณาตรวจสอบไฟล์ .env');
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST.trim(),
  port: dbPort,
  user: process.env.DB_USER.trim(),
  password: process.env.DB_PASS ? process.env.DB_PASS.trim() : '',
  database: process.env.DB_NAME.trim(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 30000, // เพิ่มเป็น 30 วินาที (สำหรับ remote connection)
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// ทดสอบการเชื่อมต่อ (แบบไม่บล็อกการทำงาน)
console.log('🔄 กำลังพยายามเชื่อมต่อฐานข้อมูล...');
console.log('   Target: ' + process.env.DB_HOST + ':' + dbPort);

pool.getConnection()
  .then(connection => {
    console.log('\n' + '✅'.repeat(30));
    console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ!');
    console.log('📊 Database:', process.env.DB_NAME);
    console.log('🌐 Host:', process.env.DB_HOST + ':' + dbPort);
    console.log('✅'.repeat(30) + '\n');
    connection.release();
  })
  .catch(err => {
    console.error('\n' + '❌'.repeat(30));
    console.error('❌ เชื่อมต่อฐานข้อมูลล้มเหลว!');
    console.error('❌'.repeat(30));
    console.error('Error Message:', err.message);
    console.error('Error Code   :', err.code);
    console.error('Error Number :', err.errno);
    
    if (err.code === 'ECONNREFUSED') {
      console.error('\n💡 สาเหตุที่เป็นไปได้:');
      console.error('   1. MySQL Server ไม่ได้เปิดอยู่');
      console.error('   2. Port ไม่ถูกต้อง (ต้องการ 3308 แต่พยายามเชื่อม 3306?)');
      console.error('   3. Firewall บล็อกการเชื่อมต่อ');
      console.error('   4. IP Address ไม่ได้รับอนุญาต');
    } else if (err.code === 'ETIMEDOUT') {
      console.error('\n💡 สาเหตุที่เป็นไปได้:');
      console.error('   1. MySQL Server ปิดการเชื่อมต่อจากภายนอก');
      console.error('   2. Firewall บล็อก Port 3308');
      console.error('   3. ใช้ 127.0.0.1 แทน IP จริง (ถ้าเป็น local)');
      console.error('   4. MySQL ไม่อนุญาตให้ User เชื่อมต่อจาก IP นี้');
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 สาเหตุที่เป็นไปได้:');
      console.error('   1. Username หรือ Password ไม่ถูกต้อง');
      console.error('   2. User ไม่มีสิทธิ์เข้าถึง Database นี้');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      console.error('\n💡 สาเหตุที่เป็นไปได้:');
      console.error('   1. Database "' + process.env.DB_NAME + '" ไม่มีอยู่ในระบบ');
      console.error('   2. สร้าง Database ก่อนด้วย: CREATE DATABASE ' + process.env.DB_NAME);
    }
    
    console.error('\n🔍 ค่าที่ใช้เชื่อมต่อ:');
    console.error('   Host:', process.env.DB_HOST);
    console.error('   Port:', dbPort, '← ตรวจสอบว่าถูกต้องหรือไม่');
    console.error('   User:', process.env.DB_USER);
    console.error('   Database:', process.env.DB_NAME);
    
    // ไม่ exit เพื่อให้ server ยังทำงานได้ (แต่จะเกิด error เมื่อใช้ pool)
    console.error('\n⚠️  Server จะทำงานต่อ แต่ API ที่ใช้ Database จะล้มเหลว!');
    console.error('💡 กรุณาแก้ไขปัญหาแล้วรีสตาร์ท Server\n');
  });

module.exports = pool;