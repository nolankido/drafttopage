"""Optional real local WordPress Media Library handoff acceptance.

Run only inside wordpress_roundtrip.py's marked loopback Playground site.
The images and Word file are deliberately fictional. No hosted WordPress
account, remote image URL, network service, or published post is involved.
"""
import base64
import hashlib
import io
import json
import re
import subprocess
import zipfile
from pathlib import Path
from urllib.parse import urlparse

from document_benchmark import ArticleHTML, normalized

ALIAS_ORIGIN = 'https://wordpress-media.test'


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def open_parent_details(page, selector):
    for parent in page.locator(selector).locator('xpath=ancestor::details').all():
        if not parent.evaluate('(el) => el.open'):
            parent.locator(':scope > summary').click()


def media_fixtures(root):
    source = subprocess.check_output(['node', 'scripts/wordpress-media-fixture.mjs'], cwd=root)
    fixture = json.loads(source)
    assert fixture['kind'] == 'fictional-multi-image-word', 'The Word source must be the deliberately fictional fixture'
    assert len(fixture['originals']) == 2 and len(fixture['occurrences']) == 3, 'Expected two distinct files and three occurrences'
    assert fixture['occurrences'][0]['filename'] == fixture['occurrences'][2]['filename'], 'Expected repeated Word image file'
    return fixture


