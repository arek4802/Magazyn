// Buduje jeden samodzielny plik dist/Magazyn.html (bez internetu, bez instalacji).
'use strict';
const fs = require('fs');
const path = require('path');
const kat = path.join(__dirname, '..');
const czytaj = (p) => fs.readFileSync(path.join(kat, p), 'utf8');
const bezpieczny = (js) => js.replace(/<\/script/gi, '<\\/script');
const obraz = (p) => 'data:image/png;base64,' + fs.readFileSync(path.join(kat, 'assets', p)).toString('base64');
const logo = { jasne: obraz('logo-jasne.png'), ciemne: obraz('logo-ciemne.png') };
const pakiet = JSON.parse(czytaj('package.json'));
const skrypty = ['vendor/qrcode.js', 'src/core.js', 'src/xlsx.js', 'src/storage.js', 'src/demo.js', 'src/pomoc.js', 'src/app.js'];
const html = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Magazyn · MAASCK</title>
<meta name="generator" content="Magazyn ${pakiet.version}">
<link rel="icon" type="image/png" href="${obraz('ikona-64.png')}">
<link rel="apple-touch-icon" href="${obraz('ikona-180.png')}">
<meta name="theme-color" content="#08075c">
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
