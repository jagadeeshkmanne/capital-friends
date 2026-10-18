/**
 * PAPER BOOK — private paper-trading snapshot for the admin page (/admin/paper in the app)
 *
 * paperSave: posted by the scheduled paper-trading run (no secret; it only accepts this one JSON shape,
 *            and it is virtual money). Stored as a file in the deployer's Drive, never in a sheet tab.
 * paperGet:  needs the admin secret; called by gas-webapp for the admin only.
 */
var PAPER_FILE_ = 'capital-friends-paper-book.json';

function paperFile_() {
  var it = DriveApp.getFilesByName(PAPER_FILE_);
  return it.hasNext() ? it.next() : null;
}

function paperSave_(data) {
  if (!data || data.kind !== 'momentum-gold-paper' || !data.books || !data.updated) throw new Error('Bad paper book');
  var txt = JSON.stringify(data);
  if (txt.length > 200000) throw new Error('Paper book too large');
  var f = paperFile_();
  if (f) f.setContent(txt); else DriveApp.createFile(PAPER_FILE_, txt, 'application/json');
  return { saved: true, updated: data.updated };
}

function paperGet_() {
  var f = paperFile_();
  return f ? JSON.parse(f.getBlob().getDataAsString()) : null;
}
