const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));

const PORT = process.env.PORT || 5000;

// ✅ FIX: Only start the server AFTER the database connects
console.log("⏳ Connecting to MongoDB...");

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`✅ MongoDB Connected`);
  });
}).catch(err => {
  console.error("❌ MongoDB Connection Error:", err);
  process.exit(1); // Stop the app if DB fails
});