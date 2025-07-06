# Price Comparator Tool (Playwright Version)

## Setup

```bash
npm install
npx playwright install
```

## Run

```bash
npm start
```

## API

POST `/api/price`

```json
{
  "country": "US",
  "query": "iPhone 16 Pro, 128GB"
}
```

## Response

```json
[
  {
    "price": "999",
    "currency": "USD",
    "link": "https://www.amazon.com/...", 
    "productName": "Apple iPhone 16 Pro"
  }
]
```
