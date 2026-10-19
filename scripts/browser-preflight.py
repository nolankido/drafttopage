"""Bounded local browser capability check, never a product acceptance result.

The synthetic HTTPS route mirrors the routed origin used by browser-smoke.py.
An optional ephemeral loopback page checks the transport required by WordPress.
No account, clipboard, installation, browser policy or external website changes.
"""
import argparse
import json
import os
import re
import shutil
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

FORMAT = 'drafttopage-browser-preflight'
ORIGIN = 'https://drafttopage.test'
PAGE_PATH = '/__preflight__/'
MODULE_PATH = PAGE_PATH + 'probe.js'
MARKER = 'drafttopage-local-module-ready-v1'
HTML = ('<!doctype html><html lang="en"><meta charset="utf-8">'
        '<title>Local browser preflight</title><link rel="icon" href="data:,">'
        '<main><h1>Local browser preflight</h1></main>'
        '<script type="module" src="probe.js"></script></html>').encode()
MODULE = ('export const marker = ' + json.dumps(MARKER) + ';\n'
          'window.DTP_PREFLIGHT_READY = marker;\n').encode()
HEADERS = {
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'none'; object-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
}


def step(result='NOT_RUN', code='NOT_RUN', **extra):
    return {'result': result, 'code': code, **extra}


def failure_code(error, stage):
    """Return only allowlisted codes, never a traceback, local path or URL."""
    if 'ERR_BLOCKED_BY_ADMINISTRATOR' in str(error):
        return 'BROWSER_POLICY_BLOCK'
    if type(error).__name__ == 'TimeoutError':
        return 'BROWSER_TIMEOUT'
    if isinstance(error, ImportError):
        return 'PLAYWRIGHT_UNAVAILABLE'
    if stage == 'launch':
        return 'CHROMIUM_LAUNCH_FAILED'
    return 'BROWSER_PROBE_FAILED'


def payload(path):
    if path == PAGE_PATH:
        return 'text/html; charset=utf-8', HTML
    if path == MODULE_PATH:
        return 'text/javascript; charset=utf-8', MODULE
    return None


def navigate(browser, origin, *, loopback=False):
    """Exercise a real navigation and ES module; do not substitute set_content."""
    context = browser.new_context(service_workers='block')
    seen, unexpected = [], []
    try:
        def route(request):
            url = request.request.url
            path = url[len(origin):] if url.startswith(origin + '/') else ''
            resource = payload(path)
            if resource is None or request.request.method != 'GET':
                unexpected.append(True)
                request.abort()
                return
            seen.append(path)
            if loopback:
                request.continue_()
            else:
                mime, body = resource
                request.fulfill(status=200, body=body, headers={**HEADERS, 'Content-Type': mime})
        context.route('**/*', route)
        page = context.new_page()
        page.set_default_timeout(5000)
        page.goto(origin + PAGE_PATH, wait_until='load', timeout=7000)
        page.wait_for_function('window.DTP_PREFLIGHT_READY === ' + json.dumps(MARKER), timeout=3000)
        secure = page.evaluate('window.isSecureContext') is True
        assert secure, 'The local test origin is not a secure browser context'
        assert not unexpected and sorted(seen) == sorted([PAGE_PATH, MODULE_PATH]), 'Unexpected browser request'
        return step('PASS', 'OK', moduleExecuted=True, secureContext=True, requestsMatched=True)
    finally:
        context.close()


class LocalProbeHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        resource = payload(self.path)
        if resource is None:
            self.send_error(404)
            return
        mime, body = resource
        self.send_response(200)
        for name, value in {**HEADERS, 'Content-Type': mime}.items():
            self.send_header(name, value)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        # Never include request or machine details in the structured report.
        pass


def run_probe(require_loopback=False):
    report = {'format': FORMAT, 'version': 1, 'result': 'BLOCKED',
              'scope': 'synthetic local navigation and module execution only; not application or WordPress acceptance',
              'browserVersion': None,
              'checks': {'launch': step(), 'routedPage': step(), 'loopbackPage': step()}}
    stage = 'launch'
    browser = server = thread = None
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as playwright:
            try:
                binary = os.environ.get('CHROMIUM_EXECUTABLE') or shutil.which('chromium') or shutil.which('chromium-browser')
                # Preserve the existing container launch flags. Do not disable
                # browser policies, web security or certificate validation.
                options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
                if binary:
                    options['executable_path'] = binary
                browser = playwright.chromium.launch(**options, timeout=10000)
                version = browser.version
                assert re.fullmatch(r'[0-9]{1,4}(?:\.[0-9]{1,10}){1,4}', version), 'Unexpected browser version'
                report['browserVersion'] = version
                report['checks']['launch'] = step('PASS', 'OK')
                stage = 'routedPage'
                report['checks'][stage] = navigate(browser, ORIGIN)
                if require_loopback:
                    stage = 'loopbackPage'
                    server = ThreadingHTTPServer(('127.0.0.1', 0), LocalProbeHandler)
                    thread = Thread(target=server.serve_forever, daemon=True)
                    thread.start()
                    report['checks'][stage] = navigate(browser, 'http://127.0.0.1:' + str(server.server_port), loopback=True)
                report['result'] = 'PASS'
            finally:
                if server:
                    if thread and thread.is_alive():
                        server.shutdown()
                    server.server_close()
                if thread and thread.is_alive():
                    thread.join(timeout=2)
                if browser:
                    browser.close()
    except Exception as error:
        report['checks'][stage] = step('BLOCKED', failure_code(error, stage))
        report['result'] = 'BLOCKED'
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--loopback', action='store_true', help='Also check local HTTP navigation needed for WordPress.')
    args = parser.parse_args()
    report = run_probe(args.loopback)
    print(json.dumps(report, sort_keys=True))
    return 0 if report['result'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
