import { W, R, fixture, para } from './docx-fixtures.js';
export const definition = (id, text = para('PRIVATE_COMMENT: Check the source.')) => '<w:comment w:id="' + id + '" w:author="PRIVATE_AUTHOR" w:date="2026-10-01T12:00:00Z">' + text + '</w:comment>';
export function commentFixture(comments = definition(7)) {
  const parts = fixture(para('Fictional article'));
  parts['[Content_Types].xml'] = parts['[Content_Types].xml'].replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>');
  parts['word/_rels/document.xml.rels'] = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="comments" Type="' + R + '/comments" Target="comments.xml"/></Relationships>';
  parts['word/comments.xml'] = '<w:comments xmlns:w="' + W + '" xmlns:r="' + R + '">' + comments + '</w:comments>';
  return parts;
}
