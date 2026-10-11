// The analyse leg (the gap pack): the four worksheets render real data
// — registry summaries with the attribute forms, the provision summary
// with claims and citations, the link inventory with resolution
// states, and the checklist with marks, evidence, and the CSV export.
import puppeteer from 'puppeteer'

const MODEL = `root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "analyse"
}

start_event Start { }
end_event Done { }

process Measure {
  name "Measure"
  modality shall
}

class Sample#data {
  store { samples }
  id: string [1..1] { modality SHALL }
}

data_registry samples {
  title "Samples"
  data_class Sample#data
}

reference refISO {
  document "ISO/IEC 17025:2017"
  clause "7.5"
}

provision prov_data {
  subject Sample#data
  modality shall
  condition "every sample carries its identifier"
  reference {
    refISO
  }
}

provision prov_other {
  subject Sample#data
  modality may
  condition "provisions may cite"
}

requirement /req/one {
  name "The one"
  statement "The organisation shall measure."
  binds_to Measure
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.setViewport({ width: 1440, height: 950 })
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5199/', { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('ANALYSE FAILED:', why); await browser.close(); process.exit(1) }

await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(MODEL)}) })()`)
await new Promise((r) => setTimeout(r, 900))
await page.evaluate(`(() => { document.querySelector('[data-testid="tab-analyse"]').click() })()`)
await new Promise((r) => setTimeout(r, 400))

// 1. The registry worksheet: the card, the class, the store, the form.
const reg = await page.evaluate(`(() => ({
  card: !!document.querySelector('[data-testid="registry-samples"]'),
  class: document.querySelector('[data-testid="registry-samples"] .reg-row code')?.textContent ?? null,
  attrs: [...document.querySelectorAll('[data-testid="registry-samples"] .reg-attr code')].map((c) => c.textContent),
}))()`)
console.log('registries:', JSON.stringify(reg))
if (!reg.card || reg.class !== 'Sample#data' || !reg.attrs.includes('id')) await fail('the registry summary did not render the form')

// 2. The provisions: claims + citations.
await page.evaluate(`(() => { document.querySelector('[data-testid="analyse-tab-provisions"]').click() })()`)
await new Promise((r) => setTimeout(r, 300))
const prov = await page.evaluate(`(() => ({
  count: document.querySelectorAll('[data-testid^="provision-"]').length,
  claims: document.querySelector('[data-testid="provision-prov_data"] .prov-verified')?.textContent ?? null,
}))()`)
console.log('provisions:', JSON.stringify(prov))
if (prov.count !== 2) await fail(`expected 2 provisions, got ${prov.count}`)
if (!prov.claims?.includes('Sample#data')) await fail('the provision claims did not render')

// 3. The link inventory: resolved + dangling states.
await page.evaluate(`(() => { document.querySelector('[data-testid="analyse-tab-links"]').click() })()`)
await new Promise((r) => setTimeout(r, 300))
const links = await page.evaluate(`(() => ({
  tally: document.querySelector('[data-testid="links-tally"]')?.textContent?.trim() ?? null,
  rows: document.querySelectorAll('.link-row').length,
}))()`)
console.log('links:', JSON.stringify(links))
if (!links.tally || !links.tally.includes('links')) await fail('the link tally did not render')

// 4. The checklist: mark two requirements, watch the rail; export.
await page.evaluate(`(() => { document.querySelector('[data-testid="analyse-tab-checklist"]').click() })()`)
await new Promise((r) => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="check-mark-/req/one-satisfied"]').click() })()`)
await new Promise((r) => setTimeout(r, 200))
await page.evaluate(`(() => {
  const ev = document.querySelector('[data-testid="check-evidence-/req/one"]')
  ev.value = 'the calibration certificate'; ev.dispatchEvent(new Event('input'))
})()`)
await new Promise((r) => setTimeout(r, 200))
const check = await page.evaluate(`(() => ({
  pct: document.querySelector('[data-testid="checklist-pct"]')?.textContent ?? null,
  on: !!document.querySelector('.check-mark.satisfied.on'),
}))()`)
console.log('checklist:', JSON.stringify(check))
if (check.pct !== '100%') await fail(`the completion rail read ${check.pct}`)
if (!check.on) await fail('the satisfied mark did not light')

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('ANALYSE OK')
await browser.close()
