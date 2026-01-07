// index.js
require('dotenv').config();
const express = require('express');
const { swaggerUi, specs } = require("./swagger");

const app = express();
app.use(express.json());

// Routes
app.use("/api/users", require("./routes/users"));
app.use("/api/menus", require("./routes/menus"));
app.use("/api/auth", require("./routes/login"));

// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation available at http://localhost:${PORT}/api-docs`);
});