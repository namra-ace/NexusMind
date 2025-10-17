import express from 'express';
import cors from 'cors';
import 'dotenv/config'; 
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js"

connectDB();

const app = express();
const port = process.env.PORT || 3001; 

app.use(cors());
app.use(express.json()); 

app.get('/api/health', (req, res) => res.send({ 
  status: 'ok', 
  message: 'Backend is healthy!' 
}));

app.get('/api/users',userRoutes);

app.listen(port, () => console.log(`Server is running on http://localhost:${port}!`));