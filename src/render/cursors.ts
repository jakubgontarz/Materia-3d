// Crisp high-DPI SVG custom cursors for CAD/BIM selection modes and modifiers (clean, discrete, minimal)

function svgToCursorUrl(svgString: string, hotX: number = 2, hotY: number = 2, fallback: string = 'default'): string {
  const encoded = encodeURIComponent(svgString.trim());
  return `url("data:image/svg+xml,${encoded}") ${hotX} ${hotY}, ${fallback}`;
}

const ARROW_PATH = `M 2 2 L 2 20 L 6.8 15.6 L 11 24.8 L 13.5 23.6 L 9.4 14.5 L 15 14.5 Z`;

// 1. Standard Default Arrow
const SVG_ARROW = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="${ARROW_PATH}" fill="#0f172a" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
</svg>
`;

// 2. Add (+) Selection Cursor (Ctrl held or 'add' mode) - discrete small plus with white halo
const SVG_ARROW_ADD = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="${ARROW_PATH}" fill="#0f172a" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
  <!-- Crisp discrete plus (+) next to arrow -->
  <g stroke="#ffffff" stroke-width="3" stroke-linecap="round">
    <line x1="20" y1="16" x2="20" y2="24" />
    <line x1="16" y1="20" x2="24" y2="20" />
  </g>
  <g stroke="#0f172a" stroke-width="1.6" stroke-linecap="round">
    <line x1="20" y1="16" x2="20" y2="24" />
    <line x1="16" y1="20" x2="24" y2="20" />
  </g>
</svg>
`;

// 3. Subtract (-) Selection Cursor (Shift held or 'subtract' mode) - discrete small minus with white halo
const SVG_ARROW_SUBTRACT = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="${ARROW_PATH}" fill="#0f172a" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
  <!-- Crisp discrete minus (-) next to arrow -->
  <line x1="16" y1="20" x2="24" y2="20" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
  <line x1="16" y1="20" x2="24" y2="20" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" />
</svg>
`;

// 4. Toggle (±) Selection Cursor (Ctrl+Shift held or 'toggle' mode) - discrete small plus-minus with white halo
const SVG_ARROW_TOGGLE = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="${ARROW_PATH}" fill="#0f172a" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" />
  <!-- Crisp discrete ± next to arrow -->
  <g stroke="#ffffff" stroke-width="3" stroke-linecap="round">
    <line x1="20" y1="15" x2="20" y2="21" />
    <line x1="17" y1="18" x2="23" y2="18" />
    <line x1="17" y1="24" x2="23" y2="24" />
  </g>
  <g stroke="#0f172a" stroke-width="1.5" stroke-linecap="round">
    <line x1="20" y1="15" x2="20" y2="21" />
    <line x1="17" y1="18" x2="23" y2="18" />
    <line x1="17" y1="24" x2="23" y2="24" />
  </g>
</svg>
`;

// Pointer with discrete glyphs
const HAND_PATH = `M 8 2 C 7 2 6 3 6 4 L 6 12 L 5 12 C 3.5 12 2.5 13 2.5 14.5 C 2.5 17 5 21 8 24 L 14 24 C 17 24 18 22 18 19 L 18 11 C 18 10 17 9 16 9 C 15.5 9 15 9.3 14.5 9.7 C 14.2 9.3 13.6 9 13 9 C 12.5 9 12 9.2 11.5 9.5 C 11.2 9.2 10.6 9 10 9 L 10 4 C 10 3 9 2 8 2 Z`;

const SVG_POINTER_ADD = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="${HAND_PATH}" fill="#ffffff" stroke="#0f172a" stroke-width="1.4" stroke-linejoin="round" />
  <g stroke="#ffffff" stroke-width="3" stroke-linecap="round">
    <line x1="21" y1="15" x2="21" y2="23" />
    <line x1="17" y1="19" x2="25" y2="19" />
  </g>
  <g stroke="#0f172a" stroke-width="1.6" stroke-linecap="round">
    <line x1="21" y1="15" x2="21" y2="23" />
    <line x1="17" y1="19" x2="25" y2="19" />
  </g>
</svg>
`;

const SVG_POINTER_SUBTRACT = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="${HAND_PATH}" fill="#ffffff" stroke="#0f172a" stroke-width="1.4" stroke-linejoin="round" />
  <line x1="17" y1="19" x2="25" y2="19" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
  <line x1="17" y1="19" x2="25" y2="19" stroke="#0f172a" stroke-width="1.6" stroke-linecap="round" />
</svg>
`;

