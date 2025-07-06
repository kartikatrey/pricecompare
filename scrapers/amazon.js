const { chromium } = require('playwright');
const fs = require('fs').promises;

// Persistent browser context
let browser = null;
let context = null;

async function initializeBrowser() {
  if (!browser) {
    console.log('Initializing browser...');
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1280, height: 720 }
    });
    // Block non-critical resources
    await context.route('**/*.{png,jpg,jpeg,webp,svg,gif,woff,woff2}', route => route.abort());
  }
  return context;
}

module.exports = async function amazon(query, country) {
  const startTime = Date.now();
  console.log('Starting scrape...');

  const ctx = await initializeBrowser();
  let page = await ctx.newPage();
  console.log(`Page created: ${Date.now() - startTime}ms`);

  const domain = country === 'in' ? 'amazon.in' : `amazon.${country}`;
  const searchQuery = encodeURIComponent(query);
  const url = `https://www.${domain}/s?k=${searchQuery}`;
  console.log('Amazon URL:', url);

  // Retry navigation up to 2 times
  let attempts = 0;
  const maxAttempts = 2;
  let results = [];

  while (attempts < maxAttempts && results.length === 0) {
    try {
      console.log(`Navigating to page (attempt ${attempts + 1}): ${Date.now() - startTime}ms`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

      // Check for CAPTCHA
      const isCaptchaPresent = await page.evaluate(() => !!document.querySelector('form[action="/errors/validateCaptcha"], div[id="captchacharacters"]'));
      if (isCaptchaPresent) {
        console.error('CAPTCHA detected');
        await page.screenshot({ path: `captcha_screenshot_${Date.now()}.png` });
        await page.close();
        page = await ctx.newPage(); // Create new page for retry
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        return [];
      }
      console.log(`CAPTCHA check complete: ${Date.now() - startTime}ms`);

      // Wait for search results
      const selector = 'div.s-main-slot div[data-component-type="s-search-result"]';
      const foundResults = await page.waitForSelector(selector, { timeout: 7000 }).catch(() => null);
      if (!foundResults) {
        console.error('No search results found for selector:', selector);
        await page.screenshot({ path: `error_screenshot_${Date.now()}.png` });
        const pageContent = await page.content();
        await fs.writeFile(`error_page_${Date.now()}.html`, pageContent);
        console.error('Page title:', await page.title());
        console.error('Page HTML saved to error_page.html');
        await page.close();
        page = await ctx.newPage(); // Create new page for retry
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        return [];
      }
      console.log(`Search results loaded: ${Date.now() - startTime}ms`);

      results = await page.evaluate(() => {
        // Define parsePrice inside evaluate
        function parsePrice(priceStr) {
          let result = 0;
          let decimal = 0;
          let isDecimal = false;
          for (let i = 0; i < priceStr.length; i++) {
            const char = priceStr[i];
            if (char >= '0' && char <= '9') {
              if (!isDecimal) {
                result = result * 10 + (char.charCodeAt(0) - 48);
              } else {
                decimal = decimal * 10 + (char.charCodeAt(0) - 48);
              }
            } else if (char === '.') {
              isDecimal = true;
            }
          }
          return isDecimal ? result + decimal / 100 : result;
        }

        const items = Array.from(document.querySelectorAll('div.s-main-slot div[data-component-type="s-search-result"]')).slice(0, 20);
        const validResults = [];

        // Log HTML of first 3 items for debugging
        for (let i = 0; i < Math.min(3, items.length); i++) {
          console.log(`Item ${i + 1} HTML:`, items[i].outerHTML);
        }

        for (const item of items) {
          if (item.querySelector('span[data-component-type="s-ads-metrics"]')) continue;

          const nameElement = item.querySelector('.a-size-medium.a-color-base.a-text-normal, h2 a span, .s-title-instructions span');
          const linkElement = item.querySelector('.a-link-normal.s-no-outline, h2 a, .s-title-instructions a');
          const priceElement = item.querySelector('.a-price-whole, .a-price .a-offscreen, .a-price span');

          const name = nameElement?.innerText?.trim() || 'N/A';
          const href = linkElement?.getAttribute('href') || '';
          const link = href ? `https://www.amazon.in${href.startsWith('/') ? href : '/' + href}` : 'N/A';
          const priceText = priceElement?.innerText || '';
          const price = priceText.replace(/[^0-9.]/g, '');

          if (name !== 'N/A' && link !== 'N/A' && price) {
            validResults.push({ price, currency: 'INR', link, productName: name });
          }
          if (validResults.length >= 10) break;
        }

        // Manual bubble sort by price
        for (let i = 0; i < validResults.length - 1; i++) {
          for (let j = 0; j < validResults.length - i - 1; j++) {
            const priceA = parsePrice(validResults[j].price);
            const priceB = parsePrice(validResults[j + 1].price);
            if (priceA > priceB) {
              const temp = validResults[j];
              validResults[j] = validResults[j + 1];
              validResults[j + 1] = temp;
            }
          }
        }

        return validResults;
      });
      console.log(`Evaluation complete: ${Date.now() - startTime}ms`);

      await page.close();
      console.log(`Page closed: ${Date.now() - startTime}ms`);
      console.log('Evaluated results:', results);
      return results.length ? results : [];
    } catch (err) {
      console.error('Amazon scraper error:', err.message);
      await page.screenshot({ path: `error_screenshot_${Date.now()}.png` });
      const pageContent = await page.content();
      await fs.writeFile(`error_page_${Date.now()}.html`, pageContent);
      console.error('Page HTML saved to error_page.html');
      await page.close();
      page = await ctx.newPage(); // Create new page for retry
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      return [];
    }
  }

  return [];
};

// Clean up browser on process exit
process.on('exit', async () => {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
  }
});