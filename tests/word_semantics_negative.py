"""Verifier-only controls for IDs, heading styles and complete inline marks.

Uses fabricated packages and the real independent check_conversion function.
No source application, browser, network or WordPress session is exercised.
"""
import base64
import copy
import io
import json
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from document_benchmark import check_conversion
from document_fidelity_negative import fixture, pack, word_change, without_part, W, R, C

NS = '{' + W + '}'


def xml_change(result, part, transform):
    result = copy.deepcopy(result)
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(result['word']))) as archive:
        parts = {name: archive.read(name).decode('utf-8') for name in archive.namelist()}
    root = ET.fromstring(parts[part])
    transform(root)
    parts[part] = ET.tostring(root, encoding='unicode')
    result['word'] = pack(parts)
    return result


def specimens():
    good, wanted = fixture()
    # An omitted supported mark is expected to be absent in compound contracts.
    wanted['inlineMarks'] = {'strong': []}
    positives = [('canonical-package', good, wanted)]
    for start in [1, 7]:
        result, expect = fixture(start)
        expect['inlineMarks'] = {'strong': []}
        positives.append(('valid-start-' + str(start), result, expect))
    for name, part, before, after in [
        ('absolute-styles-target', 'word/_rels/document.xml.rels', 'Target="styles.xml"', 'Target="/word/styles.xml"'),
        ('explicit-internal-styles', 'word/_rels/document.xml.rels', 'Target="styles.xml"', 'Target="styles.xml" TargetMode="Internal"'),
        ('explicit-paragraph-outline', 'word/document.xml', '<w:pStyle w:val="Heading2"/>', '<w:pStyle w:val="Heading2"/><w:outlineLvl w:val="1"/>'),
        ('explicit-italic-off', 'word/document.xml', '<w:r><w:t>Final', '<w:r><w:rPr><w:i w:val="0"/></w:rPr><w:t>Final')
    ]:
        positives.append((name, word_change(good, part, before, after), wanted))

    def inherited(root):
        style = root.find(NS + 'style')
        style.remove(style.find(NS + 'pPr'))
        ET.SubElement(style, NS + 'basedOn', {NS + 'val': 'BaseHeading'})
        parent = ET.SubElement(root, NS + 'style', {NS + 'type': 'paragraph', NS + 'styleId': 'BaseHeading'})
        ET.SubElement(ET.SubElement(parent, NS + 'pPr'), NS + 'outlineLvl', {NS + 'val': '1'})
    positives.append(('inherited-heading-level', xml_change(good, 'word/styles.xml', inherited), wanted))
    strong = copy.deepcopy(good)
    for key in ['html', 'wordpress']:
        strong[key] = strong[key].replace('Final sentinel 928.', '<strong>Final sentinel 928.</strong>')
    strong = word_change(strong, 'word/document.xml', '<w:r><w:t>Final', '<w:r><w:rPr><w:b/></w:rPr><w:t>Final')
    strong_wanted = copy.deepcopy(wanted)
    strong_wanted['inlineMarks']['strong'] = ['Final sentinel 928.']
    positives.append(('authored-bold-preserved', strong, strong_wanted))

    negatives = []
    for element, key in [('num', 'numId'), ('abstractNum', 'abstractNumId')]:
        def duplicate(root, element=element, key=key):
            first = copy.deepcopy(root.find(NS + element))
            if element == 'num':
                first.find(NS + 'abstractNumId').set(NS + 'val', '99')
            else:
                first.find(NS + 'lvl/' + NS + 'numFmt').set(NS + 'val', 'bullet')
            root.insert(0, first)
        negatives.append(('duplicate-' + key, xml_change(good, 'word/numbering.xml', duplicate), wanted))
        def alias_duplicate(root, element=element, key=key):
            duplicate = copy.deepcopy(root.find(NS + element))
            duplicate.set(NS + key, '0' + duplicate.get(NS + key))
            root.insert(0, duplicate)
        negatives.append(('numeric-alias-duplicate-' + key, xml_change(good, 'word/numbering.xml', alias_duplicate), wanted))
        def missing(root, element=element, key=key):
            root.find(NS + element).attrib.pop(NS + key)
        negatives.append(('missing-' + key, xml_change(good, 'word/numbering.xml', missing), wanted))

    negatives.append(('missing-styles-part', without_part(good, 'word/styles.xml'), wanted))
    for name, part, before, after in [
        ('missing-styles-relationship', 'word/_rels/document.xml.rels', '<Relationship Id="styles" Type="' + R + '/styles" Target="styles.xml"/>', ''),
        ('external-styles-relationship', 'word/_rels/document.xml.rels', 'Target="styles.xml"', 'Target="styles.xml" TargetMode="External"'),
        ('wrong-styles-target', 'word/_rels/document.xml.rels', 'Target="styles.xml"', 'Target="other.xml"'),
        ('missing-styles-content-type', '[Content_Types].xml', '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>', ''),
        ('wrong-styles-content-type', '[Content_Types].xml', 'wordprocessingml.styles+xml', 'wordprocessingml.document.main+xml'),
        ('missing-heading-style-definition', 'word/styles.xml', 'w:styleId="Heading2"', 'w:styleId="NotHeading2"'),
        ('heading-is-character-style', 'word/styles.xml', 'w:type="paragraph"', 'w:type="character"'),
        ('heading-outline-removed', 'word/styles.xml', '<w:outlineLvl w:val="1"/>', ''),
        ('heading-outline-body-text', 'word/styles.xml', 'w:val="1"', 'w:val="9"'),
        ('heading-outline-wrong-level', 'word/styles.xml', 'w:val="1"', 'w:val="2"'),
        ('heading-outline-invalid', 'word/styles.xml', 'w:val="1"', 'w:val="invalid"'),
        ('heading-duplicate-outline', 'word/styles.xml', '<w:outlineLvl w:val="1"/>', '<w:outlineLvl w:val="9"/><w:outlineLvl w:val="1"/>'),
        ('heading-missing-base-style', 'word/styles.xml', '<w:pPr>', '<w:basedOn w:val="Missing"/><w:pPr>'),
        ('heading-style-self-cycle', 'word/styles.xml', '<w:pPr>', '<w:basedOn w:val="Heading2"/><w:pPr>'),
        ('direct-paragraph-demotes-heading', 'word/document.xml', '<w:pStyle w:val="Heading2"/>', '<w:pStyle w:val="Heading2"/><w:outlineLvl w:val="9"/>'),
        ('direct-paragraph-changes-heading', 'word/document.xml', '<w:pStyle w:val="Heading2"/>', '<w:pStyle w:val="Heading2"/><w:outlineLvl w:val="2"/>')
    ]:
        negatives.append((name, word_change(good, part, before, after), wanted))

    def duplicate_style(root):
        root.insert(0, copy.deepcopy(root.find(NS + 'style')))
    negatives.append(('duplicate-style-id', xml_change(good, 'word/styles.xml', duplicate_style), wanted))
    for mark in ['em', 'code']:
        for output in ['html', 'wordpress']:
            result = copy.deepcopy(good)
            result[output] = result[output].replace('Final sentinel 928.', '<' + mark + '>Final sentinel 928.</' + mark + '>')
            negatives.append((output + '-unintended-' + mark, result, wanted))
        prop = '<w:i/>' if mark == 'em' else '<w:rStyle w:val="CodeChar"/>'
        result = word_change(good, 'word/document.xml', '<w:r><w:t>Final', '<w:r><w:rPr>' + prop + '</w:rPr><w:t>Final')
        negatives.append(('word-unintended-' + mark, result, wanted))
        result = copy.deepcopy(result)  # Keep the Word-only corruption isolated.
        for output in ['html', 'wordpress']:
            result[output] = result[output].replace('Final sentinel 928.', '<' + mark + '>Final sentinel 928.</' + mark + '>')
        negatives.append(('all-exports-unintended-' + mark, result, wanted))
    return positives, negatives


def main():
    positives, negatives = specimens()
    report = {'scope': 'synthetic verifier-only style and ID controls', 'positive': [], 'negative': [], 'errors': []}
    for name, result, wanted in positives:
        try:
            check_conversion(result, wanted)
        except Exception as error:
            report['errors'].append({'name': name, 'reason': str(error)})
        else:
            report['positive'].append(name)
    for name, result, wanted in negatives:
        try:
            check_conversion(result, wanted)
        except AssertionError as error:
            report['negative'].append({'name': name, 'rejectedBy': str(error)})
        except Exception as error:
            report['errors'].append({'name': name, 'reason': 'Unexpected exception: ' + str(error)})
        else:
            report['errors'].append({'name': name, 'reason': 'Damaged export incorrectly accepted'})
    report.update(result='FAIL' if report['errors'] else 'PASS', positiveCount=len(report['positive']),
                  negativeCount=len(report['negative']), expectedPositiveCount=len(positives), expectedNegativeCount=len(negatives))
    print(json.dumps(report, indent=2))
    return 1 if report['errors'] else 0


if __name__ == '__main__':
    raise SystemExit(main())