def run_wordpress_media_handoff(*, root, origin, config, new_page, open_editor, save_draft,
                               visible_editor_control, observe_native_paste, check_blocks,
                               check_post, media_aliases, rest_path):
    from playwright.sync_api import expect

    fixture = media_fixtures(root)
    image_bytes = {item['filename']: base64.b64decode(item['data']) for item in fixture['originals']}
    docx = base64.b64decode(fixture['docxBase64'])
    assert len(image_bytes) == 2 and len({sha256(v) for v in image_bytes.values()}) == 2, 'Distinct original images required'
    with zipfile.ZipFile(io.BytesIO(docx)) as archive:
        assert archive.testzip() is None, 'Fictional Word package is damaged'
        for item in fixture['originals']:
            assert archive.read(item['sourcePart']) == image_bytes[item['filename']], 'Word image bytes disagree with fixture'
    source = new_page()
    media_editor = None
    post_editor = None
    try:
        source.goto('https://drafttopage.test/word-to-wordpress/', wait_until='domcontentloaded')
        expect(source.locator('#desk-status')).to_contain_text('ready')
        source.locator('#import-file').set_input_files({
            'name': 'fictional-multi-image-article.docx',
            'mimeType': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'buffer': docx
        })
        expect(source.locator('#import-preview')).to_be_visible()
        assert source.locator('#body').input_value() == '', 'Import preview must not replace writing'
        source.click('#prepare-word-images')
        expect(source.locator('#word-image-kit-review')).to_be_visible()
        assert source.locator('#word-image-metadata-review').is_hidden(), 'Synthetic images unexpectedly have metadata markers'
        source.check('#word-image-private-ok')
        with source.expect_download() as image_download:
            source.click('#download-word-images')
        package = Path(image_download.value.path()).read_bytes()
        with zipfile.ZipFile(io.BytesIO(package)) as archive:
            assert archive.testzip() is None, 'Downloaded Word image ZIP is corrupt'
            assert archive.namelist() == list(image_bytes) + ['article-body.md', 'image-map.json', 'README.txt']
            for filename, expected in image_bytes.items():
                assert archive.read(filename) == expected, 'Recovered Word image content was changed'
            image_map = archive.read('image-map.json')
            mapping = json.loads(image_map)
            assert mapping['format'] == 'drafttopage-word-images-v1', 'Image placement schema unexpectedly changed'
            assert [item['placeholder'] for item in mapping['placements']] == [
                item['placeholder'] for item in fixture['occurrences']], 'Image positions changed'
            assert [item['filename'] for item in mapping['placements']] == [
                item['filename'] for item in fixture['occurrences']], 'A reused image was duplicated or remapped'
            assert [item['alt'] for item in mapping['placements']] == [
                item['alt'] for item in fixture['occurrences']], 'Per-occurrence Word alt text changed'

        # Upload the recovered, exact original files through the logged-in
        # WordPress REST endpoint in the disposable local Author account.
        media_editor = open_editor()
        uploads = []
        for original in fixture['originals']:
            filename, mime = original['filename'], original['mime']
            with media_editor.expect_response(
                lambda response: response.request.method == 'POST' and rest_path(response.url) == '/wp/v2/media'
            ) as observed:
                result = media_editor.evaluate("""async ({encoded,filename,mime}) => {
                    const data = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
                    const form = new FormData();
                    form.append('file', new File([data], filename, { type: mime }));
                    return await wp.apiFetch({ path: '/wp/v2/media', method: 'POST', body: form });
                }""", {'encoded': original['data'], 'filename': filename, 'mime': mime})
            status = observed.value.status
            assert status == 201 and isinstance(result.get('id'), int) and result['id'] > 0, 'WordPress Media Library upload failed'
            assert result['mime_type'] == mime, 'WordPress changed the uploaded media MIME type'
            media_url = result.get('source_url', '')
            parsed = urlparse(media_url)
            assert parsed.scheme == 'http' and parsed.netloc == urlparse(origin).netloc, 'Media upload escaped the marked loopback site'
            served = media_editor.request.get(media_url)
            assert served.status == 200, 'Uploaded Media Library file was not retrievable'
            served_bytes = served.body()
            assert sha256(served_bytes) == sha256(image_bytes[filename]), 'WordPress did not serve the original uploaded bytes'
            # Draft to Page deliberately requires HTTPS image URLs. The fixture
            # local WordPress server is HTTP, so a private test-only HTTPS alias
            # routes to its actual uploaded file. This is not a hosted-HTTPS test.
            alias = ALIAS_ORIGIN + parsed.path
            assert alias not in media_aliases, 'A media fixture alias was reused'
            media_aliases[alias] = {'source_url': media_url, 'bytes': served_bytes, 'mime': mime}
            uploads.append({
                'filename': filename, 'mime': mime, 'mediaId': result['id'], 'uploadStatus': status,
                'originalSha256': sha256(image_bytes[filename]), 'servedSha256': sha256(served_bytes),
                'localLoopback': True, 'fixtureHttpsAlias': alias
            })
        assert uploads[0]['mediaId'] != uploads[1]['mediaId'], 'Distinct images must be separate WordPress media attachments'
        media_editor.close()
        media_editor = None

        # The source app still requires explicit import review, then explicit
        # source comparison, alt-text use, pasted URL, preview and apply for
        # EACH image. The shortcut can select, but not approve, an occurrence.
        source.check('#import-changes-ok')
        source.click('#apply-import-and-continue')
        expect(source.locator('#publishing-destination')).to_be_focused()
        expect(source.locator('#reviewed')).not_to_be_checked()
        open_parent_details(source, '#start-notes')
        source.click('#start-notes')
        source.fill('#notes', config['privateMarkers'][0])
        open_parent_details(source, '#add-question')
        source.click('#add-question')
        source.fill('#review-question-0', config['privateMarkers'][1])
        open_parent_details(source, '#start-image-editor')
        source.click('#start-image-editor')
        if not source.locator('#image-map-panel').evaluate('el => el.open'):
            source.locator('#image-map-panel > summary').click()
        source.locator('#image-map-file').set_input_files({
            'name': 'image-map.json', 'mimeType': 'application/json', 'buffer': image_map
        })
        expect(source.locator('#image-map-review')).to_be_visible()
        resolved = []
        alias_by_filename = {upload['filename']: upload['fixtureHttpsAlias'] for upload in uploads}
        for occurrence in fixture['occurrences']:
            expect(source.locator('#image-map-next')).to_be_enabled()
            source.click('#image-map-next')
            expect(source.locator('#image-map-entry')).to_have_value(occurrence['placeholder'])
            assert occurrence['placeholder'] in source.locator('#image-target-context').input_value().replace('\\', ''), 'Wrong image location pinned'
            assert source.locator('#image-url').input_value() == '' and source.locator('#image-alt').input_value() == '', 'Details were silently carried between images'
            assert source.locator('#image-map-confirm').is_checked() is False, 'Selection must not approve an image'
            source.check('#image-map-confirm')
            source.click('#image-map-use-alt')
            assert source.locator('#image-alt').input_value() == occurrence['alt'], 'Word alternative text changed'
            url = alias_by_filename[occurrence['filename']]
            source.fill('#image-url', url)
            source.click('#image-preview')
            assert url in source.locator('#image-after').input_value(), 'Image preview lost the explicitly entered local media URL'
            assert occurrence['placeholder'] in source.locator('#image-before').input_value().replace('\\', '')
            source.click('#image-apply')
            assert not source.locator('#reviewed').is_checked(), 'Image replacement must clear export approval'
            assert not source.locator('#wordpress-linked-images').is_checked(), 'Image replacement must clear linked-image consent'
            resolved.append({'filename': occurrence['filename'], 'alt': occurrence['alt'], 'src': url})
        expect(source.locator('#image-map-next')).to_be_disabled()
        assert '[Word image ' not in source.locator('#body').input_value().replace('\\', ''), 'A Word image placeholder was left unresolved'
        assert source.locator('#article-preview img').count() == 0, 'Local article preview loaded external image URLs'

        open_parent_details(source, '#wordpress-linked-images')
        source.check('#wordpress-linked-images')
        source.check('#reviewed')
        with source.expect_download() as downloaded:
            source.click('#download-wordpress')
        exported = Path(downloaded.value.path()).read_text()
        assert exported.count('<!-- wp:image -->') == 3, 'Three explicit WordPress Image blocks were not exported'
        assert all(item['src'].replace('&', '&amp;') in exported and item['alt'] in exported for item in resolved)
        assert not any(private in exported for private in config['privateMarkers']), 'Private source/review text leaked'
        source.click('#copy-wordpress')
        expect(source.locator('#wordpress-action-status')).to_contain_text('WordPress blocks copied')
        copied = source.evaluate('navigator.clipboard.readText()')
        assert copied == exported, 'Native WordPress clipboard differs from approved export'

        # Native Visual paste, unpublished draft save, reopen, and live Media
        # Library attachment lookup in the real local WordPress installation.
        post_editor = open_editor()
        title = 'Fictional Word images: local Media Library test'
        title_field = visible_editor_control(post_editor, '.editor-post-title__input')
        title_field.fill(title)
        title_field.press('Enter')
        visual = visible_editor_control(post_editor,
            '[data-type="core/paragraph"][contenteditable="true"], [data-type="core/paragraph"] [contenteditable="true"]')
        observe_native_paste(visual, 'visual-paragraph')
        visual.click()
        visual.press('Control+V')
        post_editor.wait_for_function("() => wp.data.select('core/block-editor').getBlocks().length === 4")
        events = [frame.evaluate('window.DTP_NATIVE_PASTE||null') for frame in post_editor.frames]
        events = [event for event in events if event]
        assert len(events) == 1 and events[0]['trusted'] is True and events[0]['text'] == copied, 'Native paste transport was not verified'
        case = {
            'title': title, 'text': 'Synthetic article',
            'top': ['core/paragraph', 'core/image', 'core/image', 'core/image'],
            'images': [{'src': image['src'], 'alt': image['alt']} for image in resolved]
        }
        check_blocks(post_editor, case)
        post_id = post_editor.evaluate("wp.data.select('core/editor').getCurrentPostId()")
        saved = save_draft(post_editor, post_id)
        raw = check_post(saved, case, config['privateMarkers'])
        assert '[Word image ' not in raw and 'placementScope' not in raw, 'Word image map data leaked to post'
        post_editor.close()
        post_editor = open_editor(post_id)
        check_blocks(post_editor, case)
        reopened = post_editor.evaluate("id=>wp.apiFetch({path:'/wp/v2/posts/'+id+'?context=edit'})", post_id)
        assert check_post(reopened, case, config['privateMarkers']) == raw, 'Image blocks changed after WordPress reopen'
        assert [item['filename'] for item in resolved] == [
            'word-image-001.png', 'word-image-002.jpg', 'word-image-001.png'], 'Repeated image mapping changed'
        assert resolved[0]['src'] == resolved[2]['src'] and resolved[0]['alt'] != resolved[2]['alt'], 'Repeated media must preserve contextual alt text'
        return {
            'result': 'PASS', 'fixtureId': 'fictional-word-multi-image-media-library',
            'sourceDocumentSha256': sha256(docx), 'imagePackageVerified': True, 'mapV1Verified': True,
            'uploads': uploads, 'placements': resolved, 'wordpressAttachmentCount': len(uploads),
            'nativeVisualPasteTrusted': True, 'exportMatchesClipboard': True,
            'privateFieldsOmitted': True, 'exportApprovedSeparately': True,
            'reusedMedia': True, 'postId': post_id, 'postStatus': 'draft', 'postTitle': title, 'postText': case['text'],
            'saveResponse': 200, 'savedSha256': sha256(raw.encode()),
            'validAfterReopen': True, 'reopenedSavedSourceExact': True,
            'syntheticHttpsAlias': True
        }
    finally:
        for page in [source, media_editor, post_editor]:
            if page is not None and not page.is_closed():
                page.close()
