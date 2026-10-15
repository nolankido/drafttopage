import { fixture, para, zip, convert, R } from './docx-fixtures.js';

export const PNG = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFElEQVR4nGNU8XZgYGBgYmBgQFAADTUAtSXLI9EAAAAASUVORK5CYII=', 'base64'));
export const JPEG = new Uint8Array(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAADAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDz2iiimecf/9k=', 'base64'));
export const imageRun = (id, alt = '', hidden = false) => '<w:r>' + (hidden ? '<w:rPr><w:vanish/></w:rPr>' : '') + '<w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:docPr id="1" name="Picture" descr="' + alt + '"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><a:blip r:embed="' + id + '"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
export function imageFixture({ ids = ['one'], media = { 'word/media/one.png': PNG }, relations = [['one','media/one.png','']], body = '', defaults = '<Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/>' } = {}) {
  const source = fixture(body || para('Synthetic article') + ids.map((id,i) => '<w:p>' + imageRun(id, 'Fictional image ' + (i+1)) + '</w:p>').join(''), {
    'word/_rels/document.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + relations.map(([id,target,mode]) => '<Relationship Id="' + id + '" Type="' + R + '/image" Target="' + target + '"' + (mode ? ' TargetMode="' + mode + '"' : '') + '/>').join('') + '</Relationships>'
  });
  source['[Content_Types].xml'] = source['[Content_Types].xml'].replace('</Types>', defaults + '</Types>');
  const converted = convert(source);
  const candidate = { kind: 'Word document', draft: { body: converted.markdown }, wordImages: converted.wordImages };
  return { source, candidate, bytes: zip({ ...source, ...media }) };
}
