/**
 * annotationGeometry.js
 * Mathematical bounding boxes, resize transformations, and hit testing for CAD PDF annotations.
 */

export function getAnnotationBounds(annot, overlayCanvas) {
  if (!annot || !overlayCanvas) return null;
  const w = overlayCanvas.width;
  const h = overlayCanvas.height;
  const ctx = overlayCanvas.getContext('2d');

  if (annot.type === 'text') {
    const fontSize = Math.max(12, Math.round((annot.fontSize || 14) * (w / 1000)));
    ctx.font = `${annot.bold ? '600' : '400'} ${fontSize}px ${annot.fontFamily || 'sans-serif'}`;
    const metrics = ctx.measureText(annot.text || '');
    const pw = Math.max(30, metrics.width + 6);
    const ph = Math.max(18, fontSize * 1.35);
    const px = annot.x * w;
    const py = annot.y * h;
    return {
      x: annot.x,
      y: annot.y,
      w: pw / w,
      h: ph / h,
      px,
      py,
      pw,
      ph
    };
  }

  if (annot.type === 'comment') {
    const fontSize = Math.max(11, Math.round((annot.fontSize || 13) * (w / 1000)));
    ctx.font = `600 ${fontSize}px ${annot.fontFamily || 'sans-serif'}`;
    const metrics = ctx.measureText(annot.text || '');
    const defaultPw = metrics.width + 24;
    const defaultPh = 28;
    const pw = annot.w !== undefined ? (annot.w * w) : defaultPw;
    const ph = annot.h !== undefined ? (annot.h * h) : defaultPh;
    const px = annot.x * w;
    const py = annot.y * h;
    return {
      x: annot.x,
      y: annot.y,
      w: pw / w,
      h: ph / h,
      px,
      py,
      pw,
      ph
    };
  }

  if (annot.type === 'cloud') {
    const arcRad = annot.arcRadius || 14;
    const rawX = annot.x * w;
    const rawY = annot.y * h;
    const rawW = (annot.w || 0.16) * w;
    const rawH = (annot.h || 0.06) * h;
    const px = rawX - arcRad;
    const py = rawY - arcRad;
    const pw = rawW + arcRad * 2;
    const ph = rawH + arcRad * 2;
    return {
      x: px / w,
      y: py / h,
      w: pw / w,
      h: ph / h,
      px,
      py,
      pw,
      ph,
      rawX,
      rawY,
      rawW,
      rawH,
      arcRad
    };
  }

  if (annot.type === 'stamp' || annot.type === 'signature' || annot.type === 'image' || annot.type === 'rect' || annot.type === 'highlight') {
    const aw = annot.w || 0.22;
    const ah = annot.h || 0.16;
    return {
      x: annot.x,
      y: annot.y,
      w: aw,
      h: ah,
      px: annot.x * w,
      py: annot.y * h,
      pw: aw * w,
      ph: ah * h
    };
  }

  if (annot.type === 'ruler' || annot.type === 'arrow') {
    const minX = Math.min(annot.x1, annot.x2);
    const minY = Math.min(annot.y1, annot.y2);
    const aw = Math.max(0.04, Math.abs(annot.x2 - annot.x1));
    const ah = Math.max(0.04, Math.abs(annot.y2 - annot.y1));
    return {
      x: minX,
      y: minY,
      w: aw,
      h: ah,
      px: minX * w,
      py: minY * h,
      pw: aw * w,
      ph: ah * h
    };
  }

  if ((annot.type === 'pen' || annot.type === 'shape' || annot.type === 'curve') && annot.points && annot.points.length > 0) {
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const pt of annot.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    const aw = Math.max(0.02, maxX - minX);
    const ah = Math.max(0.02, maxY - minY);
    return {
      x: minX,
      y: minY,
      w: aw,
      h: ah,
      px: minX * w,
      py: minY * h,
      pw: aw * w,
      ph: ah * h
    };
  }

  return null;
}

