# Store listing

Text to paste into the Chrome Web Store dashboard and Firefox Add-ons. Images are in this folder:
`screenshot-1-panel.png`, `screenshot-2-library.png`, `screenshot-3-arabic-dark.png` (1280×800),
`promo-small-440x280.png` and `promo-marquee-1400x560.png`.

## Name

Coursemark: course mode for YouTube

## Summary (Chrome: 132 characters at most; Firefox: 250)

English: Study long YouTube videos like a course: chapters that tick themselves as you watch, timestamped notes, saved progress.

Arabic: ادرس فيديوهات يوتيوب الطويلة كدورة: فصول تُعلَّم تلقائيًا أثناء المشاهدة، وملاحظات مرتبطة بالوقت، وتقدّم محفوظ.

## Description, English

Long courses on YouTube are great until you lose track of where you were. Coursemark turns a long
video into a course you can actually finish.

• Chapters as a checklist. Coursemark reads the chapter list from the video description and shows
it beside the video. Videos without chapters are split into ten-minute parts.
• Progress that is honest. A chapter ticks itself once you have watched 90% of it. Skipping through
it, seeking past it, or an ad does not count. Tick or untick any chapter by hand.
• Notes pinned to the moment. Write a note while you watch; it keeps the time you started typing.
Click the time to jump back. Typing never triggers YouTube's shortcuts.
• Resume where you stopped, in one click.
• Export a course to Markdown: chapters as a checklist, notes as links back into the video.
• English and Arabic, light and dark.

Free: up to 3 courses in progress at a time, with everything above.

Coursemark Pro (one-time purchase, sold by the developer through Lemon Squeezy, not by the store):
• unlimited courses in progress
• study time for today and the week, and your streak of study days
• backup to a file and restore in another browser or on another computer

Private by design: everything stays in your browser. No account, no analytics, no server. The only
network request is to the license server, and only if you enter a Pro key.

Source code on GitHub: https://github.com/RootX22/coursemark

Coursemark is not affiliated with or endorsed by YouTube or Google.

## Description, Arabic

الدورات الطويلة على يوتيوب مفيدة، حتى تنسى أين توقفت. يحوّل Coursemark الفيديو الطويل إلى دورة
تستطيع إنهاءها فعلًا.

• الفصول قائمة مهام. يقرأ Coursemark قائمة الفصول من وصف الفيديو ويعرضها بجانبه. والفيديو الذي لا
يحتوي على فصول يُقسَّم إلى أجزاء مدة كل منها عشر دقائق.
• تقدّم صادق. يُعلَّم الفصل تلقائيًا بعد مشاهدة 90% منه، ولا يُحتسب التخطي أو القفز أو الإعلانات.
ويمكنك تعليم أي فصل أو إلغاء تعليمه بنفسك.
• ملاحظات مرتبطة باللحظة. اكتب ملاحظتك أثناء المشاهدة، فتحتفظ بالوقت الذي بدأت فيه الكتابة. اضغط
على الوقت لتعود إليه. ولا تُفعِّل الكتابة اختصارات يوتيوب.
• تابع من حيث توقفت بضغطة واحدة.
• صدّر الدورة بصيغة Markdown: الفصول قائمة مهام، والملاحظات روابط تعود إلى الفيديو.
• بالعربية والإنجليزية، وبالوضعين الفاتح والداكن.

مجانًا: حتى 3 دورات قيد الدراسة في وقت واحد، مع كل ما سبق.

Coursemark Pro (شراء لمرة واحدة، يبيعه المطوّر عبر Lemon Squeezy وليس المتجر):
• عدد غير محدود من الدورات قيد الدراسة
• وقت الدراسة اليوم وخلال الأسبوع، وأيام الدراسة المتتالية
• نسخ احتياطي في ملف واستعادته في متصفح أو جهاز آخر

خصوصيتك أولًا: تبقى كل بياناتك في متصفحك. لا حساب ولا تحليلات ولا خادم. الاتصال الوحيد هو بخادم
التراخيص، وفقط إذا أدخلت مفتاح Pro.

Coursemark غير تابع ليوتيوب أو Google ولا يحظى بتأييدهما.

## Category

Chrome: Education. Firefox: Other (there is no education category); tags: youtube, study, notes.

## Chrome: Privacy practices tab

Single purpose:
Turn long YouTube videos into courses: track which chapters were watched and keep timestamped notes.

Permission justifications:

- `storage`: saves the learner's courses, notes, study time and Pro license on the device.
- Host permission `https://api.lemonsqueezy.com/*`: activates and re-checks the Pro license key
  with the shop that sells it. Called only after the user enters a key.
- Content scripts on `https://www.youtube.com/*`: read the current video's chapters and playback
  position, and show the course panel beside the video.

Remote code: No. Every script is packaged in the extension; `content/loader.js` imports the
packaged `content/main.js` module.

Data usage: Authentication information (the Pro license key, sent to Lemon Squeezy to verify the
purchase). Nothing else is collected. Tick the three certifications: not sold to third parties, not
used for unrelated purposes, not used for creditworthiness or lending.

Privacy policy URL: https://github.com/RootX22/coursemark/blob/main/PRIVACY.md

## Firefox: notes to reviewer

The files in the package are the source; nothing is minified, bundled or transpiled. The build
(`npm run build` in https://github.com/RootX22/coursemark) only copies `src/` and adds
`browser_specific_settings` to the manifest.

The linter's UNSAFE_VAR_ASSIGNMENT warning is for `content/loader.js`, which runs
`import(browser.runtime.getURL('content/main.js'))`: content scripts cannot be modules, so the loader
imports the packaged module. The argument is a fixed path inside the extension.

`content/bridge.js` runs in the page's main world (`"world": "MAIN"`) only to read the current
video's details from YouTube's player (`movie_player.getPlayerResponse()`), and posts them to the
content script, which validates them before use.

Data collection: none required. Optional `authenticationInfo`: the Pro license key is sent to
`api.lemonsqueezy.com` only after the user enters it, and the extension asks for that consent with
`permissions.request` first.

To test Pro: paste a review license key here. Create one in Lemon Squeezy with a 100% discount code
so the reviewer can activate it like a buyer would.
