"""Real routed-browser acceptance for mobile table row ordering.

The caller serves the exact built local assets, real CSP and ES modules via
Playwright. This uses only fictional writing, no accounts, publishing or network.
Both scoped runs and the manual complete release gate execute this same scenario.
"""
from pathlib import Path
from playwright.sync_api import expect


def run_table_row_acceptance(open_page, report, open_details):
    page, context, state = open_page('/markdown-to-wordpress/')
    try:
        old_rows = [(f'Row {i}', f'Detail {i}') for i in range(1, 13)]
        original_table = '\n'.join([
            '| Name | Detail |',
            '| --- | --- |',
            *[f'| {name} | {value} |' for name, value in old_rows]
        ])
        original = 'Before sentinel 😀.\n\n' + original_table + '\n\nAfter sentinel.'
        page.fill('#body', original)
        page.check('#reviewed')
        open_details(page, '#editing-tools')
        page.click('#start-table-editor')
        page.click('#table-open-selected')
        expect(page.locator('#table-row-selected option')).to_have_count(12)
        expect(page.locator('#table-row-destination option')).to_have_count(12)
        expect(page.locator('#table-insert-before')).to_be_enabled()

        def check_narrow(width, label):
            page.set_viewport_size({'width': width, 'height': 850})
            page.locator('#table-row-arrange').scroll_into_view_if_needed()
            observed = page.evaluate("""() => {
              const width=innerWidth;
              const ids=['table-row-arrange','table-row-selected','table-row-destination',
                'table-insert-before','table-insert-after','table-move-up','table-move-down',
                'table-move-to','table-grid'];
              return {
                width, documentWidth:document.documentElement.scrollWidth,
                controls:ids.map(id=>{
                  const element=document.getElementById(id), rect=element.getBoundingClientRect();
                  return {id,left:rect.left,right:rect.right,displayed:rect.width>0&&rect.height>0,
                    textClipped:element.tagName==='BUTTON'&&element.scrollWidth>element.clientWidth+2};
                })
              };
            }""")
            overflow = observed['documentWidth'] > observed['width'] + 1 or any(
                not ctrl['displayed'] or ctrl['left'] < -2 or ctrl['right'] > observed['width'] + 2 or ctrl['textClipped']
                for ctrl in observed['controls'])
            report['layout'][f'table-row-arrange-{label}-{width}'] = overflow
            assert observed['width'] == width and not overflow, (
                f'Table row arranger layout at {width}px: {observed}')
            # The grid may scroll horizontally inside its own region, but the
            # selects and action buttons must stay in the document viewport.
            assert page.locator('#table-grid').evaluate(
                '(element)=>getComputedStyle(element).overflowX==="auto"')
            return observed

        check_narrow(1440, 'before')
        check_narrow(390, 'before')
        page.locator('#table-insert-before').focus()
        assert page.locator('#table-insert-before').evaluate(
            'element=>document.activeElement===element')
        page.click('#table-insert-before')
        expect(page.locator('#table-cell-0-0')).to_have_value('')
        expect(page.locator('#table-cell-1-0')).to_have_value('Row 1')
        page.fill('#table-cell-0-0', 'Inserted first')
        page.fill('#table-cell-0-1', 'Inserted detail')
        assert page.locator('#body').input_value() == original
        assert page.locator('#reviewed').is_checked()

        check_narrow(320, 'inserted')
        page.select_option('#table-row-selected', '1')
        page.select_option('#table-row-destination', '12')
        page.click('#table-move-to')
        expect(page.locator('#table-row-selected')).to_have_value('12')
        expect(page.locator('#table-cell-12-0')).to_have_value('Row 1')
        expect(page.locator('#table-cell-12-1')).to_have_value('Detail 1')
        expect(page.locator('#table-page-status')).to_contain_text('Rows 11 to 13 of 13')
        assert page.locator('#table-cell-12-0').evaluate(
            'element=>document.activeElement===element')
        check_narrow(320, 'moved')
        check_narrow(390, 'moved')
        assert page.locator('#body').input_value() == original

        page.click('#table-preview-change')
        before = page.locator('#table-before').input_value()
        after = page.locator('#table-after').input_value()
        assert before == original_table
        desired_rows = [('Inserted first', 'Inserted detail'), *old_rows[1:], old_rows[0]]
        desired_table = '\n'.join([
            '| Name | Detail |',
            '| --- | --- |',
            *[f'| {name} | {value} |' for name, value in desired_rows]
        ])
        assert after == desired_table, 'Preview did not preserve every data row'
        expect(page.locator('#table-reading-preview table tbody tr')).to_have_count(13)
        checkpoints = page.locator('#checkpoint-select option').count()
        page.click('#table-apply')
        expect(page.locator('#body')).to_have_value(
            'Before sentinel 😀.\n\n' + desired_table + '\n\nAfter sentinel.')
        assert page.locator('#checkpoint-select option').count() == checkpoints + 1
        assert not page.locator('#reviewed').is_checked()
        page.check('#reviewed')
        with page.expect_download() as result:
            page.click('#download-wordpress')
        block_source = Path(result.value.path()).read_text()
        assert block_source.count('<tr>') == 14
        assert block_source.index('Inserted first') < block_source.index('Row 2') < block_source.index('Row 1')
        assert 'Before sentinel 😀.' in block_source and 'After sentinel.' in block_source
        assert state['api'] == [], 'Table acceptance must not contact the private AI pilot'
        report['checks'].append(
            'Narrow table row arrangement: actual 1440/390/320px geometry, keyboard focus, insert-before, '
            '13-row cross-page move and focus, unchanged draft until reviewed Apply, '
            'exact source and reading preview, revision checkpoint, approval reset, '
            'downloaded WordPress row order, and no private pilot requests')
    finally:
        context.close()
