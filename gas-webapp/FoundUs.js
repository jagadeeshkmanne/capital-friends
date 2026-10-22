/**
 * HOW DID YOU HEAR ABOUT US - asked once per family (the app shows it after setup is finished).
 *
 * The answer is kept in the family's own Settings tab (FoundUsVia / FoundUsDetail / FoundUsAt), so no other
 * member of the family is asked again, whichever email they sign in with. A short copy is also kept in this
 * project's Script Properties ("fu:<sheet id>") so the developer can count where families come from:
 * run foundUsReport() in the editor.
 *
 * The same dialog lets people report a bug or ask for a feature: sendFeedback_ below.
 */
var FOUNDUS_OPTIONS_ = { google: 1, youtube: 1, friend: 1, whatsapp: 1, social: 1, linkedin: 1, article: 1, other: 1 };

function saveFoundUs_(params, userRecord) {
  var via = String((params && params.via) || '').toLowerCase();
  if (!FOUNDUS_OPTIONS_[via]) throw new Error('Please pick an option');
  var detail = String(params.detail || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (via === 'other' && !detail) throw new Error('Please tell us where you heard about us');

  var already = getSetting('FoundUsVia');
  if (already) return { via: already, already: true };   // someone else in the family answered first

  var at = new Date().toISOString();
  updateSetting('FoundUsVia', via);
  updateSetting('FoundUsDetail', detail);
  updateSetting('FoundUsAt', at);
  try {
    var id = userRecord && userRecord.spreadsheetId;
    if (id) PropertiesService.getScriptProperties().setProperty('fu:' + id, [via, at.slice(0, 10), detail.slice(0, 60)].join('|'));
  } catch (e) { log('saveFoundUs_ count failed (ignored): ' + e.message); }
  return { via: via };
}

/**
 * Report a bug / request a feature from inside the app. Sent with the user's own Gmail (the gmail.send
 * permission the app already has for the daily email), so no mail server is needed and replying simply
 * answers them. A copy shows in their Sent folder. At most 5 a day per user.
 */
var DEV_EMAIL_ = 'capital.friends.dev@gmail.com';

function sendFeedback_(params, userRecord) {
  var kind = params && params.kind === 'feature' ? 'feature' : 'bug';
  var text = String((params && params.message) || '').replace(/\r/g, '').trim().slice(0, 4000);
  if (text.length < 5) throw new Error('Please write a few words first');
  var email = (userRecord && userRecord.email) || Session.getActiveUser().getEmail();

  var cache = CacheService.getUserCache(), sent = Number(cache.get('feedback_sent') || 0);
  if (sent >= 5) throw new Error('You have sent 5 messages today. Please email ' + DEV_EMAIL_ + ' directly.');

  var first = text.split('\n')[0].slice(0, 60);
  var subject = (kind === 'bug' ? 'Bug report' : 'Feature request') + ' - Capital Friends: ' + first;
  var body = text + '\n\n-- \nFrom: ' + (userRecord && userRecord.displayName ? userRecord.displayName + ' <' + email + '>' : email) +
    '\nPage: ' + String(params.page || '').slice(0, 200) +
    '\nDevice: ' + String(params.device || '').slice(0, 300) +
    '\nApp version: ' + String(params.version || '').slice(0, 40) +
    '\nSent: ' + new Date().toISOString();

  var opts = { name: 'Capital Friends user', replyTo: email };
  var shot = params.screenshot;
  if (shot && shot.data && /^image\/(png|jpe?g|webp|gif)$/.test(String(shot.type || ''))) {
    var bytes = Utilities.base64Decode(String(shot.data));
    if (bytes.length > 3 * 1024 * 1024) throw new Error('The screenshot is too big (max 3 MB)');
    opts.attachments = [Utilities.newBlob(bytes, shot.type, String(shot.name || 'screenshot').slice(0, 80))];
  }
  GmailApp.sendEmail(DEV_EMAIL_, subject, body, opts);
  cache.put('feedback_sent', String(sent + 1), 24 * 3600);
  return { sent: true };
}

/** Where families came from: counts per answer and the details they wrote (newest first). */
function foundUsStats_() {
  var all = PropertiesService.getScriptProperties().getProperties();
  var counts = {}, list = [], total = 0;
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('fu:') !== 0) return;
    var p = String(all[k]).split('|'), via = p[0];
    total++;
    counts[via] = (counts[via] || 0) + 1;
    list.push({ date: p[1] || '', via: via, detail: p.slice(2).join('|') });
  });
  list.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  var families = null;
  try { families = countAppUsers_().families; } catch (e) { /* ignore */ }
  return { total: total, families: families, counts: counts, list: list.slice(0, 500), at: new Date().toISOString() };
}

/** Run from the editor to see the same numbers as the admin page (/admin/found-us). */
function foundUsReport() {
  var out = foundUsStats_();
  Logger.log(JSON.stringify(out, null, 2));
  return out;
}
