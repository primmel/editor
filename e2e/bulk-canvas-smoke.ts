import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadPackageWithProvenance, load, dump } from '@primmel/primmel'

// ─────────────────────────────────────────────────────────────────────
// The canvas-edit gate on the COMPOSED package (file 12's viewer item):
// the canvas edits the workflow (a shift+drag connect creates an edge),
// the save writes exactly the process's file, and the reload composes
// with the edit — the same kernel, no separate truth.
// ─────────────────────────────────────────────────────────────────────

const SRC = path.resolve(import.meta.dirname, '../../../oimlsmart/model-library-spike/oiml-r60-lml')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-canvas-'))
process.on('exit', () => fs.rmSync(root, { recursive: true, force: true }))
fs.cpSync(SRC, path.join(root, 'oiml-r60-lml'), { recursive: true })
const PKG_DIR = path.join(root, 'oiml-r60-lml')

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))
const fail = async (why: string) => { console.log('BULK-CANVAS FAILED:', why); await browser.close(); process.exit(1) }

// 1. Open the composed package.
await page.evaluate(`(() => { document.querySelector('[data-testid="open-package"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="package-dir"]')
  input.value = ${JSON.stringify(PKG_DIR)}
  input.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 200))
await page.evaluate(`(() => { document.querySelector('[data-testid="package-open-confirm"]').click() })()`)
await page.waitForSelector('[data-testid="package-opened"]', { timeout: 20000 }).catch(() => null)
let probe = await page.evaluate(`(() => ({ opened: !!document.querySelector('[data-testid="package-opened"]') }))()`)
if (!probe.opened) await fail('the package did not open')
await page.evaluate(`(() => { document.querySelector('[data-testid="package-done"]').click() })()`)
await new Promise(r => setTimeout(r, 800))

// 2. The canvas opens on the package's first authored page
// (application_processing — the four application elements).
await new Promise(r => setTimeout(r, 600))
probe = await page.evaluate(`(() => ({
  nodes: document.querySelectorAll('.node-group').length,
  edges: document.querySelectorAll('.edge-group').length,
}))()`)
console.log('canvas:', JSON.stringify(probe))
const nodes = probe.nodes as number
const edges = probe.edges as number
if (nodes === 0) await fail('the canvas rendered no nodes')

// 3. The page's elements all sit at (0,0) as authored — drag the
// second node apart first, then shift+drag the connect.
const raw = await page.evaluate(`(() => {
  const ns = [...document.querySelectorAll('.node-group')]
  const a = ns[0].getBoundingClientRect(), b = ns[1].getBoundingClientRect()
  return { ax: a.x + a.width / 2, ay: a.y + a.height / 2, bx: b.x + b.width / 2, by: b.y + b.height / 2 }
})()`)
if (Math.abs(raw.ax - raw.bx) < 8 && Math.abs(raw.ay - raw.by) < 8) {
  await page.mouse.move(raw.bx, raw.by)
  await page.mouse.down()
  await page.mouse.move(raw.bx + 180, raw.by + 120, { steps: 12 })
  await page.mouse.up()
  await new Promise(r => setTimeout(r, 500))
}
const box = await page.evaluate(`(() => {
  const ns = [...document.querySelectorAll('.node-group')]
  const centers = ns.map(n => { const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
  const a = centers[0]
  let b = null
  for (let i = 1; i < centers.length; i++) {
    if (Math.abs(centers[i].x - a.x) > 40 || Math.abs(centers[i].y - a.y) > 40) { b = centers[i]; break }
  }
  return { a, b }
})()`)
if (!box.b) await fail('no second node sits apart after the drag — cannot connect')
await page.keyboard.down('Shift')
await page.mouse.move(box.a.x, box.a.y)
await page.mouse.down()
await page.mouse.move(box.b.x, box.b.y, { steps: 12 })
await page.mouse.up()
await page.keyboard.up('Shift')
await new Promise(r => setTimeout(r, 700))
probe = await page.evaluate(`(() => ({ edges: document.querySelectorAll('.edge-group').length }))()`)
console.log('after connect:', JSON.stringify(probe))
if ((probe.edges as number) !== edges + 1) await fail(`the connect did not create an edge (${edges} -> ${probe.edges})`)

// 4. Save: exactly the process's file is planned and written.
await page.evaluate(`(() => { document.querySelector('[data-testid="open-save"]').click() })()`)
await new Promise(r => setTimeout(r, 800))
probe = await page.evaluate(`(() => ({
  rows: [...document.querySelectorAll('[data-testid^="pkg-save-row-"]')].map(r => r.getAttribute('data-testid')),
}))()`)
console.log('plan:', JSON.stringify(probe))
if (probe.rows?.length !== 1) await fail(`the plan should write one file: ${JSON.stringify(probe.rows)}`)
await page.evaluate(`(() => { document.querySelector('[data-testid="pkg-save-write"]').click() })()`)
await new Promise(r => setTimeout(r, 900))
const written = probe.rows[0]!.replace('pkg-save-row-', '')
const text = fs.readFileSync(path.join(PKG_DIR, written), 'utf8')
if (!text.includes('process_flow')) await fail(`the page edge block is not on disk in ${written}`)

// 5. The reload composes with the edit; the file is a fixed point.
const reloaded = loadPackageWithProvenance(PKG_DIR, {
  resolvePackage: (id: string) => path.join(path.dirname(SRC), id) as never,
})
const std = (reloaded as unknown as { standard: any }).standard ?? (reloaded as unknown as any)
const reloadedPage = std.pages.find((pg: any) => pg.id === 'application_processing')
if (!reloadedPage || (reloadedPage.edges ?? []).length !== edges + 1) {
  await fail(`the reload lost the edge: ${(reloadedPage?.edges ?? []).length} edges`)
}
const once = dump(load(text))
if (once !== dump(load(once))) await fail('the written file is not a fixed point')
console.log('canvas edit: written, reloaded, fixed point holds')

await browser.close()
console.log('BULK CANVAS EDIT GREEN')
process.exit(0)
