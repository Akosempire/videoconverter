"""Browser regression checks. Run against a local server with Playwright installed.

WORKSPACE_TEST_URL defaults to http://127.0.0.1:5050.
Artifacts are written to the ignored .tmp/workspace-checks directory.
"""
import os
from pathlib import Path

from moviepy import ColorClip
from playwright.sync_api import sync_playwright, expect


def main():
    root = Path(__file__).resolve().parents[1] / '.tmp' / 'workspace-checks'
    root.mkdir(parents=True, exist_ok=True)
    source = root / 'source.mov'
    clip = ColorClip(size=(320, 180), color=(44, 95, 124), duration=1)
    clip.write_videofile(str(source), fps=24, codec='libx264', audio=False, logger=None)
    clip.close()
    url = os.environ.get('WORKSPACE_TEST_URL', 'http://127.0.0.1:5050')
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1440, 'height': 1050})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        assert page.goto(url).status == 200
        expect(page.locator('#preview-empty')).to_be_visible()
        expect(page.locator('#convert-button')).to_be_disabled()
        expect(page.locator('#file-count')).to_have_text('0')
        assert page.locator('video[src], img[src]').count() == 0
        page.screenshot(path=str(root / 'desktop-empty.png'), full_page=True)
        with page.expect_file_chooser() as chooser:
            page.locator('#choose-file').click()
        chooser.value.set_files(str(source))
        page.wait_for_function('document.querySelector("#preview").readyState >= 2')
        expect(page.locator('#convert-button')).to_be_enabled()
        expect(page.locator('#source-name')).to_have_text('source.mov')
        expect(page.locator('#thumbnail')).to_be_visible()
        expect(page.locator('#source-resolution')).to_have_text('320 × 180')
        page.locator('#quality').select_option('high')
        page.locator('#resolution').select_option('720')
        page.locator('#keep-audio').uncheck()
        expect(page.locator('#audio-codec')).to_have_text('No audio')

        # Hold the response to inspect the real pending-state controls.
        pending = []
        page.route('**/convert', lambda route: pending.append(route))
        page.locator('#convert-button').click()
        expect(page.locator('#converter-form')).to_have_attribute('aria-busy', 'true')
        expect(page.locator('#convert-button')).to_be_disabled()
        expect(page.locator('#remove-file')).to_be_disabled()
        expect(page.locator('#quality')).to_be_disabled()
        page.wait_for_timeout(100)
        assert pending
        pending.pop().fulfill(status=500, content_type='application/json', body='{"error":"The source could not be read. Try another MOV."}')
        expect(page.locator('#job-status')).to_have_text('Conversion failed')
        expect(page.locator('#convert-button')).to_be_enabled()
        expect(page.locator('#download-button')).to_be_hidden()
        expect(page.locator('#feedback')).to_contain_text('source could not be read')
        page.unroute('**/convert')

        # Retry with an actual Flask/MoviePy conversion, then download the output.
        page.locator('#convert-button').click()
        expect(page.locator('#download-button')).to_be_visible(timeout=60000)
        expect(page.locator('#job-status')).to_have_text('Ready to download')
        expect(page.locator('#converter-form')).to_have_attribute('aria-busy', 'false')
        with page.expect_download() as info:
            page.locator('#download-button').click()
        info.value.save_as(str(root / 'download.mp4'))
        assert (root / 'download.mp4').stat().st_size > 0
        page.screenshot(path=str(root / 'desktop-complete.png'), full_page=True)

        # Removal resets every dependent state, including a stale download link.
        page.locator('#remove-file').click()
        expect(page.locator('#preview-empty')).to_be_visible()
        expect(page.locator('#job')).to_be_hidden()
        expect(page.locator('#convert-button')).to_be_disabled()
        assert page.locator('#download-button').get_attribute('href') is None
        assert page.locator('#video').input_value() == ''
        page.locator('#video').set_input_files({'name':'bad.txt', 'mimeType':'text/plain', 'buffer':b'bad'})
        expect(page.locator('#feedback')).to_contain_text('non-empty MOV')
        expect(page.locator('#file-count')).to_have_text('0')

        # Unsupported/corrupt codecs show a useful fallback and can still submit.
        page.locator('#video').set_input_files({'name':'bad.mov', 'mimeType':'video/quicktime', 'buffer':b'bad'})
        expect(page.locator('#preview-unavailable')).to_be_visible()
        expect(page.locator('#convert-button')).to_be_enabled()
        page.route('**/convert', lambda route: route.abort('failed'))
        page.locator('#convert-button').click()
        expect(page.locator('#feedback')).to_contain_text('connection was interrupted')
        expect(page.locator('#convert-button')).to_be_enabled()
        page.unroute('**/convert')

        # Drag/drop, long names, populated/empty states, and tablet/mobile bounds.
        page.locator('#remove-file').click()
        page.evaluate('''() => {
            const data = new DataTransfer();
            data.items.add(new File(['x'], 'dropped.mov', {type:'video/quicktime'}));
            document.querySelector('#drop-zone').dispatchEvent(new DragEvent('drop', {bubbles:true, dataTransfer:data}));
        }''')
        expect(page.locator('#source-name')).to_have_text('dropped.mov')
        page.locator('#video').set_input_files({'name':'a-very-long-video-name-' * 8 + '.mov','mimeType':'video/quicktime','buffer':source.read_bytes()})
        for width in [320, 390, 620, 768, 980, 1024, 1280, 1920]:
            page.set_viewport_size({'width':width, 'height':900})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
            for selector in ['#convert-button', '#quality', '#resolution', '#remove-file']:
                bounds = page.locator(selector).bounding_box()
                assert bounds and bounds['x'] >= 0 and bounds['x'] + bounds['width'] <= width, (width, selector, bounds)
            if width in [390,768]: page.screenshot(path=str(root / f'populated-{width}.png'), full_page=True)
        page.locator('#remove-file').click()
        for width in [320,390,768]:
            page.set_viewport_size({'width':width,'height':900})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
            if width == 390: page.screenshot(path=str(root / 'mobile-empty.png'),full_page=True)

        # Native multipart flow remains usable when JavaScript is disabled.
        native = browser.new_context(java_script_enabled=False).new_page()
        native.goto(url)
        native.locator('#video').set_input_files(str(source))
        native.locator('#convert-button').click()
        expect(native.locator('#feedback')).to_contain_text('Conversion complete.',timeout=60000)
        assert not errors, errors
        browser.close()
    print('PASS: empty/import/preview/remove; real conversion/download; options; busy locking; server/network errors and retry; unsupported codec; drop; 320–1920px layouts; no-JS flow; no browser errors.')


if __name__ == '__main__':
    main()
