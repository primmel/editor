import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. Click the Manufacturing process node → process inspector appears.
await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('.node-group'))
  const target = nodes.find(n => n.textContent?.includes('Manufacture')) as HTMLElement | undefined
  if (!target) throw new Error('Manufacturing node not found')
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await new Promise(r => setTimeout(r, 400))

const inspector = await page.evaluate(() => ({
  process: !!document.querySelector('[data-testid="process-inspector"]'),
  name: (document.querySelector('[data-testid="inspector-name"]') as HTMLInputElement | null)?.value ?? null,
}))
console.log('inspector:', JSON.stringify(inspector))
if (!inspector.process || inspector.name !== 'Manufacture product') {
  console.log('INSPECTOR FAILED: process inspector did not open on the clicked node')
  await browser.close()
  process.exit(1)
}

// 2. Rename via the inspector → canvas label follows (model-driven).
await page.evaluate(() => {
  const input = document.querySelector('[data-testid="inspector-name"]') as HTMLInputElement
  input.value = 'Mfg Plus'
  input.dispatchEvent(new Event('change', { bubbles: true }))
})
await new Promise(r => setTimeout(r, 400))

const renamed = await page.evaluate(() => ({
  canvas: Array.from(document.querySelectorAll('.node-group')).some(n => n.textContent?.includes('Mfg Plus')),
  field: (document.querySelector('[data-testid="inspector-name"]') as HTMLInputElement).value,
}))
console.log('renamed:', JSON.stringify(renamed))

// 3. Revert the rename (leave the sample clean for the next probe).
await page.evaluate(() => {
  const input = document.querySelector('[data-testid="inspector-name"]') as HTMLInputElement
  input.value = 'Manufacture product'
  input.dispatchEvent(new Event('change', { bubbles: true }))
})
await new Promise(r => setTimeout(r, 300))

// 4. Click the Start event node → event inspector.
await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('.node-group'))
  const target = nodes.find(n => n.textContent?.includes('Start')) as HTMLElement | undefined
  if (!target) throw new Error('Start node not found')
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await new Promise(r => setTimeout(r, 400))

const eventInspector = await page.evaluate(() => ({
  event: !!document.querySelector('[data-testid="event-inspector"]'),
  type: (document.querySelector('[data-testid="inspector-event-type"]') as HTMLSelectElement | null)?.value ?? null,
}))
console.log('event inspector:', JSON.stringify(eventInspector))

const ok = renamed.canvas && renamed.field === 'Mfg Plus'
  && eventInspector.event && eventInspector.type === 'start'
console.log(ok ? 'INSPECTOR OK' : 'INSPECTOR FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
