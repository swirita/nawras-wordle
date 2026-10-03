import { chromium } from 'playwright';

// CI installs Playwright Chromium. Locally, use installed Chrome unless overridden.
export function launchBrowser() {
  const options = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH }
    : process.env.CHROME_CHANNEL ? { channel: process.env.CHROME_CHANNEL }
      : process.env.CI ? {} : { channel: 'chrome' };
  return chromium.launch({ headless: true, ...options });
}
