import fs from 'node:fs';
import path from 'node:path';

const distBrowser = path.resolve('dist/browser');
const distRoot = path.resolve('dist');

if (fs.existsSync(distBrowser)) {
  const csrHtml = path.join(distBrowser, 'index.csr.html');
  if (fs.existsSync(csrHtml)) {
    const htmlContent = fs.readFileSync(csrHtml, 'utf-8');

    // 1. Ensure dist/browser/index.html and 404.html exist for static hosting
    fs.writeFileSync(path.join(distBrowser, 'index.html'), htmlContent);
    fs.writeFileSync(path.join(distBrowser, '404.html'), htmlContent);
    console.log('✅ Created dist/browser/index.html and dist/browser/404.html');

    // 2. Also ensure dist/index.html and dist/404.html exist if host root is dist/
    fs.writeFileSync(path.join(distRoot, 'index.html'), htmlContent);
    fs.writeFileSync(path.join(distRoot, '404.html'), htmlContent);

    // 3. Copy browser assets to dist root if not already present
    const items = fs.readdirSync(distBrowser);
    for (const item of items) {
      const srcItem = path.join(distBrowser, item);
      const destItem = path.join(distRoot, item);
      if (!fs.existsSync(destItem)) {
        fs.cpSync(srcItem, destItem, { recursive: true });
      }
    }
    console.log('✅ Synchronized static assets into dist/ for Cloudflare Pages / static hosts');
  }
}
