// Starts Chromium with the built extension and answers www.youtube.com from a local fixture,
// so the real manifest, content scripts and storage run without touching YouTube.
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = fileURLToPath(new URL('.', import.meta.url));
export const extensionPath = fileURLToPath(new URL('../../dist/chrome', import.meta.url));

export const VIDEOS = {
  abcdefghijk: {
    title: 'Containers from scratch',
    lengthSeconds: '120',
    shortDescription: 'A short course.\n\n0:00 Why containers\n0:30 Images\n1:00 Volumes\n1:30 Networking\n',
  },
  zyxwvutsrqp: { title: 'A talk without chapters', lengthSeconds: '120', shortDescription: 'No timestamps.' },
};

/** Chrome names an unpacked extension after its folder: sha256 of the path, hex mapped onto a-p. */
function extensionId(path) {
  const hex = createHash('sha256').update(path).digest('hex').slice(0, 32);
  return [...hex].map((digit) => String.fromCharCode(97 + parseInt(digit, 16))).join('');
}

export async function launch({ videos = VIDEOS, locale = 'en', viewport = { width: 1280, height: 800 } } = {}) {
  const profile = await mkdtemp(join(tmpdir(), 'coursemark-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    viewport,
    locale,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, `--lang=${locale}`],
  });
  const page = (await readFile(join(here, 'fixture.html'), 'utf8')).replace(
    '<script>',
    `<script type="application/json" id="videos">${JSON.stringify(videos)}</script>\n    <script>`,
  );
  const video = await readFile(join(here, 'fixture.webm'));
  await context.route('https://www.youtube.com/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/fixture.webm') return route.fulfill(videoResponse(video, route.request().headers().range));
    return route.fulfill({ body: page, contentType: 'text/html' });
  });
  const id = extensionId(extensionPath);
  return {
    context,
    extensionUrl: (path) => `chrome-extension://${id}/${path}`,
    async close() {
      await context.close();
      await rm(profile, { recursive: true, force: true });
    },
  };
}

/** Chromium can only seek in a video whose server answers byte ranges. */
function videoResponse(video, range) {
  const headers = { 'Accept-Ranges': 'bytes', 'Content-Type': 'video/webm' };
  const match = /^bytes=(\d+)-(\d*)$/.exec(range ?? '');
  if (!match) return { status: 200, headers, body: video };
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : video.length - 1;
  return {
    status: 206,
    headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${video.length}` },
    body: video.subarray(start, end + 1),
  };
}

/** Runs fn(arg) inside an extension page, where chrome.storage is reachable. */
export async function inExtension(browser, fn, arg) {
  const page = await browser.context.newPage();
  await page.goto(browser.extensionUrl('popup/popup.html'));
  const result = await page.evaluate(fn, arg);
  await page.close();
  return result;
}
