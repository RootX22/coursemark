// Renders the README images and the store listing images from the built extension, on the local
// watch page fixture with made-up sample courses, so no one else's video or channel appears.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { addNote, newCourse, recordWatch } from '../src/core/course.js';
import { localDay } from '../src/core/time.js';
import { inExtension, launch } from '../test/e2e/harness.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const DAY = 24 * 60 * 60 * 1000;
const MAIN_ID = 'fullstack01';

const SAMPLES = {
  en: {
    title: 'Full-Stack Web Development: From Zero to Deployed',
    channel: 'Open Learning Lab',
    chapters: [
      '0:00 Welcome and setup',
      '4:12 How the web works',
      '18:40 HTML that means something',
      '41:05 CSS layout with grid and flexbox',
      '1:12:30 JavaScript fundamentals',
      '1:58:44 Talking to APIs with fetch',
      '2:31:10 A backend with Node and Express',
      '3:20:02 Databases and SQL',
      '4:05:47 Authentication done right',
      '4:48:19 Testing what matters',
      '5:22:36 Containers and deployment',
      '6:01:50 Where to go next',
    ],
    notes: [
      [1340, 'Use <section> only when the part has its own heading'],
      [3010, 'grid-template-areas reads like a drawing of the layout'],
      [5222, 'const by default; let only when the value really changes'],
      [7240, 'Always check response.ok, fetch does not throw on 404'],
    ],
    slide: ['Part 6 of 12', 'Talking to APIs with fetch'],
    others: [
      ['sqlcourse01', 'SQL for Data Analysis, Start to Finish', 'Data Basics'],
      ['linuxcrse01', 'The Linux Command Line in One Sitting', 'Terminal Academy'],
      ['pythonbas01', 'Python for Absolute Beginners', 'Code Garden'],
    ],
  },
  ar: {
    title: 'تطوير الويب الشامل: من الصفر حتى النشر',
    channel: 'أكاديمية التعلم المفتوح',
    chapters: [
      '0:00 الترحيب وتجهيز البيئة',
      '4:12 كيف يعمل الويب',
      '18:40 HTML بمعنى واضح',
      '41:05 تخطيط الصفحات بـ Grid وFlexbox',
      '1:12:30 أساسيات JavaScript',
      '1:58:44 التعامل مع الواجهات البرمجية',
      '2:31:10 خادم بـ Node وExpress',
      '3:20:02 قواعد البيانات وSQL',
      '4:05:47 تسجيل الدخول بأمان',
      '4:48:19 اختبار ما يهم',
      '5:22:36 الحاويات والنشر',
      '6:01:50 الخطوة التالية',
    ],
    notes: [
      [1340, 'استخدم <section> فقط إذا كان للجزء عنوانه الخاص'],
      [3010, 'grid-template-areas تشبه رسمًا للتخطيط'],
      [5222, 'const افتراضيًا، وlet فقط عندما تتغير القيمة'],
      [7240, 'تحقق دائمًا من response.ok، فـ fetch لا يرمي خطأ عند 404'],
    ],
    slide: ['الجزء 6 من 12', 'التعامل مع الواجهات البرمجية'],
    others: [
      ['sqlcourse01', 'SQL لتحليل البيانات من البداية للنهاية', 'أساسيات البيانات'],
      ['linuxcrse01', 'سطر أوامر لينكس في جلسة واحدة', 'أكاديمية الطرفية'],
      ['pythonbas01', 'بايثون للمبتدئين تمامًا', 'حديقة البرمجة'],
    ],
  },
};

function playerVideos(sample) {
  return {
    [MAIN_ID]: { title: sample.title, lengthSeconds: '22500', shortDescription: sample.chapters.join('\n') },
  };
}

/** Sample courses built with the extension's own code, so they look exactly like real ones. */
function sampleCourses(sample, now) {
  const video = {
    id: MAIN_ID,
    title: sample.title,
    channel: sample.channel,
    duration: 22500,
    description: sample.chapters.join('\n'),
  };
  let main = recordWatch(newCourse(video, now - 6 * DAY), 0, 7300, now);
  for (const [time, text] of sample.notes) main = addNote(main, time, text, now);
  const progressByCourse = [0.6, 0.2, 1];
  const others = sample.others.map(([id, title, channel], index) => {
    const duration = 14400;
    const course = newCourse({ id, title, channel, duration, description: '' }, now - (index + 10) * DAY);
    return recordWatch(course, 0, duration * progressByCourse[index], now - (index * 4 + 1) * DAY);
  });
  return [main, ...others];
}

function sampleStats(now) {
  const minutes = [52, 40, 35, 65, 38, 45, 71, 30, 0, 24];
  return Object.fromEntries(
    minutes.flatMap((value, daysAgo) => (value ? [[localDay(new Date(now - daysAgo * DAY)), value * 60]] : [])),
  );
}

