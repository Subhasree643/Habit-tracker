require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const habitRoutes = require('./routes/habitRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// --- Middleware ---
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

// --- Routes ---
app.get('/api/health', (req, res) => res.json({ success: true, message: 'API is running' }));
app.use('/api/habits', habitRoutes);

// --- Error handling (keep last) ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
});
