/*
 * Minimalny zapis plików .xlsx (jeden arkusz, tekst i liczby, pogrubiony nagłówek).
 * Bez zewnętrznych bibliotek: pliki XML pakowane do ZIP bez kompresji.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MagazynXlsx = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TABELA_CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bajty) {
    let c = 0xffffffff;
    for (let i = 0; i < bajty.length; i++) c = TABELA_CRC[(c ^ bajty[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function zip(pliki) {
    // pliki: [{nazwa, dane: Uint8Array}]
    const enc = new TextEncoder();
    const czesci = [];
    const katalog = [];
    let przesuniecie = 0;
    const dosTime = 0, dosDate = (2026 - 1980) << 9 | 1 << 5 | 1;
    for (const p of pliki) {
      const nazwa = enc.encode(p.nazwa);
      const crc = crc32(p.dane);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true); // UTF-8
      lh.setUint16(8, 0, true); // bez kompresji
      lh.setUint16(10, dosTime, true);
      lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, p.dane.length, true);
      lh.setUint32(22, p.dane.length, true);
      lh.setUint16(26, nazwa.length, true);
      lh.setUint16(28, 0, true);
      czesci.push(new Uint8Array(lh.buffer), nazwa, p.dane);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true);
      ch.setUint32(16, crc, true);
      ch.setUint32(20, p.dane.length, true);
      ch.setUint32(24, p.dane.length, true);
      ch.setUint16(28, nazwa.length, true);
      ch.setUint32(42, przesuniecie, true);
      katalog.push(new Uint8Array(ch.buffer), nazwa);
      przesuniecie += 30 + nazwa.length + p.dane.length;
    }
    const rozmiarKatalogu = katalog.reduce((s, b) => s + b.length, 0);
    const koniec = new DataView(new ArrayBuffer(22));
    koniec.setUint32(0, 0x06054b50, true);
    koniec.setUint16(8, pliki.length, true);
    koniec.setUint16(10, pliki.length, true);
    koniec.setUint32(12, rozmiarKatalogu, true);
    koniec.setUint32(16, przesuniecie, true);
    const wszystko = czesci.concat(katalog, [new Uint8Array(koniec.buffer)]);
    const dl = wszystko.reduce((s, b) => s + b.length, 0);
    const wynik = new Uint8Array(dl);
    let o = 0;
    for (const b of wszystko) { wynik.set(b, o); o += b.length; }
    return wynik;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  }

  function kolumna(i) {
    let s = '';
    i += 1;
    while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }

  /**
   * @param {string} arkusz nazwa arkusza
   * @param {string[]} naglowki
   * @param {Array<Array<string|number|null>>} wiersze
   * @param {string} [tytul] opis nad tabelą (np. data eksportu)
   */
  function utworz(arkusz, naglowki, wiersze, tytul) {
    const enc = new TextEncoder();
    const rows = [];
    let r = 1;
    const komorka = (c, v, styl) => {
      const ref = kolumna(c) + r;
      const s = styl ? ' s="' + styl + '"' : '';
      if (v === null || v === undefined || v === '') return '<c r="' + ref + '"' + s + '/>';
      if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"' + s + '><v>' + v + '</v></c>';
      return '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
    };
    if (tytul) {
      rows.push('<row r="' + r + '">' + komorka(0, tytul, 2) + '</row>');
      r += 2;
    }
    const wierszNaglowka = r;
    rows.push('<row r="' + r + '">' + naglowki.map((h, c) => komorka(c, h, 1)).join('') + '</row>');
    r++;
    for (const w of wiersze) {
      rows.push('<row r="' + r + '">' + w.map((v, c) => komorka(c, v, 0)).join('') + '</row>');
      r++;
    }
    const szer = naglowki.map((h, c) => {
      let m = String(h).length;
      for (const w of wiersze) m = Math.max(m, String(w[c] == null ? '' : w[c]).length);
      return Math.min(60, Math.max(8, m + 2));
    });
    const cols = '<cols>' + szer.map((s, c) => '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + s + '" customWidth="1"/>').join('') + '</cols>';
    const ostatnia = kolumna(Math.max(0, naglowki.length - 1)) + Math.max(wierszNaglowka, r - 1);
    const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + wierszNaglowka + '" topLeftCell="A' + (wierszNaglowka + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      cols + '<sheetData>' + rows.join('') + '</sheetData>' +
      '<autoFilter ref="A' + wierszNaglowka + ':' + ostatnia + '"/>' +
      '</worksheet>';
    const nazwaArkusza = esc(String(arkusz).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Arkusz1');
    const pliki = [
      { nazwa: '[Content_Types].xml', tekst: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { nazwa: '_rels/.rels', tekst: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { nazwa: 'xl/workbook.xml', tekst: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + nazwaArkusza + '" sheetId="1" r:id="rId1"/></sheets></workbook>' },
      { nazwa: 'xl/_rels/workbook.xml.rels', tekst: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { nazwa: 'xl/styles.xml', tekst: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="13"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE17A"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><bottom style="thin"><color rgb="FF888888"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
      { nazwa: 'xl/worksheets/sheet1.xml', tekst: sheet },
    ];
    return zip(pliki.map((p) => ({ nazwa: p.nazwa, dane: enc.encode(p.tekst) })));
  }

  return { utworz, crc32, zip };
});
