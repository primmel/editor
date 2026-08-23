import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. The Code tab mounts Monaco (no worker errors).
await page.evaluate(`(() => {
  const btns = Array.from(document.querySelectorAll('button'))
  btns.find((b) => b.textContent.trim() === 'Code')?.click()
})()`)
await new Promise(r => setTimeout(r, 2500))
let state = await page.evaluate(`(() => ({
  monaco: !!document.querySelector('.monaco-editor'),
  lines: document.querySelectorAll('.view-lines .view-line').length > 0,
}))()`)
console.log('monaco:', JSON.stringify(state))
if (!state.monaco || !state.lines) { console.log('MONACO FAILED'); await browser.close(); process.exit(1) }

// 2. Type a new process in text → it appears in the tree after parse.
await page.evaluate(`(() => {
  document.querySelector('.monaco-editor textarea')?.focus()
})()`)
await page.keyboard.down('Control')
await page.keyboard.press('End')
await page.keyboard.up('Control')
await page.keyboard.type('\n\nprocess TypedIn {\n  name "Typed in code"\n  actor QA\n}')
await new Promise(r => setTimeout(r, 1200))
state = await page.evaluate(`(() => ({
  inAst: window.__stores.model.standard.processes.some((p) => p.id === 'TypedIn'),
  parseError: window.__stores.model.parseError,
}))()`)
console.log('typed:', JSON.stringify(state))
if (!state.inAst || state.parseError) { console.log('MONACO FAILED'); await browser.close(); process.exit(1) }

// 3. A syntax error marks inline with the kernel's message.
await page.keyboard.press('Enter')
await page.keyboard.type('this is not prl')
await new Promise(r => setTimeout(r, 1000))
state = await page.evaluate(`(() => ({
  errorBar: !!document.querySelector('.error-bar'),
  markers: document.querySelectorAll('.monaco-editor .squiggly-error').length,
}))()`)
console.log('error:', JSON.stringify(state))
if (!state.errorBar || state.markers === 0) { console.log('MONACO FAILED'); await browser.close(); process.exit(1) }

// 4. Undo the garbage, then completion after `actor` lists the roles.
await page.evaluate(`(() => {
  window.__stores.model.loadText(\`root Root

version "v1.0.0-dev1"

metadata {
  title "T"
  schema "Primmel 0.1"
  namespace "N"
}

role Factory { name "Factory" }
role QA { name "Quality" }

start_event Start { }

process P1 {
  name "P one"
  actor 

canvas Root {
  elements {
    Start { x 0 y 0 }
  }
  process_flow {
  }
}\`)
})()`)
await new Promise(r => setTimeout(r, 800))
// Place the cursor after `actor ` (line 18, end) and trigger suggest.
await page.evaluate(`(() => {
  const ed = window.__editor
  const model = ed.getModel()
  const line = model.getLineCount() >= 18 ? 18 : model.getLineCount()
  ed.setPosition({ lineNumber: 18, column: model.getLineMaxColumn(18) })
  ed.focus()
  ed.trigger('probe', 'editor.action.triggerSuggest', {})
})()`)
await new Promise(r => setTimeout(r, 900))
state = await page.evaluate(`(() => ({
  suggest: !!document.querySelector('.suggest-widget.visible'),
  items: Array.from(document.querySelectorAll('.suggest-widget .monaco-list-row .label-name')).map((r) => r.textContent),
}))()`)
console.log('completion:', JSON.stringify(state))

// 5. A canvas-side command re-renders the text byte-clean.
await page.evaluate(`(() => {
  window.__stores.model.execute({
    label: 'canvas rename',
    apply(ast) { ast.processes.find((p) => p.id === 'P1').name = 'Renamed on canvas' },
    revert(ast) { ast.processes.find((p) => p.id === 'P1').name = 'P one' },
  })
})()`)
await new Promise(r => setTimeout(r, 600))
const synced = await page.evaluate(`(() => {
  const text = window.__editor.getValue()
  return {
    hasRename: text.includes('name "Renamed on canvas"'),
    byteClean: text === window.__stores.model.serialize(),
  }
})()`)
console.log('synced:', JSON.stringify(synced))

const ok = state.suggest && state.items.includes('Factory') && state.items.includes('QA')
  && synced.hasRename && synced.byteClean
console.log(ok ? 'MONACO OK' : 'MONACO FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
