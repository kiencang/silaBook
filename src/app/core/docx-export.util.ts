import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  BorderStyle,
  WidthType,
  VerticalAlign
} from 'docx';

function convertDataUrlToUint8Array(dataUrl: string): Uint8Array {
  const parts = dataUrl.split(';base64,');
  const base64 = parts[parts.length - 1].replace(/\s+/g, '');
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

interface InlineToken {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
}

export function tokenizeInline(text: string): InlineToken[] {
  const parts: InlineToken[] = [];
  let index = 0;

  while (index < text.length) {
    if (text.startsWith('`', index)) {
      const end = text.indexOf('`', index + 1);
      if (end !== -1) {
        parts.push({
          text: text.substring(index + 1, end),
          bold: false,
          italic: false,
          code: true
        });
        index = end + 1;
        continue;
      }
    }

    if (text.startsWith('***', index)) {
      const end = text.indexOf('***', index + 3);
      if (end !== -1) {
        parts.push({
          text: text.substring(index + 3, end),
          bold: true,
          italic: true,
          code: false
        });
        index = end + 3;
        continue;
      }
    }

    if (text.startsWith('**', index)) {
      const end = text.indexOf('**', index + 2);
      if (end !== -1) {
        parts.push({
          text: text.substring(index + 2, end),
          bold: true,
          italic: false,
          code: false
        });
        index = end + 2;
        continue;
      }
    }

    if (text.startsWith('__', index)) {
      const end = text.indexOf('__', index + 2);
      if (end !== -1) {
        parts.push({
          text: text.substring(index + 2, end),
          bold: true,
          italic: false,
          code: false
        });
        index = end + 2;
        continue;
      }
    }

    if (text.startsWith('*', index)) {
      const end = text.indexOf('*', index + 1);
      if (end !== -1) {
        parts.push({
          text: text.substring(index + 1, end),
          bold: false,
          italic: true,
          code: false
        });
        index = end + 1;
        continue;
      }
    }

    if (text.startsWith('_', index)) {
      const end = text.indexOf('_', index + 1);
      if (end !== -1) {
        parts.push({
          text: text.substring(index + 1, end),
          bold: false,
          italic: true,
          code: false
        });
        index = end + 1;
        continue;
      }
    }

    let nextIndex = index;
    while (nextIndex < text.length) {
      const char = text[nextIndex];
      if (char === '`' || char === '*' || char === '_') {
        break;
      }
      nextIndex++;
    }

    if (nextIndex > index) {
      parts.push({
        text: text.substring(index, nextIndex),
        bold: false,
        italic: false,
        code: false
      });
      index = nextIndex;
    } else {
      parts.push({
        text: text[index],
        bold: false,
        italic: false,
        code: false
      });
      index++;
    }
  }

  return parts;
}

function createRunsFromText(text: string): TextRun[] {
  const tokens = tokenizeInline(text);
  return tokens.map(token => {
    return new TextRun({
      text: token.text,
      bold: token.bold || undefined,
      italics: token.italic || undefined,
      font: token.code ? "Consolas" : "Calibri",
      size: token.code ? 19 : 22,
      color: token.code ? "A855F7" : undefined,
    });
  });
}

function parseMarkdownTable(tableLines: string[]): Table {
  const rowsData = tableLines.filter(line => {
    const clean = line.trim();
    if (/^[|:\-\s]+$/.test(clean)) return false;
    return true;
  });

  const parsedRows: TableRow[] = [];

  for (let rIndex = 0; rIndex < rowsData.length; rIndex++) {
    const line = rowsData[rIndex];
    const cols = line.split('|').map(s => s.trim());
    if (line.startsWith('|')) cols.shift();
    if (line.endsWith('|')) cols.pop();

    const cells = cols.map(colText => {
      return new TableCell({
        children: [
          new Paragraph({
            children: createRunsFromText(colText),
            spacing: { before: 80, after: 80 },
          }),
        ],
        shading: rIndex === 0 ? { fill: "F2F5F9" } : undefined,
        verticalAlign: VerticalAlign.CENTER,
      });
    });

    parsedRows.push(new TableRow({ children: cells }));
  }

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: "D1D5DB" },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: "D1D5DB" },
      left: { style: BorderStyle.SINGLE, size: 8, color: "D1D5DB" },
      right: { style: BorderStyle.SINGLE, size: 8, color: "D1D5DB" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
    },
    rows: parsedRows,
  });
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve({ width: 400, height: 300 });
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
    };
    img.onerror = () => {
      resolve({ width: 400, height: 300 });
    };
    img.src = dataUrl;
  });
}

