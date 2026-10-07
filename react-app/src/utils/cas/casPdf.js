// Reads a CAS PDF in the browser (the file never leaves the device; only the parsed funds and
// transactions are sent to the user's own Google Sheet). pdf.js is loaded only on the import page.
import { linesFromTextItems, parseCamsCas } from './casParser'

let pdfjsPromise = null
async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })
  }
  return pdfjsPromise
}

export class PdfPasswordError extends Error {
  constructor(wrong) {
    super(wrong ? 'That password did not open the file. Please try again.' : 'This file is protected with a password.')
    this.needsPassword = true
    this.wrongPassword = !!wrong
  }
}

/**
 * file: File from <input type=file>. password: optional.
 * Returns { meta, folios, problems, pages }.
 * Throws PdfPasswordError when a password is needed or was wrong.
 */
export async function readCasPdf(file, password) {
  const pdfjs = await loadPdfJs()
  const data = new Uint8Array(await file.arrayBuffer())
  let doc
  try {
    doc = await pdfjs.getDocument({ data, password: password || undefined, isEvalSupported: false }).promise
  } catch (e) {
    if (e && e.name === 'PasswordException') throw new PdfPasswordError(e.code === 2 || !!password)
    throw new Error('Could not open this PDF. Please choose the statement PDF downloaded from CAMS.')
  }
  let lines = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const tc = await page.getTextContent()
    lines = lines.concat(linesFromTextItems(tc.items))
  }
  const pages = doc.numPages
  try { await doc.destroy() } catch { /* ignore */ }
  const text = lines.join('\n')
  if (/NSDL|CDSL/.test(text) && !/Folio No:/.test(text)) {
    throw new Error('This looks like an NSDL / CDSL statement. For now please use the CAMS "Detailed" statement (since inception).')
  }
  if (!/Folio No:/.test(text)) {
    throw new Error('No mutual fund folios found in this PDF. Please use the CAMS / KFintech consolidated statement (Detailed, since inception).')
  }
  const res = parseCamsCas(lines)
  return { ...res, pages }
}

/** Only what the server needs (smaller upload). */
export function statementForServer(parsed) {
  return {
    meta: parsed.meta,
    folios: parsed.folios.map((f) => ({
      folio: f.folio, pan: f.pan, holder: f.holder, isin: f.isin, scheme: f.scheme, amc: f.amc,
      platformCode: f.platformCode, platform: f.platform, demat: f.demat,
      opening: f.opening, close: f.close, nav: f.nav, navDate: f.navDate, cost: f.cost, mv: f.mv, reconciled: f.reconciled,
      txns: f.txns.map((t) => ({ date: t.date, desc: t.desc, amount: t.amount, units: t.units, stamp: t.stamp, tax: t.tax, kind: t.kind })),
    })),
  }
}
