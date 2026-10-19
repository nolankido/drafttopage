"""Independent, local package semantics for Draft to Page export checks.

This is a bounded export contract, not a general Word renderer. Relationships
are inspected, never fetched. A heading must resolve to an outline level in
actual paragraph properties/styles; a style's name alone proves nothing.
"""
import re
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
P = '{http://schemas.openxmlformats.org/package/2006/relationships}'
C = '{http://schemas.openxmlformats.org/package/2006/content-types}'
OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/'


def numbering_index(root, element, attribute):
    """Reject conflicting declarations before any dictionary can hide them."""
    assert root.tag == W + 'numbering', 'Word numbering namespace is invalid'
    result, numeric_ids = {}, set()
    for node in root.findall(W + element):
        identity = node.get(W + attribute)
        assert isinstance(identity, str) and re.fullmatch(r'[+]?[0-9]{1,10}', identity), 'Word numbering identifier is missing or invalid'
        number = int(identity)
        assert number not in numeric_ids, 'Word numbering identifiers are duplicated: ' + attribute
        numeric_ids.add(number)
        result[identity] = node
    return result


def _one(node, path, description):
    nodes = [] if node is None else node.findall(path)
    assert len(nodes) <= 1, 'Ambiguous Word ' + description
    return nodes[0] if nodes else None


def _outline(properties):
    outline = _one(properties, W + 'outlineLvl', 'outline level')
    if outline is None:
        return None
    value = outline.get(W + 'val')
    assert isinstance(value, str) and re.fullmatch(r'[0-9]', value), 'Word outline level is invalid'
    return int(value)


def _styles_part(archive):
    names = archive.namelist()
    assert len(names) == len(set(names)), 'Word package contains duplicate parts'
    for part in ['word/styles.xml', '[Content_Types].xml', 'word/_rels/document.xml.rels']:
        assert part in names, 'Word style package part is missing: ' + part
    types = ET.fromstring(archive.read('[Content_Types].xml'))
    assert types.tag == C + 'Types', 'Word content-types namespace is invalid'
    declarations = [item for item in types.findall(C + 'Override') if item.get('PartName') == '/word/styles.xml']
    assert len(declarations) == 1 and declarations[0].get('ContentType') == 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml', 'Word styles content type is missing, duplicated or wrong'
    relationships = ET.fromstring(archive.read('word/_rels/document.xml.rels'))
    assert relationships.tag == P + 'Relationships', 'Word styles relationships namespace is invalid'
    entries = list(relationships)
    assert all(item.tag == P + 'Relationship' and item.get('Id') for item in entries), 'Word style relationship entry is invalid'
    assert len({item.get('Id') for item in entries}) == len(entries), 'Word style relationship identifiers are duplicated'
    links = [item for item in entries if item.get('Type') == OFFICE + 'styles']
    assert len(links) == 1, 'Word package needs exactly one styles relationship'
    assert links[0].get('Target') in ['styles.xml', '/word/styles.xml'] and links[0].get('TargetMode', 'Internal') == 'Internal', 'Word styles relationship must target its local styles part'
    root = ET.fromstring(archive.read('word/styles.xml'))
    assert root.tag == W + 'styles', 'Word styles namespace is invalid'
    return root


def resolved_word_headings(archive, document):
    """Resolve heading semantics, including inheritance and direct overrides."""
    assert document.tag == W + 'document', 'Word document namespace is invalid'
    root = _styles_part(archive)
    styles, defaults = {}, []
    for style in root.findall(W + 'style'):
        identity = style.get(W + 'styleId')
        assert identity and identity not in styles, 'Word style identifier is missing or duplicated'
        styles[identity] = style
        if style.get(W + 'type') == 'paragraph':
            flag = style.get(W + 'default', 'false')
            assert flag in ['true', 'false', '1', '0', 'on', 'off'], 'Word default paragraph flag is invalid'
            if flag in ['true', '1', 'on']:
                defaults.append(identity)
    assert len(defaults) <= 1, 'Word default paragraph style is ambiguous'
    doc_defaults = _one(root, W + 'docDefaults', 'document defaults')
    pdefaults = _one(doc_defaults, W + 'pPrDefault', 'paragraph defaults')
    default_level = _outline(_one(pdefaults, W + 'pPr', 'default paragraph properties'))
    default_level = 9 if default_level is None else default_level
    cache = {}

    def resolve(identity, visiting=()):
        assert identity not in visiting and len(visiting) < 64, 'Word paragraph style inheritance is cyclic or too deep'
        assert identity in styles, 'Word paragraph style definition is missing: ' + identity
        if identity in cache:
            return cache[identity]
        style = styles[identity]
        assert style.get(W + 'type') == 'paragraph', 'Word paragraph refers to a non-paragraph style'
        parent = _one(style, W + 'basedOn', 'base style')
        inherited = default_level
        if parent is not None:
            parent_id = parent.get(W + 'val')
            assert parent_id, 'Word base style reference is empty'
            inherited = resolve(parent_id, visiting + (identity,))
        own = _outline(_one(style, W + 'pPr', 'style paragraph properties'))
        cache[identity] = inherited if own is None else own
        return cache[identity]

    headings = []
    for paragraph in document.iter(W + 'p'):
        properties = _one(paragraph, W + 'pPr', 'paragraph properties')
        reference = _one(properties, W + 'pStyle', 'paragraph style reference')
        identity = reference.get(W + 'val') if reference is not None else (defaults[0] if defaults else None)
        if reference is not None:
            assert identity, 'Word paragraph style reference is empty'
        level = resolve(identity) if identity is not None else default_level
        direct = _outline(properties)
        if direct is not None:
            level = direct
        if level < 9:
            text = re.sub(r'\s+', ' ', ''.join(' ' if item.tag in [W + 'br', W + 'tab'] else item.text or ''
                                             for item in paragraph.iter() if item.tag in [W + 't', W + 'br', W + 'tab'])).strip()
            headings.append({'level': level + 1, 'text': text})
    return headings
