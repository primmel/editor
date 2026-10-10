// The deep surfaces' browser leg (the twelfth pass): four UI
// affordances the lib layer spec'd but no browser ever walked — the
// repo-map strip, the transitive-discovery section, the adopt button,
// and the edition-diff panel with the REAL 13485 map sets.
import puppeteer from 'puppeteer'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// The edition step reads the corpus's 13485 map sets — the runtime-spec
// pattern: prove against the real fixture when present, skip the leg on
// machines without it.
const DIR = join(homedir(), 'src/mn/mmel-models/13485 (for diff)')
if (!existsSync(join(DIR, '2016.json')) || !existsSync(join(DIR, '2021.json'))) {
  console.log('UI-SURFACES SKIPPED (no corpus map sets)')
  process.exit(0)
}

const IMP = `root Imp

version "v1.0.0-dev1"

metadata {
  title "IMP"
  schema "Primmel 0.1"
  namespace "imp"
}

process pa {
  name "Do the thing"
  modality shall
}

map_profile refA {
  mapping {
    pa -> refA#a_test
  }
}
`
const REF_A = `root RefA

version "v1.0.0-dev1"

metadata {
  title "Ref A"
  schema "Primmel 0.1"
  namespace "refA"
}

process a_test {
  name "The thing, tested"
  modality shall
}

term adopted_term {
  label "adopted"
  definition "the definition that comes across"
}

map_profile refB {
  mapping {
    a_test -> refB#b_test
  }
}
`
const REF_B = `root RefB

version "v1.0.0-dev1"

metadata {
  title "Ref B"
  schema "Primmel 0.1"
  namespace "refB"
}

process b_test {
  name "The thing, upstream"
  modality shall
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.setViewport({ width: 1440, height: 950 })
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5199/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('UI-SURFACES FAILED:', why); await browser.close(); process.exit(1) }

// The IMP + both references load; the mapping view opens with refB active.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(IMP)}) })()`)
await page.evaluate(`(() => { window.__stores.mapping.loadRefText(${JSON.stringify(REF_A)}) })()`)
await page.evaluate(`(() => { window.__stores.mapping.loadRefText(${JSON.stringify(REF_B)}) })()`)
await new Promise((r) => setTimeout(r, 600))
await page.evaluate(`(() => { window.__stores.ui.view = 'mapping'; window.__stores.mapping.activate('refB') })()`)
await new Promise((r) => setTimeout(r, 900))

// 1. The repo-map strip renders the registry, mapped-or-not.
const repo = await page.evaluate(`(() => ({
  strip: !!document.querySelector('[data-testid="repo-map"]'),
  rows: [...document.querySelectorAll('[data-testid^="repo-map-"]')].map((r) => r.getAttribute('data-testid')?.replace('repo-map-', '')),
}))()`)
console.log('repo map:', JSON.stringify(repo))
if (!repo.strip) await fail('no repo-map strip')
for (const ns of ['refA', 'refB']) {
  if (!repo.rows.some((r) => r?.startsWith(ns))) await fail(`repo map misses ${ns}`)
}

// 2. The transitive-discovery section proposes the chain's far end.
const discovered = await page.evaluate(`(() => ({
  header: [...document.querySelectorAll('.proposal-header')].some((h) => h.textContent?.includes('discovered')),
  transitive: [...document.querySelectorAll('[data-testid^="transitive-"]')].map((t) => t.getAttribute('data-testid')),
}))()`)
console.log('discovery:', JSON.stringify(discovered))
if (!discovered.header) await fail('no discovered section')
if (!discovered.transitive.some((t) => t?.includes('pa') && t?.includes('b_test'))) await fail('the transitive proposal for the far end is missing')

// 3. The adopt button on an unmapped reference row lands element+pair
//    (the term lives in refA — switch the lens first).
await page.evaluate(`(() => { window.__stores.mapping.activate('refA') })()`)
await new Promise((r) => setTimeout(r, 500))
await page.evaluate(`(() => {
  const btn = document.querySelector('[data-testid^="party-adopt-adopted_term"]')
  if (!btn) throw new Error('no adopt button for adopted_term')
  btn.click()
})()`)
await new Promise((r) => setTimeout(r, 500))
const adopted = await page.evaluate(`(() => {
  const s = window.__stores.model.standard
  return {
    term: s.terms.some((t) => t.id === 'adopted_term'),
    pair: s.mapProfiles.some((p) => p.namespace === 'refA' && (p.mappings['adopted_term'] ?? []).length > 0),
    error: document.querySelector('[data-testid="adopt-error"]')?.textContent ?? null,
  }
})()`)
console.log('adopted:', JSON.stringify(adopted))
if (!adopted.term || !adopted.pair) await fail(`the adopt cascade did not land: ${JSON.stringify(adopted)}`)

// 4. The edition-diff panel with the REAL 13485 map sets.
await page.evaluate(`(() => { document.querySelector('[data-testid="mdiff-toggle"]').click() })()`)
await new Promise((r) => setTimeout(r, 300))
const [oldChooser] = await Promise.all([
  page.waitForFileChooser(),
  page.evaluate(`(() => { document.querySelector('[data-testid="editions-pick-old"]').click() })()`),
])
await oldChooser.accept([join(DIR, '2016.json')])
await new Promise((r) => setTimeout(r, 300))
const [newChooser] = await Promise.all([
  page.waitForFileChooser(),
  page.evaluate(`(() => { document.querySelector('[data-testid="editions-pick-new"]').click() })()`),
])
await newChooser.accept([join(DIR, '2021.json')])
await new Promise((r) => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="editions-run"]').click() })()`)
await new Promise((r) => setTimeout(r, 600))
const editions = await page.evaluate(`(() => ({
  rows: [...document.querySelectorAll('[data-testid^="editions-ns-"]')].map((r) => r.getAttribute('data-testid')?.replace('editions-ns-', '')),
  anyDelta: [...document.querySelectorAll('.mdiff-stat')].some((s) => s.textContent?.includes('carried')),
}))()`)
console.log('editions:', JSON.stringify(editions))
if (!editions.rows.some((r) => r?.includes('EU90/385/EECAnnex2-doc'))) await fail('the 13485 edition namespaces did not render')
if (!editions.anyDelta) await fail('no carried/added/dropped stats rendered')

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('UI-SURFACES OK')
await browser.close()
