"""Optional real-browser regression: Python Playwright + a local Chromium.
Run: python tests/browser-smoke.py
Use --in-memory for DOM/layout checks without an HTTP origin. This mode uses a
storage double and does NOT test real persistence or service-worker navigation.
No external service or real school data is required; uses the public catalogue.
"""
import functools
import json
import os
import re
import sys
from pathlib import Path
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('REVIEW_OUTPUT', tempfile.mkdtemp(prefix='course-review-')))
OUT.mkdir(parents=True, exist_ok=True)
class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass
server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT.parent)))
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}/{ROOT.name}/'
IN_MEMORY = '--in-memory' in sys.argv

def load(page, blocked=False):
    if not IN_MEMORY:
        page.goto(base)
        return
    # Load only local bytes. No HTTP requests or service-worker registration.
    html = (ROOT/'index.html').read_text()
    html = re.sub(r'<script\b[^>]*>[\s\S]*?</script>', '', html)
    html = re.sub(r'<link\b[^>]*>', '', html)
    css = '\n'.join((ROOT/'assets'/name).read_text() for name in ('styles.css', 'review.css'))
    page.set_content(html.replace('</head>', '<style>'+css+'</style></head>'))
    if blocked:
        page.evaluate("Object.defineProperty(window, 'localStorage', {configurable:true, get() { throw new DOMException('blocked', 'SecurityError'); }})")
    else:
        page.evaluate("""() => {
          const saved = new Map();
          Object.defineProperty(window, 'localStorage', { configurable:true, value: {
            getItem(key) {return saved.get(key) ?? null;},
            setItem(key, value) {saved.set(key, String(value));},
            removeItem(key) {saved.delete(key);}
          }});
        }""")
    for name in ('courses.js', 'catalog-core.js', 'app.js', 'review.js'):
        page.add_script_tag(content=(ROOT/'assets'/name).read_text())

results = []
def passed(name):
    results.append(name)
    print('PASS', name, flush=True)

def browse_subject(page):
    page.locator('.entry-doors [data-mode="subject"]').click()
    page.locator('#shelfUnit .product-card').first.wait_for()

