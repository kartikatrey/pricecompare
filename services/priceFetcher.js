const amazon = require('../scrapers/amazon');

module.exports = async function fetchPrices({ country, query }) {
  const results = await Promise.allSettled([
    amazon(query, country)
  ]);

  const valid = results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);

  console.log('Valid results:', valid);
  return valid.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
};
