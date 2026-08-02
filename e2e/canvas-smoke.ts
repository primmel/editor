import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
page.on('pageerror', e => console.log('PAGE ERROR:', String(e).slice(0, 300)))
page.on('console', m => { if (m.text().includes('finishConnect')) console.log('LOG:', m.text()) })
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const state = await page.evaluate(() => ({
  nodes: document.querySelectorAll('.node-group').length,
  edges: document.querySelectorAll('.edge-group').length,
  tabs: document.querySelectorAll('.canvas-tab').length,
  hint: document.querySelector('.canvas-hint')?.textContent?.trim() ?? '',
}))
console.log('state:', JSON.stringify(state))

// Shift+drag from the Manufacturing node to Done → connect creates an edge.
const box = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('.node-group'))
  const m = nodes.find(n => n.textContent?.trim() === 'Start')
  const d = nodes.find(n => n.textContent?.includes('Done'))
  const mr = m.getBoundingClientRect()
  const dr = d.getBoundingClientRect()
  return { m: { x: mr.x, y: mr.y, width: mr.width, height: mr.height }, d: { x: dr.x, y: dr.y, width: dr.width, height: dr.height } }
})
const cx = r => r.x + r.width / 2
const cy = r => r.y + r.height / 2
await page.keyboard.down('Shift')
await page.mouse.move(cx(box.m), cy(box.m))
await page.mouse.down()
await page.mouse.move(cx(box.d), cy(box.d), { steps: 12 })
await page.mouse.up()
await page.keyboard.up('Shift')
await new Promise(r => setTimeout(r, 600))

const after = await page.evaluate(() => ({
  edges: document.querySelectorAll('.edge-group').length,
}))
console.log('after connect:', JSON.stringify(after))
console.log(after.edges === state.edges + 1 ? 'CONNECT OK' : 'CONNECT FAILED')
await browser.close()
