/**
 * ============================================================================
 * SHEETS ADAPTER - SpreadsheetApp look-alike that works with ONLY drive.file
 * ============================================================================
 *
 * Why: Google refused the "spreadsheets" scope. SpreadsheetApp needs it, the
 * Sheets API (Advanced Sheets service) and Drive API do not (drive.file covers
 * every sheet this app created or the user picked in the Google Picker).
 *
 * How: getSpreadsheet() returns SheetsAdapter.openById(id) instead of
 * SpreadsheetApp.openById(id) when the USE_SHEETS_API switch is on for the user
 * (see useSheetsApi_ in Code.js). Business code keeps calling the same methods.
 *
 * Batching (keeps us far below 60 Sheets API calls / minute / user):
 *  - Reads: the first read of a tab loads the whole tab (2 calls for any number
 *    of tabs: computed values + formulas). Later reads come from memory.
 *  - Writes and formatting are queued in order and sent by flush():
 *    consecutive value writes -> 1 values.batchUpdate,
 *    consecutive format/structure changes -> 1 spreadsheets.batchUpdate.
 *  - Like SpreadsheetApp, a read after a pending write flushes first when the
 *    tab has formulas (so formula results are fresh).
 *  - flushSheets_() is called at the end of every request (WebApp.js) and
 *    trigger, and wherever the old code called SpreadsheetApp.flush().
 *
 * Dates: cells shown as dates come back as JavaScript Date objects (same as
 * SpreadsheetApp). Dates written are sent as 'yyyy-MM-dd HH:mm:ss' with
 * USER_ENTERED so Sheets stores real dates.
 * ============================================================================
 */

var SHEETS_API_CALLS = 0; // per execution, for logging / tests

