import { fixture, para, run } from './docx-fixtures.js';

export const insertion = (text, properties = '') => '<w:ins w:id="1" w:author="Fictional reviewer" w:date="2026-10-16T00:00:00Z">' + run(text, properties) + '</w:ins>';
export const deletion = (text, properties = '') => '<w:del w:id="2" w:author="Fictional reviewer" w:date="2026-10-16T00:00:00Z">' + run(text, properties).replaceAll('w:t', 'w:delText') + '</w:del>';
export const revisionFixture = () => fixture(para('Fictional version review', '<w:outlineLvl w:val="0"/>') + '<w:p>' + run('The workshop opens on ') + deletion('Friday', '<w:i/>') + insertion('Saturday', '<w:b/>') + run('.') + '</w:p>' + '<w:p>' + deletion('A retired sentence.') + insertion('A proposed sentence.') + '</w:p>' + para('Both versions keep this closing sentence.'));
export const proposedBody = 'The workshop opens on **Saturday**\\.\n\nA proposed sentence\\.\n\nBoth versions keep this closing sentence\\.';
export const previousBody = 'The workshop opens on *Friday*\\.\n\nA retired sentence\\.\n\nBoth versions keep this closing sentence\\.';