export class DocxExporter {
  static async generateDocx(title: string, markdownContent: string, images?: Record<string, string>): Promise<Blob> {
    const activeImages: Record<string, { dataUrl: string; width: number; height: number }> = {};
    if (images) {
      const promises = Object.entries(images).map(async ([key, dataUrl]) => {
        try {
          const dims = await getImageDimensions(dataUrl);
          activeImages[key] = { dataUrl, ...dims };
        } catch {
          activeImages[key] = { dataUrl, width: 400, height: 300 };
        }
      });
      await Promise.all(promises);
    }

    const findImage = (key: string) => {
      let imgData = activeImages[key];
      if (!imgData) {
         const lowerKey = key.toLowerCase();
         for (const [k, v] of Object.entries(activeImages)) {
             if (k.toLowerCase() === lowerKey || k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() === key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()) {
                 imgData = v;
                 break;
             }
         }
      }
      return imgData || null;
    };

    const children: any[] = [];
    const lines = markdownContent.split('\n');
    let idx = 0;

    let inCodeBlock = false;
    let codeBlockContent: string[] = [];

    while (idx < lines.length) {
      const line = lines[idx];
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('```')) {
        if (inCodeBlock) {
          const codeText = codeBlockContent.join('\n');
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: [
                            new TextRun({
                              text: codeText,
                              font: "Consolas",
                              size: 19,
                              color: "374151",
                            }),
                          ],
                          spacing: { before: 120, after: 120 },
                        }),
                      ],
                      shading: { fill: "F3F4F6" },
                    }),
                  ],
                }),
              ],
            })
          );
          inCodeBlock = false;
          codeBlockContent = [];
        } else {
          inCodeBlock = true;
        }
        idx++;
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        idx++;
        continue;
      }

      if (trimmedLine === '') {
        idx++;
        continue;
      }

      if (trimmedLine.startsWith('|')) {
        const tableLines: string[] = [];
        while (idx < lines.length && lines[idx].trim().startsWith('|')) {
          tableLines.push(lines[idx]);
          idx++;
        }
        try {
          children.push(parseMarkdownTable(tableLines));
        } catch {
          tableLines.forEach(l => {
            children.push(
              new Paragraph({
                children: [new TextRun(l)],
                spacing: { after: 120 },
              })
            );
          });
        }
        continue;
      }

      if (trimmedLine.startsWith('#')) {
        const levelMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
        if (levelMatch) {
          const depth = levelMatch[1].length;
          const text = levelMatch[2];
          let headingLevel: any = HeadingLevel.HEADING_1;
          let fontSize = 36;
          let color = "1F497D";

          if (depth === 1) {
            headingLevel = HeadingLevel.HEADING_1;
            fontSize = 40;
            color = "1F497D";
          } else if (depth === 2) {
            headingLevel = HeadingLevel.HEADING_2;
            fontSize = 32;
            color = "2E74B5";
          } else if (depth === 3) {
            headingLevel = HeadingLevel.HEADING_3;
            fontSize = 26;
            color = "1F4E79";
          } else {
            headingLevel = HeadingLevel.HEADING_4;
            fontSize = 24;
            color = "333333";
          }

          children.push(
            new Paragraph({
              heading: headingLevel,
              children: [
                new TextRun({
                  text: text,
                  bold: true,
                  size: fontSize,
                  color: color,
                  font: "Segoe UI",
                }),
              ],
              spacing: { before: 240, after: 120 },
            })
          );
          idx++;
          continue;
        }
      }

      if (trimmedLine.startsWith('>')) {
        const quoteText = trimmedLine.replace(/^>\s*/, '');
        children.push(
          new Paragraph({
            children: tokenizeInline(quoteText).map(token => {
              return new TextRun({
                text: token.text,
                bold: token.bold || undefined,
                italics: true,
                font: token.code ? "Consolas" : "Calibri",
                size: token.code ? 19 : 21,
                color: "4B5563",
              });
            }),
            indent: { left: 720 },
            spacing: { before: 120, after: 120 },
          })
        );
        idx++;
        continue;
      }

      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') || trimmedLine.startsWith('+ ')) {
        const bulletText = trimmedLine.substring(2);
        children.push(
          new Paragraph({
            children: tokenizeInline(bulletText).map(token => {
              return new TextRun({
                text: token.text,
                bold: token.bold || undefined,
                italics: token.italic || undefined,
                font: token.code ? "Consolas" : "Calibri",
                size: token.code ? 19 : 22,
                color: token.code ? "A855F7" : undefined,
              });
            }),
            bullet: { level: 0 },
            spacing: { after: 100 },
          })
        );
        idx++;
        continue;
      }

      const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.*)$/);
      if (numberedMatch) {
        const numStr = numberedMatch[1];
        const ordText = numberedMatch[2];
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${numStr}. `,
                bold: true,
                font: "Calibri",
                size: 22,
              }),
              ...tokenizeInline(ordText).map(token => {
                return new TextRun({
                  text: token.text,
                  bold: token.bold || undefined,
                  italics: token.italic || undefined,
                  font: token.code ? "Consolas" : "Calibri",
                  size: token.code ? 19 : 22,
                  color: token.code ? "A855F7" : undefined,
                });
              }),
            ],
            indent: { left: 720 },
            spacing: { after: 100 },
          })
        );
        idx++;
        continue;
      }

      const robustImgRegex = /!\[([^\]]*)\]\(([^)]+)\)|!\[([^\]]*)\]\s*\[([^\]]+)\]|!\[([^\]]+)\]|<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
        
      const hasImage = robustImgRegex.test(trimmedLine);
      if (hasImage) {
        robustImgRegex.lastIndex = 0;
        let lastStop = 0;
        let match;
        
        while ((match = robustImgRegex.exec(trimmedLine)) !== null) {
          const matchIndex = match.index;
          let key = match[2] || match[4] || match[5] || match[6];


          if (matchIndex > lastStop) {
            const preText = trimmedLine.substring(lastStop, matchIndex).trim();
            if (preText) {
              children.push(
                new Paragraph({
                  children: tokenizeInline(preText).map(token => {
                    return new TextRun({
                      text: token.text,
                      bold: token.bold || undefined,
                      italics: token.italic || undefined,
                      font: token.code ? "Consolas" : "Calibri",
                      size: token.code ? 19 : 22,
                      color: token.code ? "A855F7" : undefined,
                    });
                  }),
                  spacing: { after: 120 },
                })
              );
            }
          }

          const imgObj = findImage(key);
          if (imgObj) {
            try {
              const maxW = 560;
              let displayWidth = imgObj.width || 400;
              let displayHeight = imgObj.height || 300;

              if (displayWidth > maxW) {
                const ratio = maxW / displayWidth;
                displayWidth = maxW;
                displayHeight = Math.floor(displayHeight * ratio);
              }

              const uint8Arr = convertDataUrlToUint8Array(imgObj.dataUrl);

              children.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: uint8Arr,
                      transformation: {
                        width: displayWidth,
                        height: displayHeight,
                      },
                      type: imgObj.dataUrl.includes('image/jpeg') ? "jpg" : "png",
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 240, after: 240 },
                })
              );
            } catch (e) {
              console.error(e);
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `[Lỗi hiển thị ảnh: ${key}]`,
                      color: "EF4444",
                      italics: true,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 120, after: 120 },
                })
              );
            }
          } else {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `[Đang tải ảnh: ${key}]`,
                    color: "6B7280",
                    italics: true,
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 120 },
              })
            );
          }

          lastStop = robustImgRegex.lastIndex;
        }

        if (lastStop < trimmedLine.length) {
          const postText = trimmedLine.substring(lastStop).trim();
          if (postText) {
            children.push(
              new Paragraph({
                children: tokenizeInline(postText).map(token => {
                  return new TextRun({
                    text: token.text,
                    bold: token.bold || undefined,
                    italics: token.italic || undefined,
                    font: token.code ? "Consolas" : "Calibri",
                    size: token.code ? 19 : 22,
                    color: token.code ? "A855F7" : undefined,
                  });
                }),
                spacing: { after: 120 },
              })
            );
          }
        }

        idx++;
        continue;
      }

      children.push(
        new Paragraph({
          children: tokenizeInline(trimmedLine).map(token => {
            return new TextRun({
              text: token.text,
              bold: token.bold || undefined,
              italics: token.italic || undefined,
              font: token.code ? "Consolas" : "Calibri",
              size: token.code ? 19 : 22,
              color: token.code ? "A855F7" : undefined,
            });
          }),
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 120 },
        })
      );

      idx++;
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: children,
        },
      ],
    });

    return await Packer.toBlob(doc);
  }
}
