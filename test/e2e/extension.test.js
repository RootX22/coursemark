import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';

import { inExtension, launch } from './harness.js';

let browser;
let page;

before(async () => {
  browser = await launch();
  page = await browser.context.newPage();
  await page.goto('https://www.youtube.com/watch?v=abcdefghijk');
});

after(() => browser.close());

const panel = () => page.locator('#coursemark-panel');
const checkboxes = () => panel().locator('.chapters input');

async function playUntil(seconds, rate = 8) {
  await page.evaluate((rate) => {
    const video = document.querySelector('video');
    video.playbackRate = rate;
    return video.play();
  }, rate);
  await page.waitForFunction((seconds) => document.querySelector('video').currentTime >= seconds, seconds);
  await page.evaluate(() => document.querySelector('video').pause());
}

const savedCourses = () =>
  inExtension(browser, async () => {
    const everything = await chrome.storage.local.get(null);
    return Object.entries(everything)
      .filter(([key]) => key.startsWith('course:'))
      .map(([, course]) => course);
  });

test('a video with chapters in its description is offered as a course', async () => {
  await panel().locator('.idle p').waitFor();
  assert.match(await panel().locator('.idle p').textContent(), /^4 chapters/);
  await panel().getByRole('button', { name: 'Study as a course' }).click();
  await checkboxes().first().waitFor();
  assert.equal(await checkboxes().count(), 4);
  assert.deepEqual(
    (await savedCourses()).map((course) => course.chapters.map((chapter) => chapter.title)),
    [['Why containers', 'Images', 'Volumes', 'Networking']],
  );
});

test('chapters tick themselves as they are watched', async () => {
  await playUntil(64);
  await page.waitForFunction(() => {
    const boxes = document.querySelector('#coursemark-panel').shadowRoot.querySelectorAll('.chapters input');
    return boxes[1].checked;
  });
  assert.deepEqual(await checkboxes().evaluateAll((boxes) => boxes.map((box) => box.checked)), [
    true,
    true,
    false,
    false,
  ]);
  assert.equal(await panel().locator('.summary').textContent(), '2/4 · 50%');
});

test('jumping ahead does not count as watching what was skipped', async () => {
  await page.evaluate(() => (document.querySelector('video').currentTime = 100));
  await playUntil(110, 2);
  assert.deepEqual(await checkboxes().evaluateAll((boxes) => boxes.map((box) => box.checked)), [
    true,
    true,
    false,
    false,
  ]);
});

test('a note is anchored to when typing began and its keys never reach the page', async () => {
  await page.evaluate(() => (document.querySelector('video').currentTime = 75));
  const input = panel().locator('.note-form input');
  await input.click();
  await page.evaluate(() => (document.querySelector('video').currentTime = 90));
  await input.pressSequentially('k mounts outlive the container');
  await input.press('Enter');
  const note = panel().locator('.notes li').first();
  await note.waitFor();
  assert.equal(await note.locator('.time').textContent(), '1:15');
  assert.equal(await note.locator('p').textContent(), 'k mounts outlive the container');
  assert.deepEqual(await page.evaluate(() => window.keysSeenByPage), []);
  await note.locator('.time').click();
  assert.equal(await page.evaluate(() => document.querySelector('video').currentTime), 75);
});

test('progress and notes are there after a reload, with a way back to where the learner was', async () => {
  await page.evaluate(() => document.querySelector('video').pause());
  await page.waitForTimeout(500); // the pause handler saves
  await page.reload();
  await panel().locator('.notes li').first().waitFor();
  assert.equal(await panel().locator('.summary').textContent(), '2/4 · 50%');
  assert.match(await panel().locator('button.link').textContent(), /^Resume at 1:/);
});

test('moving to another video inside the page switches the panel', async () => {
  await page.evaluate(() => window.navigateTo('zyxwvutsrqp'));
  await panel().locator('.idle p').waitFor();
  assert.match(await panel().locator('.idle p').textContent(), /split into 1 parts/);
});

test('the free plan stops at three courses in progress and Pro lifts the limit', async () => {
  await inExtension(browser, async () => {
    const course = (id) => ({
      id,
      title: id,
      channel: 'c',
      duration: 60,
      chapters: [{ start: 0, end: 60, title: null }],
      watched: [],
      marks: {},
      notes: [],
      position: 0,
      createdAt: 1,
      updatedAt: 1,
      completedAt: null,
    });
    await chrome.storage.local.set({
      'course:aaaaaaaaaaa': course('aaaaaaaaaaa'),
      'course:bbbbbbbbbbb': course('bbbbbbbbbbb'),
    });
  });
  await panel().locator('.limit').waitFor();
  await inExtension(browser, () =>
    chrome.storage.local.set({
      license: { key: 'K', instanceId: 'i', email: '', status: 'active', checkedAt: Date.now() },
    }),
  );
  await panel().locator('.idle').waitFor();
  await inExtension(browser, () => chrome.storage.local.remove('license'));
});

test('the library lists courses, exports notes as Markdown and deletes on confirmation', async () => {
  const library = await browser.context.newPage();
  await library.goto(browser.extensionUrl('library/library.html'));
  await library.locator('.course').first().waitFor();
  assert.equal(await library.locator('.course').count(), 3);
  const course = library.locator('.course', { hasText: 'Containers from scratch' });
  const [download] = await Promise.all([
    library.waitForEvent('download'),
    course.getByRole('button', { name: 'Export notes' }).click(),
  ]);
  const markdown = await readFile(await download.path(), 'utf8');
  assert.match(markdown, /^# Containers from scratch\n/);
  assert.match(markdown, /- \[x\] \[0:30\]\(https:\/\/www\.youtube\.com\/watch\?v=abcdefghijk&t=30s\) Images/);
  assert.match(markdown, /\[1:15\]\(.*&t=75s\) k mounts outlive the container/);
  library.once('dialog', (dialog) => dialog.accept());
  await library.locator('.course', { hasText: 'aaaaaaaaaaa' }).getByRole('button', { name: 'Delete' }).click();
  await library.waitForFunction(() => document.querySelectorAll('.course').length === 2);
  assert.equal((await savedCourses()).length, 2);
  await library.close();
});

test('the popup lists the courses in progress', async () => {
  const popup = await browser.context.newPage();
  await popup.goto(browser.extensionUrl('popup/popup.html'));
  await popup.locator('.courses li').first().waitFor();
  assert.equal(await popup.locator('.courses li').count(), 2);
  assert.match(await popup.locator('.courses li').first().textContent(), /Containers from scratch2 of 4 chapters done/);
  await popup.close();
});
