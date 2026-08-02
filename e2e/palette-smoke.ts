import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const before = await page.evaluate(() => ({
  nodes: document.querySelectorAll('.node-group').length,
  palette: document.querySelectorAll('.palette-item').length,
}))
console.log('before:', JSON.stringify(before))

// Click-to-add a process from the palette.
await page.evaluate(() => {
  const item = document.querySelector('[data-testid="palette-process"]') as HTMLElement
  item.click()
})
await new Promise(r => setTimeout(r, 500))

const after = await page.evaluate(() => ({
  nodes: document.querySelectorAll('.node-group').length,
  hasP1: Array.from(document.querySelectorAll('.node-group')).some(n => n.textContent?.includes('P1')),
}))
console.log('after click-add:', JSON.stringify(after))
console.log(after.nodes === before.nodes + 1 && after.hasP1 ? 'PALETTE OK' : 'PALETTE FAILED')
await browser.close()
