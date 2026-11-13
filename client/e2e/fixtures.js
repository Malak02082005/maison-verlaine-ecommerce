// Every test file imports `test` and `expect` from here instead of from '@playwright/test'.
//
// By default Playwright waits for a page's "load" event, which also waits for outside scripts
// and frames (Stripe.js, Google Fonts) to finish loading. That can take very long and has
// nothing to do with our app. So page.goto() and page.reload() only wait until the page's own
// HTML is ready ("domcontentloaded"); the checks in the tests (expect …) already wait until the
// right text, buttons and data are actually on the screen.
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, providePage) => {
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);
    page.goto = (url, options) => goto(url, { waitUntil: 'domcontentloaded', ...options });
    page.reload = (options) => reload({ waitUntil: 'domcontentloaded', ...options });
    await providePage(page);
  },
});

export { expect };
