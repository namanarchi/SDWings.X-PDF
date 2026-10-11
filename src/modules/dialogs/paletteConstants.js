/**
 * paletteConstants.js
 * Standard palette colors, stroke presets, font families, and color utility functions.
 */

/**
 * Exact 21 Colors Matching User Palette (3 rows x 7 cols)
 */
export const PALETTE_COLORS = [
  // Row 1: Vivid primary & secondary
  '#1976d2', '#1b5e20', '#f5a623', '#f57c00', '#d32f2f', '#9c27b0', '#673ab7',
  // Row 2: Pastels & light tints
  '#00e5ff', '#aeea00', '#fff59d', '#ffccbc', '#ff8a80', '#ea80fc', '#b388ff',
  // Row 3: Grayscale ramp
  '#ffffff', '#cfd8dc', '#90a4ae', '#546e7a', '#37474f', '#263238', '#000000'
];

export const STROKE_WEIGHTS = [
  { value: 1, label: '1px' },
  { value: 2, label: '2px' },
  { value: 3, label: '3px' },
  { value: 5, label: '5px' },
  { value: 8, label: '8px' },
  { value: 12, label: '12px' }
];

/**
 * Font families for text markups and architectural comments
 */
export const FONT_FAMILIES = [
  { value: 'sans-serif', label: 'Mặc định (Sans-Serif)', sample: 'Aa Bb Cc 123', family: 'sans-serif', desc: 'Sạch sẽ, hiện đại' },
  { value: 'Arial, sans-serif', label: 'Arial', sample: 'Aa Bb Cc 123', family: 'Arial, sans-serif', desc: 'Tiêu chuẩn quốc tế' },
  { value: 'Roboto, sans-serif', label: 'Roboto', sample: 'Aa Bb Cc 123', family: 'Roboto, sans-serif', desc: 'Rõ nét, kỹ thuật CAD' },
  { value: 'Inter, sans-serif', label: 'Inter', sample: 'Aa Bb Cc 123', family: 'Inter, sans-serif', desc: 'Hiện đại, sắc nét' },
  { value: '"Courier New", monospace', label: 'Monospace (CAD Code)', sample: 'Aa Bb Cc 123', family: '"Courier New", monospace', desc: 'Đều chữ, ghi chú CAD/BIM' },
  { value: '"Times New Roman", serif', label: 'Times New Roman (Serif)', sample: 'Aa Bb Cc 123', family: '"Times New Roman", serif', desc: 'Trang trọng, pháp lý' },
  { value: '"Segoe UI", sans-serif', label: 'Segoe UI', sample: 'Aa Bb Cc 123', family: '"Segoe UI", sans-serif', desc: 'Giao diện hệ điều hành' },
  { value: 'cursive', label: 'Chữ Ký / Viết Tay', sample: 'Aa Bb Cc 123', family: 'cursive', desc: 'Ký tên, phê duyệt mềm' }
];

/**
 * Checks whether a given hex color is perceptually light (for contrasting text/icons)
 */
export function isLightColor(hex) {
  if (!hex || hex === 'transparent' || hex === 'none') return false;
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return false;
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
}
