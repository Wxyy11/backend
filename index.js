// index.js
require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// ==================== Root Route ====================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Backend API Server is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    documentation: '/api-docs',
    endpoints: {
      users: '/api/users',
      auth: '/api/auth',
      menus: '/api/menus',
      health: '/health'
    }
  });
});

// ==================== Health Check ====================
app.get('/health', async (req, res) => {
  try {
    const db = require('./config/db');
    const [result] = await db.query('SELECT 1 as test');
    
    res.json({
      status: 'OK',
      database: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      database: 'disconnected',
      error: error.message,
      uptime: process.uptime()
    });
  }
});

// ==================== Routes ====================
try {
  app.use("/api/users", require("./routes/users"));
  console.log('✅ Users routes loaded');
} catch (error) {
  console.error('❌ Users routes error:', error.message);
}

try {
  app.use("/api/menus", require("./routes/menus"));
  console.log('✅ Menus routes loaded');
} catch (error) {
  console.error('❌ Menus routes error:', error.message);
}

try {
  app.use("/api/auth", require("./routes/login"));
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.error('❌ Auth routes error:', error.message);
}

// ==================== Swagger Documentation ====================
try {
  const { swaggerUi, specs } = require("./swagger");
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
  console.log('✅ Swagger loaded');
} catch (error) {
  console.error('❌ Swagger error:', error.message);
  app.get("/api-docs", (req, res) => {
    res.json({
      error: 'API Documentation not available',
      message: error.message
    });
  });
}

// ==================== 404 Handler ====================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// ==================== Global Error Handler ====================
app.use((err, req, res, next) => {
  console.error('❌ Global Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const PORT = process.env.PORT || 3000;

// Only listen if not in production (Vercel handles this)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 API Documentation available at http://localhost:${PORT}/api-docs`);
  });
}

// ==================== Export for Vercel ====================
module.exports = app;