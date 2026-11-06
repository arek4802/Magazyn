// Buduje jeden samodzielny plik dist/Magazyn.html (bez internetu, bez instalacji).
'use strict';
const fs = require('fs');
const path = require('path');
const kat = path.join(__dirname, '..');
const czytaj = (p) => fs.readFileSync(path.join(kat, p), 'utf8');
const bezpieczny = (js) => js.replace(/<\/script/gi, '<\\/script');
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(kat, 'assets/logo-maasck.png')).toString('base64');
const pakiet = JSON.parse(czytaj('package.json'));
const skrypty = ['vendor/qrcode.js', 'src/core.js', 'src/xlsx.js', 'src/storage.js', 'src/demo.js', 'src/app.js'];
const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Magazyn · MAASCK</title>
<meta name="generator" content="Magazyn ${pakiet.version}">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#16160f"/><circle cx="23" cy="23" r="4" fill="#ffc400"/><path d="M7 22V11h3l3 5 3-5h3v11" stroke="#fff" stroke-width="2.6" fill="none" stroke-linejoin="round"/></svg>')}">
<style>
${czytaj('src/styles.css')}
</style>
</head>
<body>
<div id="app"></div>
<div id="modal"></div>
<div id="toasty" aria-live="polite"></div>
<div id="druk"></div>
<script>window.MAGAZYN_LOGO = ${JSON.stringify(logo)}; window.MAGAZYN_WERSJA = ${JSON.stringify(pakiet.version)};</script>
${skrypty.map((s) => '<script>\n/* ' + s + ' */\n' + bezpieczny(czytaj(s)) + '\n</script>').join('\n')}
</body>
</html>
`;
fs.mkdirSync(path.join(kat, 'dist'), { recursive: true });
fs.writeFileSync(path.join(kat, 'dist/Magazyn.html'), html);
console.log('dist/Magazyn.html', (html.length / 1024).toFixed(0) + ' KB');
