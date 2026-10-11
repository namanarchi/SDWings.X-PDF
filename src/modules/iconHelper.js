import { createElement, icons } from 'lucide';

/**
 * Resolves an icon definition from PascalCase, camelCase or kebab-case name.
 */
function resolveIcon(name) {
  if (!name) return null;
  if (icons[name]) return icons[name];
  // Convert kebab-case or lowercase to PascalCase (e.g. book-open -> BookOpen)
  const pascal = name.replace(/(^\w|-\w)/g, m => m.replace('-', '').toUpperCase());
  if (icons[pascal]) return icons[pascal];
  return null;
}

/**
 * Creates an SVG element for any Lucide icon.
 * @param {string} name - The Lucide icon name (PascalCase or kebab-case)
 * @param {object} options - { size, strokeWidth, className, color }
 * @returns {SVGElement}
 */
export function createIconElement(name, options = {}) {
  const iconDef = resolveIcon(name);
  const size = options.size || 14;
  const strokeWidth = options.strokeWidth || 1.75;
  const color = options.color || 'currentColor';
  const className = options.className || 'lucide-icon';

  if (!iconDef) {
    console.warn(`Icon "${name}" not found in Lucide library.`);
    const fallback = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    fallback.setAttribute('width', String(size));
    fallback.setAttribute('height', String(size));
    return fallback;
  }

  const iconAttrs = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: String(size),
    height: String(size),
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    'stroke-width': String(strokeWidth),
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    class: className
  };

  return createElement(['svg', iconAttrs, iconDef]);
}

/**
 * Returns HTML string representation of the Lucide icon SVG.
 */
export function getIconHtml(name, options = {}) {
  const el = createIconElement(name, options);
  if (el.outerHTML) return el.outerHTML;
  const container = document.createElement('div');
  container.appendChild(el);
  return container.innerHTML;
}

/**
 * Replaces all elements with data-icon="IconName" in a container with Lucide SVG elements.
 */
export function applyLucideIcons(container = document) {
  const targets = container.querySelectorAll('[data-icon]');
  targets.forEach(el => {
    const iconName = el.getAttribute('data-icon');
    if (!iconName) return;
    const size = parseInt(el.getAttribute('data-size') || '14', 10);
    const strokeWidth = parseFloat(el.getAttribute('data-stroke') || '1.75');
    const color = el.getAttribute('data-color') || 'currentColor';
    const svgEl = createIconElement(iconName, { size, strokeWidth, color });
    el.innerHTML = '';
    el.appendChild(svgEl);
  });
}
