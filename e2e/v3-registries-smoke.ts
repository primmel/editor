import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 registry-plane leg (TODO.editor wave 03, window 2) — the seven
// small registry kinds on the live app: invariants, formulas-used,
// texts, activity archetypes, competence kinds, predicates, discrepancy
// records. The tree sections, the inspectors, an edit through the
// command path, and the in-tree creates.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `invariant INV-1 {
  name "No bare numbers"
  statement "every physical quantity is a QuantityValue"
  severity error
  enforcement aspirational
}

formulas_used /conf/metrological/mdlo {
  name "MDLO evaluation formulas"
  description "The evaluation-level quantities"
  formulas { conversion_factor_f e_l }
}

text load-cell.definition {
  spell de "Wägezelle"
}

activity_archetype peer-assessment {
  label "peer assessment"
  clause "6.2"
  definition "assessment of a body by others in the same field"
}

competence_kind force-measurement {
  label "Force measurement"
  definition "d"
  method_standard iec-61000-4-4 "IEC 61000-4-4 — bursts"
}

predicate derives-from {
  kind citation
  description "the clause-URN provenance"
  resolution must-resolve
  transitive true
}

discrepancy_record dr-1 {
  status open
  summary "The 2017 and 2021 editions disagree"
  sources { "urn:a" "urn:b" }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-REGISTRIES FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows all seven sections.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  groups: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).filter((g) =>
    g.startsWith('Invariants') || g.startsWith('Formulas Used') || g.startsWith('Texts') || g.startsWith('Activity Archetypes')
    || g.startsWith('Competence Kinds') || g.startsWith('Predicates') || g.startsWith('Discrepancy Records')),
}))()`)
console.log('tree:', JSON.stringify(state))
const EXPECTED = ['Invariants (1) +', 'Formulas Used (1) +', 'Texts (1) +', 'Activity Archetypes (1) +', 'Competence Kinds (1) +', 'Predicates (1) +', 'Discrepancy Records (1) +']
if (EXPECTED.some(g => !state.groups.includes(g))) await fail('the tree sections did not render')

// 2. The invariant inspector opens; the aspirational marker shows.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'INV-1')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="invariant-inspector"]'),
  name: document.querySelector('[data-testid="inv-name"]')?.value ?? null,
  aspirational: document.querySelector('[data-testid="inv-aspirational"]')?.checked ?? null,
}))()`)
console.log('invariant inspector:', JSON.stringify(state))
if (!state.inspector || state.name !== 'No bare numbers' || state.aspirational !== true)
  await fail('the invariant inspector did not open with the enforcement marker')

// 3. Unmarking aspirational and adding a claim lands through the command path.
await page.evaluate(`(() => { document.querySelector('[data-testid="inv-aspirational"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  enforcement: window.__stores.model.standard.invariants[0]?.enforcement,
}))()`)
if (state.enforcement?.aspirational !== false) await fail('the enforcement toggle did not land')

// 4. The predicate inspector opens with the flags.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'derives-from')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="predicate-inspector"]'),
  kind: document.querySelector('[data-testid="pred-kind"]')?.value ?? null,
  transitive: document.querySelector('[data-testid="pred-transitive"]')?.checked ?? null,
}))()`)
console.log('predicate inspector:', JSON.stringify(state))
if (!state.inspector || state.kind !== 'citation' || state.transitive !== true)
  await fail('the predicate inspector did not open with the flags')

// 5. The text inspector opens with the spelling.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'load-cell.definition')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="text-inspector"]'),
  spelling: document.querySelector('[data-testid="text-spelling-0"]')?.value ?? null,
  value: document.querySelector('[data-testid="text-value-0"]')?.value ?? null,
}))()`)
console.log('text inspector:', JSON.stringify(state))
if (!state.inspector || state.spelling !== 'de' || state.value !== 'Wägezelle')
  await fail('the text inspector did not open with the spelling')

// 6. The in-tree creates mint one of each remaining kind.
for (const type of ['formulasUsed', 'activityArchetype', 'competenceKind', 'discrepancyRecord']) {
  await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-' + '${type}' + '"]').click() })()`)
  await new Promise(r => setTimeout(r, 250))
}
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  fu: window.__stores.model.standard.formulasUsed.map((f) => f.id),
  aa: window.__stores.model.standard.activityArchetypes.map((a) => a.id),
  ck: window.__stores.model.standard.competenceKinds.map((c) => c.id),
  dr: window.__stores.model.standard.discrepancyRecords.map((d) => d.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.fu.includes('FU1') || !state.aa.includes('AA1') || !state.ck.includes('CK1') || !state.dr.includes('DR1')
  || state.selection?.id !== 'DR1' || state.selection?.type !== 'discrepancyRecord')
  await fail('the in-tree creates did not mint + select')

console.log('V3-REGISTRIES OK')
await browser.close()
process.exit(0)
