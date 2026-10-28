// Renders src/icons/icon.svg to the PNG sizes the browsers and stores ask for.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const icons = fileURLToPath(new URL('../src/icons/', import.meta.url));
const svg = await readFile(`${icons}icon.svg`, 'utf8');
const browser = await chromium.launch();
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`,
  );
  await page.screenshot({ path: `${icons}${size}.png`, omitBackground: true });
  await page.close();
}
await browser.close();
