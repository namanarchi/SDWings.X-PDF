/**
 * annotationRenderer.js
 * HTML5 Canvas rendering engine for CAD annotations, clouds, dimensions, stamps, and signatures.
 */

import { getSelectionUIGeometry, computeCadMeasurement } from './annotationGeometry.js';

export function drawCloudPath(ctx, x, y, w, h, arcRadius = 14) {
  ctx.beginPath();
  // Top side: x to x+w, looping upwards
  for (let cx = x + arcRadius; cx < x + w; cx += arcRadius * 2) {
    ctx.arc(cx, y, arcRadius, Math.PI, 0);
  }
  // Right side: y to y+h, looping rightwards
  for (let cy = y + arcRadius; cy < y + h; cy += arcRadius * 2) {
    ctx.arc(x + w, cy, arcRadius, -Math.PI / 2, Math.PI / 2);
  }
  // Bottom side: x+w to x, looping downwards
  for (let cx = x + w - arcRadius; cx > x; cx -= arcRadius * 2) {
    ctx.arc(cx, y + h, arcRadius, 0, Math.PI);
  }
  // Left side: y+h to y, looping leftwards
  for (let cy = y + h - arcRadius; cy > y; cy -= arcRadius * 2) {
    ctx.arc(x, cy, arcRadius, Math.PI / 2, -Math.PI / 2);
  }
  ctx.closePath();
}

export function drawCloudRect(ctx, x, y, w, h, arcRadius = 14) {
  drawCloudPath(ctx, x, y, w, h, arcRadius);
  ctx.stroke();
}

