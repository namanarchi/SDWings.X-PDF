import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Creates a sample architectural presentation PDF matching the BD01 Conference aesthetic
 * so the application opens immediately with a live, realistic document.
 */
export async function createSampleArchitecturalPdf() {
  const pdfDoc = await PDFDocument.create();
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const colors = {
    bg: rgb(0.95, 0.945, 0.93),
    white: rgb(1, 1, 1),
    black: rgb(0.08, 0.08, 0.08),
    darkGrey: rgb(0.2, 0.2, 0.2),
    midGrey: rgb(0.55, 0.54, 0.52),
    lightGrey: rgb(0.85, 0.84, 0.82),
    gridLine: rgb(0.9, 0.89, 0.87),
    accent: rgb(0.85, 0.35, 0.15),
    blueCad: rgb(0.18, 0.35, 0.55),
    glass: rgb(0.68, 0.82, 0.9)
  };

  // Page 1: BD01 - Conference Hall - General Architectural Isometric
  const page1 = pdfDoc.addPage([1190, 842]); // A3 Landscape (1190 x 842 pt)
  const { width: w1, height: h1 } = page1.getSize();

  // Background
  page1.drawRectangle({
    x: 0,
    y: 0,
    width: w1,
    height: h1,
    color: colors.bg
  });

  // Architectural Grid
  const gridSpacing = 40;
  for (let x = 60; x < w1 - 60; x += gridSpacing) {
    page1.drawLine({
      start: { x, y: 60 },
      end: { x, y: h1 - 60 },
      thickness: 0.5,
      color: colors.gridLine
    });
  }
  for (let y = 60; y < h1 - 60; y += gridSpacing) {
    page1.drawLine({
      start: { x: 60, y },
      end: { x: w1 - 60, y },
      thickness: 0.5,
      color: colors.gridLine
    });
  }

  // Border Frame (Architectural Title Block Border)
  page1.drawRectangle({
    x: 40,
    y: 40,
    width: w1 - 80,
    height: h1 - 80,
    borderColor: colors.black,
    borderWidth: 1.5,
    color: undefined
  });

  // Header Title
  page1.drawText('OPENBIM / BUILDING 3D ENVIRONMENT', {
    x: 60,
    y: h1 - 80,
    size: 11,
    font: fontHelvetica,
    color: colors.midGrey
  });

  page1.drawText('BD01 · Conference', {
    x: 60,
    y: h1 - 120,
    size: 32,
    font: fontHelveticaBold,
    color: colors.black
  });

  page1.drawText('SDWings.PDFReader · Architectural CAD & PDF Workbench Engine', {
    x: w1 - 440,
    y: h1 - 85,
    size: 9,
    font: fontHelvetica,
    color: colors.darkGrey
  });

  // Central Architectural Model Diagram (Auditorium Building Massing)
  const cx = w1 / 2;
  const cy = h1 / 2 - 20;

  // Main hall floor slab outline (Isometric / Plan projection)
  page1.drawRectangle({
    x: cx - 280,
    y: cy - 140,
    width: 560,
    height: 280,
    color: colors.white,
    borderColor: colors.black,
    borderWidth: 2
  });

  // Tiered seating area (Auditorium tiers)
  for (let i = 0; i < 9; i++) {
    const tierY = cy + 60 - i * 18;
    page1.drawRectangle({
      x: cx - 230,
      y: tierY,
      width: 220,
      height: 12,
      color: rgb(0.25, 0.27, 0.3),
      borderColor: colors.black,
      borderWidth: 0.8
    });
  }

  // Stage area
  page1.drawRectangle({
    x: cx - 230,
    y: cy - 115,
    width: 220,
    height: 35,
    color: rgb(0.9, 0.88, 0.83),
    borderColor: colors.black,
    borderWidth: 1.2
  });
  page1.drawText('STAGE / LECTURE PODIUM [EL. +0.600m]', {
    x: cx - 210,
    y: cy - 95,
    size: 9,
    font: fontHelveticaBold,
    color: colors.black
  });

  // Foyer and curved glass wall
  page1.drawRectangle({
    x: cx + 20,
    y: cy - 120,
    width: 230,
    height: 240,
    color: rgb(0.96, 0.96, 0.95),
    borderColor: colors.midGrey,
    borderWidth: 1
  });

  // Curved glass curtain wall mullions
  for (let m = 0; m < 7; m++) {
    const mx = cx + 30 + m * 30;
    page1.drawLine({
      start: { x: mx, y: cy - 120 },
      end: { x: mx + 10, y: cy - 60 },
      thickness: 2,
      color: colors.blueCad
    });
  }

  page1.drawText('CURVED GLASS CURTAIN WALL (STRUCTURAL GLAZING)', {
    x: cx + 30,
    y: cy - 50,
    size: 8,
    font: fontHelveticaBold,
    color: colors.blueCad
  });

  page1.drawText('MAIN ENTRANCE FOYER / RECEPTION', {
    x: cx + 35,
    y: cy + 40,
    size: 10,
    font: fontHelvetica,
    color: colors.darkGrey
  });

  // Dimension lines
  page1.drawLine({
    start: { x: cx - 280, y: cy - 165 },
    end: { x: cx + 280, y: cy - 165 },
    thickness: 1,
    color: colors.black
  });
  page1.drawText('TOTAL LENGTH: 28,000 mm', {
    x: cx - 60,
    y: cy - 180,
    size: 9,
    font: fontHelveticaBold,
    color: colors.black
  });

  // Title Block (Bottom Right)
  const tbX = w1 - 340;
  const tbY = 40;
  page1.drawRectangle({
    x: tbX,
    y: tbY,
    width: 300,
    height: 90,
    color: colors.white,
    borderColor: colors.black,
    borderWidth: 1.5
  });

  // Brand title block
  page1.drawText('SDWings', {
    x: tbX + 15,
    y: tbY + 68,
    size: 10,
    font: fontHelveticaBold,
    color: colors.black
  });
  page1.drawText('X', {
    x: tbX + 63,
    y: tbY + 68,
    size: 11,
    font: fontHelveticaBold,
    color: rgb(0.145, 0.388, 0.922) // Royal blue #2563eb
  });
  page1.drawText('(R) · ARCHITECTURAL CAD WORKBENCH', {
    x: tbX + 72,
    y: tbY + 69,
    size: 8,
    font: fontHelveticaBold,
    color: colors.black
  });
  page1.drawText('PROJECT: BD01 CONVENTION & AUDITORIUM COMPLEX', {
    x: tbX + 15,
    y: tbY + 50,
    size: 8,
    font: fontHelvetica,
    color: colors.darkGrey
  });
  page1.drawText('DRAWING: SCHEMATIC ISOMETRIC & GENERAL LAYOUT', {
    x: tbX + 15,
    y: tbY + 34,
    size: 8,
    font: fontHelvetica,
    color: colors.darkGrey
  });
  page1.drawText('SCALE: 1:100   |   SHEET: AR-101   |   STATUS: APPROVED', {
    x: tbX + 15,
    y: tbY + 16,
    size: 8,
    font: fontHelveticaBold,
    color: colors.accent
  });

  // Page 2: Floor Plan Level 00
  const page2 = pdfDoc.addPage([1190, 842]);
  page2.drawRectangle({ x: 0, y: 0, width: w1, height: h1, color: colors.bg });
  page2.drawRectangle({ x: 40, y: 40, width: w1 - 80, height: h1 - 80, borderColor: colors.black, borderWidth: 1.5 });

  page2.drawText('OPENBIM / BUILDING 3D ENVIRONMENT', { x: 60, y: h1 - 80, size: 11, font: fontHelvetica, color: colors.midGrey });
  page2.drawText('BD01 · Level 00 Ground Floor Plan', { x: 60, y: h1 - 120, size: 28, font: fontHelveticaBold, color: colors.black });

  // Grid axes (A, B, C, D & 1, 2, 3, 4)
  const axesX = [200, 450, 700, 950];
  const axesY = [220, 420, 620];
  axesX.forEach((ax, idx) => {
    page2.drawLine({ start: { x: ax, y: 150 }, end: { x: ax, y: 680 }, thickness: 0.5, color: colors.midGrey });
    page2.drawCircle({ x: ax, y: 700, size: 14, color: colors.white, borderColor: colors.black, borderWidth: 1 });
    page2.drawText(`0${idx + 1}`, { x: ax - 5, y: 696, size: 9, font: fontHelveticaBold, color: colors.black });
  });

  axesY.forEach((ay, idx) => {
    page2.drawLine({ start: { x: 120, y: ay }, end: { x: 1020, y: ay }, thickness: 0.5, color: colors.midGrey });
    page2.drawCircle({ x: 1040, y: ay, size: 14, color: colors.white, borderColor: colors.black, borderWidth: 1 });
    page2.drawText(String.fromCharCode(65 + idx), { x: 1037, y: ay - 4, size: 9, font: fontHelveticaBold, color: colors.black });
  });

  // Plan walls
  page2.drawRectangle({ x: 200, y: 220, width: 750, height: 400, color: undefined, borderColor: colors.black, borderWidth: 3 });
  page2.drawRectangle({ x: 240, y: 260, width: 360, height: 320, color: rgb(0.98, 0.98, 0.97), borderColor: colors.darkGrey, borderWidth: 1.5 });
  page2.drawText('MAIN AUDITORIUM (SEATS: 350)', { x: 300, y: 440, size: 14, font: fontHelveticaBold, color: colors.black });
  page2.drawText('ACOUSTIC WALL LINING: NRC 0.85', { x: 300, y: 415, size: 10, font: fontHelvetica, color: colors.midGrey });

  // Page 3: Acoustic Section & Technical Notes
  const page3 = pdfDoc.addPage([1190, 842]);
  page3.drawRectangle({ x: 0, y: 0, width: w1, height: h1, color: colors.bg });
  page3.drawRectangle({ x: 40, y: 40, width: w1 - 80, height: h1 - 80, borderColor: colors.black, borderWidth: 1.5 });

  page3.drawText('ENGINEERING SPECIFICATIONS & SECTION A-A', { x: 60, y: h1 - 80, size: 11, font: fontHelvetica, color: colors.midGrey });
  page3.drawText('BD01 · Section A-A / Sound & Light Array', { x: 60, y: h1 - 120, size: 28, font: fontHelveticaBold, color: colors.black });

  // Longitudinal ceiling baffles
  for (let b = 0; b < 12; b++) {
    page3.drawRectangle({
      x: 180 + b * 65,
      y: 500 - (b % 3) * 15,
      width: 45,
      height: 8,
      color: colors.darkGrey
    });
  }
  page3.drawText('SUSPENDED SOUND BAFFLE ARRAY (CALCULATED RT60 = 1.1s)', {
    x: 200,
    y: 530,
    size: 11,
    font: fontHelveticaBold,
    color: colors.black
  });

  // Specification list
  const specs = [
    '1. Structural Steel Frame: ASTM A992 Grade 50 wide flange beams and columns.',
    '2. Double Glazing: 8mm Low-E outer pane + 16mm Argon gap + 8mm acoustic laminated inner pane.',
    '3. Acoustic ceiling panels: Perforated gypsum with rockwool acoustic backer.',
    '4. Mechanical ventilation: Underfloor displacement air distribution (UFAD) with low velocity airflow.',
    '5. Fire rating: 2-hour fire-resistance rated assembly for all egress corridors.'
  ];

  specs.forEach((spec, i) => {
    page3.drawText(spec, {
      x: 180,
      y: 360 - i * 32,
      size: 11,
      font: fontHelvetica,
      color: colors.darkGrey
    });
  });

  return await pdfDoc.save();
}
