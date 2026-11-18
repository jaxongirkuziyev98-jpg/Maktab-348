import type { Ebook } from '../src/types/lms.ts';

function toPdfAscii(text: string): string {
  const cyrMap: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
    ъ: "'", ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'Yo', Ж: 'J', З: 'Z',
    И: 'I', Й: 'Y', К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R',
    С: 'S', Т: 'T', У: 'U', Ф: 'F', Х: 'X', Ц: 'Ts', Ч: 'Ch', Ш: 'Sh', Щ: 'Shch',
    Ъ: "'", Ы: 'Y', Ь: '', Э: 'E', Ю: 'Yu', Я: 'Ya',
    ў: "o'", Ў: "O'", қ: 'q', Қ: 'Q', ғ: "g'", Ғ: "G'", ҳ: 'h', Ҳ: 'H',
    '‘': "'", '’': "'", '“': '"', '”': '"', '—': '-', '–': '-', '×': 'x', '÷': '/',
    '≤': '<=', '≥': '>=', '≠': '!=', '²': '^2', '³': '^3', '°': ' deg',
  };
  let out = '';
  for (const ch of text) {
    if (cyrMap[ch] !== undefined) {
      out += cyrMap[ch];
    } else if (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) <= 126) {
      out += ch;
    } else {
      out += ' ';
    }
  }
  return out;
}

function escapePdfLiteral(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = toPdfAscii(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function generateEbookPdfBuffer(ebook: Ebook): Buffer {
  const pagesContent: string[] = [];

  // Cover / Page 1
  const coverLines: string[] = [
    'BT',
    '/F2 18 Tf',
    '54 760 Td',
    `(${escapePdfLiteral(toPdfAscii(`348-MAKTAB | ${ebook.grade}-SINF DARSLIGI`))}) Tj`,
    '0 -32 Td',
    '/F2 15 Tf',
    `(${escapePdfLiteral(toPdfAscii(ebook.title))}) Tj`,
    '0 -24 Td',
    '/F1 11 Tf',
    `(${escapePdfLiteral(toPdfAscii(`Muallif: ${ebook.author}`))}) Tj`,
    '0 -20 Td',
    '------------------------------------------------------------------------ Tj',
    '0 -24 Td',
  ];
  for (const line of wrapLines(ebook.summary, 78)) {
    coverLines.push(`(${escapePdfLiteral(line)}) Tj`);
    coverLines.push('0 -16 Td');
  }
  coverLines.push('0 -12 Td');
  coverLines.push('/F2 12 Tf');
  coverLines.push('(Mundarija / Chapters:) Tj');
  coverLines.push('0 -18 Td');
  coverLines.push('/F1 11 Tf');
  ebook.chapters.forEach((ch, idx) => {
    coverLines.push(`(${escapePdfLiteral(toPdfAscii(`${idx + 1}. ${ch.title}`))}) Tj`);
    coverLines.push('0 -16 Td');
  });
  coverLines.push('ET');
  pagesContent.push(coverLines.join('\n'));

  // One page per chapter
  ebook.chapters.forEach((chapter, idx) => {
    const lines: string[] = [
      'BT',
      '/F2 14 Tf',
      '54 760 Td',
      `(${escapePdfLiteral(toPdfAscii(`${idx + 1}-bob. ${chapter.title}`))}) Tj`,
      '0 -24 Td',
      '/F1 11 Tf',
    ];
    const paragraphs = chapter.content.split('\n');
    let yLeft = 710;
    for (const para of paragraphs) {
      const wrapped = wrapLines(para, 80);
      for (const l of wrapped) {
        if (yLeft < 70) break;
        lines.push(`(${escapePdfLiteral(l)}) Tj`);
        lines.push('0 -16 Td');
        yLeft -= 16;
      }
      lines.push('0 -8 Td');
      yLeft -= 8;
    }
    lines.push('ET');
    lines.push(`BT /F1 9 Tf 54 36 Td (348-MAKTAB Elektron Kutubxona - Sahifa ${idx + 2}) Tj ET`);
    pagesContent.push(lines.join('\n'));
  });

  // Build valid PDF 1.4 object tree
  const objects: string[] = [];
  // 1: Catalog, 2: Pages, 3: F1 Helvetica, 4: F2 Helvetica-Bold
  const pageObjIds: number[] = [];
  let nextId = 5;

  const pageObjects: { pageId: number; contentId: number; stream: string }[] = [];
  for (const stream of pagesContent) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageObjIds.push(pageId);
    pageObjects.push({ pageId, contentId, stream });
  }

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>\nendobj\n`
  );
  objects.push(
    `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`
  );
  objects.push(
    `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`
  );

  for (const p of pageObjects) {
    objects.push(
      `${p.pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${p.contentId} 0 R >>\nendobj\n`
    );
    const byteLen = Buffer.byteLength(p.stream, 'utf8');
    objects.push(
      `${p.contentId} 0 obj\n<< /Length ${byteLen} >>\nstream\n${p.stream}\nendstream\nendobj\n`
    );
  }

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}