export function drawSingleAnnotation(ctx, a, w, h) {
  ctx.save();
  if ((a.type === 'pen' || a.type === 'shape' || a.type === 'curve') && a.points && a.points.length > 0) {
    ctx.strokeStyle = a.color || '#111111';
    ctx.lineWidth = Math.max(1, (a.size !== undefined ? a.size : 2) * (w / 1000));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (a.opacity !== undefined) ctx.globalAlpha = a.opacity;

    ctx.beginPath();
    const pts = a.points;
    if (a.isSmooth || a.type === 'curve') {
      // Smooth Catmull-Rom / Bézier spline curve through points
      ctx.moveTo(pts[0].x * w, pts[0].y * h);
      if (pts.length === 2) {
        ctx.lineTo(pts[1].x * w, pts[1].y * h);
      } else {
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i];
          const p1 = pts[i + 1];
          const midX = ((p0.x + p1.x) / 2) * w;
          const midY = ((p0.y + p1.y) / 2) * h;
          ctx.quadraticCurveTo(p0.x * w, p0.y * h, midX, midY);
        }
        ctx.lineTo(pts[pts.length - 1].x * w, pts[pts.length - 1].y * h);
      }
    } else {
      // Direct segments through points
      pts.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x * w, pt.y * h);
        else ctx.lineTo(pt.x * w, pt.y * h);
      });
    }

    if (a.isClosed) {
      ctx.closePath();
      if (a.bgColor && a.bgColor !== 'transparent' && a.bgColor !== 'none') {
        ctx.fillStyle = a.bgColor;
        ctx.fill();
      }
    }

    if (a.size !== 0 && a.color !== 'transparent') {
      ctx.stroke();
    }
  } else if (a.type === 'highlight') {
    ctx.fillStyle = a.color || '#ffd54f';
    ctx.globalAlpha = a.opacity !== undefined ? a.opacity : 0.38;
    ctx.fillRect(a.x * w, a.y * h, a.w * w, a.h * h);
  } else if (a.type === 'rect') {
    const rx = a.x * w;
    const ry = a.y * h;
    const rw = a.w * w;
    const rh = a.h * h;
    const rad = a.borderRadius !== undefined ? a.borderRadius : 0;

    if (a.bgColor && a.bgColor !== 'transparent') {
      ctx.fillStyle = a.bgColor;
      ctx.beginPath();
      if (rad > 0 && ctx.roundRect) {
        ctx.roundRect(rx, ry, rw, rh, Math.min(rad, rh / 2, rw / 2));
      } else {
        ctx.rect(rx, ry, rw, rh);
      }
      ctx.fill();
    }

    const strokeW = a.size !== undefined ? a.size : 2;
    if (strokeW > 0 && a.color && a.color !== 'transparent') {
      ctx.strokeStyle = a.color || '#111111';
      ctx.lineWidth = Math.max(1, strokeW * (w / 1000));
      ctx.beginPath();
      if (rad > 0 && ctx.roundRect) {
        ctx.roundRect(rx, ry, rw, rh, Math.min(rad, rh / 2, rw / 2));
      } else {
        ctx.rect(rx, ry, rw, rh);
      }
      ctx.stroke();
    }
  } else if (a.type === 'cloud') {
    const arcRad = a.arcRadius || 14;
    const cx = a.x * w;
    const cy = a.y * h;
    const cw = a.w * w;
    const ch = a.h * h;
    const strokeW = a.size !== undefined ? a.size : 2;

    if (a.bgColor && a.bgColor !== 'transparent') {
      ctx.fillStyle = a.bgColor;
      drawCloudPath(ctx, cx, cy, cw, ch, arcRad);
      ctx.fill();
    }

    if (strokeW > 0 && a.color && a.color !== 'transparent') {
      ctx.strokeStyle = a.color || '#d32f2f';
      ctx.lineWidth = Math.max(1, strokeW * (w / 1000));
      drawCloudPath(ctx, cx, cy, cw, ch, arcRad);
      ctx.stroke();
    }
  } else if (a.type === 'ruler') {
    // CAD Dimension line
    const x1 = a.x1 * w;
    const y1 = a.y1 * h;
    const x2 = a.x2 * w;
    const y2 = a.y2 * h;

    ctx.strokeStyle = a.color || '#111111';
    ctx.lineWidth = 1.5 * (w / 1000);

    // Main line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Architectural 45-degree slash ticks at ends
    const tickSize = 8;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const tickAngle = angle + Math.PI / 4;

    ctx.beginPath();
    ctx.moveTo(x1 - Math.cos(tickAngle) * tickSize, y1 - Math.sin(tickAngle) * tickSize);
    ctx.lineTo(x1 + Math.cos(tickAngle) * tickSize, y1 + Math.sin(tickAngle) * tickSize);
    ctx.moveTo(x2 - Math.cos(tickAngle) * tickSize, y2 - Math.sin(tickAngle) * tickSize);
    ctx.lineTo(x2 + Math.cos(tickAngle) * tickSize, y2 + Math.sin(tickAngle) * tickSize);
    ctx.stroke();

    // Label pill
    if (a.label) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      ctx.font = `600 ${Math.max(11, Math.round((a.fontSize || 13) * (w / 1000)))}px monospace`;
      const textMetrics = ctx.measureText(a.label);
      const pad = 6;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(midX - textMetrics.width / 2 - pad, midY - 10, textMetrics.width + pad * 2, 20);
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 1;
      ctx.strokeRect(midX - textMetrics.width / 2 - pad, midY - 10, textMetrics.width + pad * 2, 20);
      ctx.fillStyle = '#111111';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(a.label, midX, midY);
    }
  } else if (a.type === 'arrow') {
    const x1 = a.x1 * w;
    const y1 = a.y1 * h;
    const x2 = a.x2 * w;
    const y2 = a.y2 * h;
    ctx.strokeStyle = a.color || '#111111';
    ctx.lineWidth = (a.size || 2) * (w / 1000);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const headLength = 14;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.fillStyle = a.color || '#111111';
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  } else if (a.type === 'text' || a.type === 'comment') {
    if (a.type === 'comment') {
      const cx = a.x * w;
      const cy = a.y * h;
      const cw = (a.w !== undefined ? a.w * w : 120);
      const ch = (a.h !== undefined ? a.h * h : 28);
      const rad = a.borderRadius !== undefined ? a.borderRadius : 8;

      // 1. Background fill
      if (a.bgColor && a.bgColor !== 'transparent') {
        ctx.fillStyle = a.bgColor;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(cx, cy, cw, ch, Math.min(rad, ch / 2, cw / 2));
        } else {
          ctx.rect(cx, cy, cw, ch);
        }
        ctx.fill();
      }

      // 2. Stroke line
      const strokeW = a.size !== undefined ? a.size : 1.5;
      if (strokeW > 0 && a.color && a.color !== 'transparent') {
        ctx.strokeStyle = a.color || '#f59e0b';
        ctx.lineWidth = Math.max(1, strokeW * (w / 1000));
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(cx, cy, cw, ch, Math.min(rad, ch / 2, cw / 2));
        } else {
          ctx.rect(cx, cy, cw, ch);
        }
        ctx.stroke();
      }

      // 3. Text & Icon
      if (!a._isEditing) {
        const fs = Math.max(10, Math.round((a.fontSize || 13) * (w / 1000)));
        ctx.font = `600 ${fs}px ${a.fontFamily || 'sans-serif'}`;
        ctx.fillStyle = a.textColor || a.color || '#78350f';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(cx, cy, cw, ch, Math.min(rad, ch / 2, cw / 2));
        } else {
          ctx.rect(cx, cy, cw, ch);
        }
        ctx.clip();
        ctx.fillText(a.text || '💬 Ghi chú', cx + 8, cy + ch / 2);
        ctx.restore();
      }
    } else {
      const tx = a.x * w;
      const ty = a.y * h;
      if (a.bgColor && a.bgColor !== 'transparent') {
        const fs = Math.round((a.fontSize || 14) * (w / 1000));
        ctx.font = `${a.bold ? '600' : '400'} ${fs}px ${a.fontFamily || 'sans-serif'}`;
        const m = ctx.measureText(a.text || '');
        const rad = a.borderRadius || 0;
        ctx.fillStyle = a.bgColor;
        if (rad > 0 && ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(tx - 4, ty - 2, m.width + 8, fs * 1.3, rad);
          ctx.fill();
        } else {
          ctx.fillRect(tx - 4, ty - 2, m.width + 8, fs * 1.3);
        }
      }
      if (!a._isEditing) {
        ctx.fillStyle = a.color || '#111827';
        ctx.font = `${a.bold ? '600' : '400'} ${Math.round((a.fontSize || 14) * (w / 1000))}px ${a.fontFamily || 'sans-serif'}`;
        ctx.textBaseline = 'top';
        ctx.fillText(a.text || 'Văn bản', tx, ty);
      }
    }
  } else if (a.type === 'stamp') {
    const sx = a.x * w;
    const sy = a.y * h;
    const sw = a.w * w;
    const sh = a.h * h;
    ctx.strokeStyle = a.stampColor || '#2e7d32';
    ctx.lineWidth = 3;
    ctx.strokeRect(sx, sy, sw, sh);
    ctx.fillStyle = a.stampColor || '#2e7d32';
    ctx.globalAlpha = 0.12;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.globalAlpha = 1.0;
    ctx.font = `bold ${Math.round(sh * 0.45)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(a.stampText, sx + sw / 2, sy + sh / 2);
  } else if ((a.type === 'signature' || a.type === 'image') && a.dataUrl) {
    let img = a._cachedImg;
    if (!img) {
      img = new Image();
      img.src = a.dataUrl;
      a._cachedImg = img;
    }
    const ix = a.x * w;
    const iy = a.y * h;
    const iw = a.w * w;
    const ih = a.h * h;
    const op = a.opacity !== undefined ? a.opacity : 1.0;
    ctx.save();
    ctx.globalAlpha = op;

    const rad = a.borderRadius || 0;
    if (rad > 0 && ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(ix, iy, iw, ih, Math.min(rad, iw / 2, ih / 2));
      ctx.clip();
    }

    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, ix, iy, iw, ih);
    } else {
      img.onload = () => {
        try {
          ctx.drawImage(img, ix, iy, iw, ih);
        } catch (_) {}
      };
    }

    // Optional border stroke
    const strokeW = a.size !== undefined ? a.size : 0;
    if (strokeW > 0 && a.color && a.color !== 'transparent') {
      ctx.strokeStyle = a.color;
      ctx.lineWidth = Math.max(1, strokeW * (w / 1000));
      if (rad > 0 && ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(ix, iy, iw, ih, Math.min(rad, iw / 2, ih / 2));
        ctx.stroke();
      } else {
        ctx.strokeRect(ix, iy, iw, ih);
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

export function drawSelectionUI(ctx, geom) {
  if (!geom) return;
  ctx.save();
  // 1. Dashed selection bounding box (High visibility blue)
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(geom.px, geom.py, geom.pw, geom.ph);
  ctx.setLineDash([]);

  // 1b. Stem line and circular rotation grip
  if (geom.rotX !== undefined && geom.rotY !== undefined) {
    const topCenterX = geom.px + geom.pw / 2;
    const topCenterY = geom.py;
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(topCenterX, topCenterY);
    ctx.lineTo(geom.rotX, geom.rotY);
    ctx.stroke();

    // Circle rotate handle
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(geom.rotX, geom.rotY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner rotation icon dot
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(geom.rotX, geom.rotY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Corner resize grab handles
  for (const [key, h] of Object.entries(geom.handles)) {
    if (key === 'rot') continue;
    const s = h.hs;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.8;
    ctx.fillRect(h.x - s / 2, h.y - s / 2, s, s);
    ctx.strokeRect(h.x - s / 2, h.y - s / 2, s, s);
  }

  ctx.restore();
}

export function drawSnapIndicator(ctx, snap, w, h) {
  if (!snap) return;
  ctx.save();
  const px = snap.snapPx;
  const py = snap.snapPy;

  if (snap.snapType === 'start-point') {
    // Loop closure indicator: Golden amber ring with inner loop dot
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
    ctx.beginPath();
    ctx.arc(px, py, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();

    // Snap badge
    ctx.fillStyle = '#1e293b';
    ctx.font = '600 11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Khép kín hình (Snap)', px + 14, py + 4);
  } else if (snap.snapType === 'object-point') {
    // CAD Osnap marker: Emerald green diamond with center dot
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(5, 150, 105, 0.2)';
    const s = 7;
    ctx.beginPath();
    ctx.moveTo(px, py - s);
    ctx.lineTo(px + s, py);
    ctx.lineTo(px, py + s);
    ctx.lineTo(px - s, py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#059669';
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (snap.snapType === 'ortho-angle') {
    // Ortho straight line guide (Shift constraint)
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(snap.refPx, snap.refPy);
    ctx.lineTo(px, py);
    ctx.stroke();
    ctx.setLineDash([]);

    // Small blue dot at target
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    // Angle badge
    ctx.fillStyle = '#1e293b';
    ctx.font = '700 11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`${snap.snapAngle}° [Shift]`, px + 8, py - 6);
  }
  ctx.restore();
}

export function drawPageOverlay(pageIndex, overlayCanvas, annots, selectedAnnot, previewAnnot, activeSnap = null, draftPoints = null) {
  if (!overlayCanvas) return;
  const ctx = overlayCanvas.getContext('2d');
  const w = overlayCanvas.width;
  const h = overlayCanvas.height;

  ctx.clearRect(0, 0, w, h);

  const drawList = [...(annots || [])];
  if (previewAnnot) {
    drawList.push(previewAnnot);
  }

  for (const a of drawList) {
    if (a.rotation && a.rotation !== 0) {
      const geom = getSelectionUIGeometry(a, overlayCanvas);
      if (geom) {
        ctx.save();
        ctx.translate(geom.centerX, geom.centerY);
        ctx.rotate(a.rotation * (Math.PI / 180));
        ctx.translate(-geom.centerX, -geom.centerY);
        drawSingleAnnotation(ctx, a, w, h);
        ctx.restore();
        continue;
      }
    }
    drawSingleAnnotation(ctx, a, w, h);
  }

  // Draw draft vertices for multi-point shape / curve creation
  if (draftPoints && draftPoints.length > 0) {
    ctx.save();
    for (let i = 0; i < draftPoints.length; i++) {
      const pt = draftPoints[i];
      const px = pt.x * w;
      const py = pt.y * h;
      ctx.fillStyle = i === 0 ? '#f59e0b' : '#2563eb';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, i === 0 ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Render selection bounding box & resize grab handles
  if (selectedAnnot) {
    const geom = getSelectionUIGeometry(selectedAnnot, overlayCanvas);
    if (geom) {
      if (selectedAnnot.rotation && selectedAnnot.rotation !== 0) {
        ctx.save();
        ctx.translate(geom.centerX, geom.centerY);
        ctx.rotate(selectedAnnot.rotation * (Math.PI / 180));
        ctx.translate(-geom.centerX, -geom.centerY);
        drawSelectionUI(ctx, geom);
        ctx.restore();
      } else {
        drawSelectionUI(ctx, geom);
      }
    }
  }

  // Render active snap indicator on the top-most layer
  if (activeSnap) {
    drawSnapIndicator(ctx, activeSnap, w, h);
  }
}

export function createFinalAnnotation(tool, sp, ep, strokeColor, strokeWidth, highlighterColor, scaleRatio, unit, activeStampText, activeStampColor, activeSignatureData) {
  if (!sp || !ep) return null;

  if (tool === 'pen') {
    return null; // Pen pushed live
  }

  if (tool === 'rect') {
    return {
      id: 'annot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'rect',
      x: Math.min(sp.x, ep.x),
      y: Math.min(sp.y, ep.y),
      w: Math.max(0.01, Math.abs(ep.x - sp.x)),
      h: Math.max(0.01, Math.abs(ep.y - sp.y)),
      color: strokeColor,
      bgColor: 'transparent',
      borderRadius: 0,
      size: strokeWidth
    };
  }

  if (tool === 'cloud') {
    return {
      id: 'annot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'cloud',
      x: Math.min(sp.x, ep.x),
      y: Math.min(sp.y, ep.y),
      w: Math.max(0.03, Math.abs(ep.x - sp.x)),
      h: Math.max(0.02, Math.abs(ep.y - sp.y)),
      color: strokeColor || '#d32f2f',
      bgColor: 'transparent',
      arcRadius: 14,
      size: strokeWidth || 2
    };
  }

  if (tool === 'highlight') {
    return {
      id: 'annot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'highlight',
      x: Math.min(sp.x, ep.x),
      y: Math.min(sp.y, ep.y),
      w: Math.max(0.01, Math.abs(ep.x - sp.x)),
      h: Math.max(0.01, Math.abs(ep.y - sp.y)),
      color: highlighterColor || '#ffd54f',
      opacity: 0.38
    };
  }

  if (tool === 'ruler') {
    const label = computeCadMeasurement(sp, ep, scaleRatio, unit);
    return {
      id: 'annot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'ruler',
      x1: sp.x,
      y1: sp.y,
      x2: ep.x,
      y2: ep.y,
      color: strokeColor,
      label: label,
      fontSize: 12
    };
  }

  if (tool === 'arrow') {
    return {
      id: 'annot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'arrow',
      x1: sp.x,
      y1: sp.y,
      x2: ep.x,
      y2: ep.y,
      color: strokeColor,
      size: strokeWidth
    };
  }

  if (tool === 'stamp') {
    return {
      id: 'annot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'stamp',
      x: ep.x - 0.08,
      y: ep.y - 0.03,
      w: 0.16,
      h: 0.06,
      stampText: activeStampText || 'APPROVED',
      stampColor: activeStampColor || '#2e7d32'
    };
  }

  if (tool === 'signature' && activeSignatureData) {
    return {
      id: 'annot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type: 'signature',
      x: ep.x - 0.08,
      y: ep.y - 0.04,
      w: 0.16,
      h: 0.08,
      dataUrl: activeSignatureData
    };
  }

  return null;
}

export function getPreviewAnnotation(tool, sp, cp, strokeColor, strokeWidth, highlighterColor, scaleRatio, unit) {
  if (!sp || !cp) return null;

  if (tool === 'highlight') {
    const x = Math.min(sp.x, cp.x);
    const y = Math.min(sp.y, cp.y);
    const w = Math.abs(cp.x - sp.x);
    const h = Math.abs(cp.y - sp.y);
    return { type: 'highlight', x, y, w, h, color: highlighterColor, opacity: 0.38 };
  }

  if (tool === 'rect') {
    const x = Math.min(sp.x, cp.x);
    const y = Math.min(sp.y, cp.y);
    const w = Math.abs(cp.x - sp.x);
    const h = Math.abs(cp.y - sp.y);
    return {
      type: 'rect',
      x,
      y,
      w,
      h,
      color: strokeColor,
      bgColor: 'transparent',
      borderRadius: 0,
      size: strokeWidth
    };
  }

  if (tool === 'cloud') {
    const x = Math.min(sp.x, cp.x);
    const y = Math.min(sp.y, cp.y);
    const w = Math.abs(cp.x - sp.x);
    const h = Math.abs(cp.y - sp.y);
    return {
      type: 'cloud',
      x,
      y,
      w,
      h,
      color: strokeColor || '#d32f2f',
      bgColor: 'transparent',
      arcRadius: 14,
      size: strokeWidth || 2
    };
  }

  if (tool === 'ruler') {
    const label = computeCadMeasurement(sp, cp, scaleRatio, unit);
    return {
      type: 'ruler',
      x1: sp.x,
      y1: sp.y,
      x2: cp.x,
      y2: cp.y,
      color: strokeColor,
      label: label,
      fontSize: 12
    };
  }

  if (tool === 'arrow') {
    return {
      type: 'arrow',
      x1: sp.x,
      y1: sp.y,
      x2: cp.x,
      y2: cp.y,
      color: strokeColor,
      size: strokeWidth
    };
  }

  return null;
}
