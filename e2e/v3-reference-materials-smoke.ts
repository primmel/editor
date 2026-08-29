import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 reference-materials leg (TODO.editor wave 03, window 2) — the
// certified-material surface on the live app: the tree section, the
// inspector with its identity fields + constraints + override, an edit
// through the command path, and the in-tree create.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `reference_material cgm-200 {
  kind certified_gas_mixture
  name "CGM 200"
  definition "Certified gas mixture for analyzer verification"
  source { doc "urn:oiml:pub:r:144-1:2013" clause "5.2" }
  identity_fields {
    field certified_value { description "The certified concentration" unit "mol/mol" type mole_fraction required true }
  }
  constraints {
    constraint purity_band {
      description "The purity band"
      rule "ocl{purity >= 0.999}"
      evidence { purity: purity_certificate }
      override { rule "ocl{purity >= 0.99}" by issuing_authority evidence override_approved }
      on_violation invalidate
      source { doc "urn:oiml:pub:r:144-1:2013" clause "5.2.1" }
    }
  }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-REFERENCE-MATERIALS FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows the section.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  materials: window.__stores.model.standard.referenceMaterials.length,
  group: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).find((g) => g.startsWith('Reference Materials')) ?? null,
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.materials !== 1 || state.group !== 'Reference Materials (1) +') await fail('the tree section did not render')

// 2. Selecting the material opens its inspector with the nested blocks.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'cgm-200')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="reference-material-inspector"]'),
  kind: document.querySelector('[data-testid="rm-kind"]')?.value ?? null,
  fieldDesc: document.querySelector('[data-testid="rm-field-desc-certified_value"]')?.value ?? null,
  fieldRequired: document.querySelector('[data-testid="rm-field-required-certified_value"]')?.checked ?? null,
  constraintRule: document.querySelector('[data-testid="rm-constraint-rule-purity_band"]')?.value ?? null,
  overrideBy: document.querySelector('[data-testid="rm-constraint-override-by-purity_band"]')?.value ?? null,
}))()`)
console.log('inspector:', JSON.stringify(state))
if (!state.inspector || state.kind !== 'certified_gas_mixture' || state.fieldDesc !== 'The certified concentration'
  || state.fieldRequired !== true || state.constraintRule !== 'ocl{purity >= 0.999}' || state.overrideBy !== 'issuing_authority')
  await fail('the inspector did not open with the nested facets')

// 3. An edit lands through the command path and into the serialization.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="rm-constraint-rule-purity_band"]')
  el.value = 'ocl{purity >= 0.9995}'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  rule: window.__stores.model.standard.referenceMaterials[0]?.constraints[0]?.rule,
  serialized: window.__stores.model.serialize().includes('ocl{purity >= 0.9995}'),
}))()`)
if (state.rule !== 'ocl{purity >= 0.9995}' || !state.serialized) await fail('the constraint edit did not land')

// 4. The in-tree create mints a material and selects it.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-referenceMaterial"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  ids: window.__stores.model.standard.referenceMaterials.map((r) => r.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  inspector: !!document.querySelector('[data-testid="reference-material-inspector"]'),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.ids.includes('RM1') || state.selection?.id !== 'RM1' || state.selection?.type !== 'referenceMaterial' || !state.inspector)
  await fail('the in-tree create did not mint + select the material')

console.log('V3-REFERENCE-MATERIALS OK')
await browser.close()
process.exit(0)