def select_n(page, count):
    for _ in range(count):
        page.locator('#shelfUnit .put-button:not(.selected)').first.click()

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce', accept_downloads=True)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        load(page)
        page.wait_for_function('window.CourseSupermarket && window.CourseReview')
        count = page.evaluate('window.COURSE_SUPERMARKET_DATA.courses.length')
        assert int(page.locator('#courseTotal').inner_text()) == count
        passed('published catalogue loads without JavaScript errors')
        page.screenshot(path=str(OUT/'homepage-desktop.png'), full_page=False)
        page.locator('.entry-doors [data-mode="problem"]').click()
        page.locator('#searchInput').fill('食育')
        assert page.locator('#shelfTitle').inner_text() == '全库检索'
        assert int(page.locator('#resultCount').inner_text()) > 0
        passed('global search works before a problem has been selected')
        load(page)
        browse_subject(page)
        stages = page.locator('#stageFilter button').all_text_contents()
        assert len(stages) > 2
        page.locator('#stageFilter [data-stage="小学"]').click()
        assert page.locator('#stageFilter button').all_text_contents() == stages
        page.locator('#stageFilter [data-stage="初中"]').click()
        assert page.locator('#stageFilter [data-stage="初中"]').get_attribute('aria-pressed') == 'true'
        passed('stage switching preserves sibling filter options')
        assert page.locator('#clearFilter').is_visible()
        page.locator('#clearFilter').click()
        assert page.locator('#stageFilter [data-stage="全部"]').get_attribute('aria-pressed') == 'true'
        passed('clear filters works inside subject browsing')
        select_n(page, 5)
        assert page.locator('#selectionCount').inner_text() == '5'
        page.locator('#cartDock').click()
        assert page.evaluate('document.querySelector("main").inert')
        page.locator('#closeSelection').focus()
        page.keyboard.press('Shift+Tab')
        assert page.evaluate('document.activeElement.id') == 'continueShopping'
        passed('drawer traps keyboard focus and makes background inert')
        checks = page.locator('[data-compare]')
        for i in range(5):
            checks.nth(i).click()
        assert page.locator('[data-compare]:checked').count() == 4
        assert '4/4' in page.locator('#compareCourses').inner_text()
        checks.nth(3).uncheck()
        page.locator('#compareCourses').click()
        assert page.locator('.review-dialog').is_visible()
        assert page.locator('#reviewTable thead th').count() == 4
        passed('comparison accepts two to four courses and refuses a fifth')
        first_id = page.locator('[data-review-note]').first.get_attribute('data-review-note')
        note = '先在一个年级共备，保留儿童的提问。<img src=x onerror=alert(1)>'
        page.locator('[data-review-note]').first.fill(note)
        assert page.evaluate('(id) => window.CourseSupermarket.getSelection()[id].note', first_id) == note
        page.locator('.review-dialog').evaluate('(node) => node.scrollTop = 0')
        page.screenshot(path=str(OUT/'comparison-desktop.png'), full_page=False)
        page.keyboard.press('Escape')
        page.wait_for_function('document.querySelector("#selectionDrawer").getAttribute("aria-hidden") === "false"')
        assert page.locator('#note-'+first_id).input_value() == note
        assert page.locator('#selectionList img').count() == 0
        passed('comparison notes persist and are rendered as plain text')
        with page.expect_download() as download:
            page.locator('#backupSelection').click()
        download.value.save_as(str(OUT/'sample-backup.json'))
        exported = json.loads((OUT/'sample-backup.json').read_text())
        assert len(exported['items']) == 5
        assert set(exported['items'][0]) == {'id', 'note'}
        passed('backup downloads only IDs and user notes')
        with page.expect_download() as download:
            page.locator('#downloadDiscussion').click()
        download.value.save_as(str(OUT/'sample-discussion.html'))
        text = (OUT/'sample-discussion.html').read_text()
        assert text.count('首次试教安排：待共议') == 5
        assert note.replace("<", "&lt;").replace(">", "&gt;") in text
        assert 'onclick="window.print()"' in text
        passed('discussion export includes the entire basket and unfilled trial fields')
        before = page.evaluate('window.CourseSupermarket.getSelection()')
        page.locator('#backupFile').set_input_files({'name': 'invalid.json', 'mimeType': 'application/json', 'buffer': b'{bad'})
        page.wait_for_timeout(100)
        assert page.evaluate('window.CourseSupermarket.getSelection()') == before
        passed('malformed import leaves the basket unchanged')
        new_id = page.evaluate('window.COURSE_SUPERMARKET_DATA.courses.find(c => !window.CourseSupermarket.getSelection()[c.id]).id')
        payload = {'schema': 'course-supermarket-selection', 'version': 1, 'items': [{'id': first_id, 'note': 'incoming note'}, {'id': new_id, 'note': 'new note'}, {'id': 'OLD-ID', 'note': 'old note'}]}
        confirmations = []
        def accept(dialog):
            confirmations.append(dialog.message)
            dialog.accept()
        page.once('dialog', accept)
        page.locator('#backupFile').set_input_files({'name': 'backup.json', 'mimeType': 'application/json', 'buffer': json.dumps(payload).encode()})
        page.wait_for_function('Object.keys(window.CourseSupermarket.getSelection()).length === 6')
        assert page.evaluate('(id) => window.CourseSupermarket.getSelection()[id].note', first_id) == note
        assert confirmations and '跳过' in confirmations[0]
        passed('confirmed import merges, keeps existing notes, and reports old IDs')
        page.locator('#makeReceipt').click()
        assert page.locator('#receiptDialog').is_visible()
        assert note in page.locator('#receiptContent').inner_text()
        page.locator('#closeReceipt').click()
        passed('existing receipt generation still includes saved notes')
        if not IN_MEMORY:
            page.reload()
            assert page.locator('#selectionCount').inner_text() == '6'
            passed('basket survives a normal reload')
            page.evaluate('navigator.serviceWorker.ready.then(() => true)')
            page.wait_for_function('!!navigator.serviceWorker.controller')
            context.set_offline(True)
            page.goto(base + '?offline-check=1', wait_until='domcontentloaded')
            page.wait_for_function('!!window.CourseReview')
            assert page.locator('#selectionCount').inner_text() == '6'
            assert int(page.locator('#courseTotal').inner_text()) == count
            passed('offline reload works at a project subpath with a fresh query string')
            context.set_offline(False)
        assert not errors, errors
        passed('desktop flow has no uncaught JavaScript errors')
        context.close()
        for width in (375, 768):
            mobile = browser.new_context(viewport={'width': width, 'height': 900}, reduced_motion='reduce')
            mp = mobile.new_page(); load(mp); browse_subject(mp); select_n(mp, 2)
            mp.evaluate('window.CourseSupermarket.openSelection()')
            mp.locator('[data-compare]').nth(0).check(); mp.locator('[data-compare]').nth(1).check()
            mp.locator('#compareCourses').click()
            assert mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            mp.locator('.review-dialog').evaluate('(node) => node.scrollTop = 0')
            mp.screenshot(path=str(OUT/f'comparison-{width}.png'), full_page=False)
            assert mp.locator('.review-table-wrap').evaluate('(node) => node.scrollWidth > 0 && node.clientWidth <= window.innerWidth')
            passed(f'{width}px layout keeps comparison scrolling inside its own region')
            mobile.close()
        blocked = browser.new_context(viewport={'width': 1280, 'height': 900}, reduced_motion='reduce')
        blocked.add_init_script("Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });")
        bp = blocked.new_page(); blocked_errors = []; bp.on('pageerror', lambda error: blocked_errors.append(str(error)))
        load(bp, blocked=True); browse_subject(bp); select_n(bp, 2)
        bp.locator('#cartDock').click()
        assert '暂未写入' in bp.locator('#storageNotice').inner_text()
        bp.locator('[data-compare]').nth(0).check(); bp.locator('[data-compare]').nth(1).check()
        bp.locator('#compareCourses').click()
        bp.locator('[data-review-note]').first.fill('仍可继续讨论')
        assert '暂未写入' in bp.locator('#reviewStorageNotice').inner_text()
        assert not blocked_errors
        passed('blocked storage does not interrupt selection and warns in both views')
        blocked.close()
        browser.close()
    (OUT/'browser-results.json').write_text(json.dumps({'mode': 'local-source DOM with storage double; no HTTP/SW' if IN_MEMORY else 'HTTP browser', 'passed': len(results), 'checks': results}, ensure_ascii=False, indent=2))
    print(f'{len(results)} browser checks passed; screenshots: {OUT}', flush=True)
finally:
    server.shutdown()
