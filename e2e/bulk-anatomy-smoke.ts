import puppeteer from 'puppeteer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadPackageWithProvenance } from '@primmel/primmel'

// ─────────────────────────────────────────────────────────────────────
// The bulk package's editor gates (file 12, phase 3): the anatomy
// views (IS/HAS/DOES) render and edit against oiml-r60-lml — the
// whole converted R 60 package — and the process canvas renders its
// workflow. The viewer leg is the same kernel's read path: the tree,
// the census, the canvas.
// ─────────────────────────────────────────────────────────────────────

const SRC = path.resolve(import.meta.dirname, '../../../oimlsmart/model-library-spike/oiml-r60-lml')
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prl-bulk-'))
process.on('exit', () => fs.rmSync(root, { recursive: true, force: true }))
fs.cpSync(SRC, path.join(root, 'oiml-r60-lml'), { recursive: true })
const PKG_DIR = path.join(root, 'oiml-r60-lml')

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))
const fail = async (why: string) => { console.log('BULK-ANATOMY FAILED:', why); await browser.close(); process.exit(1) }

// 1. Open the bulk package.
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
let probe = await page.evaluate(`(() => ({
  opened: !!document.querySelector('[data-testid="package-opened"]'),
  error: document.querySelector('[data-testid="package-error"]')?.textContent ?? null,
}))()`)
console.log('open:', JSON.stringify(probe))
if (!probe.opened) await fail(`the bulk package did not open: ${probe.error}`)
await page.evaluate(`(() => { document.querySelector('[data-testid="package-done"]').click() })()`)
await new Promise(r => setTimeout(r, 800))

// 2. The census (the viewer's read path over the whole package).
probe = await page.evaluate(`(() => { const s = window.__stores.model; return {
  subjects: s.standard.subjects.length,
  instruments: s.standard.instruments.length,
  classes: Object.keys(s.standard.dataclasses ?? {}).length,
  attrs: Object.values(s.standard.dataclasses ?? {}).reduce((n, c) => n + c.attributes.length, 0),
  instances: s.standard.instances.length,
  tests: s.standard.conformanceTests.length,
  requirements: s.standard.requirements.length,
  forms: s.standard.forms.length,
  processes: s.standard.processes.length,
  promises: Object.values(s.standard.promiseSets ?? {}).length,
  attestations: s.standard.attestations.length,
} })()`)
console.log('census:', JSON.stringify(probe))
const c = probe as Record<string, number>
if (c.subjects !== 1 || c.instruments !== 1 || c.classes < 8 || c.attrs < 490 || c.instances < 4 ||
    c.tests < 60 || c.requirements < 20 || c.forms < 55 || c.processes < 20 || c.attestations < 1)
  await fail('the census is short of the converted package')

// 3. The anatomy view: select the subject, the three families render.
await page.evaluate(`(() => {
  const groups = [...document.querySelectorAll('.tree-group')]
  const subjects = groups.find(g => g.querySelector('.group-label, .group-header, h3, h2')?.textContent?.includes('Subjects') || g.previousElementSibling?.textContent?.includes('Subjects'))
  const item = [...document.querySelectorAll('.item-id')].find(n => n.textContent?.trim() === 'LoadCell')
  item?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 700))
probe = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="subject-inspector"]'),
  heads: [...document.querySelectorAll('.anatomy-head')].map(h => h.textContent?.trim()),
  extends: document.querySelector('[data-testid="subject-extends"]')?.value ?? null,
}))()`)
console.log('anatomy:', JSON.stringify(probe))
if (!probe.inspector) await fail('the subject inspector did not render')
if (probe.heads?.length !== 3 || !probe.heads[0]!.startsWith('is') || !probe.heads[1]!.startsWith('has') || !probe.heads[2]!.startsWith('does'))
  await fail(`the three anatomy families did not render: ${JSON.stringify(probe.heads)}`)

// 4. An anatomy edit: the subject's extends moves; only twin.prl plans.
await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="subject-extends"]')
  input.value = 'MeasuringInstrumentModel'
  input.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 500))
await page.evaluate(`(() => { document.querySelector('[data-testid="open-save"]').click() })()`)
await new Promise(r => setTimeout(r, 800))
probe = await page.evaluate(`(() => ({
  plan: !!document.querySelector('[data-testid="pkg-save-plan"]'),
  rows: [...document.querySelectorAll('[data-testid^="pkg-save-row-"]')].map(r => r.getAttribute('data-testid')),
}))()`)
console.log('plan:', JSON.stringify(probe))
if (!probe.plan || probe.rows?.length !== 1 || !probe.rows[0]!.includes('twin.prl'))
  await fail(`the anatomy edit should plan exactly model/twin.prl: ${JSON.stringify(probe.rows)}`)
await page.evaluate(`(() => { document.querySelector('[data-testid="pkg-save-write"]').click() })()`)
await new Promise(r => setTimeout(r, 900))
const twinText = fs.readFileSync(path.join(PKG_DIR, 'model/twin.prl'), 'utf8')
console.log('saved twin.prl:', JSON.stringify(twinText.slice(0, 400)))
if (!/extends\s+MeasuringInstrumentModel/.test(twinText)) await fail('the anatomy edit is not on disk')
const reloaded = loadPackageWithProvenance(PKG_DIR, {
  resolvePackage: (id: string) => path.join(path.dirname(SRC), id) as never,
})
const std = (reloaded as unknown as { standard: any }).standard ?? (reloaded as unknown as any)
if (std.subjects.find((s: any) => s.id === 'LoadCell')?.extends !== 'MeasuringInstrumentModel')
  await fail('the reload lost the anatomy edit')
console.log('anatomy edit: written, reloaded')

// 5. The canvas: select a process, the nodes render.
await page.evaluate(`(() => {
  const item = [...document.querySelectorAll('.item-id')].find(n => n.textContent?.trim() === 'conduct_mdlo_tests')
  item?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 900))
probe = await page.evaluate(`(() => ({
  nodes: document.querySelectorAll('.node-group').length,
  edges: document.querySelectorAll('.edge-group').length,
  tabs: document.querySelectorAll('.canvas-tab').length,
}))()`)
console.log('canvas:', JSON.stringify(probe))
if ((probe.nodes as number) + (probe.edges as number) === 0)
  await fail('the process canvas rendered nothing for conduct_mdlo_tests')

await browser.close()
console.log('BULK ANATOMY + CANVAS GREEN')
process.exit(0)