export function getSelectionUIGeometry(annot, overlayCanvas) {
  const b = getAnnotationBounds(annot, overlayCanvas);
  if (!b) return null;

  const pad = 4;
  const px = b.px - pad;
  const py = b.py - pad;
  const pw = b.pw + pad * 2;
  const ph = b.ph + pad * 2;

  const centerX = px + pw / 2;
  const centerY = py + ph / 2;

  const hs = 8;
  const rotDist = 24;
  const rotX = px + pw / 2;
  const rotY = py - rotDist;

  const handles = {
    tl: { x: px, y: py, hs, cursor: 'nwse-resize' },
    tc: { x: px + pw / 2, y: py, hs, cursor: 'ns-resize' },
    tr: { x: px + pw, y: py, hs, cursor: 'nesw-resize' },
    ml: { x: px, y: py + ph / 2, hs, cursor: 'ew-resize' },
    mr: { x: px + pw, y: py + ph / 2, hs, cursor: 'ew-resize' },
    bl: { x: px, y: py + ph, hs, cursor: 'nesw-resize' },
    bc: { x: px + pw / 2, y: py + ph, hs, cursor: 'ns-resize' },
    br: { x: px + pw, y: py + ph, hs, cursor: 'nwse-resize' },
    rot: { x: rotX, y: rotY, hs: 10, isRotate: true, cursor: 'crosshair' }
  };

  return { b, px, py, pw, ph, centerX, centerY, rotX, rotY, handles };
}

export function hitTestSelectionUI(annot, overlayCanvas, pt) {
  const geom = getSelectionUIGeometry(annot, overlayCanvas);
  if (!geom) return null;

  const cx = pt.x * overlayCanvas.width;
  const cy = pt.y * overlayCanvas.height;

  // Transform coordinates if annot is rotated
  let testX = cx;
  let testY = cy;
  if (annot.rotation && annot.rotation !== 0) {
    const rad = -annot.rotation * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = cx - geom.centerX;
    const dy = cy - geom.centerY;
    testX = geom.centerX + dx * cos - dy * sin;
    testY = geom.centerY + dx * sin + dy * cos;
  }

  // 1. Check rotation handle (14px radius hit zone)
  if (geom.handles.rot && Math.hypot(testX - geom.handles.rot.x, testY - geom.handles.rot.y) <= 14) {
    return { part: 'rotate' };
  }

  // 2. Corner & edge resize grab handles (12px hit radius)
  const hitRadius = 12;
  for (const [key, h] of Object.entries(geom.handles)) {
    if (key === 'rot') continue;
    if (Math.hypot(testX - h.x, testY - h.y) <= hitRadius) {
      return { part: 'handle', handle: key };
    }
  }

  // 3. Move anywhere inside the bounding box
  if (
    testX >= geom.px - 3 &&
    testX <= geom.px + geom.pw + 3 &&
    testY >= geom.py - 3 &&
    testY <= geom.py + geom.ph + 3
  ) {
    return { part: 'move' };
  }

  return null;
}

export function hitTestAnnotation(annots, overlayCanvas, pt) {
  if (!annots) return null;
  const w = overlayCanvas.width;
  const h = overlayCanvas.height;
  for (let i = annots.length - 1; i >= 0; i--) {
    const a = annots[i];
    const bounds = getAnnotationBounds(a, overlayCanvas);
    if (!bounds) continue;

    let testPtX = pt.x;
    let testPtY = pt.y;

    if (a.rotation && a.rotation !== 0) {
      const centerX = bounds.x + bounds.w / 2;
      const centerY = bounds.y + bounds.h / 2;
      const rad = -a.rotation * (Math.PI / 180);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const dx = pt.x - centerX;
      const dy = pt.y - centerY;
      testPtX = centerX + dx * cos - dy * sin;
      testPtY = centerY + dx * sin + dy * cos;
    }

    const padX = 8 / w;
    const padY = 8 / h;
    if (
      testPtX >= bounds.x - padX &&
      testPtX <= bounds.x + bounds.w + padX &&
      testPtY >= bounds.y - padY &&
      testPtY <= bounds.y + bounds.h + padY
    ) {
      return a;
    }
  }
  return null;
}

