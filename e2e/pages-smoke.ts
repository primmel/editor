import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

function clickNode(text: string) {
  return page.evaluate((t: string) => {
    const nodes = Array.from(document.querySelectorAll('.node-group'))
    const target = nodes.find(n => n.textContent?.includes(t)) as HTMLElement | undefined
    if (!target) throw new Error(`node ${t} not found`)
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }, text)
}

function click(selector: string) {
  return page.evaluate((s: string) => {
    const el = document.querySelector(s) as HTMLElement | null
    if (!el) throw new Error(`no element ${s}`)
    el.click()
  }, selector)
}

// 1. Select Manufacturing → create its subprocess page from the inspector.
await clickNode('Manufacture')
await new Promise(r => setTimeout(r, 300))
await click('[data-testid="inspector-new-page"]')
await new Promise(r => setTimeout(r, 400))
let state = await page.evaluate(() => ({
  pageLink: (document.querySelector('[data-testid="inspector-page"]') as HTMLSelectElement | null)?.value ?? null,
  treeHasPage: !!document.querySelector('[data-testid="page-node-Page1"]'),
}))
console.log('created:', JSON.stringify(state))
if (state.pageLink !== 'Page1' || !state.treeHasPage) { console.log('PAGES FAILED'); await browser.close(); process.exit(1) }

// 2. Open the page → canvas switches, breadcrumb shows Root / Page1.
await click('[data-testid="inspector-open-page"]')
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(() => ({
  breadcrumb: document.querySelector('[data-testid="canvas-breadcrumb"]')?.textContent ?? null,
  activePage: (document.querySelector('[data-testid="page-node-Page1"]') as HTMLElement | null)?.className ?? null,
}))
console.log('descended:', JSON.stringify(state))
if (!state.breadcrumb?.includes('Root') || !state.breadcrumb?.includes('Page1') || !state.activePage?.includes('active')) {
  console.log('PAGES FAILED'); await browser.close(); process.exit(1)
}

// 3. The breadcrumb walks back up.
await page.evaluate(() => {
  const crumbs = Array.from(document.querySelectorAll('.crumb-link')) as HTMLElement[]
  const root = crumbs.find(c => c.textContent === 'Root')
  if (!root) throw new Error('no Root crumb')
  root.click()
})
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(() => ({
  breadcrumbGone: !document.querySelector('[data-testid="canvas-breadcrumb"]'),
  nodes: document.querySelectorAll('.node-group').length,
}))
console.log('back at root:', JSON.stringify(state))
if (!state.breadcrumbGone || state.nodes !== 3) { console.log('PAGES FAILED'); await browser.close(); process.exit(1) }

// 4. The duplicate-edge refusal says so out loud (shift+drag Start → Manufacturing).
await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('.node-group'))
  const start = nodes.find(n => n.textContent?.includes('Start')) as HTMLElement
  const mfg = nodes.find(n => n.textContent?.includes('Manufacture')) as HTMLElement
  start.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, shiftKey: true }))
  mfg.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
})
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(() => ({
  refusal: document.querySelector('[data-testid="canvas-refusal"]')?.textContent ?? null,
}))
console.log('refusal:', JSON.stringify(state))
if (!state.refusal?.includes('already connected')) { console.log('PAGES FAILED'); await browser.close(); process.exit(1) }

// 5. Rename Page1 in the tree → the link follows.
await click('[data-testid="page-rename-Page1"]')
await new Promise(r => setTimeout(r, 200))
await page.evaluate(() => {
  const input = document.querySelector('[data-testid="page-rename-input"]') as HTMLInputElement
  input.value = 'AssemblyBay'
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
await click('[data-testid="page-rename-commit"]')
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(() => ({
  renamed: !!document.querySelector('[data-testid="page-node-AssemblyBay"]'),
  oldGone: !document.querySelector('[data-testid="page-node-Page1"]'),
}))
console.log('renamed:', JSON.stringify(state))

const ok = !!state.renamed && !!state.oldGone
console.log(ok ? 'PAGES OK' : 'PAGES FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