const SVG_POINTER_TOGGLE = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <path d="${HAND_PATH}" fill="#ffffff" stroke="#0f172a" stroke-width="1.4" stroke-linejoin="round" />
  <g stroke="#ffffff" stroke-width="3" stroke-linecap="round">
    <line x1="21" y1="14" x2="21" y2="20" />
    <line x1="18" y1="17" x2="24" y2="17" />
    <line x1="18" y1="23" x2="24" y2="23" />
  </g>
  <g stroke="#0f172a" stroke-width="1.5" stroke-linecap="round">
    <line x1="21" y1="14" x2="21" y2="20" />
    <line x1="18" y1="17" x2="24" y2="17" />
    <line x1="18" y1="23" x2="24" y2="23" />
  </g>
</svg>
`;

// Zoom (Lupa) Cursor
const SVG_ZOOM = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <circle cx="12" cy="12" r="7" fill="none" stroke="#0f172a" stroke-width="2" />
  <circle cx="12" cy="12" r="7" fill="none" stroke="#ffffff" stroke-width="3.6" stroke-opacity="0.6" />
  <circle cx="12" cy="12" r="7" fill="none" stroke="#0f172a" stroke-width="2" />
  <line x1="17.2" y1="17.2" x2="25" y2="25" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" />
  <line x1="17.2" y1="17.2" x2="25" y2="25" stroke="#0f172a" stroke-width="2.6" stroke-linecap="round" />
</svg>
`;

export const CURSORS = {
  default: svgToCursorUrl(SVG_ARROW, 2, 2, 'default'),
  zoom: svgToCursorUrl(SVG_ZOOM, 12, 12, 'ns-resize'),
  selectAdd: svgToCursorUrl(SVG_ARROW_ADD, 2, 2, 'crosshair'),
  selectSubtract: svgToCursorUrl(SVG_ARROW_SUBTRACT, 2, 2, 'crosshair'),
  selectToggle: svgToCursorUrl(SVG_ARROW_TOGGLE, 2, 2, 'crosshair'),
  pointerAdd: svgToCursorUrl(SVG_POINTER_ADD, 6, 2, 'pointer'),
  pointerSubtract: svgToCursorUrl(SVG_POINTER_SUBTRACT, 6, 2, 'pointer'),
  pointerToggle: svgToCursorUrl(SVG_POINTER_TOGGLE, 6, 2, 'pointer'),
};

export type SelectionModeType = 'replace' | 'add' | 'subtract' | 'toggle';

export function getEffectiveSelectionMode(
  ctrlKey: boolean,
  shiftKey: boolean,
  mobileSelMode: SelectionModeType
): SelectionModeType {
  if (ctrlKey && shiftKey) return 'toggle';
  if (ctrlKey) return 'add';
  if (shiftKey) return 'subtract';
  return mobileSelMode;
}

export function getCanvasCursor(params: {
  mode: string;
  navMode: string;
  isHoverInteractive: boolean;
  selMode: SelectionModeType;
  isDraggingBox?: boolean;
  isDraggingNav?: boolean;
}): string {
  const {
    mode,
    navMode,
    isHoverInteractive,
    selMode,
    isDraggingBox,
    isDraggingNav,
  } = params;

  // 1. Drawing / Adding elements / Grid tool
  if (mode === 'addBar' || mode === 'addPanel' || mode === 'grid') {
    if (isHoverInteractive) return 'pointer';
    return 'crosshair';
  }

  // 2. Active dragging states
  if (isDraggingBox) {
    if (selMode === 'add') return CURSORS.selectAdd;
    if (selMode === 'subtract') return CURSORS.selectSubtract;
    if (selMode === 'toggle') return CURSORS.selectToggle;
    return 'default';
  }

  if (isDraggingNav) {
    if (navMode === 'zoom') return CURSORS.zoom;
    if (navMode === 'pan') return 'grabbing';
    if (navMode === 'orbit') return 'grabbing';
  }

  // 3. Hovering over a clickable object (Node, Bar, ViewCube) - only when in boxSelect or orbit mode without dragging
  if (isHoverInteractive && (navMode === 'boxSelect' || navMode === 'orbit')) {
    if (mode === 'select') {
      if (selMode === 'add') return CURSORS.pointerAdd;
      if (selMode === 'subtract') return CURSORS.pointerSubtract;
      if (selMode === 'toggle') return CURSORS.pointerToggle;
    }
    return 'pointer';
  }

  // 4. Navigation Modes
  if (navMode === 'boxSelect') {
    if (selMode === 'add') return CURSORS.selectAdd;
    if (selMode === 'subtract') return CURSORS.selectSubtract;
    if (selMode === 'toggle') return CURSORS.selectToggle;
    return 'default';
  }

  if (navMode === 'pan') {
    return 'grab';
  }

  if (navMode === 'zoom') {
    return CURSORS.zoom;
  }

  // Orbit mode (default fallback when no toggle active)
  if (navMode === 'orbit') {
    if (selMode === 'add') return CURSORS.selectAdd;
    if (selMode === 'subtract') return CURSORS.selectSubtract;
    if (selMode === 'toggle') return CURSORS.selectToggle;
    return 'grab';
  }

  return 'default';
}
