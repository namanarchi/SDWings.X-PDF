import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import JSZip from 'jszip';

/**
 * Parses user page range strings like "1-3, 5, 8-10" into 0-indexed page numbers.
 * @param {string} rangeStr 
 * @param {number} totalPages 
 * @returns {number[]} Array of 0-based page indices
 */
export function parsePageRange(rangeStr, totalPages) {
  if (!rangeStr || rangeStr.trim().toLowerCase() === 'all' || rangeStr.trim() === '') {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const indices = new Set();
  const parts = rangeStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = Math.max(1, parseInt(startStr, 10));
      const end = Math.min(totalPages, parseInt(endStr, 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          indices.add(i - 1);
        }
      }
    } else {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num) && num >= 1 && num <= totalPages) {
        indices.add(num - 1);
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Combine multiple PDFs into a single document.
 * @param {Array<{ buffer: ArrayBuffer, name: string, pageRange?: string }>} items
 * @returns {Promise<Uint8Array>}
 */
export async function combinePdfs(items) {
  if (!items || items.length === 0) {
    throw new Error('Không có file PDF nào để ghép nối.');
  }

  const mergedDoc = await PDFDocument.create();

  for (const item of items) {
    const srcDoc = await PDFDocument.load(item.buffer, { ignoreEncryption: true });
    const totalPages = srcDoc.getPageCount();
    const indicesToCopy = parsePageRange(item.pageRange, totalPages);

    if (indicesToCopy.length > 0) {
      const copiedPages = await mergedDoc.copyPages(srcDoc, indicesToCopy);
      for (const page of copiedPages) {
        mergedDoc.addPage(page);
      }
    }
  }

  return await mergedDoc.save();
}

/**
 * Split a PDF into multiple separate documents or extract ranges.
 * @param {ArrayBuffer} docBuffer
 * @param {'every-page' | 'every-n' | 'ranges' | 'extract'} mode
 * @param {object} options
 * @returns {Promise<Array<{ name: string, bytes: Uint8Array }> | { zipBlob: Blob, files: Array<{ name: string, bytes: Uint8Array }> }>}
 */
export async function splitPdf(docBuffer, mode, options = {}) {
  const srcDoc = await PDFDocument.load(docBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const baseName = options.baseName ? options.baseName.replace(/\.pdf$/i, '') : 'document';
  const results = [];

  if (mode === 'every-page') {
    // 1 page per file
    for (let i = 0; i < totalPages; i++) {
      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
      singleDoc.addPage(copiedPage);
      const bytes = await singleDoc.save();
      const pad = String(i + 1).padStart(3, '0');
      results.push({
        name: `${baseName}_trang_${pad}.pdf`,
        bytes
      });
    }
  } else if (mode === 'every-n') {
    const n = Math.max(1, options.everyN || 1);
    let chunk = 1;
    for (let i = 0; i < totalPages; i += n) {
      const chunkDoc = await PDFDocument.create();
      const end = Math.min(i + n, totalPages);
      const pageIndices = [];
      for (let p = i; p < end; p++) pageIndices.push(p);

      const copiedPages = await chunkDoc.copyPages(srcDoc, pageIndices);
      copiedPages.forEach(page => chunkDoc.addPage(page));
      const bytes = await chunkDoc.save();
      results.push({
        name: `${baseName}_phan_${chunk}_(trang_${i + 1}-${end}).pdf`,
        bytes
      });
      chunk++;
    }
  } else if (mode === 'ranges') {
    // E.g. "1-2, 3-5"
    const rangeList = (options.ranges || '').split(';').map(s => s.trim()).filter(Boolean);
    let idx = 1;
    for (const r of rangeList) {
      const indices = parsePageRange(r, totalPages);
      if (indices.length > 0) {
        const rangeDoc = await PDFDocument.create();
        const copiedPages = await rangeDoc.copyPages(srcDoc, indices);
        copiedPages.forEach(page => rangeDoc.addPage(page));
        const bytes = await rangeDoc.save();
        results.push({
          name: `${baseName}_trang_${r.replace(/[\s,]+/g, '_')}.pdf`,
          bytes
        });
        idx++;
      }
    }
  } else if (mode === 'extract') {
    // Extract selected pages into one unified new file
    const indices = options.pageIndices || [];
    if (indices.length === 0) throw new Error('Chưa chọn trang để trích xuất.');
    const extractDoc = await PDFDocument.create();
    const copiedPages = await extractDoc.copyPages(srcDoc, indices);
    copiedPages.forEach(page => extractDoc.addPage(page));
    const bytes = await extractDoc.save();
    results.push({
      name: `${baseName}_trich_xuat.pdf`,
      bytes
    });
  }

  // Create ZIP archive for multi-file outputs
  const zip = new JSZip();
  results.forEach(res => {
    zip.file(res.name, res.bytes);
  });
  const zipBlob = await zip.generateAsync({ type: 'blob' });

  return { files: results, zipBlob };
}

/**
 * Reorganize pages: change order, rotate individual pages, delete, insert blanks.
 * @param {ArrayBuffer} docBuffer
 * @param {Array<{ originalIndex: number, rotationDelta: number, isBlank?: boolean, pageSize?: [number, number] }>} pageDescriptors
 * @returns {Promise<Uint8Array>}
 */
export async function reorganizeDoc(docBuffer, pageDescriptors) {
  const srcDoc = await PDFDocument.load(docBuffer, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();

  for (const desc of pageDescriptors) {
    if (desc.isBlank) {
      // Add blank page with specified size or default A4
      const size = desc.pageSize || [842, 595]; // Landscape A4
      newDoc.addPage(size);
    } else {
      const [copiedPage] = await newDoc.copyPages(srcDoc, [desc.originalIndex]);
      if (desc.rotationDelta) {
        const currentRotation = copiedPage.getRotation().angle;
        copiedPage.setRotation(degrees((currentRotation + desc.rotationDelta + 360) % 360));
      }
      newDoc.addPage(copiedPage);
    }
  }

  return await newDoc.save();
}

function getRotatedPdfOrigin(cx, cy, width, height, angleDegrees) {
  if (!angleDegrees || angleDegrees === 0) {
    return { x: cx - width / 2, y: cy - height / 2, rotate: degrees(0) };
  }
  const phi = (-angleDegrees % 360 + 360) % 360;
  const rad = phi * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const halfW = width / 2;
  const halfH = height / 2;
  const newX = cx - halfW * cos + halfH * sin;
  const newY = cy - halfW * sin - halfH * cos;
  return { x: newX, y: newY, rotate: degrees(phi) };
}

/**
 * Embeds annotations (drawings, highlights, text, stamps, signatures, measurements)
 * permanently into the PDF document stream using pdf-lib.
 * @param {ArrayBuffer} docBuffer
 * @param {Map<number, Array<object>>} annotationsByPage
 * @returns {Promise<Uint8Array>}
 */
export async function embedAnnotationsInPdf(docBuffer, annotationsByPage) {
  const pdfDoc = await PDFDocument.load(docBuffer, { ignoreEncryption: true });
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontCourier = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontCourierBold = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontTimesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const getPdfFont = (family, bold) => {
    const f = (family || '').toLowerCase();
    if (f.includes('courier') || f.includes('mono')) {
      return bold ? fontCourierBold : fontCourier;
    }
    if (f.includes('times') || (f.includes('serif') && !f.includes('sans'))) {
      return bold ? fontTimesBold : fontTimes;
    }
    return bold ? fontHelveticaBold : fontHelvetica;
  };

  const pageCount = pdfDoc.getPageCount();

  for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
    const pageAnnots = annotationsByPage.get(pageIdx);
    if (!pageAnnots || pageAnnots.length === 0) continue;

    const page = pdfDoc.getPage(pageIdx);
    const { width: pWidth, height: pHeight } = page.getSize();

    for (const annot of pageAnnots) {
      try {
        if ((annot.type === 'pen' || annot.type === 'shape' || annot.type === 'curve') && annot.points && annot.points.length > 1) {
          // Freehand ink path, custom shapes, and curves
          const c = parseHexColor(annot.color || '#111111');
          for (let i = 0; i < annot.points.length - 1; i++) {
            const p1 = annot.points[i];
            const p2 = annot.points[i + 1];
            page.drawLine({
              start: { x: p1.x * pWidth, y: (1 - p1.y) * pHeight },
              end: { x: p2.x * pWidth, y: (1 - p2.y) * pHeight },
              thickness: annot.size || 2,
              color: rgb(c.r, c.g, c.b),
              opacity: annot.opacity !== undefined ? annot.opacity : 1
            });
          }
          if (annot.isClosed && annot.points.length >= 3) {
            const pFirst = annot.points[0];
            const pLast = annot.points[annot.points.length - 1];
            page.drawLine({
              start: { x: pLast.x * pWidth, y: (1 - pLast.y) * pHeight },
              end: { x: pFirst.x * pWidth, y: (1 - pFirst.y) * pHeight },
              thickness: annot.size || 2,
              color: rgb(c.r, c.g, c.b),
              opacity: annot.opacity !== undefined ? annot.opacity : 1
            });
          }
        } else if (annot.type === 'highlight') {
          // Highlight rectangle
          const c = parseHexColor(annot.color || '#ffeb3b');
          const hw = annot.w * pWidth;
          const hh = annot.h * pHeight;
          const cx = annot.x * pWidth + hw / 2;
          const cy = (1 - annot.y) * pHeight - hh / 2;
          const pos = getRotatedPdfOrigin(cx, cy, hw, hh, annot.rotation || 0);
          page.drawRectangle({
            x: pos.x,
            y: pos.y,
            width: hw,
            height: hh,
            rotate: pos.rotate,
            color: rgb(c.r, c.g, c.b),
            opacity: annot.opacity !== undefined ? annot.opacity : 0.38
          });
        } else if (annot.type === 'rect') {
          const c = parseHexColor(annot.color || '#111111');
          const hasBg = annot.bgColor && annot.bgColor !== 'transparent';
          const bg = hasBg ? parseHexColor(annot.bgColor) : null;
          const strokeW = annot.size !== undefined ? annot.size : 2;
          const rw = annot.w * pWidth;
          const rh = annot.h * pHeight;
          const cx = annot.x * pWidth + rw / 2;
          const cy = (1 - annot.y) * pHeight - rh / 2;
          const pos = getRotatedPdfOrigin(cx, cy, rw, rh, annot.rotation || 0);
          page.drawRectangle({
            x: pos.x,
            y: pos.y,
            width: rw,
            height: rh,
            rotate: pos.rotate,
            borderColor: strokeW > 0 && annot.color !== 'transparent' ? rgb(c.r, c.g, c.b) : undefined,
            borderWidth: strokeW,
            color: bg ? rgb(bg.r, bg.g, bg.b) : undefined,
            opacity: 1
          });
        } else if (annot.type === 'comment') {
          const cw = (annot.w || 0.14) * pWidth;
          const ch = (annot.h || 0.04) * pHeight;
          const cx = annot.x * pWidth;
          const cy = (1 - annot.y - (annot.h || 0.04)) * pHeight;
          const bgHex = annot.bgColor && annot.bgColor !== 'transparent' ? annot.bgColor : '#fef3c7';
          const borderHex = annot.color && annot.color !== 'transparent' ? annot.color : '#f59e0b';
          const textHex = annot.textColor || annot.color || '#92400e';
          const bgC = parseHexColor(bgHex);
          const borderC = parseHexColor(borderHex);
          const textC = parseHexColor(textHex);
          const strokeW = annot.size !== undefined ? annot.size : 1.5;

          page.drawRectangle({
            x: cx,
            y: cy,
            width: cw,
            height: ch,
            color: annot.bgColor === 'transparent' ? undefined : rgb(bgC.r, bgC.g, bgC.b),
            borderColor: strokeW > 0 && annot.color !== 'transparent' ? rgb(borderC.r, borderC.g, borderC.b) : undefined,
            borderWidth: strokeW,
            opacity: 1
          });

          const fs = annot.fontSize || 12;
          page.drawText(annot.text || '', {
            x: cx + 6,
            y: cy + ch / 2 - fs / 3,
            size: fs,
            font: getPdfFont(annot.fontFamily, true),
            color: rgb(textC.r, textC.g, textC.b)
          });
        } else if (annot.type === 'line' || annot.type === 'ruler') {
          const c = parseHexColor(annot.color || '#111111');
          const sx = annot.x1 * pWidth;
          const sy = (1 - annot.y1) * pHeight;
          const ex = annot.x2 * pWidth;
          const ey = (1 - annot.y2) * pHeight;

          page.drawLine({
            start: { x: sx, y: sy },
            end: { x: ex, y: ey },
            thickness: annot.size || 1.5,
            color: rgb(c.r, c.g, c.b)
          });

          // Draw dimension label if ruler
          if (annot.label) {
            const midX = (sx + ex) / 2;
            const midY = (sy + ey) / 2;
            page.drawRectangle({
              x: midX - 25,
              y: midY - 6,
              width: 50,
              height: 14,
              color: rgb(1, 1, 1),
              borderColor: rgb(c.r, c.g, c.b),
              borderWidth: 0.5
            });
            page.drawText(annot.label, {
              x: midX - 20,
              y: midY - 3,
              size: 8,
              font: fontHelveticaBold,
              color: rgb(c.r, c.g, c.b)
            });
          }
        } else if (annot.type === 'cloud') {
          // Revision cloud
          const c = parseHexColor(annot.color || '#d32f2f');
          page.drawRectangle({
            x: annot.x * pWidth,
            y: (1 - annot.y - annot.h) * pHeight,
            width: annot.w * pWidth,
            height: annot.h * pHeight,
            borderColor: rgb(c.r, c.g, c.b),
            borderWidth: 2,
            opacity: 0.9
          });
          page.drawText('REV CLOUD', {
            x: annot.x * pWidth + 4,
            y: (1 - annot.y) * pHeight - 12,
            size: 8,
            font: fontHelveticaBold,
            color: rgb(c.r, c.g, c.b)
          });
        } else if (annot.type === 'text') {
          const c = parseHexColor(annot.color || '#111111');
          page.drawText(annot.text || '', {
            x: annot.x * pWidth,
            y: (1 - annot.y) * pHeight - (annot.fontSize || 14),
            size: annot.fontSize || 14,
            font: getPdfFont(annot.fontFamily, annot.bold),
            color: rgb(c.r, c.g, c.b)
          });
        } else if (annot.type === 'stamp') {
          // Architectural Stamp
          const stampWidth = (annot.w || 0.18) * pWidth;
          const stampHeight = (annot.h || 0.06) * pHeight;
          const cx = annot.x * pWidth + stampWidth / 2;
          const cy = (1 - annot.y) * pHeight - stampHeight / 2;
          const stampColor = annot.stampColor ? parseHexColor(annot.stampColor) : rgb(0.1, 0.55, 0.3);
          const pos = getRotatedPdfOrigin(cx, cy, stampWidth, stampHeight, annot.rotation || 0);

          page.drawRectangle({
            x: pos.x,
            y: pos.y,
            width: stampWidth,
            height: stampHeight,
            rotate: pos.rotate,
            borderColor: rgb(stampColor.r, stampColor.g, stampColor.b),
            borderWidth: 2,
            color: rgb(stampColor.r, stampColor.g, stampColor.b),
            opacity: 0.12
          });

          page.drawText(annot.stampText || 'APPROVED', {
            x: pos.x + 12,
            y: pos.y + stampHeight / 2 - 5,
            size: 13,
            rotate: pos.rotate,
            font: fontHelveticaBold,
            color: rgb(stampColor.r, stampColor.g, stampColor.b)
          });
        } else if ((annot.type === 'signature' || annot.type === 'image') && annot.dataUrl) {
          // Embed signature or user attached image
          let imgObj;
          if (annot.dataUrl.startsWith('data:image/jpeg') || annot.dataUrl.startsWith('data:image/jpg')) {
            imgObj = await pdfDoc.embedJpg(annot.dataUrl);
          } else {
            imgObj = await pdfDoc.embedPng(annot.dataUrl);
          }
          const imgW = (annot.w || 0.25) * pWidth;
          const imgH = (annot.h || 0.18) * pHeight;
          const cx = annot.x * pWidth + imgW / 2;
          const cy = (1 - annot.y) * pHeight - imgH / 2;
          const pos = getRotatedPdfOrigin(cx, cy, imgW, imgH, annot.rotation || 0);

          page.drawImage(imgObj, {
            x: pos.x,
            y: pos.y,
            width: imgW,
            height: imgH,
            rotate: pos.rotate,
            opacity: annot.opacity !== undefined ? annot.opacity : 1
          });
        }
      } catch (err) {
        console.warn('Error embedding annotation to PDF page:', err);
      }
    }
  }

  return await pdfDoc.save();
}

function parseHexColor(hex) {
  if (!hex || typeof hex !== 'string') return { r: 0.1, g: 0.1, b: 0.1 };
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 0.1, g: 0.1, b: 0.1 };
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255
  };
}
