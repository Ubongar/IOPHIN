#!/usr/bin/env node
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  // Try to load from client node_modules if installed there
  try {
    puppeteer = require(require('path').resolve(__dirname, '../client/node_modules/puppeteer'));
  } catch (e2) {
    throw e;
  }
}

(async () => {
  const url = process.argv[2] || 'http://localhost:5174/';
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(20000);
    console.log('Opening', url);
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Wait for toggle and legend to appear
    await page.waitForSelector('[data-testid="risk-mode-toggle"]');
    await page.waitForSelector('[data-testid="legend-mode-desc"]');

    const readCounts = async () => {
      const levels = ['Critical','High','Medium','Low','Minimal'];
      const counts = {};
      for (const l of levels) {
        const sel = `[data-testid="legend-count-${l}"]`;
        try {
          counts[l] = await page.$eval(sel, el => el.innerText.trim());
        } catch (e) {
          counts[l] = null;
        }
      }
      return counts;
    };

    const modeDesc = await page.$eval('[data-testid="legend-mode-desc"]', el => el.innerText);
    console.log('Initial legend mode text:', modeDesc);
    const beforeCounts = await readCounts();
    console.log('Counts before toggle:', beforeCounts);

    // Click toggle
    await page.click('[data-testid="risk-mode-toggle"]');

    // Wait for legend mode text to change
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="legend-mode-desc"]');
      if (!el) return false;
      return el.textContent.includes('Absolute') || el.textContent.includes('Cluster-relative');
    });

    // Small delay to allow counts to update
    await page.waitForTimeout(800);

    const modeDescAfter = await page.$eval('[data-testid="legend-mode-desc"]', el => el.innerText);
    const afterCounts = await readCounts();
    console.log('After legend mode text:', modeDescAfter);
    console.log('Counts after toggle:', afterCounts);

    // Simple assertion: mode text must have toggled
    if (modeDesc === modeDescAfter) {
      console.error('ERROR: Legend mode text did not change after toggle');
      process.exitCode = 2;
    } else {
      console.log('SUCCESS: Legend mode toggled and legend updated');
    }
  } catch (err) {
    console.error('TEST ERROR', err.message || err);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
