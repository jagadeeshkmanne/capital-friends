/**
 * APP STATS - how many families use Capital Friends (only counts, nothing personal)
 *
 * Counted from the user registry (Script Properties): families = different sheets in use,
 * users = signed-up people (family members sharing a sheet count once as a family).
 * Sent to the master DB admin endpoint, which writes the public App_Stats tab that the
 * landing page reads. Runs at most every 6 hours, piggy-backing on app opens and sign-ups.
 *
 * Setup (once): in the master DB project run setAdminSecret(), then put that secret in this
 * project's Script Properties as MASTER_DB_ADMIN_SECRET. Without it nothing is sent.
 * To send now: run publishAppStatsNow() in the editor.
 */
var APPSTATS_MASTER_URL_ = 'https://script.google.com/macros/s/AKfycbxdTWO2_k9sVKokJoHTqoEDGnqbW7Y0blVp3pe7ihlCP-h1KdhRlzTDkrvOae5nvvOK/exec';

function countAppUsers_() {
  var all = PropertiesService.getScriptProperties().getProperties();
  var sheets = {}, users = 0, active30 = {}, cutoff = Date.now() - 30 * 86400000;
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('user:') !== 0) return;
    var r;
    try { r = JSON.parse(all[k]); } catch (e) { return; }
    if (!r || r.status === 'Suspended' || !r.spreadsheetId) return;
    users++;
    sheets[r.spreadsheetId] = true;
    var last = r.lastLogin ? new Date(r.lastLogin).getTime() : 0;
    if (last && last >= cutoff) active30[r.spreadsheetId] = true;
  });
  return { families: Object.keys(sheets).length, users: users, active30: Object.keys(active30).length };
}

function publishAppStats_(force) {
  try {
    var secret = PropertiesService.getScriptProperties().getProperty('MASTER_DB_ADMIN_SECRET');
    if (!secret) return null;
    var cache = CacheService.getScriptCache();
    if (!force && cache.get('appstats_sent')) return null;
    cache.put('appstats_sent', '1', 6 * 3600);
    var stats = countAppUsers_();
    var res = UrlFetchApp.fetch(APPSTATS_MASTER_URL_, {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true, followRedirects: true,
      payload: JSON.stringify({ secret: secret, action: 'setAppStats', stats: stats })
    });
    return { code: res.getResponseCode(), stats: stats, body: String(res.getContentText()).slice(0, 200) };
  } catch (e) {
    log('publishAppStats_ failed (ignored): ' + e.message);
    return null;
  }
}

/** Run from the editor to send the numbers right away. */
function publishAppStatsNow() {
  var r = publishAppStats_(true);
  Logger.log(JSON.stringify(r));
  return r;
}
