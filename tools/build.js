// Genera el juego en un solo archivo HTML.
//   index.html          → página completa (abrir en el navegador o publicar en GitHub Pages)
//   dist/artifact.html  → mismo contenido sin <html>/<head>, para publicarlo como Artifact
const fs = require('fs');
const path = require('path');
const files = require('./files');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const js = files.game.concat(files.ui).map((f) => `// ---- ${f} ----\n${read(f)}`).join('\n');
if (js.includes('</script')) throw new Error('El JS contiene "</script", rompería el HTML.');
const template = read('src/template.html');
const body = `${template}\n<script>\n${js}\n</script>\n`;

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/artifact.html'), body);
const full = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#1d7348">
<meta name="apple-mobile-web-app-capable" content="yes">
</head>
<body>
${body}</body>
</html>
`;
fs.writeFileSync(path.join(root, 'index.html'), full);
console.log('OK', Math.round(full.length / 1024) + ' KB');
