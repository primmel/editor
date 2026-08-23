import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 950 })
page.on('pageerror', e => console.log('PAGEERROR:', String(e)))
await page.goto(process.env.E2E_BASE ?? 'http://localhost:5173/', { waitUntil: 'domcontentloaded' })
await new Promise(r => setTimeout(r, 2500))

// 1. Select Manufacturing → the comment panel targets it.
await page.evaluate(`(() => {
  const nodes = Array.from(document.querySelectorAll('.node-group'))
  const target = nodes.find((n) => n.textContent.includes('Manufacture'))
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 400))
let state = await page.evaluate(`(() => ({
  panel: !!document.querySelector('[data-testid="comment-panel"]'),
  target: document.querySelector('.comment-target')?.textContent ?? null,
}))()`)
console.log('panel:', JSON.stringify(state))
if (!state.panel || state.target !== 'Manufacturing') {
  console.log('COMMENTS FAILED'); await browser.close(); process.exit(1)
}

// 2. Add two comments, reply to the first, resolve the second.
// (input-set and click are separate evaluates — the :disabled patch
// needs a flush between them.)
async function addCommentText(text: string) {
  await page.evaluate(`((t) => {
    const input = document.querySelector('[data-testid="comment-input"]')
    input.value = t
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })(${JSON.stringify(text)})`)
  await new Promise(r => setTimeout(r, 250))
  await page.evaluate(`(() => { document.querySelector('[data-testid="comment-send"]').click() })()`)
  await new Promise(r => setTimeout(r, 350))
}

await addCommentText('first note')
await addCommentText('second note')

await page.evaluate(`(() => {
  document.querySelector('[data-testid="comment-reply-C1"]').click()
})()`)
await new Promise(r => setTimeout(r, 300))
await page.evaluate(`(() => {
  const input = document.querySelector('[data-testid="reply-input-C1"]')
  input.value = 'a reply'
  input.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await new Promise(r => setTimeout(r, 250))
await page.evaluate(`(() => {
  document.querySelector('[data-testid="reply-send-C1"]').click()
})()`)
await new Promise(r => setTimeout(r, 350))
state = await page.evaluate(`(() => ({
  rows: document.querySelectorAll('.comment-row').length,
  badge: document.querySelector('[data-testid="badge-Manufacturing"]')?.textContent ?? null,
  comments: window.__stores.model.standard.comments.map((c) => c.id + ':' + c.on + ':' + (c.replyTo ?? '')),
}))()`)
console.log('threaded:', JSON.stringify(state))
if (state.rows !== 3 || state.badge !== '3' || state.comments.length !== 3) {
  console.log('COMMENTS FAILED'); await browser.close(); process.exit(1)
}

// 3. Resolve C2 → badge drops to 2.
await page.evaluate(`(() => {
  document.querySelector('[data-testid="comment-resolve-C2"]').click()
})()`)
await new Promise(r => setTimeout(r, 400))
state = await page.evaluate(`(() => ({
  badge: document.querySelector('[data-testid="badge-Manufacturing"]')?.textContent ?? null,
  resolved: window.__stores.model.standard.comments.find((c) => c.id === 'C2')?.resolved,
}))()`)
console.log('resolved:', JSON.stringify(state))

// 4. Delete C1 → the subtree (C1 + reply C3) goes; C2 survives.
await page.evaluate(`(() => {
  document.querySelector('[data-testid="comment-delete-C1"]').click()
})()`)
await new Promise(r => setTimeout(r, 400))
const after = await page.evaluate(`(() => ({
  ids: window.__stores.model.standard.comments.map((c) => c.id),
  rows: document.querySelectorAll('.comment-row').length,
}))()`)
console.log('deleted:', JSON.stringify(after))

const ok = state.badge === '2' && state.resolved === true
  && after.ids.length === 1 && after.ids[0] === 'C2' && after.rows === 1
console.log(ok ? 'COMMENTS OK' : 'COMMENTS FAILED')
await browser.close()
process.exit(ok ? 0 : 1)
