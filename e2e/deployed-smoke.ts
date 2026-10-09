// The deployed-artifact leg (TODO.editor/52, the fourth pass): the
// PRODUCTION pages build — never before probed (every prior leg ran
// against the dev server). Both widths against the deployed URL.
import puppeteer from 'puppeteer'

const URL = process.env.DEPLOY_URL ?? 'http://www.primmel.org/editor/'
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
const errors: string[] = []

const page = await browser.newPage()
page.on('pageerror', (e) => errors.push(String(e)))
await page.setViewport({ width: 1440, height: 950 })
await page.goto(URL, { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 3000))

const fail = async (why: string) => { console.log('DEPLOYED FAILED:', why); await browser.close(); process.exit(1) }

const desktop = await page.evaluate(`(() => {
  const ws = document.querySelector('.workspace')
  const app = !!document.querySelector('.atelier')
  const styles = [...document.querySelectorAll('style')].map((s) => s.textContent ?? '').join('')
  const sheetHasResponsive = styles.includes('@media') || [...document.styleSheets].some((ss) => {
    try { return [...ss.cssRules].some((r) => r.media && r.media.mediaText.includes('1024')) } catch { return false }
  })
  return { app, cols: ws ? getComputedStyle(ws).gridTemplateColumns : null, responsive: sheetHasResponsive, title: document.title }
})()`)
console.log('desktop:', JSON.stringify(desktop))
if (!desktop.app) await fail('the deployed app did not mount')
if (!desktop.responsive) await fail('the deployed CSS carries no media query — the responsive layer is missing from the artifact')
if (!desktop.cols || desktop.cols.split(' ').length !== 3) await fail(`the deployed desktop grid is wrong: ${desktop.cols}`)

const mobilePage = await browser.newPage()
mobilePage.on('pageerror', (e) => errors.push(String(e)))
await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
await mobilePage.goto(URL, { waitUntil: 'domcontentloaded' })
await new Promise((r) => setTimeout(r, 3000))

const mobile = await mobilePage.evaluate(`(() => {
  const ws = document.querySelector('.workspace')
  const toggles = document.querySelector('.drawer-toggles')
  const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth
  return {
    cols: ws ? getComputedStyle(ws).gridTemplateColumns : null,
    toggles: toggles ? getComputedStyle(toggles).display : 'absent',
    overflow,
  }
})()`)
console.log('mobile:', JSON.stringify(mobile))
if (mobile.cols?.startsWith('390')) console.log('(collapsed)')
if (mobile.toggles !== 'flex') await fail('the deployed mobile shell did not collapse — drawers absent')
if (mobile.overflow) await fail('the deployed page scrolls horizontally at 390px')

if (errors.length) { console.log('PAGE ERRORS:', errors.slice(0, 3)); await browser.close(); process.exit(1) }
console.log('DEPLOYED OK')
await browser.close()
