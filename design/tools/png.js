const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const [src, dst] = process.argv.slice(2); fs.mkdirSync(dst, { recursive: true });
  const b = await chromium.launch(); 
  for (const f of fs.readdirSync(src).filter(f => f.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(src, f), 'utf8'); const m = svg.match(/width="([\d.]+)" height="([\d.]+)"/);
    const p = await b.newPage({ viewport: { width: Math.ceil(+m[1]), height: Math.ceil(+m[2]) }, deviceScaleFactor: 2 });
    await p.setContent(`<html><body style="margin:0;background:#fff">${svg}</body></html>`);
    await p.screenshot({ path: path.join(dst, f.replace('.svg', '.png')), omitBackground: false });
    await p.close();
  }
  await b.close();
})();
