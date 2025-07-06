const express = require('express');
const router = express.Router();
const fetchPrices = require('../services/priceFetcher');

router.post('/', async (req, res, next) => {
  try {
    const results = await fetchPrices(req.body);
    res.json(results);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
