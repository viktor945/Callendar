import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.preview.config.ts'], {
  stdio: 'inherit', env: { ...process.env, VITE_STATIC_PREVIEW: 'true', NODE_ENV: 'production' },
});
if (result.status !== 0) process.exit(result.status || 1);
// HTML Preview rewrites script tags even inside JS string literals. Escape the
// literal React uses when creating a script element; its runtime value is intact.
const js = readFileSync('.preview-build/preview.js', 'utf8').replace(/<script/gi, '\\x3cscript').replace(/<\/script/gi, '<\\/script');
const css = readFileSync('.preview-build/vdvoem-calendar.css', 'utf8');
const favicon = `data:image/svg+xml,${encodeURIComponent(readFileSync('public/favicon.svg', 'utf8'))}`;
mkdirSync('docs', { recursive: true });
writeFileSync('docs/index.html', `<!doctype html>
<html lang="ru"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="Вдвоём">
<meta name="theme-color" content="#f7f5fa"><meta name="referrer" content="no-referrer">
<meta name="description" content="Интерактивный предпросмотр календаря для пары Вдвоём. Демо без регистрации.">
<title>Вдвоём — интерактивный просмотр</title><link rel="icon" href="${favicon}">
<style>${css}</style></head><body><div id="root"></div>
<script type="text/javascript">${js}</script></body></html>\n`);
writeFileSync('docs/.nojekyll', '');
console.log('Standalone preview written to docs/index.html');
