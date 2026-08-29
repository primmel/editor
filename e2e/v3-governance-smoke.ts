import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 governance leg (TODO.editor wave 03, window 2) — dataspaces +
// policies on the live app: the tree sections, the inspectors (the
// dataspace's classes + trust anchor, the policy's rules), edits
// through the command path, and the in-tree creates.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `dataspace oiml-cs-dataspace {
  name "OIML-CS"
  artifact_class test_report {
    label "Test report"
    element tr-form
    policy default-sharing
  }
  default_policy default-sharing
  trust_anchor biml {
    trust_ref oiml key biml-2026
    role registry
  }
}

policy default-sharing {
  name "Default sharing"
  governs { test_report }
  default_posture true
  rule read-ok {
    kind permission
    action read
    artifact test_report
    constraint "ocl{requester.accredited}"
  }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-GOVERNANCE FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows both sections.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  dataspaces: window.__stores.model.standard.dataspaces.length,
  policies: window.__stores.model.standard.policies.length,
  groups: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).filter((g) => g.startsWith('Dataspaces') || g.startsWith('Policies')),
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.dataspaces !== 1 || state.policies !== 1 || !state.groups.includes('Dataspaces (1) +') || !state.groups.includes('Policies (1) +'))
  await fail('the tree sections did not render')

// 2. The dataspace inspector opens with the artifact class + the trust anchor.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'oiml-cs-dataspace')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="dataspace-inspector"]'),
  name: document.querySelector('[data-testid="ds-name"]')?.value ?? null,
  artifactElement: document.querySelector('[data-testid="ds-artifact-element-test_report"]')?.value ?? null,
  anchorOrg: document.querySelector('[data-testid="ds-anchor-org-biml"]')?.value ?? null,
  anchorKid: document.querySelector('[data-testid="ds-anchor-kid-biml"]')?.value ?? null,
}))()`)
console.log('dataspace inspector:', JSON.stringify(state))
if (!state.inspector || state.name !== 'OIML-CS' || state.artifactElement !== 'tr-form'
  || state.anchorOrg !== 'oiml' || state.anchorKid !== 'biml-2026')
  await fail('the dataspace inspector did not open with the facets')

// 3. An edit to the default policy lands through the command path.
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="ds-default-policy"]')
  el.value = 'restricted-sharing'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  defaultPolicy: window.__stores.model.standard.dataspaces[0]?.defaultPolicy,
  serialized: window.__stores.model.serialize().includes('default_policy restricted-sharing'),
}))()`)
if (state.defaultPolicy !== 'restricted-sharing' || !state.serialized) await fail('the default-policy edit did not land')

// 4. The policy inspector opens with the rule.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'default-sharing')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="policy-inspector"]'),
  name: document.querySelector('[data-testid="pol-name"]')?.value ?? null,
  posture: document.querySelector('[data-testid="pol-default-posture"]')?.value ?? null,
  ruleKind: document.querySelector('[data-testid="pol-rule-kind-read-ok"]')?.value ?? null,
  ruleAction: document.querySelector('[data-testid="pol-rule-action-read-ok"]')?.value ?? null,
}))()`)
console.log('policy inspector:', JSON.stringify(state))
if (!state.inspector || state.name !== 'Default sharing' || state.posture !== 'true'
  || state.ruleKind !== 'permission' || state.ruleAction !== 'read')
  await fail('the policy inspector did not open with the rule')

// 5. The in-tree creates mint one of each.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-dataspace"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-policy"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  dataspaces: window.__stores.model.standard.dataspaces.map((d) => d.id),
  policies: window.__stores.model.standard.policies.map((p) => p.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  inspector: !!document.querySelector('[data-testid="policy-inspector"]'),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.dataspaces.includes('DS1') || !state.policies.includes('Pol1') || state.selection?.id !== 'Pol1' || !state.inspector)
  await fail('the in-tree creates did not mint + select')

console.log('V3-GOVERNANCE OK')
await browser.close()
process.exit(0)
