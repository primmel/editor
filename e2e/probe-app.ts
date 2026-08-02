import puppeteer from 'puppeteer'
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 3500))
const info = await page.evaluate(() => ({
  workspace: document.querySelector('.workspace, .workspace-registry, .workspace-mapping, .error-state')?.className ?? 'NONE',
  errorCard: document.querySelector('.error-card')?.textContent?.replace(/\s+/g, ' ').slice(0, 300) ?? null,
  leftPanel: document.querySelector('.panel-left')?.textContent?.replace(/\s+/g, ' ').slice(0, 200) ?? null,
  nodeGroups: document.querySelectorAll('.node-group').length,
  treeItems: document.querySelectorAll('.tree-item, [class*="tree"]').length,
}))
console.log(JSON.stringify(info, null, 1))
await browser.close()
