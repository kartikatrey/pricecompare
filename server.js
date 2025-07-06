const express = require('express');
const dotenv = require('dotenv');
const priceRoutes = require('./routes/priceRoutes');
dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/price', priceRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