var SheetsAdapter = (function () {

  // ---------- helpers ----------
  function q_(name) { return "'" + String(name).replace(/'/g, "''") + "'"; }
  function colToA1_(c) { var s = ''; while (c > 0) { var m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
  function a1ColToNum_(s) { var n = 0; for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64); return n; }
  function parseA1_(a1) {
    var s = String(a1).toUpperCase().replace(/\$/g, '');
    if (s.indexOf('!') >= 0) s = s.split('!').pop();
    var m = s.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
    if (m) {
      var r1 = +m[2], c1 = a1ColToNum_(m[1]), r2 = m[4] ? +m[4] : r1, c2 = m[3] ? a1ColToNum_(m[3]) : c1;
      return { row: Math.min(r1, r2), col: Math.min(c1, c2), rows: Math.abs(r2 - r1) + 1, cols: Math.abs(c2 - c1) + 1 };
    }
    var mc = s.match(/^([A-Z]+):([A-Z]+)$/); // whole columns, e.g. A:A
    if (mc) { var a = a1ColToNum_(mc[1]), b = a1ColToNum_(mc[2]); return { row: 1, col: Math.min(a, b), rows: null, cols: Math.abs(b - a) + 1 }; }
    var mr = s.match(/^(\d+):(\d+)$/); // whole rows, e.g. 2:2
    if (mr) { var r = +mr[1], t = +mr[2]; return { row: Math.min(r, t), col: 1, rows: Math.abs(t - r) + 1, cols: null }; }
    throw new Error('SheetsAdapter: unsupported A1 range "' + a1 + '"');
  }
  function api_(fn) { SHEETS_API_CALLS++; return withRetry_(fn); }
  function withRetry_(fn) {
    var wait = 1000;
    for (var i = 0; ; i++) {
      try { return fn(); }
      catch (e) {
        var msg = String(e && e.message || e);
        // per-minute quota: back off 1+2+4+8+16+32 s (~1 min) before giving up
        if (i < 6 && /429|Quota exceeded|Rate Limit|rateLimitExceeded|503|backendError|internal error/i.test(msg)) {
          Utilities.sleep(wait + Math.floor(Math.random() * 500)); wait *= 2; continue;
        }
        throw e;
      }
    }
  }
  function hexToColor_(hex) {
    if (hex === null || hex === undefined || hex === '') return null;
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return null;
    return { red: ((n >> 16) & 255) / 255, green: ((n >> 8) & 255) / 255, blue: (n & 255) / 255 };
  }
  var H_ALIGN = { left: 'LEFT', center: 'CENTER', right: 'RIGHT', normal: 'LEFT', general: 'LEFT' };
  var V_ALIGN = { top: 'TOP', middle: 'MIDDLE', center: 'MIDDLE', bottom: 'BOTTOM' };

  // ---------- Spreadsheet ----------
  function Book(id) {
    this.id = id;
    this._meta = null;          // { title, timeZone, locale, sheets: [{title, sheetId, index, hidden, rowCount, columnCount, cfCount}] }
    this._tabs = {};            // title -> { values: [[]], formulas: [[]], hasFormulas: bool }
    this._queue = [];           // [{kind:'values', data:[...]} | {kind:'req', requests:[...]}]
    this._pendingTabs = {};     // titles with queued writes
    this._staleTabs = {};       // titles whose cache must be reloaded after next flush
    this.autoFlush = false;     // true outside API requests (triggers): send every change right away
  }
  Book.prototype.getId = function () { return this.id; };
  Book.prototype.getUrl = function () { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; };
  Book.prototype.getName = function () { return this._m().title; };
  Book.prototype._m = function () {
    if (!this._meta) {
      var self = this;
      var r = api_(function () {
        return Sheets.Spreadsheets.get(self.id, { fields: 'properties(title,timeZone,locale),sheets(properties(title,sheetId,index,hidden,gridProperties(rowCount,columnCount,frozenRowCount)),conditionalFormats(ranges))' });
      });
      this._meta = {
        title: r.properties.title, timeZone: r.properties.timeZone || Session.getScriptTimeZone(), locale: r.properties.locale,
        sheets: (r.sheets || []).map(function (s) {
          var p = s.properties, g = p.gridProperties || {};
          return { title: p.title, sheetId: p.sheetId, index: p.index, hidden: !!p.hidden, rowCount: g.rowCount || 1000, columnCount: g.columnCount || 26, cfCount: (s.conditionalFormats || []).length };
        })
      };
    }
    return this._meta;
  };
  Book.prototype._sheetMeta = function (title) {
    var s = this._m().sheets.filter(function (x) { return x.title === title; })[0];
    if (!s) throw new Error('SheetsAdapter: sheet "' + title + '" not found');
    return s;
  };
  Book.prototype.getSheets = function () {
    var b = this;
    return this._m().sheets.slice().sort(function (x, y) { return x.index - y.index; }).map(function (s) { return new Sheet(b, s.title); });
  };
  Book.prototype.getSheetByName = function (name) {
    return this._m().sheets.some(function (s) { return s.title === name; }) ? new Sheet(this, name) : null;
  };
  Book.prototype.insertSheet = function (name, index) {
    var m = this._m();
    if (typeof name === 'number') { index = name; name = 'Sheet' + (m.sheets.length + 1); }
    if (!name) name = 'Sheet' + (m.sheets.length + 1);
    // choose our own sheetId so formatting can be queued without a round trip
    var sheetId, used = {};
    m.sheets.forEach(function (s) { used[s.sheetId] = true; });
    do { sheetId = 1 + Math.floor(Math.random() * 2000000000); } while (used[sheetId]);
    // SpreadsheetApp (opened by id) inserts right after the active sheet, which is
    // the first tab - so new tabs land at position 2, newest first. Match that.
    var idx = typeof index === 'number' ? index : Math.min(1, m.sheets.length);
    this._req({ addSheet: { properties: { title: name, sheetId: sheetId, index: idx } } });
    m.sheets.forEach(function (s) { if (s.index >= idx) s.index++; });
    m.sheets.push({ title: name, sheetId: sheetId, index: idx, hidden: false, rowCount: 1000, columnCount: 26, cfCount: 0 });
    this._tabs[name] = { values: [], formulas: [], hasFormulas: false };
    return new Sheet(this, name);
  };
  Book.prototype.deleteSheet = function (sheet) {
    var title = sheet.getName(), sm = this._sheetMeta(title), m = this._m();
    this._req({ deleteSheet: { sheetId: sm.sheetId } });
    m.sheets = m.sheets.filter(function (s) { return s.title !== title; });
    m.sheets.forEach(function (s) { if (s.index > sm.index) s.index--; });
    delete this._tabs[title];
  };
  Book.prototype.setSpreadsheetTimeZone = function (tz) {
    this._m();  // load metadata first, so the server's old time zone can't overwrite ours later
    this._req({ updateSpreadsheetProperties: { properties: { timeZone: tz }, fields: 'timeZone' } });
    this._meta.timeZone = tz;
  };
  // The Sheets API rejects some locales SpreadsheetApp accepts (e.g. en_IN).
  // Send it on its own (never inside the batch, one bad request fails the whole
  // batch) and keep the current locale if the API refuses it.
  Book.prototype.setSpreadsheetLocale = function (loc) {
    var self = this;
    try {
      api_(function () { return Sheets.Spreadsheets.batchUpdate({ requests: [{ updateSpreadsheetProperties: { properties: { locale: loc }, fields: 'locale' } }] }, self.id); });
      if (self._meta) self._meta.locale = loc;
    } catch (e) {
      Logger.log('SheetsAdapter: locale ' + loc + ' not supported by Sheets API, keeping ' + (self._meta ? self._meta.locale : 'current') + ' (' + e.message + ')');
    }
  };
  Book.prototype.getSpreadsheetTimeZone = function () { return this._m().timeZone; };
  Book.prototype.getOwner = function () {
    var self = this;
    var f = api_(function () { return Drive.Files.get(self.id, { fields: 'owners(emailAddress)' }); });
    var email = f.owners && f.owners[0] ? f.owners[0].emailAddress : '';
    return { getEmail: function () { return email; } };
  };
  Book.prototype.addEditor = function (email) { return this._share(email, 'writer'); };
  Book.prototype.addViewer = function (email) { return this._share(email, 'reader'); };
  Book.prototype._share = function (email, role) {
    var self = this;
    api_(function () { return Drive.Permissions.create({ role: role, type: 'user', emailAddress: email }, self.id, { sendNotificationEmail: false }); });
    return this;
  };
  Book.prototype.removeEditor = function (email) {
    var self = this;
    var list = api_(function () { return Drive.Permissions.list(self.id, { fields: 'permissions(id,emailAddress,role)' }); });
    (list.permissions || []).forEach(function (p) {
      if (p.emailAddress && p.emailAddress.toLowerCase() === String(email).toLowerCase() && p.role !== 'owner') {
        api_(function () { return Drive.Permissions.remove(self.id, p.id); });
      }
    });
    return this;
  };

  // ---- queue ----
  // Formatting-type requests don't depend on cell values, so they may jump ahead of
  // value writes queued after the last request batch. That keeps the queue to a few
  // calls instead of one call per format/value switch (Sheets API write quota is
  // 60 calls per minute per user). Requests never move past other requests.
  var HOISTABLE_ = { addSheet: 1, repeatCell: 1, updateBorders: 1, mergeCells: 1, unmergeCells: 1, addConditionalFormatRule: 1,
    addProtectedRange: 1, updateDimensionProperties: 1, updateSheetProperties: 1 };
  function hoistable_(req) {
    var k = Object.keys(req)[0];
    if (!HOISTABLE_[k]) return false;
    // Number formats interact with typed-in values (a typed date sets a date format,
    // a Text format changes parsing), so those keep their original order.
    if (k === 'repeatCell' && /numberFormat/.test(req.repeatCell.fields || '')) return false;
    return true;
  }
  Book.prototype._req = function (request) {
    var q = this._queue, last = q[q.length - 1];
    if (last && last.kind === 'req') last.requests.push(request);
    else if (last && last.kind === 'values' && hoistable_(request)) {
      var prev = q[q.length - 2];
      if (prev && prev.kind === 'req') prev.requests.push(request);
      else q.splice(q.length - 1, 0, { kind: 'req', requests: [request] });
    }
    else q.push({ kind: 'req', requests: [request] });
    if (this.autoFlush) this.flush();
  };
  Book.prototype._vals = function (title, range, values) {
    var last = this._queue[this._queue.length - 1];
    var item = { range: q_(title) + '!' + range, values: values };
    if (last && last.kind === 'values') last.data.push(item); else this._queue.push({ kind: 'values', data: [item] });
    this._pendingTabs[title] = true;
    if (this.autoFlush) this.flush();
  };
  Book.prototype.hasPending = function () { return this._queue.length > 0; };
  Book.prototype.flush = function () {
    if (!this._queue.length) return this;
    var self = this, queue = this._queue;
    this._queue = [];
    queue.forEach(function (seg) {
      if (seg.kind === 'values') {
        api_(function () { return Sheets.Spreadsheets.Values.batchUpdate({ valueInputOption: 'USER_ENTERED', data: seg.data }, self.id); });
      } else {
        api_(function () { return Sheets.Spreadsheets.batchUpdate({ requests: seg.requests }, self.id); });
      }
    });
    // After a flush, tabs with formulas (or touched by structure changes) may have new computed values.
    var t;
    for (t in this._tabs) { if (this._tabs[t].hasFormulas || this._staleTabs[t]) delete this._tabs[t]; }
    for (t in this._pendingTabs) { if (this._tabs[t] && this._tabs[t].wroteFormula) delete this._tabs[t]; }
    this._pendingTabs = {};
    this._staleTabs = {};
    return this;
  };

  // ---- reading ----
  // Load several tabs at once: 2 calls total (formulas view + computed values with date detection).
  Book.prototype.preload = function (titles) {
    var self = this;
    var need = (titles || []).filter(function (t) { return !self._tabs[t]; });
    if (!need.length) return;
    // A read must see pending writes (SpreadsheetApp flushes before reads too).
    if (this._queue.length) { this.flush(); need = (titles || []).filter(function (t) { return !self._tabs[t]; }); if (!need.length) return; }
    var ranges = need.map(q_);
    var tz = this._m().timeZone;
    var f = api_(function () { return Sheets.Spreadsheets.Values.batchGet(self.id, { ranges: ranges, valueRenderOption: 'FORMULA', dateTimeRenderOption: 'SERIAL_NUMBER' }); });
    var v = api_(function () { return Sheets.Spreadsheets.Values.batchGet(self.id, { ranges: ranges, valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING' }); });
    need.forEach(function (title, i) {
      var fr = (f.valueRanges[i] && f.valueRanges[i].values) || [];
      var vr = (v.valueRanges[i] && v.valueRanges[i].values) || [];
      var rows = Math.max(fr.length, vr.length), values = [], formulas = [], hasF = false;
      for (var r = 0; r < rows; r++) {
        var frow = fr[r] || [], vrow = vr[r] || [], n = Math.max(frow.length, vrow.length), vals = [], fms = [];
        for (var c = 0; c < n; c++) {
          var raw = frow[c], val = vrow[c];
          var isFormula = typeof raw === 'string' && raw.charAt(0) === '=';
          if (isFormula) { hasF = true; fms.push(raw); } else fms.push('');
          // number in the raw view but text in the computed view = a date/time cell
          if (!isFormula && typeof raw === 'number' && typeof val === 'string') val = serialToDate_(raw, tz);
          vals.push(val === undefined || val === null ? '' : val);
        }
        values.push(vals); formulas.push(fms);
      }
      self._tabs[title] = { values: values, formulas: formulas, hasFormulas: hasF };
    });
  };
  Book.prototype._tab = function (title) {
    var t = this._tabs[title];
    // pending writes on a formula tab: flush so computed values are fresh
    if (t && this._queue.length && (t.hasFormulas || t.wroteFormula)) { this.flush(); t = this._tabs[title]; }
    if (!t) { this.preload([title]); t = this._tabs[title]; }
    return t;
  };
  function serialToDate_(serial, tz) {
    var ms = Math.round((serial - 25569) * 86400000);
    var wall = Utilities.formatDate(new Date(ms), 'UTC', 'yyyy-MM-dd HH:mm:ss');
    return Utilities.parseDate(wall, tz, 'yyyy-MM-dd HH:mm:ss');
  }

  // ---------- Sheet ----------
  function Sheet(book, title) { this.book = book; this.title = title; }
  Sheet.prototype.getName = function () { return this.title; };
  Sheet.prototype.getParent = function () { return this.book; };
  Sheet.prototype.getSheetId = function () { return this.book._sheetMeta(this.title).sheetId; };
  Sheet.prototype.getIndex = function () { return this.book._sheetMeta(this.title).index + 1; };
  Sheet.prototype.activate = function () { return this; };
  Sheet.prototype.getMaxRows = function () { return this.book._sheetMeta(this.title).rowCount; };
  Sheet.prototype.getMaxColumns = function () { return this.book._sheetMeta(this.title).columnCount; };
  Sheet.prototype.getLastRow = function () {
    var v = this.book._tab(this.title).values;
    for (var r = v.length; r > 0; r--) { var row = v[r - 1] || []; for (var c = 0; c < row.length; c++) if (row[c] !== '' && row[c] !== null && row[c] !== undefined) return r; }
    return 0;
  };
  Sheet.prototype.getLastColumn = function () {
    var v = this.book._tab(this.title).values, max = 0;
    v.forEach(function (row) { for (var c = row.length; c > max; c--) if (row[c - 1] !== '' && row[c - 1] !== null && row[c - 1] !== undefined) { max = c; break; } });
    return max;
  };
  Sheet.prototype.getRange = function (a, b, c, d) {
    if (typeof a === 'string') {
      var p = parseA1_(a);
      return new Range(this, p.row, p.col, p.rows === null ? this.getMaxRows() : p.rows, p.cols === null ? this.getMaxColumns() : p.cols);
    }
    return new Range(this, a, b, c || 1, d || 1);
  };
  Sheet.prototype.getDataRange = function () { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); };
  Sheet.prototype.appendRow = function (values) {
    this.getRange(this.getLastRow() + 1, 1, 1, values.length).setValues([values]);
    return this;
  };
  Sheet.prototype._grid = function (row, col, rows, cols) {
    var g = { sheetId: this.getSheetId(), startRowIndex: row - 1, startColumnIndex: col - 1 };
    if (rows) g.endRowIndex = row - 1 + rows;
    if (cols) g.endColumnIndex = col - 1 + cols;
    return g;
  };
  Sheet.prototype._dim = function (dimension, start, count, props, fields) {
    this.book._req({ updateDimensionProperties: { range: { sheetId: this.getSheetId(), dimension: dimension, startIndex: start - 1, endIndex: start - 1 + count }, properties: props, fields: fields } });
    return this;
  };
  Sheet.prototype.setColumnWidth = function (col, px) { return this._dim('COLUMNS', col, 1, { pixelSize: px }, 'pixelSize'); };
  Sheet.prototype.setColumnWidths = function (col, n, px) { return this._dim('COLUMNS', col, n, { pixelSize: px }, 'pixelSize'); };
  Sheet.prototype.setRowHeight = function (row, px) { return this._dim('ROWS', row, 1, { pixelSize: px }, 'pixelSize'); };
  Sheet.prototype.setRowHeights = function (row, n, px) { return this._dim('ROWS', row, n, { pixelSize: px }, 'pixelSize'); };
  Sheet.prototype.hideColumns = function (col, n) { return this._dim('COLUMNS', col, n || 1, { hiddenByUser: true }, 'hiddenByUser'); };
  Sheet.prototype.showColumns = function (col, n) { return this._dim('COLUMNS', col, n || 1, { hiddenByUser: false }, 'hiddenByUser'); };
  Sheet.prototype.autoResizeColumns = function (col, n) {
    this.book._req({ autoResizeDimensions: { dimensions: { sheetId: this.getSheetId(), dimension: 'COLUMNS', startIndex: col - 1, endIndex: col - 1 + n } } });
    return this;
  };
  Sheet.prototype._props = function (props, fields) {
    props.sheetId = this.getSheetId();
    this.book._req({ updateSheetProperties: { properties: props, fields: fields } });
    return this;
  };
  Sheet.prototype.setFrozenRows = function (n) { return this._props({ gridProperties: { frozenRowCount: n } }, 'gridProperties.frozenRowCount'); };
  Sheet.prototype.setFrozenColumns = function (n) { return this._props({ gridProperties: { frozenColumnCount: n } }, 'gridProperties.frozenColumnCount'); };
  Sheet.prototype.setTabColor = function (hex) { return this._props({ tabColor: hexToColor_(hex) || {} }, 'tabColor'); };
  Sheet.prototype.hideSheet = function () { this.book._sheetMeta(this.title).hidden = true; return this._props({ hidden: true }, 'hidden'); };
  Sheet.prototype.showSheet = function () { this.book._sheetMeta(this.title).hidden = false; return this._props({ hidden: false }, 'hidden'); };
  Sheet.prototype.isSheetHidden = function () { return this.book._sheetMeta(this.title).hidden; };
  Sheet.prototype.setName = function (name) {
    var old = this.title, sm = this.book._sheetMeta(old);
    this._props({ title: name }, 'title');
    sm.title = name;
    if (this.book._tabs[old]) { this.book._tabs[name] = this.book._tabs[old]; delete this.book._tabs[old]; }
    this.title = name;
    return this;
  };
  Sheet.prototype._insertDim = function (dimension, startIndex0, count) {
    this.book._req({ insertDimension: { range: { sheetId: this.getSheetId(), dimension: dimension, startIndex: startIndex0, endIndex: startIndex0 + count }, inheritFromBefore: startIndex0 > 0 } });
    var sm = this.book._sheetMeta(this.title), t = this.book._tabs[this.title];
    if (dimension === 'ROWS') {
      sm.rowCount += count;
      if (t) { var blanks = []; for (var i = 0; i < count; i++) blanks.push([]); Array.prototype.splice.apply(t.values, [startIndex0, 0].concat(blanks)); Array.prototype.splice.apply(t.formulas, [startIndex0, 0].concat(blanks.map(function () { return []; }))); }
    } else {
      sm.columnCount += count;
      if (t) [t.values, t.formulas].forEach(function (g) { g.forEach(function (row) { if (row.length > startIndex0) Array.prototype.splice.apply(row, [startIndex0, 0].concat(new Array(count).fill(''))); }); });
    }
    this.book._staleTabs[this.title] = true;
    return this;
  };
  Sheet.prototype.insertRowBefore = function (row) { return this._insertDim('ROWS', row - 1, 1); };
  Sheet.prototype.insertRowAfter = function (row) { return this._insertDim('ROWS', row, 1); };
  Sheet.prototype.insertRowsAfter = function (row, n) { return this._insertDim('ROWS', row, n); };
  Sheet.prototype.insertRowsBefore = function (row, n) { return this._insertDim('ROWS', row - 1, n); };
  Sheet.prototype.insertColumnsAfter = function (col, n) { return this._insertDim('COLUMNS', col, n); };
  Sheet.prototype.deleteRow = function (row) { return this.deleteRows(row, 1); };
  Sheet.prototype.deleteRows = function (row, n) {
    this.book._req({ deleteDimension: { range: { sheetId: this.getSheetId(), dimension: 'ROWS', startIndex: row - 1, endIndex: row - 1 + n } } });
    var sm = this.book._sheetMeta(this.title), t = this.book._tabs[this.title];
    sm.rowCount -= n;
    if (t) { t.values.splice(row - 1, n); t.formulas.splice(row - 1, n); }
    this.book._staleTabs[this.title] = true;
    return this;
  };
  Sheet.prototype.clear = function () { this.getRange(1, 1, this.getMaxRows(), this.getMaxColumns()).clear(); return this; };
  Sheet.prototype.clearContents = function () { this.getRange(1, 1, this.getMaxRows(), this.getMaxColumns()).clearContent(); return this; };
  Sheet.prototype.getConditionalFormatRules = function () {
    // Existing rules stay on the sheet; we only ADD new rules (all callers do rules.push(...) then set).
    var arr = [];
    arr.__adapterExisting = this.book._sheetMeta(this.title).cfCount;
    return arr;
  };
  Sheet.prototype.setConditionalFormatRules = function (rules) {
    var self = this, start = rules.__adapterExisting || 0, sm = this.book._sheetMeta(this.title);
    rules.forEach(function (rule, i) {
      if (!rule || !rule.__adapterRule) return; // a pre-existing rule kept by caller
      var ranges = rule.ranges.map(function (r) { return self._gridFor(r); });
      var r = { ranges: ranges, booleanRule: { condition: rule.condition, format: rule.format } };
      self.book._req({ addConditionalFormatRule: { rule: r, index: start + i } });
    });
    sm.cfCount = start + rules.length;
    return this;
  };
  Sheet.prototype._gridFor = function (range) { return range.sheet._grid(range.row, range.col, range.rows, range.cols); };
  Sheet.prototype.protect = function () { return new Protection_(this, null); };

  // ---------- Range ----------
  function Range(sheet, row, col, rows, cols) { this.sheet = sheet; this.book = sheet.book; this.row = row; this.col = col; this.rows = rows; this.cols = cols; }
  Range.prototype.getRow = function () { return this.row; };
  Range.prototype.getColumn = function () { return this.col; };
  Range.prototype.getNumRows = function () { return this.rows; };
  Range.prototype.getNumColumns = function () { return this.cols; };
  Range.prototype.getLastRow = function () { return this.row + this.rows - 1; };
  Range.prototype.getLastColumn = function () { return this.col + this.cols - 1; };
  Range.prototype.getSheet = function () { return this.sheet; };
  Range.prototype.getA1Notation = function () {
    var a = colToA1_(this.col) + this.row;
    return (this.rows === 1 && this.cols === 1) ? a : a + ':' + colToA1_(this.col + this.cols - 1) + (this.row + this.rows - 1);
  };
  Range.prototype._read = function (which) {
    var t = this.book._tab(this.sheet.title), g = t[which], out = [];
    for (var r = 0; r < this.rows; r++) {
      var src = g[this.row - 1 + r] || [], line = [];
      for (var c = 0; c < this.cols; c++) { var v = src[this.col - 1 + c]; line.push(v === undefined || v === null ? '' : v); }
      out.push(line);
    }
    return out;
  };
  Range.prototype.getValues = function () { return this._read('values'); };
  Range.prototype.getValue = function () { return this._read('values')[0][0]; };
  Range.prototype.getDisplayValues = function () { return this._read('values').map(function (r) { return r.map(function (v) { return v instanceof Date ? v.toLocaleDateString() : String(v); }); }); };
  Range.prototype.getFormulas = function () { return this._read('formulas'); };
  Range.prototype.getFormula = function () { return this._read('formulas')[0][0]; };
  Range.prototype.setValues = function (vals) {
    if (!vals || !vals.length) return this;
    var tz = this.book._m().timeZone, title = this.sheet.title, t = this.book._tabs[title], wroteFormula = false;
    var out = vals.map(function (row) {
      return row.map(function (v) {
        if (v instanceof Date) {
          var hms = Utilities.formatDate(v, tz, 'HH:mm:ss.SSS');
          return Utilities.formatDate(v, tz, hms === '00:00:00.000' ? 'yyyy-MM-dd' : (v.getMilliseconds() ? 'yyyy-MM-dd HH:mm:ss.SSS' : 'yyyy-MM-dd HH:mm:ss'));
        }
        if (v === null || v === undefined) return '';
        if (typeof v === 'string' && v.charAt(0) === '=') wroteFormula = true;
        return v;
      });
    });
    // keep the in-memory copy in sync (so reads after writes see the new values)
    if (t) {
      for (var r = 0; r < vals.length; r++) {
        var i = this.row - 1 + r;
        while (t.values.length <= i) { t.values.push([]); t.formulas.push([]); }
        for (var c = 0; c < vals[r].length; c++) {
          var v = vals[r][c], j = this.col - 1 + c;
          var isF = typeof v === 'string' && v.charAt(0) === '=';
          t.values[i][j] = isF ? '' : (v === null || v === undefined ? '' : v);
          t.formulas[i][j] = isF ? v : '';
        }
      }
      if (wroteFormula) t.wroteFormula = true;
    }
    var endCol = colToA1_(this.col + vals[0].length - 1), endRow = this.row + vals.length - 1;
    this.book._vals(title, colToA1_(this.col) + this.row + ':' + endCol + endRow, out);
    return this;
  };
  Range.prototype.setValue = function (v) {
    var grid = [];
    for (var r = 0; r < this.rows; r++) { var row = []; for (var c = 0; c < this.cols; c++) row.push(v); grid.push(row); }
    return this.setValues(grid);
  };
  Range.prototype.setFormula = function (f) { return this.setValue(f); };
  Range.prototype.setFormulas = function (fs) { return this.setValues(fs); };
  Range.prototype.clearContent = function () {
    this.book._req({ updateCells: { range: this._gridRange(), fields: 'userEnteredValue' } });
    this._blank();
    return this;
  };
  Range.prototype.clear = function () {
    this.book._req({ updateCells: { range: this._gridRange(), fields: 'userEnteredValue,userEnteredFormat' } });
    this._blank();
    return this;
  };
  Range.prototype._blank = function () {
    var t = this.book._tabs[this.sheet.title];
    if (!t) return;
    for (var r = 0; r < this.rows; r++) {
      var i = this.row - 1 + r; if (!t.values[i]) continue;
      for (var c = 0; c < this.cols; c++) { t.values[i][this.col - 1 + c] = ''; if (t.formulas[i]) t.formulas[i][this.col - 1 + c] = ''; }
    }
  };
  Range.prototype._gridRange = function () { return this.sheet._grid(this.row, this.col, this.rows, this.cols); };
  Range.prototype._fmt = function (format, fields) {
    this.book._req({ repeatCell: { range: this._gridRange(), cell: { userEnteredFormat: format }, fields: fields } });
    return this;
  };
  Range.prototype.setNumberFormat = function (pattern) {
    var type = /^@$/.test(pattern) ? 'TEXT' : (/[dy]/i.test(pattern.replace(/"[^"]*"/g, '')) || /mmm/i.test(pattern)) ? 'DATE' : (/%$/.test(pattern) ? 'PERCENT' : 'NUMBER');
    if (type === 'DATE' && /h/i.test(pattern)) type = 'DATE_TIME';
    return this._fmt({ numberFormat: { type: type, pattern: pattern } }, 'userEnteredFormat.numberFormat');
  };
  Range.prototype.setBackground = function (hex) { var c = hexToColor_(hex); return this._fmt({ backgroundColor: c || { red: 1, green: 1, blue: 1 } }, 'userEnteredFormat.backgroundColor'); };
  Range.prototype.setFontColor = function (hex) { return this._fmt({ textFormat: { foregroundColor: hexToColor_(hex) || { red: 0, green: 0, blue: 0 } } }, 'userEnteredFormat.textFormat.foregroundColor'); };
  Range.prototype.setFontWeight = function (w) { return this._fmt({ textFormat: { bold: w === 'bold' } }, 'userEnteredFormat.textFormat.bold'); };
  Range.prototype.setBold = function (b) { return this._fmt({ textFormat: { bold: !!b } }, 'userEnteredFormat.textFormat.bold'); };
  Range.prototype.setFontSize = function (s) { return this._fmt({ textFormat: { fontSize: s } }, 'userEnteredFormat.textFormat.fontSize'); };
  Range.prototype.setFontStyle = function (s) { return this._fmt({ textFormat: { italic: s === 'italic' } }, 'userEnteredFormat.textFormat.italic'); };
  Range.prototype.setFontFamily = function (f) { return this._fmt({ textFormat: { fontFamily: f } }, 'userEnteredFormat.textFormat.fontFamily'); };
  Range.prototype.setHorizontalAlignment = function (a) { return this._fmt({ horizontalAlignment: H_ALIGN[String(a).toLowerCase()] || 'LEFT' }, 'userEnteredFormat.horizontalAlignment'); };
  Range.prototype.setVerticalAlignment = function (a) { return this._fmt({ verticalAlignment: V_ALIGN[String(a).toLowerCase()] || 'BOTTOM' }, 'userEnteredFormat.verticalAlignment'); };
  Range.prototype.setWrap = function (w) { return this._fmt({ wrapStrategy: w ? 'WRAP' : 'OVERFLOW_CELL' }, 'userEnteredFormat.wrapStrategy'); };
  Range.prototype.setBorder = function (top, left, bottom, right, vertical, horizontal, color, style) {
    var st = style ? String(style).replace(/^.*\./, '') : 'SOLID';
    if (!/^(SOLID|SOLID_MEDIUM|SOLID_THICK|DOTTED|DASHED|DOUBLE)$/.test(st)) st = 'SOLID';
    var b = { style: st, color: hexToColor_(color || '#000000') }, none = { style: 'NONE' };
    function pick(flag) { return flag === true ? b : (flag === false ? none : undefined); }
    var req = { range: this._gridRange() };
    var map = { top: top, left: left, bottom: bottom, right: right, innerVertical: vertical, innerHorizontal: horizontal };
    Object.keys(map).forEach(function (k) { var v = pick(map[k]); if (v) req[k] = v; });
    this.book._req({ updateBorders: req });
    return this;
  };
  Range.prototype.merge = function () { this.book._req({ mergeCells: { range: this._gridRange(), mergeType: 'MERGE_ALL' } }); return this; };
  Range.prototype.mergeAcross = function () { this.book._req({ mergeCells: { range: this._gridRange(), mergeType: 'MERGE_ROWS' } }); return this; };
  Range.prototype.breakApart = function () { this.book._req({ unmergeCells: { range: this._gridRange() } }); return this; };
  Range.prototype.protect = function () { return new Protection_(this.sheet, this); };
  Range.prototype.activate = function () { return this; };

  // ---------- protection (warning-only, as used by the app) ----------
  function Protection_(sheet, range) {
    this.sheet = sheet; this.range = range; this.description = ''; this.queued = false;
  }
  Protection_.prototype.setDescription = function (d) { this.description = d; this._queue(); return this; };
  Protection_.prototype.setWarningOnly = function (w) { this.warningOnly = !!w; this._queue(); return this; };
  Protection_.prototype._queue = function () {
    if (this.queued || this.warningOnly === undefined) return; // wait until warningOnly is known
    this.queued = true;
    var pr = { description: this.description, warningOnly: this.warningOnly };
    pr.range = this.range ? this.range._gridRange() : { sheetId: this.sheet.getSheetId() };
    this.sheet.book._req({ addProtectedRange: { protectedRange: pr } });
  };

  // ---------- conditional format rule builder (subset used by the app) ----------
  function RuleBuilder_() { this.ranges = []; this.condition = null; this.format = {}; }
  RuleBuilder_.prototype.whenFormulaSatisfied = function (f) { this.condition = { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: f }] }; return this; };
  RuleBuilder_.prototype.whenNumberGreaterThan = function (n) { this.condition = { type: 'NUMBER_GREATER', values: [{ userEnteredValue: String(n) }] }; return this; };
  RuleBuilder_.prototype.whenNumberLessThan = function (n) { this.condition = { type: 'NUMBER_LESS', values: [{ userEnteredValue: String(n) }] }; return this; };
  RuleBuilder_.prototype.whenNumberGreaterThanOrEqualTo = function (n) { this.condition = { type: 'NUMBER_GREATER_THAN_EQ', values: [{ userEnteredValue: String(n) }] }; return this; };
  RuleBuilder_.prototype.whenNumberLessThanOrEqualTo = function (n) { this.condition = { type: 'NUMBER_LESS_THAN_EQ', values: [{ userEnteredValue: String(n) }] }; return this; };
  RuleBuilder_.prototype.whenTextEqualTo = function (s) { this.condition = { type: 'TEXT_EQ', values: [{ userEnteredValue: s }] }; return this; };
  RuleBuilder_.prototype.setBackground = function (hex) { this.format.backgroundColor = hexToColor_(hex); return this; };
  RuleBuilder_.prototype.setFontColor = function (hex) { this.format.textFormat = this.format.textFormat || {}; this.format.textFormat.foregroundColor = hexToColor_(hex); return this; };
  RuleBuilder_.prototype.setBold = function (b) { this.format.textFormat = this.format.textFormat || {}; this.format.textFormat.bold = !!b; return this; };
  RuleBuilder_.prototype.setRanges = function (ranges) { this.ranges = ranges; return this; };
  RuleBuilder_.prototype.build = function () { return { __adapterRule: true, ranges: this.ranges, condition: this.condition, format: this.format }; };

  return {
    openById: function (id) { return new Book(id); },
    create: function (title) {
      var r = api_(function () { return Sheets.Spreadsheets.create({ properties: { title: title } }); });
      return new Book(r.spreadsheetId);
    },
    newConditionalFormatRule: function () { return new RuleBuilder_(); },
    isAdapter: function (ss) { return ss instanceof Book; }
  };
})();