export function applyResize(selectedAnnot, resizeOrigAnnot, resizeOrigBounds, resizeHandle, resizeStartPt, pt, overlayCanvas) {
  if (!selectedAnnot || !resizeOrigAnnot || !resizeOrigBounds || !resizeStartPt) return;

  let dx = pt.x - resizeStartPt.x;
  let dy = pt.y - resizeStartPt.y;
  if (selectedAnnot.rotation && selectedAnnot.rotation !== 0) {
    const rad = -selectedAnnot.rotation * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rdx = dx * cos - dy * sin;
    const rdy = dx * sin + dy * cos;
    dx = rdx;
    dy = rdy;
  }
  const orig = resizeOrigAnnot;
  const origB = resizeOrigBounds;
  const handle = resizeHandle;
  const ow = overlayCanvas.width;
  const oh = overlayCanvas.height;

  // Text: scale font size smoothly
  if (selectedAnnot.type === 'text') {
    const origFontSize = orig.fontSize || 14;
    let scale = 1.0;
    if (handle === 'br') {
      const sx = (origB.pw + dx * ow) / origB.pw;
      const sy = (origB.ph + dy * oh) / origB.ph;
      scale = Math.max(0.35, Math.max(sx, sy));
    } else if (handle === 'tl') {
      const sx = (origB.pw - dx * ow) / origB.pw;
      const sy = (origB.ph - dy * oh) / origB.ph;
      scale = Math.max(0.35, Math.max(sx, sy));
      selectedAnnot.x = Math.max(0, Math.min(0.96, orig.x + dx));
      selectedAnnot.y = Math.max(0, Math.min(0.96, orig.y + dy));
    } else if (handle === 'tr') {
      const sx = (origB.pw + dx * ow) / origB.pw;
      const sy = (origB.ph - dy * oh) / origB.ph;
      scale = Math.max(0.35, Math.max(sx, sy));
      selectedAnnot.y = Math.max(0, Math.min(0.96, orig.y + dy));
    } else if (handle === 'bl') {
      const sx = (origB.pw - dx * ow) / origB.pw;
      const sy = (origB.ph + dy * oh) / origB.ph;
      scale = Math.max(0.35, Math.max(sx, sy));
      selectedAnnot.x = Math.max(0, Math.min(0.96, orig.x + dx));
    } else if (handle === 'mr' || handle === 'ml') {
      const sx = handle === 'mr' ? (origB.pw + dx * ow) / origB.pw : (origB.pw - dx * ow) / origB.pw;
      scale = Math.max(0.35, sx);
      if (handle === 'ml') selectedAnnot.x = Math.max(0, Math.min(0.96, orig.x + dx));
    } else if (handle === 'bc' || handle === 'tc') {
      const sy = handle === 'bc' ? (origB.ph + dy * oh) / origB.ph : (origB.ph - dy * oh) / origB.ph;
      scale = Math.max(0.35, sy);
      if (handle === 'tc') selectedAnnot.y = Math.max(0, Math.min(0.96, orig.y + dy));
    }
    selectedAnnot.fontSize = Math.max(8, Math.min(180, Math.round(origFontSize * scale)));
    return;
  }

  // Box-based annotations: comment, rect, cloud, highlight, stamp, signature
  if (
    selectedAnnot.type === 'comment' ||
    selectedAnnot.type === 'rect' ||
    selectedAnnot.type === 'cloud' ||
    selectedAnnot.type === 'highlight' ||
    selectedAnnot.type === 'stamp' ||
    selectedAnnot.type === 'signature' ||
    selectedAnnot.type === 'image'
  ) {
    const minW = 0.015;
    const minH = 0.012;
    const owNorm = orig.w || 0.14;
    const ohNorm = orig.h || 0.04;

    let newX = orig.x;
    let newY = orig.y;
    let newW = owNorm;
    let newH = ohNorm;

    const lockRatio = selectedAnnot.type === 'image' && selectedAnnot.lockAspectRatio !== false;
    const aspect = (owNorm && ohNorm) ? (owNorm / ohNorm) : 1;

    if (handle === 'mr') {
      newW = Math.max(minW, owNorm + dx);
      if (lockRatio) newH = newW / aspect;
    } else if (handle === 'ml') {
      newW = Math.max(minW, owNorm - dx);
      newX = orig.x + (owNorm - newW);
      if (lockRatio) newH = newW / aspect;
    } else if (handle === 'bc') {
      newH = Math.max(minH, ohNorm + dy);
      if (lockRatio) newW = newH * aspect;
    } else if (handle === 'tc') {
      newH = Math.max(minH, ohNorm - dy);
      newY = orig.y + (ohNorm - newH);
      if (lockRatio) newW = newH * aspect;
    } else if (handle === 'br') {
      newW = Math.max(minW, owNorm + dx);
      newH = lockRatio ? (newW / aspect) : Math.max(minH, ohNorm + dy);
    } else if (handle === 'tl') {
      newW = Math.max(minW, owNorm - dx);
      newH = lockRatio ? (newW / aspect) : Math.max(minH, ohNorm - dy);
      newX = orig.x + (owNorm - newW);
      newY = orig.y + (ohNorm - newH);
    } else if (handle === 'tr') {
      newW = Math.max(minW, owNorm + dx);
      newH = lockRatio ? (newW / aspect) : Math.max(minH, ohNorm - dy);
      newY = orig.y + (ohNorm - newH);
    } else if (handle === 'bl') {
      newW = Math.max(minW, owNorm - dx);
      newH = lockRatio ? (newW / aspect) : Math.max(minH, ohNorm + dy);
      newX = orig.x + (owNorm - newW);
    }

    selectedAnnot.x = Math.max(0, Math.min(0.98, newX));
    selectedAnnot.y = Math.max(0, Math.min(0.98, newY));
    selectedAnnot.w = Math.min(1.0 - selectedAnnot.x, newW);
    selectedAnnot.h = Math.min(1.0 - selectedAnnot.y, newH);
    return;
  }

  // Ruler, Arrow
  if (selectedAnnot.type === 'ruler' || selectedAnnot.type === 'arrow') {
    if (handle === 'br' || handle === 'tr') {
      selectedAnnot.x2 = orig.x2 + dx;
      selectedAnnot.y2 = orig.y2 + dy;
    } else if (handle === 'tl' || handle === 'bl') {
      selectedAnnot.x1 = orig.x1 + dx;
      selectedAnnot.y1 = orig.y1 + dy;
    }
    return;
  }

  // Pen & Custom Shapes freehand / polygon strokes
  if ((selectedAnnot.type === 'pen' || selectedAnnot.type === 'shape' || selectedAnnot.type === 'curve') && orig.points && orig.points.length > 0) {
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const p of orig.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const origSpanX = Math.max(0.01, maxX - minX);
    const origSpanY = Math.max(0.01, maxY - minY);

    let newMinX = minX, newMinY = minY, newSpanX = origSpanX, newSpanY = origSpanY;
    if (handle === 'br') {
      newSpanX = Math.max(0.01, origSpanX + dx);
      newSpanY = Math.max(0.01, origSpanY + dy);
    } else if (handle === 'tl') {
      newSpanX = Math.max(0.01, origSpanX - dx);
      newSpanY = Math.max(0.01, origSpanY - dy);
      newMinX = minX + (origSpanX - newSpanX);
      newMinY = minY + (origSpanY - newSpanY);
    } else if (handle === 'tr') {
      newSpanX = Math.max(0.01, origSpanX + dx);
      newSpanY = Math.max(0.01, origSpanY - dy);
      newMinY = minY + (origSpanY - newSpanY);
    } else if (handle === 'bl') {
      newSpanX = Math.max(0.01, origSpanX - dx);
      newSpanY = Math.max(0.01, origSpanY + dy);
      newMinX = minX + (origSpanX - newSpanX);
    }

    selectedAnnot.points = orig.points.map(p => ({
      x: newMinX + ((p.x - minX) / origSpanX) * newSpanX,
      y: newMinY + ((p.y - minY) / origSpanY) * newSpanY
    }));
  }
}

