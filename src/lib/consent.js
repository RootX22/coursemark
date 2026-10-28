import { ext } from './ext.js';

// Firefox asks the user before an add-on sends data anywhere, and a license key counts as
// account data there. Chrome has no such step, so there the answer is always yes.
const LICENSE_DATA = { data_collection: ['authenticationInfo'] };
const asksConsent = Boolean(ext.runtime.getManifest().browser_specific_settings?.gecko?.data_collection_permissions);

/** Must be called straight from a click, before anything is awaited, or Firefox refuses to ask. */
export function askToSendLicense() {
  return asksConsent ? ext.permissions.request(LICENSE_DATA) : Promise.resolve(true);
}

export function maySendLicense() {
  return asksConsent ? ext.permissions.contains(LICENSE_DATA) : Promise.resolve(true);
}
