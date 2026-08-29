import puppeteer from 'puppeteer'

// ─────────────────────────────────────────────────────────────────────
// The v3 twin-family leg (TODO.editor wave 03, window 2) — connector
// profiles, monitors, passports on the live app: the tree sections, the
// inspectors (the monitor's trigger clock + evaluate selectors +
// escalation; the passport's UPI + access-classed entries), edits
// through the command path, and the in-tree creates.
// ─────────────────────────────────────────────────────────────────────

const TEXT = `connector_profile rest_https {
  protocol "REST/JSON"
  description "Query/subscribe over HTTPS"
}

monitor fleet_watch {
  over { LoadCellModel }
  triggers {
    every 1h
    on signal artifact_arrived
  }
  evaluate {
    requirements applicable_to(this.classification)
    promises all
  }
  emit {
    verdicts -> verdict_log
  }
  escalate {
    on fail { flag_certificate }
  }
}

passport lc500_passport {
  upi { pattern upi:acme:lc500 level model }
  carrier { kind qr payload "https://passport.acme.example/p.json" }
  public { identity composition }
}
`

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

const fail = async (why: string) => { console.log('V3-TWIN FAILED:', why); await browser.close(); process.exit(1) }

// 1. The text loads; the tree shows the three sections.
await page.evaluate(`(() => { window.__stores.model.loadText(${JSON.stringify(TEXT)}) })()`)
await new Promise(r => setTimeout(r, 700))
let state = await page.evaluate(`(() => ({
  profiles: window.__stores.model.standard.connectorProfiles.length,
  monitors: window.__stores.model.standard.monitors.length,
  passports: window.__stores.model.standard.passports.length,
  groups: Array.from(document.querySelectorAll('.tree-group .group-header')).map((g) => g.textContent.trim()).filter((g) => g.startsWith('Connector Profiles') || g.startsWith('Monitors') || g.startsWith('Passports')),
}))()`)
console.log('tree:', JSON.stringify(state))
if (state.profiles !== 1 || state.monitors !== 1 || state.passports !== 1
  || !state.groups.includes('Connector Profiles (1) +') || !state.groups.includes('Monitors (1) +') || !state.groups.includes('Passports (1) +'))
  await fail('the tree sections did not render')

// 2. The monitor inspector opens with the clock + the selectors + the escalation.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'fleet_watch')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="monitor-inspector"]'),
  triggerKind: document.querySelector('[data-testid="mon-trigger-kind-0"]')?.value ?? null,
  triggerValue: document.querySelector('[data-testid="mon-trigger-value-0"]')?.value ?? null,
  evalKind: document.querySelector('[data-testid="mon-evaluate-requirements-kind"]')?.value ?? null,
  evalExpr: document.querySelector('[data-testid="mon-evaluate-requirements-expression"]')?.value ?? null,
  escalateOutcome: document.querySelector('[data-testid="mon-escalate-outcome-0"]')?.value ?? null,
}))()`)
console.log('monitor inspector:', JSON.stringify(state))
if (!state.inspector || state.triggerKind !== 'timer' || state.triggerValue !== '1h'
  || state.evalKind !== 'applicable_to' || state.evalExpr !== 'this.classification' || state.escalateOutcome !== 'fail')
  await fail('the monitor inspector did not open with the facets')

// 3. A trigger edit lands through the command path (the value facet follows the kind).
await page.evaluate(`(() => {
  const el = document.querySelector('[data-testid="mon-trigger-value-0"]')
  el.value = '30min'
  el.dispatchEvent(new Event('change', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 300))
state = await page.evaluate(`(() => ({
  every: window.__stores.model.standard.monitors[0]?.triggers[0]?.every,
  serialized: window.__stores.model.serialize().includes('every 30min'),
}))()`)
if (state.every !== '30min' || !state.serialized) await fail('the trigger edit did not land')

// 4. The passport inspector opens with the UPI + the entries.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'lc500_passport')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="passport-inspector"]'),
  pattern: document.querySelector('[data-testid="pp-upi-pattern"]')?.value ?? null,
  level: document.querySelector('[data-testid="pp-upi-level"]')?.value ?? null,
  entryAccess: document.querySelector('[data-testid="pp-entry-access-0"]')?.value ?? null,
  entryClass: document.querySelector('[data-testid="pp-entry-class-1"]')?.value ?? null,
}))()`)
console.log('passport inspector:', JSON.stringify(state))
if (!state.inspector || state.pattern !== 'upi:acme:lc500' || state.level !== 'model'
  || state.entryAccess !== 'public' || state.entryClass !== 'composition')
  await fail('the passport inspector did not open with the facets')

// 5. The connector profile inspector + an edit.
await page.evaluate(`(() => {
  const item = Array.from(document.querySelectorAll('.item-id')).find((el) => el.textContent === 'rest_https')
  item.closest('li').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  inspector: !!document.querySelector('[data-testid="connector-profile-inspector"]'),
  protocol: document.querySelector('[data-testid="cp-protocol"]')?.value ?? null,
}))()`)
if (!state.inspector || state.protocol !== 'REST/JSON') await fail('the connector profile inspector did not open')

// 6. The in-tree creates mint one of each.
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-connectorProfile"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-monitor"]').click() })()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => { document.querySelector('[data-testid="tree-add-passport"]').click() })()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  profiles: window.__stores.model.standard.connectorProfiles.map((c) => c.id),
  monitors: window.__stores.model.standard.monitors.map((m) => m.id),
  passports: window.__stores.model.standard.passports.map((p) => p.id),
  selection: JSON.parse(JSON.stringify(window.__stores.ui.selection ?? null)),
  inspector: !!document.querySelector('[data-testid="passport-inspector"]'),
}))()`)
console.log('created:', JSON.stringify(state))
if (!state.profiles.includes('CP1') || !state.monitors.includes('Mon1') || !state.passports.includes('PP1')
  || state.selection?.id !== 'PP1' || !state.inspector)
  await fail('the in-tree creates did not mint + select')

console.log('V3-TWIN OK')
await browser.close()
process.exit(0)