export function computeCadMeasurement(p1, p2, scaleRatio = 100, unit = 'mm') {
  const normalizedDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const nominalPageWidthMm = 420; // A3 width
  const distanceOnPaperMm = normalizedDistance * nominalPageWidthMm;
  const realDistanceMm = distanceOnPaperMm * scaleRatio;

  if (unit === 'm') {
    return `${(realDistanceMm / 1000).toFixed(2)} m`;
  } else if (unit === 'cm') {
    return `${(realDistanceMm / 10).toFixed(1)} cm`;
  }
  return `${Math.round(realDistanceMm)} mm`;
}

/**
 * Snapping Candidate Finder (Smart Snapping / Osnap / Loop Closure / Ortho Shift)
 * Finds the closest snapping target:
 * 1. Loop closure (Snap to start point of the active path)
 * 2. Shift key Ortho angle constraint (0°, 45°, 90°, 135°, 180°, etc.)
 * 3. Object snap (Endpoints, corners, centers of existing annotations)
 */
export function findSnapCandidate(annots, overlayCanvas, rawPt, currentPath, options = {}) {
  if (!rawPt || !overlayCanvas) return null;
  const w = overlayCanvas.width;
  const h = overlayCanvas.height;
  const curPx = rawPt.x * w;
  const curPy = rawPt.y * h;
  const snapThreshold = options.snapThresholdPx || 16;

  // 1. Check currentPath start point for loop closure (Khép kín hình)
  if (currentPath && currentPath.length >= 2) {
    const startPt = currentPath[0];
    const spX = startPt.x * w;
    const spY = startPt.y * h;
    if (Math.hypot(curPx - spX, curPy - spY) <= 22) {
      return {
        snappedPt: { x: startPt.x, y: startPt.y },
        snapType: 'start-point',
        snapPx: spX,
        snapPy: spY,
        description: 'Khép kín hình (Snap)'
      };
    }
  }

  // 2. Check Shift key Ortho straight line constraint (Angle snapping 0°, 45°, 90°, etc.)
  if (options.shiftKey && currentPath && currentPath.length >= 1) {
    const refPt = currentPath[currentPath.length - 1];
    const refPx = refPt.x * w;
    const refPy = refPt.y * h;
    const dx = curPx - refPx;
    const dy = curPy - refPy;
    const dist = Math.hypot(dx, dy);
    if (dist > 4) {
      const deg = Math.atan2(dy, dx) * (180 / Math.PI);
      const snapDeg = Math.round(deg / 45) * 45;
      const snapRad = snapDeg * (Math.PI / 180);
      const snPx = refPx + dist * Math.cos(snapRad);
      const snPy = refPy + dist * Math.sin(snapRad);
      return {
        snappedPt: {
          x: Math.max(0, Math.min(1, snPx / w)),
          y: Math.max(0, Math.min(1, snPy / h))
        },
        snapType: 'ortho-angle',
        snapPx: snPx,
        snapPy: snPy,
        snapAngle: (snapDeg % 360 + 360) % 360,
        refPx,
        refPy,
        description: `${(snapDeg % 360 + 360) % 360}° [Shift]`
      };
    }
  }

  // 3. Check Object Snapping (Osnap to existing annotations on the page)
  if (annots && annots.length > 0) {
    let closest = null;
    let minDist = snapThreshold;

    for (const a of annots) {
      if (options.excludeAnnot && a === options.excludeAnnot) continue;

      const pts = [];
      if (a.points && a.points.length > 0) {
        pts.push(a.points[0]);
        pts.push(a.points[a.points.length - 1]);
        if (a.points.length > 2) {
          pts.push(a.points[Math.floor(a.points.length / 2)]);
        }
      } else if (a.x1 !== undefined && a.y1 !== undefined) {
        pts.push({ x: a.x1, y: a.y1 });
        pts.push({ x: a.x2, y: a.y2 });
        pts.push({ x: (a.x1 + a.x2) / 2, y: (a.y1 + a.y2) / 2 });
      } else if (a.x !== undefined && a.y !== undefined) {
        const aw = a.w || 0.1;
        const ah = a.h || 0.05;
        pts.push({ x: a.x, y: a.y });
        pts.push({ x: a.x + aw, y: a.y });
        pts.push({ x: a.x, y: a.y + ah });
        pts.push({ x: a.x + aw, y: a.y + ah });
        pts.push({ x: a.x + aw / 2, y: a.y + ah / 2 });
      }

      for (const p of pts) {
        const px = p.x * w;
        const py = p.y * h;
        const d = Math.hypot(curPx - px, curPy - py);
        if (d < minDist) {
          minDist = d;
          closest = {
            snappedPt: { x: p.x, y: p.y },
            snapType: 'object-point',
            snapPx: px,
            snapPy: py,
            description: 'Bắt điểm đối tượng (Osnap)'
          };
        }
      }
    }

    if (closest) return closest;
  }

  return null;
}
