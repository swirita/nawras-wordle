import { chromium } from 'playwright';

// CI installs Playwright Chromium. Locally, use installed Chrome unless overridden.
export function launchBrowser() {
  const options = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH }
    : process.env.CHROME_CHANNEL ? { channel: process.env.CHROME_CHANNEL }
      : process.env.CI ? {} : { channel: 'chrome' };
  return chromium.launch({ headless: true, ...options });
}

// Deterministic crypto samples for gameplay tests; production uses real entropy.
export function stubWordRandom(sample = 0) {
  window.wordRandomCalls = 0;
  crypto.getRandomValues = (buffer) => {
    window.wordRandomCalls += 1;
    buffer.fill(sample);
    return buffer;
  };
}
