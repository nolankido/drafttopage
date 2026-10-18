"""Only allow explicitly authored, versioned, fictional source-app fixtures.

This helper never opens browser/user documents, fetches URLs, or silently
rebrands synthetic DOCX/HTML as a Microsoft Word or Google Docs export.
"""
import hashlib
import json
from pathlib import Path
from document_benchmark import build_authored_docx

SOURCES = {
    'authored-compound-docx-article': ('docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    'authored-compound-docs-style-html': ('html', 'text/html'),
}


def load_wordpress_source_fixture(root, case_id):
    """Return bytes for a pinned synthetic source, never untrusted path input."""
    if case_id not in SOURCES:
        raise ValueError('Unknown synthetic acceptance fixture. Current writing is unchanged.')
    root = Path(root)
    path = root / 'tests/fixtures/documents/authored-cases.json'
    corpus = json.loads(path.read_text(encoding='utf-8'))
    if corpus.get('version') != 1 or corpus.get('origin') != 'authored-synthetic':
        raise ValueError('The synthetic corpus origin is invalid.')
    matches = [case for case in corpus['cases'] if case.get('id') == case_id]
    if len(matches) != 1:
        raise ValueError('The synthetic acceptance fixture must exist exactly once.')
    case = matches[0]
    kind, mime = SOURCES[case_id]
    if case.get('kind') != kind or not isinstance(case.get('source'), str):
        raise ValueError('The synthetic acceptance fixture changed format.')
    if kind == 'docx':
        blob = build_authored_docx(case)
        limit = 8 * 1024 * 1024
    else:
        # The authored source is an inert and bounded HTML import selection.
        # It is not captured from Google Docs; the user must not confuse it
        # with application-origin or customer acceptance evidence.
        blob = case['source'].encode('utf-8')
        limit = 512 * 1024
        if b'<script' in blob.lower() or b'<base' in blob.lower():
            raise ValueError('Active or source-base HTML does not belong in this test fixture.')
    if not blob or len(blob) > limit:
        raise ValueError('Synthetic acceptance input is missing or exceeds the supported limit.')
    return {
        'input': {'name': case_id + '.' + kind, 'mimeType': mime, 'buffer': blob},
        'origin': 'authored-synthetic',
        'sha256': hashlib.sha256(blob).hexdigest(),
        'kind': kind,
    }
