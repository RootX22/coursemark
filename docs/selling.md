# Selling Pro and publishing

This is the owner's checklist: set up the shop, put its ids in the build, and submit to both stores.

## 1. Lemon Squeezy

Lemon Squeezy is the merchant of record: it charges the buyer, handles sales tax and VAT, emails the
license key, and pays out to a bank account or PayPal. Its
[supported countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries) page
lists Egypt and Saudi Arabia for bank payouts. Fees are 5% + 50¢ per sale.

1. Create an account and a store, and complete the identity check and payout details.
2. Products → New product, named "Coursemark Pro":
   - Pricing: single payment. A suggestion: $7.99, with a launch discount code.
   - Turn on **Generate license keys**. Activation limit: 5 (one per browser the buyer uses).
     License length: unlimited.
3. Copy three values into [`src/lib/config.js`](../src/lib/config.js):
   - `storeId`: Settings → Stores, the number next to the store name.
   - `productId`: the number in the product page's address.
   - `checkoutUrl`: the product's Share link, `https://<store>.lemonsqueezy.com/buy/<id>`.
4. Test with Lemon Squeezy's test mode: buy with the test card, paste the emailed key into the
   library page, and check that Pro turns on. Refund it from the dashboard; within a week (or after
   setting the extension's clock forward) the library shows the key as no longer valid.

The extension checks that a key belongs to this store and product, so a key bought for anything
else is refused and its activation released.

## 2. Build

Raise `version` in both `package.json` and `src/manifest.json` (the build refuses if they differ),
then:

```sh
npm ci && npm test && npm run test:e2e && npm run lint
npm run build
```

`dist/coursemark-<version>-chrome.zip` and `dist/coursemark-<version>-firefox.zip` are the uploads.
Pushing a tag `v<version>` makes CI attach both to a GitHub release.

## 3. Chrome Web Store

1. Register at the [developer dashboard](https://chrome.google.com/webstore/devconsole) (one-time
   $5 fee).
2. New item → upload the Chrome zip.
3. Store listing, Privacy practices and Distribution: copy from
   [`store/listing.md`](../store/listing.md). Images are in [`store/`](../store).
4. Submit for review.

Chrome has no in-store payments; the listing must say that Pro is sold by you, not by Google, which
the listing text already does.

## 4. Firefox Add-ons

1. Sign in at the [Add-on Developer Hub](https://addons.mozilla.org/developers/) and submit a new
   add-on, listed on this site.
2. Upload the Firefox zip. Mozilla's linter reports one warning, the dynamic `import()` in
   `content/loader.js`; the reviewer notes in `store/listing.md` explain it.
3. Source code: not required (nothing is minified or bundled), but the notes link to this repository.
4. Fill in the listing from `store/listing.md`, including the line that some features are paid.

## 5. After launch

- Put the store links in the README's Install section.
- Answer reviews; a few early ratings decide how often the listings are shown.
- Each new version: raise the version, build, upload to both stores, push the tag.
