require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

// Connect Database
connectDB();

app.get('/', (req, res) => {
  res.send('NexusMind API is running...');
});

// --- ROUTES ---
app.use('/api/auth', require('./routes/authRoutes'));
// MAKE SURE THIS LINE EXISTS:
app.use('/api/projects', require('./routes/projectRoutes')); 
app.use('/api/chat', require('./routes/chatRoutes'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});