async function seed(browser, sample) {
  const now = Date.now();
  const items = Object.fromEntries(sampleCourses(sample, now).map((course) => [`course:${course.id}`, course]));
  items.stats = sampleStats(now);
  items.license = {
    key: 'SAMPLE',
    instanceId: 'sample',
    email: 'learner@example.com',
    status: 'active',
    checkedAt: now,
  };
  await inExtension(browser, (values) => chrome.storage.local.set(values), items);
}

/** The video area shows a lecture slide instead of the test pattern. */
async function watchPage(browser, sample, { dark, rtl }) {
  const page = await browser.context.newPage();
  await page.goto(`https://www.youtube.com/watch?v=${MAIN_ID}`);
  const [part, heading] = sample.slide;
  const x = rtl ? 1480 : 120;
  const anchor = rtl ? 'end' : 'start';
  const slide = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#11151c"/>` +
      `<text x="${x}" y="380" text-anchor="${anchor}" fill="#9aa4b2" font-family="Helvetica, Arial" font-size="44">${part}</text>` +
      `<text x="${x}" y="480" text-anchor="${anchor}" fill="#ffffff" font-family="Helvetica, Arial" font-size="80" font-weight="700">${heading}</text>` +
      `<rect x="${rtl ? x - 180 : x}" y="540" width="180" height="10" rx="5" fill="#2dd4bf"/></svg>`,
  )}`;
  await page.evaluate(
    ({ slide, dark, rtl }) => {
      const video = document.querySelector('video');
      video.removeAttribute('src');
      video.poster = slide;
      video.load();
      if (rtl) document.documentElement.dir = 'rtl';
      if (dark) {
        document.documentElement.setAttribute('dark', '');
        document.body.style.cssText = 'background:#0f0f0f;color:#f1f1f1';
        for (const block of document.querySelectorAll('.related')) block.style.background = '#272727';
      }
    },
    { slide, dark, rtl },
  );
  await page.locator('#coursemark-panel .chapters li').first().waitFor();
  await page.waitForTimeout(400);
  return page;
}

async function shoot(page, path, options = {}) {
  await page.screenshot({ path: `${root}${path}`, ...options });
  console.log(`wrote ${path}`);
}

async function promoTile(width, height, path) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height } });
  const icon = (await readFile(`${root}src/icons/icon.svg`, 'utf8')).replace('<svg ', '<svg width="96" height="96" ');
  await page.setContent(
    `<body style="margin:0;height:100vh;display:flex;align-items:center;gap:28px;padding:0 40px;box-sizing:border-box;background:linear-gradient(135deg,#0f766e,#0b3f3b);font-family:Helvetica,Arial,sans-serif;color:#fff">${icon}<div><div style="font-size:${Math.round(height / 7)}px;font-weight:700">Coursemark</div><div style="font-size:${Math.round(height / 15)}px;opacity:.85;margin-top:8px">Study long YouTube videos like a course</div></div></body>`,
  );
  await shoot(page, path);
  await browser.close();
}

async function englishShots() {
  const sample = SAMPLES.en;
  const browser = await launch({ videos: playerVideos(sample) });
  await seed(browser, sample);
  const watch = await watchPage(browser, sample, { dark: false, rtl: false });
  await shoot(watch, 'store/screenshot-1-panel.png');
  await shoot(watch, 'docs/panel.png', { clip: { x: 830, y: 0, width: 450, height: 720 } });
  const library = await browser.context.newPage();
  await library.goto(browser.extensionUrl('library/library.html'));
  await library.locator('.course').first().waitFor();
  await shoot(library, 'store/screenshot-2-library.png');
  await shoot(library, 'docs/library.png', { fullPage: true });
  const popup = await browser.context.newPage();
  await popup.setViewportSize({ width: 340, height: 520 });
  await popup.goto(browser.extensionUrl('popup/popup.html'));
  await popup.locator('.courses li').first().waitFor();
  await popup.waitForTimeout(400);
  await shoot(popup, 'docs/popup.png', { clip: await popup.locator('body').boundingBox() });
  await browser.close();
}

/** Chromium on macOS ignores --lang and reads its language from its own defaults domain. */
async function arabicShots() {
  const sample = SAMPLES.ar;
  const onMac = process.platform === 'darwin';
  if (onMac) execFileSync('defaults', ['write', 'org.chromium.Chromium', 'AppleLanguages', '-array', 'ar']);
  try {
    const browser = await launch({ videos: playerVideos(sample), locale: 'ar' });
    await seed(browser, sample);
    await shoot(await watchPage(browser, sample, { dark: true, rtl: true }), 'store/screenshot-3-arabic-dark.png');
    await browser.close();
  } finally {
    if (onMac) execFileSync('defaults', ['delete', 'org.chromium.Chromium', 'AppleLanguages']);
  }
}

await mkdir(`${root}docs`, { recursive: true });
await mkdir(`${root}store`, { recursive: true });
await englishShots();
await arabicShots();
await promoTile(440, 280, 'store/promo-small-440x280.png');
await promoTile(1400, 560, 'store/promo-marquee-1400x560.png');
