import assert from "node:assert/strict";
import { chromium } from "playwright";

const [threadUrl, fileName] = process.argv.slice(2);
assert(threadUrl && fileName,
  "Usage: npm run test:scroll -- <BB thread URL> <open Markdown filename>");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(15000);
  await page.goto(threadUrl, { waitUntil: "domcontentloaded" });
  const showPanel = page.getByRole("button", { name: /^Show right panel/ });
  await page.getByRole("button", { name: /^(Show|Hide) right panel/ }).waitFor();
  if (await showPanel.isVisible()) await showPanel.click();
  const tabs = page.getByRole("button", { name: fileName, exact: true });
  const actions = page.getByRole("group", { name: "Скачивание файла" });
  for (let i = 0; i < await tabs.count(); i++) {
    await tabs.nth(i).click();
    if (await actions.isVisible()) break;
  }
  await actions.waitFor({ state: "visible" });
  const panel = actions.locator("..").locator("..");
  const content = panel.locator(":scope > div").nth(1);
  for (const width of [1440, 900]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(element => element.scrollHeight > element.clientHeight + 100,
      await content.elementHandle());
    await content.evaluate(element => { element.scrollTop = 0; });
    const before = await actions.boundingBox();
    const box = await content.boundingBox();
    assert(before && box, "Download actions and Markdown must be visible");
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(150, box.height / 2));
    await page.mouse.wheel(0, 700);
    try {
      await page.waitForFunction(element => element.scrollTop > 0,
        await content.elementHandle(), { timeout: 3000 });
    } catch {
      const metrics = await content.evaluate(element => ({
        height: element.clientHeight,
        contentHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
        overflowY: getComputedStyle(element).overflowY,
      }));
      throw new Error(`Markdown does not scroll at width ${width}: ${JSON.stringify(metrics)}`);
    }
    const after = await actions.boundingBox();
    assert(after && Math.abs(before.y - after.y) < 1,
      "Download actions must stay above the scrolling Markdown");
    console.log(`PASS: Markdown scrolls at width ${width}; download actions stay visible`);
  }
} finally {
  await browser.close();
}
