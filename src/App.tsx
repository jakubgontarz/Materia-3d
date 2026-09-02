import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RenderEngine3D, ViewCubeHit, GraphicsMode } from './render/engine3d';
import { drawScene3D, SceneRenderOptions, getPanelCorners } from './render/scene3d';
import {
  Node3D,
  Element3D,
  Section,
  Material,
  SolverResult3D,
  AnalysisSettings,
  Panel3D,
  PanelShape,
  ConstructionLine3D,
  DimensionLine3D,
  ToolMode,
} from './fem/types';
import { INITIAL_SECTIONS, INITIAL_MATERIALS } from './fem/catalogs';
import { generate3DPortalFrame } from './fem/templates';
import { solveLinearStatic3D, solveStability3D, solveModal3D } from './fem/solver3d';
import {
  LoadCase3D,
  LoadNature,
  EurocodeCategory,
  LoadCombination3D,
  MultiCaseResults3D,
  INITIAL_DEFAULT_LOAD_CASE,
  getDefaultPsiAndGammas,
  getNatureLabel,
  solveAllLoadCasesAndCombinations3D,
  createModelForLoadCase,
} from './fem/loadcases';
import { Toolbar, ICONS } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { OptionsModal, APP_ACCENTS } from './components/OptionsModal';
import { AboutModal } from './components/AboutModal';
import { TemplatesModal } from './components/TemplatesModal';
import { SelectByModal } from './components/SelectByModal';
import {
  SaveLocalModal,
  LoadLocalModal,
  ExportJsonModal,
  StoredModelRecord,
  getStoredModelsList,
  saveStoredModelsList,
} from './components/StorageModals';
import {
  getCanvasCursor,
  getEffectiveSelectionMode,
  SelectionModeType,
} from './render/cursors';

const TOGGLE_ICONS = {
  nodeNumbers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="12" r="3" fill="currentColor" stroke="none" />
      <text x="11" y="16" fontSize="12" fontWeight="800" fill="currentColor" stroke="none" fontFamily="sans-serif">W</text>
    </svg>
  ),
  elementNumbers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="18" x2="11" y2="6" />
      <text x="12" y="16" fontSize="12" fontWeight="800" fill="currentColor" stroke="none" fontFamily="sans-serif">P</text>
    </svg>
  ),
  sectionNames: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h14M5 20h14M12 4v16" />
      <path d="M7 4v2M17 4v2M7 20v-2M17 20v-2" />
    </svg>
  ),
  materialNames: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  supports: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4l-6 10h12z" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <line x1="7" y1="18" x2="4" y2="22" />
      <line x1="12" y1="18" x2="9" y2="22" />
      <line x1="17" y1="18" x2="14" y2="22" />
    </svg>
  ),
  profileSketches: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  localAxes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h14" />
      <path d="M4 20V6" />
      <path d="M4 20l8-8" />
      <path d="M15 18l3 2-3 2" />
      <path d="M2 9l2-3 2 3" />
    </svg>
  ),
  hingeLabels: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="14" r="3" />
      <line x1="2" y1="14" x2="3" y2="14" />
      <line x1="9" y1="14" x2="22" y2="14" />
      <text x="11" y="9" fontSize="9" fontWeight="800" fill="currentColor" stroke="none" fontFamily="sans-serif">Ry</text>
    </svg>
  ),
  loads: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v13" />
      <path d="M7 11l5 5 5-5" />
      <line x1="4" y1="20" x2="20" y2="20" />
    </svg>
  ),
  loadValues: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4v12" />
      <path d="M3 11l3 4 3-4" />
      <text x="11" y="16" fontSize="12" fontWeight="800" fill="currentColor" stroke="none" fontFamily="sans-serif">#</text>
    </svg>
  ),
  panels: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="4 6 18 4 20 18 6 20" />
    </svg>
  ),
};

const INITIAL_GROUPS: import('./fem/types').ElementGroupDef[] = [];

interface HistoryState {
  nodes: Node3D[];
  elements: Element3D[];
  panels: Panel3D[];
  sections: Section[];
  materials: Material[];
  groups?: import('./fem/types').ElementGroupDef[];
  analysisSettings: AnalysisSettings;
  constructionLines?: ConstructionLine3D[];
  dimensionLines?: DimensionLine3D[];
}

interface UserPreferences {
  theme?: 'light' | 'dark';
  accent?: string;
  graphicsMode?: GraphicsMode;
  showAxes?: boolean;
  includeSelfWeight?: boolean;

  showNodeNumbers?: boolean;
  showElementNumbers?: boolean;
  showSectionNames?: boolean;
  showMaterialNames?: boolean;
  showSupports?: boolean;
  showPanels?: boolean;
  showProfileSketches?: boolean;
  showLocalAxes?: boolean;
  showHingeLabels?: boolean;
  showLoads?: boolean;
  showLoadValues?: boolean;
  showDimensions?: boolean;

  showDeform?: boolean;
  showMy?: boolean;
  showMz?: boolean;
  showMx?: boolean;
  showVy?: boolean;
  showVz?: boolean;
  showN?: boolean;
  showStress?: boolean;
  showReactions?: boolean;
  deformScaleMult?: number;
  diagramScaleMult?: number;
  diagramLabelMode?: 'none' | 'minmax' | 'all';

  snapSize?: number;
  snapEnabled?: boolean;
  showGrid?: boolean;
  mergeTolerance?: number;

  allowNewNodesInBarMode?: boolean;
  drawConstructionGrid?: boolean;
  drawOuterDimensionLines?: boolean;
  momentsAsArcs?: boolean;
}

const PREFS_KEY = 'materia3d_user_preferences';

function loadUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to load user preferences from localStorage', err);
  }
  return {};
}

function saveUserPreferences(prefs: UserPreferences) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn('Failed to save user preferences to localStorage', err);
  }
}

function isTextEditingElement(el: Element | null): boolean {
  if (!el) return false;
  const tagName = el.tagName.toUpperCase();
  if (tagName === 'TEXTAREA') return true;
  if (tagName === 'INPUT') {
    const inputEl = el as HTMLInputElement;
    const type = (inputEl.type || 'text').toLowerCase();
    return ['text', 'number', 'password', 'search', 'tel', 'url'].includes(type);
  }
  return false;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawSegmentDimensionPoints(
  ctx: CanvasRenderingContext2D,
  pa: { x: number; y: number },
  pb: { x: number; y: number },
  lengthMeters: number,
  color = '#7c3aed'
) {
  if (!pa || !pb) return;
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const segLen = Math.hypot(dx, dy) || 1;
  if (segLen < 12) return;

  const ux = dx / segLen;
  const uy = dy / segLen;
  const nx = -uy;
  const ny = ux;

  const offset = 24;
  const oa = { x: pa.x + nx * offset, y: pa.y + ny * offset };
  const ob = { x: pb.x + nx * offset, y: pb.y + ny * offset };

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  // Extension lines from points to dimension line
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(oa.x, oa.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pb.x, pb.y);
  ctx.lineTo(ob.x, ob.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Main dimension line
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(oa.x, oa.y);
  ctx.lineTo(ob.x, ob.y);
  ctx.stroke();

  // 45° diagonal ticks at endpoints
  const tick = 4;
  const tx = (ux - nx) * tick;
  const ty = (uy - ny) * tick;
  ctx.beginPath();
  ctx.moveTo(oa.x - tx, oa.y - ty);
  ctx.lineTo(oa.x + tx, oa.y + ty);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ob.x - tx, ob.y - ty);
  ctx.lineTo(ob.x + tx, ob.y + ty);
  ctx.stroke();

  // Length badge
  const midx = (oa.x + ob.x) / 2;
  const midy = (oa.y + ob.y) / 2;
  const label = `${lengthMeters.toFixed(2)} m`;
  ctx.font = '11px monospace, "SF Mono", Consolas';
  const w = ctx.measureText(label).width;
  const padH = 5;
  const h = 16;

  ctx.fillStyle = color;
  roundRect(ctx, midx - w / 2 - padH, midy - h / 2, w + 2 * padH, h, 4);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, midx, midy);
  ctx.restore();
}

function drawNodeCoordTip(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number },
  label: string,
  color = '#7c3aed'
) {
  ctx.save();
  ctx.font = '11.5px monospace, "SF Mono", Consolas';
  const w = ctx.measureText(label).width;
  const padH = 6;
  const h = 18;
  const gap = 24;
  const cx = p.x;
  const cy = p.y - gap - h;
  const bx = cx - w / 2 - padH;
  const by = cy;

  ctx.fillStyle = color;
  roundRect(ctx, bx, by, w + 2 * padH, h, 4);
  ctx.fill();

  // Pointer tip pointing down to node
  ctx.beginPath();
  ctx.moveTo(cx - 5, by + h);
  ctx.lineTo(cx, p.y - 7);
  ctx.lineTo(cx + 5, by + h);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, by + h / 2);
  ctx.restore();
}

function drawSplitPreview(
  ctx: CanvasRenderingContext2D,
  engine: RenderEngine3D,
  nodes: Node3D[],
  elements: Element3D[],
  selectedElemIds: number[],
  splitMode: 'single' | 'multi',
  splitT: number,
  splitN: number
) {
  if (selectedElemIds.length === 0) return;

  ctx.save();

  selectedElemIds.forEach((eid) => {
    const el = elements.find((e) => e.id === eid);
    if (!el) return;
    const n1 = nodes.find((n) => n.id === el.n1);
    const n2 = nodes.find((n) => n.id === el.n2);
    if (!n1 || !n2) return;

    const A: [number, number, number] = [n1.x, n1.y, n1.z];
    const B: [number, number, number] = [n2.x, n2.y, n2.z];
    const totalLength = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    if (totalLength < 1e-5) return;

    const pA = engine.project(A);
    const pB = engine.project(B);

    const numParts = splitMode === 'single' ? 2 : Math.max(2, Math.min(50, Math.round(splitN || 2)));
    const tValues: number[] = [0];

    if (splitMode === 'single') {
      const safeT = Math.max(0.01, Math.min(0.99, Number.isFinite(splitT) ? splitT : 0.5));
      tValues.push(safeT);
    } else {
      for (let i = 1; i < numParts; i++) {
        tValues.push(i / numParts);
      }
    }
    tValues.push(1);

    // Calculate all division points in 3D and 2D
    const pts3D: [number, number, number][] = tValues.map((t) => [
      A[0] + (B[0] - A[0]) * t,
      A[1] + (B[1] - A[1]) * t,
      A[2] + (B[2] - A[2]) * t,
    ]);
    const pts2D = pts3D.map((p) => engine.project(p));

    // Palettes for segment visual differentiation
    const segmentColors = ['#2563eb', '#059669', '#d97706', '#9333ea', '#0891b2', '#e11d48'];
    const segmentTextColors = ['#93c5fd', '#6ee7b7', '#fcd34d', '#d8b4fe', '#67e8f9', '#fda4af'];

    // 1. Draw glowing segment lines and length badges
    for (let s = 0; s < numParts; s++) {
      const sp1 = pts2D[s];
      const sp2 = pts2D[s + 1];
      const segColor = segmentColors[s % segmentColors.length];
      const segTextColor = segmentTextColors[s % segmentColors.length];

      // Segment thick accent glow
      ctx.save();
      ctx.strokeStyle = segColor;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(sp1.x, sp1.y);
      ctx.lineTo(sp2.x, sp2.y);
      ctx.stroke();

      // Inner dashed white line for high contrast
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sp1.x, sp1.y);
      ctx.lineTo(sp2.x, sp2.y);
      ctx.stroke();
      ctx.restore();

      // Segment length label in the middle of each segment
      const segLen3D = (tValues[s + 1] - tValues[s]) * totalLength;
      const mid2D = { x: (sp1.x + sp2.x) / 2, y: (sp1.y + sp2.y) / 2 };
      const segPixLen = Math.hypot(sp2.x - sp1.x, sp2.y - sp1.y);

      // Normal vector in 2D
      let nx = -(sp2.y - sp1.y);
      let ny = sp2.x - sp1.x;
      const nlen = Math.hypot(nx, ny) || 1;
      nx /= nlen;
      ny /= nlen;

      // Draw segment badge if segment is long enough
      if (segPixLen >= 24) {
        ctx.save();
        const segPercent = Math.round((tValues[s + 1] - tValues[s]) * 100);
        const labelText =
          splitMode === 'single'
            ? `L${s + 1} = ${segLen3D.toFixed(2)} m (${segPercent}%)`
            : `${segLen3D.toFixed(2)} m`;

        ctx.font = '10.5px monospace, "SF Mono", Consolas';
        const tw = ctx.measureText(labelText).width;
        const padX = 6;
        const bh = 17;
        const offsetDist = 16;
        const bx = mid2D.x + nx * offsetDist - tw / 2 - padX;
        const by = mid2D.y + ny * offsetDist - bh / 2;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = segColor;
        ctx.lineWidth = 1.4;
        roundRect(ctx, bx, by, tw + 2 * padX, bh, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = segTextColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, mid2D.x + nx * offsetDist, mid2D.y + ny * offsetDist);
        ctx.restore();
      }
    }

    // 2. Draw cut ticks (perpendicular cut lines) and new node markers at all intermediate split points
    for (let i = 1; i < pts2D.length - 1; i++) {
      const p = pts2D[i];
      const pPrev = pts2D[i - 1];
      const pNext = pts2D[i + 1];

      // Bar vector at cut point
      const barDx = pNext.x - pPrev.x;
      const barDy = pNext.y - pPrev.y;
      const barLen = Math.hypot(barDx, barDy) || 1;
      const perpX = -barDy / barLen;
      const perpY = barDx / barLen;

      ctx.save();
      // Perpendicular tick cut line
      const tickHalf = 11;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(p.x - perpX * tickHalf, p.y - perpY * tickHalf);
      ctx.lineTo(p.x + perpX * tickHalf, p.y + perpY * tickHalf);
      ctx.stroke();

      // Node preview marker (outer ring + center dot)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      // For single split: detailed tooltip with 3D coordinate of the new node
      if (splitMode === 'single' && selectedElemIds.length <= 2) {
        const pt3D = pts3D[i];
        const tipText = `Nowy węzeł (${pt3D[0].toFixed(2)}, ${pt3D[1].toFixed(2)}, ${pt3D[2].toFixed(2)}) m`;
        drawNodeCoordTip(ctx, p, tipText, '#ef4444');
      } else if (splitMode === 'multi' && numParts <= 8 && selectedElemIds.length === 1) {
        // Multi split node index badge
        ctx.save();
        ctx.font = '9.5px monospace, "SF Mono", Consolas';
        const nodeBadge = `+W${i}`;
        const nbw = ctx.measureText(nodeBadge).width;
        const nbh = 14;
        const nby = p.y - 18;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        roundRect(ctx, p.x - nbw / 2 - 3, nby - nbh / 2, nbw + 6, nbh, 3);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(nodeBadge, p.x, nby);
        ctx.restore();
      }
    }

    // 3. Start & End node orientation markers when 1 or 2 bars are selected
    if (selectedElemIds.length <= 2) {
      ctx.save();
      ctx.font = '10px monospace, "SF Mono", Consolas';

      const labelA = `W${n1.id} (Początek)`;
      const labelB = `W${n2.id} (Koniec)`;
      const twA = ctx.measureText(labelA).width;
      const twB = ctx.measureText(labelB).width;

      const offsetNear = 18;
      // Start node tag
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;
      roundRect(ctx, pA.x - twA / 2 - 4, pA.y + offsetNear - 7, twA + 8, 15, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#93c5fd';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelA, pA.x, pA.y + offsetNear + 0.5);

      // End node tag
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      roundRect(ctx, pB.x - twB / 2 - 4, pB.y + offsetNear - 7, twB + 8, 15, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#6ee7b7';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelB, pB.x, pB.y + offsetNear + 0.5);

      ctx.restore();
    }
  });

  ctx.restore();
}

function drawTransientOverlays(
  ctx: CanvasRenderingContext2D,
  engine: RenderEngine3D,
  nodes: Node3D[],
  elements: Element3D[],
  panels: Panel3D[],
  mode: ToolMode,
  panelShape: PanelShape,
  panelPoints: number[],
  barStartNodeId: number | null,
  lastPlacedNodeId: number | null,
  lastDrawnElemId: number | null,
  mousePos: { px: number; py: number } | null,
  gridPlane: 'XY' | 'XZ' | 'YZ',
  gridOffset: number,
  snapEnabled: boolean,
  snapSize: number,
  hoverNodeId: number | null,
  accentColor: string,
  isTouch: boolean,
  selectedNodeIds: number[] = [],
  selectedElemIds: number[] = [],
  selectedPanelIds: number[] = [],
  activeTransformMode: 'none' | 'move' | 'rotate' | 'mirror' | 'scale' = 'none',
  transformWithCopy = false,
  transformConnect = false,
  transformRepeat = 1,
  moveDx = 0,
  moveDy = 0,
  moveDz = 0,
  rotateCenter: [number, number, number] = [0, 0, 0],
  rotateAxis: 'X' | 'Y' | 'Z' = 'Z',
  rotateAngleDeg = 90,
  mirrorPoint: [number, number, number] = [0, 0, 0],
  mirrorPlane: 'XY' | 'YZ' | 'XZ' = 'XZ',
  scaleCenter: [number, number, number] = [0, 0, 0],
  scaleFactor = 1.5,
  pickMoveVector: { active: boolean; step: 1 | 2; p1: [number, number, number] | null } = { active: false, step: 1, p1: null },
  pickTransformPoint: { active: boolean; target: 'rotateCenter' | 'mirrorPoint' | 'scaleCenter' | null } = { active: false, target: null },
  splitFormOpen = false,
  splitMode: 'single' | 'multi' = 'single',
  splitT = 0.5,
  splitN = 2,
  linesSubMode: 'construction' | 'dimension' = 'construction',
  lineStartPoint: [number, number, number] | null = null,
  activeGridAxis: 'X' | 'Y' | 'Z' = 'X',
  drawConstructionGrid = true,
  constructionPoints: [number, number, number][] = []
) {
  const getSnappedPt = (mx: number, my: number): [number, number, number] => {
    if (hoverNodeId != null) {
      const hn = nodes.find((n) => n.id === hoverNodeId);
      if (hn) return [hn.x, hn.y, hn.z];
    }
    if (drawConstructionGrid && constructionPoints && constructionPoints.length > 0) {
      let closestCP: [number, number, number] | null = null;
      let minCPDist = 14;
      for (const cp of constructionPoints) {
        const proj = engine.project(cp);
        if (proj.visible) {
          const d = Math.hypot(proj.x - mx, proj.y - my);
          if (d < minCPDist) {
            minCPDist = d;
            closestCP = cp;
          }
        }
      }
      if (closestCP) return closestCP;
    }
    const pt = engine.unprojectToPlane(mx, my, gridPlane, gridOffset);
    let x = pt[0], y = pt[1], z = pt[2];
    if (snapEnabled) {
      if (gridPlane === 'XY') {
        x = Math.round(x / snapSize) * snapSize;
        y = Math.round(y / snapSize) * snapSize;
        z = gridOffset;
      } else if (gridPlane === 'XZ') {
        x = Math.round(x / snapSize) * snapSize;
        y = gridOffset;
        z = Math.round(z / snapSize) * snapSize;
      } else if (gridPlane === 'YZ') {
        x = gridOffset;
        y = Math.round(y / snapSize) * snapSize;
        z = Math.round(z / snapSize) * snapSize;
      }
    }
    return [x, y, z];
  };

  // 0. Draw Transform Ghosts, Vector & Point Picking Guide Line
  drawTransformPreviewAndGuide(
    ctx,
    engine,
    nodes,
    elements,
    panels,
    selectedNodeIds,
    selectedElemIds,
    selectedPanelIds,
    activeTransformMode,
    transformWithCopy,
    transformConnect,
    transformRepeat,
    moveDx,
    moveDy,
    moveDz,
    rotateCenter,
    rotateAxis,
    rotateAngleDeg,
    mirrorPoint,
    mirrorPlane,
    scaleCenter,
    scaleFactor,
    pickMoveVector,
    pickTransformPoint,
    mousePos,
    gridPlane,
    gridOffset,
    snapEnabled,
    snapSize,
    hoverNodeId,
    constructionPoints
  );

  // 0b. Draw Split Preview (single & multi split on selected elements)
  if (splitFormOpen && selectedElemIds.length > 0) {
    drawSplitPreview(
      ctx,
      engine,
      nodes,
      elements,
      selectedElemIds,
      splitMode,
      splitT,
      splitN
    );
  }
  // 1. Draw dimension line for last drawn element if exists
  if (lastDrawnElemId != null) {
    const el = elements.find((e) => e.id === lastDrawnElemId);
    if (el) {
      const n1 = nodes.find((n) => n.id === el.n1);
      const n2 = nodes.find((n) => n.id === el.n2);
      if (n1 && n2) {
        const pa = engine.project([n1.x, n1.y, n1.z]);
        const pb = engine.project([n2.x, n2.y, n2.z]);
        const len = Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z);
        drawSegmentDimensionPoints(ctx, pa, pb, len, accentColor || '#2563eb');
      }
    }
  }

  // 2. Draw node coordinate tip for last placed node if exists
  if (lastPlacedNodeId != null) {
    const n = nodes.find((node) => node.id === lastPlacedNodeId);
    if (n) {
      const p = engine.project([n.x, n.y, n.z]);
      const label = `W${n.id} (${n.x.toFixed(2)}, ${n.y.toFixed(2)}, ${n.z.toFixed(2)}) m`;
      drawNodeCoordTip(ctx, p, label, '#16a34a');
    }
  }

  // 3. Mode 'addBar' preview: guide line, dimension line, and target node tip
  if (mode === 'addBar') {
    if (barStartNodeId != null) {
      const n1 = nodes.find((n) => n.id === barStartNodeId);
      if (n1) {
        const pa = engine.project([n1.x, n1.y, n1.z]);
        let targetPt: [number, number, number] = [n1.x, n1.y, n1.z];
        let targetNodeId: number | null = null;

        if (hoverNodeId != null) {
          const hn = nodes.find((n) => n.id === hoverNodeId);
          if (hn) {
            targetPt = [hn.x, hn.y, hn.z];
            targetNodeId = hn.id;
          }
        } else if (mousePos) {
          targetPt = getSnappedPt(mousePos.px, mousePos.py);
        }

        const pb = engine.project(targetPt);
        const dist3D = Math.hypot(targetPt[0] - n1.x, targetPt[1] - n1.y, targetPt[2] - n1.z);
        const pixDist = Math.hypot(pb.x - pa.x, pb.y - pa.y);

        if (pixDist >= 6 && dist3D >= 0.001) {
          // A) Dashed guide line (prowadnica)
          ctx.save();
          ctx.strokeStyle = '#ea580c';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
          ctx.restore();

          // B) Dimension line with length badge
          drawSegmentDimensionPoints(ctx, pa, pb, dist3D, '#ea580c');

          // C) Target coordinate tip
          const tipLabel = targetNodeId != null
            ? `W${targetNodeId} (${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`
            : `(${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`;

          drawNodeCoordTip(ctx, pb, tipLabel, '#7c3aed');
        }
      }
    } else if (mousePos) {
      // barStartNodeId is null, show coordinate tip for current cursor position in addBar mode
      let targetPt: [number, number, number] = [0, 0, 0];
      let targetNodeId: number | null = null;
      if (hoverNodeId != null) {
        const hn = nodes.find((n) => n.id === hoverNodeId);
        if (hn) {
          targetPt = [hn.x, hn.y, hn.z];
          targetNodeId = hn.id;
        }
      } else {
        targetPt = getSnappedPt(mousePos.px, mousePos.py);
      }
      const pb = engine.project(targetPt);
      const tipLabel = targetNodeId != null
        ? `W${targetNodeId} (${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`
        : `(${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`;
      drawNodeCoordTip(ctx, pb, tipLabel, '#2563eb');
    }
  }

  // 4. Mode 'addPanel' preview
  if (mode === 'addPanel' && mousePos) {
    let targetPt: [number, number, number] = [0, 0, 0];
    let targetNodeId: number | null = null;
    if (hoverNodeId != null) {
      const hn = nodes.find((n) => n.id === hoverNodeId);
      if (hn) {
        targetPt = [hn.x, hn.y, hn.z];
        targetNodeId = hn.id;
      }
    } else {
      targetPt = getSnappedPt(mousePos.px, mousePos.py);
    }

    const curPts = panelPoints || [];
    const pb = engine.project(targetPt);

    if (curPts.length === 0) {
      const tipLabel = targetNodeId != null
        ? `W${targetNodeId} (${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`
        : `(${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`;
      drawNodeCoordTip(ctx, pb, tipLabel, '#0891b2');
    } else if (curPts.length === 1) {
      const n1 = nodes.find((n) => n.id === curPts[0]);
      if (n1) {
        const pa = engine.project([n1.x, n1.y, n1.z]);
        const dist3D = Math.hypot(targetPt[0] - n1.x, targetPt[1] - n1.y, targetPt[2] - n1.z);
        if (dist3D >= 0.001) {
          ctx.save();
          ctx.strokeStyle = '#0891b2';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.stroke();
          ctx.restore();

          drawSegmentDimensionPoints(ctx, pa, pb, dist3D, '#0891b2');
          const tipLabel = targetNodeId != null
            ? `W${targetNodeId} (${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`
            : `(${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`;
          drawNodeCoordTip(ctx, pb, tipLabel, '#0891b2');
        }
      }
    } else if (curPts.length >= 2) {
      const n1 = nodes.find((n) => n.id === curPts[0]);
      const n2 = nodes.find((n) => n.id === curPts[1]);
      if (n1 && n2) {
        const pa = engine.project([n1.x, n1.y, n1.z]);
        const pb2 = engine.project([n2.x, n2.y, n2.z]);

        if (panelShape === 'triangle') {
          ctx.save();
          ctx.fillStyle = 'rgba(8, 145, 178, 0.2)';
          ctx.strokeStyle = '#0891b2';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.lineTo(pb2.x, pb2.y);
          ctx.lineTo(pb.x, pb.y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          const tipLabel = targetNodeId != null
            ? `W${targetNodeId} (${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`
            : `(${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`;
          drawNodeCoordTip(ctx, pb, tipLabel, '#0891b2');
        } else {
          // Rectangle
          const ux = n2.x - n1.x;
          const uy = n2.y - n1.y;
          const uz = n2.z - n1.z;
          const uLenSq = ux * ux + uy * uy + uz * uz;
          if (uLenSq > 1e-8) {
            const vx = targetPt[0] - n1.x;
            const vy = targetPt[1] - n1.y;
            const vz = targetPt[2] - n1.z;
            const dot = (vx * ux + vy * uy + vz * uz) / uLenSq;
            const wx = vx - dot * ux;
            const wy = vy - dot * uy;
            const wz = vz - dot * uz;

            const v3 = [n2.x + wx, n2.y + wy, n2.z + wz] as [number, number, number];
            const v4 = [n1.x + wx, n1.y + wy, n1.z + wz] as [number, number, number];
            const pc = engine.project(v3);
            const pd = engine.project(v4);

            ctx.save();
            ctx.fillStyle = 'rgba(8, 145, 178, 0.2)';
            ctx.strokeStyle = '#0891b2';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb2.x, pb2.y);
            ctx.lineTo(pc.x, pc.y);
            ctx.lineTo(pd.x, pd.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            const tipLabel = targetNodeId != null
              ? `W${targetNodeId} (${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`
              : `(${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`;
            drawNodeCoordTip(ctx, pb, tipLabel, '#0891b2');
          }
        }
      }
    }
  }

  // 5. Mode 'grid' tip preview
  if (mode === 'grid' && mousePos) {
    if (hoverNodeId != null) {
      const hn = nodes.find((n) => n.id === hoverNodeId);
      if (hn) {
        const pb = engine.project([hn.x, hn.y, hn.z]);
        const lvl = gridPlane === 'XY' ? hn.z : gridPlane === 'XZ' ? hn.y : hn.x;
        const coordName = gridPlane === 'XY' ? 'Z' : gridPlane === 'XZ' ? 'Y' : 'X';
        drawNodeCoordTip(ctx, pb, `W${hn.id} (${hn.x.toFixed(2)}, ${hn.y.toFixed(2)}, ${hn.z.toFixed(2)}) m`, '#8b5cf6');
      }
    } else {
      const pt = engine.unprojectToPlane(mousePos.px, mousePos.py, gridPlane, gridOffset);
      let x = pt[0];
      let y = pt[1];
      let z = pt[2];
      if (snapEnabled) {
        if (gridPlane === 'XY') {
          x = Math.round(x / snapSize) * snapSize;
          y = Math.round(y / snapSize) * snapSize;
          z = gridOffset;
        } else if (gridPlane === 'XZ') {
          x = Math.round(x / snapSize) * snapSize;
          y = gridOffset;
          z = Math.round(z / snapSize) * snapSize;
        } else if (gridPlane === 'YZ') {
          x = gridOffset;
          y = Math.round(y / snapSize) * snapSize;
          z = Math.round(z / snapSize) * snapSize;
        }
      }
      const pb = engine.project([x, y, z]);
      const coordName = gridPlane === 'XY' ? 'Z' : gridPlane === 'XZ' ? 'Y' : 'X';
      drawNodeCoordTip(ctx, pb, `Siatka ${gridPlane} (${coordName} = ${gridOffset.toFixed(2)} m)`, '#8b5cf6');
    }
  }

  // 6. Mode 'lines' preview
  if (mode === 'lines' && mousePos) {
    let targetPt: [number, number, number] = [0, 0, 0];
    let targetNodeId: number | null = null;
    if (hoverNodeId != null) {
      const hn = nodes.find((n) => n.id === hoverNodeId);
      if (hn) {
        targetPt = [hn.x, hn.y, hn.z];
        targetNodeId = hn.id;
      }
    } else {
      const pt = engine.unprojectToPlane(mousePos.px, mousePos.py, gridPlane, gridOffset);
      let x = pt[0];
      let y = pt[1];
      let z = pt[2];
      if (snapEnabled) {
        if (gridPlane === 'XY') {
          x = Math.round(x / snapSize) * snapSize;
          y = Math.round(y / snapSize) * snapSize;
          z = gridOffset;
        } else if (gridPlane === 'XZ') {
          x = Math.round(x / snapSize) * snapSize;
          y = gridOffset;
          z = Math.round(z / snapSize) * snapSize;
        } else if (gridPlane === 'YZ') {
          x = gridOffset;
          y = Math.round(y / snapSize) * snapSize;
          z = Math.round(z / snapSize) * snapSize;
        }
      }
      targetPt = [x, y, z];
    }

    const pb = engine.project(targetPt);
    const coordVal = activeGridAxis === 'X' ? targetPt[0] : activeGridAxis === 'Y' ? targetPt[1] : targetPt[2];
    const tipLabel = `Dodaj współrzędną ${activeGridAxis} = ${coordVal.toFixed(2)} m`;
    drawNodeCoordTip(ctx, pb, tipLabel, '#2563eb');

    ctx.save();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pb.x - 7, pb.y);
    ctx.lineTo(pb.x + 7, pb.y);
    ctx.moveTo(pb.x, pb.y - 7);
    ctx.lineTo(pb.x, pb.y + 7);
    ctx.stroke();
    ctx.restore();
  }
}

function transformPoint(
  p: [number, number, number],
  mode: 'move' | 'rotate' | 'mirror' | 'scale',
  params: {
    moveDx: number; moveDy: number; moveDz: number;
    rotateCenter: [number, number, number]; rotateAxis: 'X' | 'Y' | 'Z'; rotateAngleDeg: number;
    mirrorPoint: [number, number, number]; mirrorPlane: 'XY' | 'YZ' | 'XZ';
    scaleCenter: [number, number, number]; scaleFactor: number;
  },
  step: number
): [number, number, number] {
  let [x, y, z] = p;
  if (mode === 'move') {
    return [x + params.moveDx * step, y + params.moveDy * step, z + params.moveDz * step];
  } else if (mode === 'rotate') {
    const [cx, cy, cz] = params.rotateCenter;
    const rad = (params.rotateAngleDeg * step * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    let dx = x - cx;
    let dy = y - cy;
    let dz = z - cz;
    let dx1 = dx, dy1 = dy, dz1 = dz;
    if (params.rotateAxis === 'X') {
      dy1 = dy * cos - dz * sin;
      dz1 = dy * sin + dz * cos;
    } else if (params.rotateAxis === 'Y') {
      dx1 = dx * cos + dz * sin;
      dz1 = -dx * sin + dz * cos;
    } else if (params.rotateAxis === 'Z') {
      dx1 = dx * cos - dy * sin;
      dy1 = dx * sin + dy * cos;
    }
    return [cx + dx1, cy + dy1, cz + dz1];
  } else if (mode === 'mirror') {
    const [px, py, pz] = params.mirrorPoint;
    if (params.mirrorPlane === 'XY') {
      return [x, y, 2 * pz - z];
    } else if (params.mirrorPlane === 'YZ') {
      return [2 * px - x, y, z];
    } else { // XZ
      return [x, 2 * py - y, z];
    }
  } else if (mode === 'scale') {
    const [cx, cy, cz] = params.scaleCenter;
    const factor = Math.pow(params.scaleFactor, step);
    return [cx + (x - cx) * factor, cy + (y - cy) * factor, cz + (z - cz) * factor];
  }
  return [x, y, z];
}

function drawTransformPreviewAndGuide(
  ctx: CanvasRenderingContext2D,
  engine: RenderEngine3D,
  nodes: Node3D[],
  elements: Element3D[],
  panels: Panel3D[],
  selectedNodeIds: number[],
  selectedElemIds: number[],
  selectedPanelIds: number[],
  activeTransformMode: 'none' | 'move' | 'rotate' | 'mirror' | 'scale',
  transformWithCopy: boolean,
  transformConnect: boolean,
  transformRepeat: number,
  moveDx: number, moveDy: number, moveDz: number,
  rotateCenter: [number, number, number], rotateAxis: 'X' | 'Y' | 'Z', rotateAngleDeg: number,
  mirrorPoint: [number, number, number], mirrorPlane: 'XY' | 'YZ' | 'XZ',
  scaleCenter: [number, number, number], scaleFactor: number,
  pickMoveVector: { active: boolean; step: 1 | 2; p1: [number, number, number] | null },
  pickTransformPoint: { active: boolean; target: 'rotateCenter' | 'mirrorPoint' | 'scaleCenter' | null },
  mousePos: { px: number; py: number } | null,
  gridPlane: 'XY' | 'XZ' | 'YZ',
  gridOffset: number,
  snapEnabled: boolean,
  snapSize: number,
  hoverNodeId: number | null,
  constructionPoints: [number, number, number][] = []
) {
  let effectiveDx = moveDx;
  let effectiveDy = moveDy;
  let effectiveDz = moveDz;

  const resolvePoint = (mx: number, my: number): [number, number, number] => {
    if (hoverNodeId != null) {
      const hn = nodes.find((n) => n.id === hoverNodeId);
      if (hn) return [hn.x, hn.y, hn.z];
    }
    if (constructionPoints && constructionPoints.length > 0) {
      let closestCP: [number, number, number] | null = null;
      let minCPDist = 14;
      for (const cp of constructionPoints) {
        const proj = engine.project(cp);
        if (proj.visible) {
          const d = Math.hypot(proj.x - mx, proj.y - my);
          if (d < minCPDist) {
            minCPDist = d;
            closestCP = cp;
          }
        }
      }
      if (closestCP) return closestCP;
    }
    const pt = engine.unprojectToPlane(mx, my, gridPlane, gridOffset);
    let x = pt[0], y = pt[1], z = pt[2];
    if (snapEnabled) {
      if (gridPlane === 'XY') {
        x = Math.round(x / snapSize) * snapSize;
        y = Math.round(y / snapSize) * snapSize;
        z = gridOffset;
      } else if (gridPlane === 'XZ') {
        x = Math.round(x / snapSize) * snapSize;
        y = gridOffset;
        z = Math.round(z / snapSize) * snapSize;
      } else if (gridPlane === 'YZ') {
        x = gridOffset;
        y = Math.round(y / snapSize) * snapSize;
        z = Math.round(z / snapSize) * snapSize;
      }
    }
    return [x, y, z];
  };

  // 1. Vector Picking Active (Step 1 or Step 2)
  if (pickMoveVector.active) {
    if (pickMoveVector.step === 2 && pickMoveVector.p1) {
      const p1 = pickMoveVector.p1;
      let targetPt: [number, number, number] = mousePos ? resolvePoint(mousePos.px, mousePos.py) : [p1[0], p1[1], p1[2]];

      effectiveDx = Math.round((targetPt[0] - p1[0]) * 1000) / 1000;
      effectiveDy = Math.round((targetPt[1] - p1[1]) * 1000) / 1000;
      effectiveDz = Math.round((targetPt[2] - p1[2]) * 1000) / 1000;

      const sp1 = engine.project(p1);
      const sp2 = engine.project(targetPt);
      const dist3D = Math.hypot(targetPt[0] - p1[0], targetPt[1] - p1[1], targetPt[2] - p1[2]);
      const pixDist = Math.hypot(sp2.x - sp1.x, sp2.y - sp1.y);

      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(sp1.x, sp1.y);
      ctx.lineTo(sp2.x, sp2.y);
      ctx.stroke();

      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.arc(sp1.x, sp1.y, 5, 0, 2 * Math.PI);
      ctx.fill();

      if (pixDist >= 12) {
        const ang = Math.atan2(sp2.y - sp1.y, sp2.x - sp1.x);
        const ah = 9;
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.moveTo(sp2.x, sp2.y);
        ctx.lineTo(sp2.x - ah * Math.cos(ang - Math.PI / 6), sp2.y - ah * Math.sin(ang - Math.PI / 6));
        ctx.lineTo(sp2.x - ah * Math.cos(ang + Math.PI / 6), sp2.y - ah * Math.sin(ang + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      if (pixDist >= 15 && dist3D >= 0.001) {
        drawSegmentDimensionPoints(ctx, sp1, sp2, dist3D, '#2563eb');
      }

      const deltaLabel = `Δ (${effectiveDx.toFixed(2)}, ${effectiveDy.toFixed(2)}, ${effectiveDz.toFixed(2)}) m`;
      drawNodeCoordTip(ctx, sp2, deltaLabel, '#2563eb');
    } else if (pickMoveVector.step === 1 && mousePos) {
      const targetPt = resolvePoint(mousePos.px, mousePos.py);
      const sp = engine.project(targetPt);
      drawNodeCoordTip(ctx, sp, `Wskaż P1 (${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`, '#2563eb');
    }
  }

  // 2. Point Picking Active for Rotate/Mirror/Scale
  if (pickTransformPoint.active && pickTransformPoint.target && mousePos) {
    const targetPt = resolvePoint(mousePos.px, mousePos.py);
    const sp = engine.project(targetPt);
    let label = '';
    if (pickTransformPoint.target === 'rotateCenter') {
      label = `Środek obrotu (${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`;
    } else if (pickTransformPoint.target === 'mirrorPoint') {
      label = `Punkt płaszczyzny (${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`;
    } else if (pickTransformPoint.target === 'scaleCenter') {
      label = `Środek skalowania (${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`;
    }
    drawNodeCoordTip(ctx, sp, label, '#2563eb');
  }

  // 3. Draw Live Ghost Model Preview
  if (activeTransformMode !== 'none' || pickMoveVector.active || pickTransformPoint.active) {
    const baseNodeIds = new Set<number>(selectedNodeIds);
    selectedElemIds.forEach((eid) => {
      const el = elements.find((e) => e.id === eid);
      if (el) {
        baseNodeIds.add(el.n1);
        baseNodeIds.add(el.n2);
      }
    });
    selectedPanelIds.forEach((pid) => {
      const p = panels.find((pan) => pan.id === pid);
      if (p) p.nodeIds.forEach((nid) => baseNodeIds.add(nid));
    });

    const baseNodes = Array.from(baseNodeIds)
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is Node3D => !!n);

    const baseElements = selectedElemIds
      .map((id) => elements.find((e) => e.id === id))
      .filter((e): e is Element3D => !!e);

    const basePanels = selectedPanelIds
      .map((id) => panels.find((p) => p.id === id))
      .filter((p): p is Panel3D => !!p);

    if (baseNodes.length > 0 || baseElements.length > 0 || basePanels.length > 0) {
      const currentMode = activeTransformMode === 'none' ? 'move' : activeTransformMode;
      const repeat = (currentMode === 'mirror')
        ? 1
        : (transformWithCopy ? Math.max(1, Math.min(50, Math.round(transformRepeat || 1))) : 1);

      const params = {
        moveDx: effectiveDx,
        moveDy: effectiveDy,
        moveDz: effectiveDz,
        rotateCenter,
        rotateAxis,
        rotateAngleDeg,
        mirrorPoint,
        mirrorPlane,
        scaleCenter,
        scaleFactor,
      };

      ctx.save();

      for (let step = 1; step <= repeat; step++) {
        // Ghost Panels
        basePanels.forEach((pan) => {
          const corners = getPanelCorners(pan, nodes);
          if (corners.length >= 3) {
            const transformedCorners = corners.map(
              (c) => transformPoint(c, currentMode, params, step)
            );
            const pts = transformedCorners.map((c) => engine.project(c));
            if (pts.length >= 3) {
              ctx.fillStyle = 'rgba(8, 145, 178, 0.12)';
              ctx.strokeStyle = '#0891b2';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([5, 3]);
              ctx.beginPath();
              ctx.moveTo(pts[0].x, pts[0].y);
              for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            }
          }
        });

        // Ghost Elements
        baseElements.forEach((el) => {
          const n1 = nodes.find((n) => n.id === el.n1);
          const n2 = nodes.find((n) => n.id === el.n2);
          if (n1 && n2) {
            const t1 = transformPoint([n1.x, n1.y, n1.z], currentMode, params, step);
            const t2 = transformPoint([n2.x, n2.y, n2.z], currentMode, params, step);
            const p1 = engine.project(t1);
            const p2 = engine.project(t2);
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2.2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        });

        // Ghost Connecting Lines if transformWithCopy AND transformConnect
        if (transformWithCopy && transformConnect) {
          baseNodes.forEach((n) => {
            const tPrev = transformPoint([n.x, n.y, n.z], currentMode, params, step - 1);
            const tCurr = transformPoint([n.x, n.y, n.z], currentMode, params, step);
            const pPrev = engine.project(tPrev);
            const pCurr = engine.project(tCurr);
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(pPrev.x, pPrev.y);
            ctx.lineTo(pCurr.x, pCurr.y);
            ctx.stroke();
          });
        }

        // Ghost Nodes
        baseNodes.forEach((n) => {
          const tn = transformPoint([n.x, n.y, n.z], currentMode, params, step);
          const p = engine.project(tn);
          ctx.fillStyle = 'rgba(37, 99, 235, 0.2)';
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 2]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5.5, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
        });
      }

      ctx.restore();
    }

    // 4. Draw Center / Plane Markers on Canvas
    if (activeTransformMode === 'rotate') {
      const sp = engine.project(rotateCenter);
      ctx.save();
      ctx.fillStyle = '#d97706';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 14, 0, 2 * Math.PI);
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      drawNodeCoordTip(ctx, { x: sp.x, y: sp.y }, `Środek obrotu (${rotateAxis})`, '#d97706');
      ctx.restore();
    } else if (activeTransformMode === 'mirror') {
      const sp = engine.project(mirrorPoint);
      ctx.save();
      ctx.fillStyle = '#9333ea';
      ctx.strokeStyle = '#9333ea';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      drawNodeCoordTip(ctx, { x: sp.x, y: sp.y }, `Płaszczyzna ${mirrorPlane}`, '#9333ea');
      ctx.restore();
    } else if (activeTransformMode === 'scale') {
      const sp = engine.project(scaleCenter);
      ctx.save();
      ctx.fillStyle = '#059669';
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 6, 0, 2 * Math.PI);
      ctx.fill();
      drawNodeCoordTip(ctx, { x: sp.x, y: sp.y }, `Środek S=${scaleFactor}`, '#059669');
      ctx.restore();
    }
  }
}

// --- Rotation Center Calculation ---
const calculateRotationCenter = (
  selectedNodeIds: number[],
  selectedElemIds: number[],
  selectedPanelIds: number[],
  nodes: Node3D[],
  elements: Element3D[],
  panels: Panel3D[]
): [number, number, number] => {
  const nodeMap = new Map<number, Node3D>();
  for (const n of nodes) {
    nodeMap.set(n.id, n);
  }

  const hasSelection =
    selectedNodeIds.length > 0 || selectedElemIds.length > 0 || selectedPanelIds.length > 0;

  let totalX = 0;
  let totalY = 0;
  let totalZ = 0;
  let count = 0;

  if (hasSelection) {
    // 1. Selected Nodes
    for (const id of selectedNodeIds) {
      const n = nodeMap.get(id);
      if (n) {
        totalX += n.x;
        totalY += n.y;
        totalZ += n.z;
        count++;
      }
    }

    // 2. Selected Elements (Bars)
    for (const id of selectedElemIds) {
      const el = elements.find((e) => e.id === id);
      if (el) {
        const n1 = nodeMap.get(el.n1);
        const n2 = nodeMap.get(el.n2);
        if (n1 && n2) {
          totalX += (n1.x + n2.x) / 2;
          totalY += (n1.y + n2.y) / 2;
          totalZ += (n1.z + n2.z) / 2;
          count++;
        }
      }
    }

    // 3. Selected Panels
    for (const id of selectedPanelIds) {
      const pan = panels.find((p) => p.id === id);
      if (pan) {
        const corners = getPanelCorners(pan, nodes);
        if (corners.length > 0) {
          const cx = corners.reduce((sum, c) => sum + c[0], 0) / corners.length;
          const cy = corners.reduce((sum, c) => sum + c[1], 0) / corners.length;
          const cz = corners.reduce((sum, c) => sum + c[2], 0) / corners.length;
          totalX += cx;
          totalY += cy;
          totalZ += cz;
          count++;
        }
      }
    }
  } else {
    // Nothing selected: centroid of all elements in the model
    // 1. All nodes
    for (const n of nodes) {
      totalX += n.x;
      totalY += n.y;
      totalZ += n.z;
      count++;
    }

    // 2. All elements (bars)
    for (const el of elements) {
      const n1 = nodeMap.get(el.n1);
      const n2 = nodeMap.get(el.n2);
      if (n1 && n2) {
        totalX += (n1.x + n2.x) / 2;
        totalY += (n1.y + n2.y) / 2;
        totalZ += (n1.z + n2.z) / 2;
        count++;
      }
    }

    // 3. All panels
    for (const pan of panels) {
      const corners = getPanelCorners(pan, nodes);
      if (corners.length > 0) {
        const cx = corners.reduce((sum, c) => sum + c[0], 0) / corners.length;
        const cy = corners.reduce((sum, c) => sum + c[1], 0) / corners.length;
        const cz = corners.reduce((sum, c) => sum + c[2], 0) / corners.length;
        totalX += cx;
        totalY += cy;
        totalZ += cz;
        count++;
      }
    }
  }

  if (count > 0) {
    return [totalX / count, totalY / count, totalZ / count];
  }

  return [0, 0, 0];
};

export default function App() {
  const [nodes, setNodes] = useState<Node3D[]>([]);
  const [elements, setElements] = useState<Element3D[]>([]);
  const [panels, setPanels] = useState<Panel3D[]>([]);
  const [panelShape, setPanelShape] = useState<PanelShape>('triangle');
  const [panelPoints, setPanelPoints] = useState<number[]>([]);
  const [sections, setSections] = useState<Section[]>(INITIAL_SECTIONS);
  const [materials, setMaterials] = useState<Material[]>(INITIAL_MATERIALS);
  const [groups, setGroups] = useState<import('./fem/types').ElementGroupDef[]>(INITIAL_GROUPS);

  const [defaultSectionId, setDefaultSectionId] = useState<number>(1);
  const [defaultMaterialId, setDefaultMaterialId] = useState<number>(1);
  const [defaultGroupId, setDefaultGroupId] = useState<string>('');

  // Interaction Mode & 3D Navigation Mode
  const [mode, setMode] = useState<ToolMode>('select');
  const [navMode, setNavMode] = useState<'orbit' | 'boxSelect' | 'pan' | 'zoom'>('orbit');

  // Axis grid coordinates state (initially empty for a clean canvas)
  const [gridCoords, setGridCoords] = useState<{ x: number[]; y: number[]; z: number[] }>({
    x: [],
    y: [],
    z: []
  });
  const [activeGridAxis, setActiveGridAxis] = useState<'X' | 'Y' | 'Z'>('X');

  const selectedDrawingGroup = useMemo(() => {
    return groups.find((g) => g.id === defaultGroupId);
  }, [groups, defaultGroupId]);

  const activeSectionIdForDrawing = useMemo(() => {
    return (selectedDrawingGroup && selectedDrawingGroup.sectionId !== undefined)
      ? selectedDrawingGroup.sectionId
      : defaultSectionId;
  }, [selectedDrawingGroup, defaultSectionId]);

  const activeMaterialIdForDrawing = useMemo(() => {
    return (selectedDrawingGroup && selectedDrawingGroup.materialId !== undefined)
      ? selectedDrawingGroup.materialId
      : defaultMaterialId;
  }, [selectedDrawingGroup, defaultMaterialId]);

  // Dynamically compute construction points (intersections) and construction lines
  const { constructionPoints, constructionLines } = useMemo(() => {
    const xVals: number[] = Array.from(new Set<number>(gridCoords.x.map((v) => Math.round(v * 1000) / 1000))).sort((a, b) => a - b);
    const yVals: number[] = Array.from(new Set<number>(gridCoords.y.map((v) => Math.round(v * 1000) / 1000))).sort((a, b) => a - b);
    const zVals: number[] = Array.from(new Set<number>(gridCoords.z.map((v) => Math.round(v * 1000) / 1000))).sort((a, b) => a - b);

    const hasX = xVals.length > 0;
    const hasY = yVals.length > 0;
    const hasZ = zVals.length > 0;

    const activeCount = (hasX ? 1 : 0) + (hasY ? 1 : 0) + (hasZ ? 1 : 0);

    const points: [number, number, number][] = [];
    const lines: ConstructionLine3D[] = [];

    if (activeCount >= 2) {
      const effX: number[] = hasX ? xVals : [0];
      const effY: number[] = hasY ? yVals : [0];
      const effZ: number[] = hasZ ? zVals : [0];

      const minX = effX[0];
      const maxX = effX[effX.length - 1];
      const minY = effY[0];
      const maxY = effY[effY.length - 1];
      const minZ = effZ[0];
      const maxZ = effZ[effZ.length - 1];

      // Intersection points
      for (const x of effX) {
        for (const y of effY) {
          for (const z of effZ) {
            points.push([x, y, z]);
          }
        }
      }

      let lineId = 1;

      // Lines parallel to X
      if (hasX && xVals.length > 1) {
        for (const y of effY) {
          for (const z of effZ) {
            lines.push({
              id: lineId++,
              p1: [minX, y, z],
              p2: [maxX, y, z],
              name: `Grid X (${y.toFixed(2)}, ${z.toFixed(2)})`,
            });
          }
        }
      }

      // Lines parallel to Y
      if (hasY && yVals.length > 1) {
        for (const x of effX) {
          for (const z of effZ) {
            lines.push({
              id: lineId++,
              p1: [x, minY, z],
              p2: [x, maxY, z],
              name: `Grid Y (${x.toFixed(2)}, ${z.toFixed(2)})`,
            });
          }
        }
      }

      // Lines parallel to Z
      if (hasZ && zVals.length > 1) {
        for (const x of effX) {
          for (const y of effY) {
            lines.push({
              id: lineId++,
              p1: [x, y, minZ],
              p2: [x, y, maxZ],
              name: `Grid Z (${x.toFixed(2)}, ${y.toFixed(2)})`,
            });
          }
        }
      }
    }

    return { constructionPoints: points, constructionLines: lines };
  }, [gridCoords]);

  // Lines tool state
  const [linesSubMode, setLinesSubMode] = useState<'construction' | 'dimension'>('construction');
  const [dimensionLines, setDimensionLines] = useState<DimensionLine3D[]>([]);
  const [selectedConstructionLineIds, setSelectedConstructionLineIds] = useState<number[]>([]);
  const [selectedDimensionLineIds, setSelectedDimensionLineIds] = useState<number[]>([]);
  const hoverConstructionLineIdRef = useRef<number | null>(null);
  const hoverDimensionLineIdRef = useRef<number | null>(null);
  const [lineStartPoint, setLineStartPoint] = useState<[number, number, number] | null>(null);

  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [selectedElemIds, setSelectedElemIds] = useState<number[]>([]);
  const [selectedPanelIds, setSelectedPanelIds] = useState<number[]>([]);
  const [mobileSelMode, setMobileSelMode] = useState<SelectionModeType>('replace');
  const [keyModifiers, setKeyModifiers] = useState<{ ctrl: boolean; shift: boolean }>({ ctrl: false, shift: false });
  const keyModifiersRef = useRef<{ ctrl: boolean; shift: boolean }>({ ctrl: false, shift: false });
  const effectiveSelMode = getEffectiveSelectionMode(keyModifiers.ctrl, keyModifiers.shift, mobileSelMode);
  const [barStartNodeId, setBarStartNodeId] = useState<number | null>(null);
  const [lastPlacedNodeId, setLastPlacedNodeId] = useState<number | null>(null);
  const [lastDrawnElemId, setLastDrawnElemId] = useState<number | null>(null);
  const mousePosRef = useRef<{ px: number; py: number } | null>(null);
  const isTouchRef = useRef<boolean>(false);
  const lastTouchTimeRef = useRef<number>(0);

  // Fast direct hover refs (avoids 60fps React re-renders on mousemove for 120 FPS buttery smooth performance)
  const hoverViewCubeRef = useRef<ViewCubeHit | null>(null);
  const hoverNodeIdRef = useRef<number | null>(null);
  const hoverElemIdRef = useRef<number | null>(null);
  const hoverPanelIdRef = useRef<number | null>(null);

  // Status & Hint
  const [statusHint, setStatusHint] = useState<string>('Tryb: Zaznacz');
  const coordsSpanRef = useRef<HTMLSpanElement | null>(null);

  // Box selection drag state ref
  const boxSelectStateRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    curX: number;
    curY: number;
    hasMoved: boolean;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    curX: 0,
    curY: 0,
    hasMoved: false,
  });

  // Settings & Display Options (loaded from localStorage preferences)
  const initialPrefsRef = useRef<UserPreferences>(loadUserPreferences());
  const initialPrefs = initialPrefsRef.current;

  const [theme, setTheme] = useState<'light' | 'dark'>(initialPrefs.theme ?? 'light');
  const [accent, setAccent] = useState<string>(initialPrefs.accent ?? 'blue');
  const [graphicsMode, setGraphicsMode] = useState<GraphicsMode>(initialPrefs.graphicsMode ?? 'balanced');
  const [showGrid, setShowGrid] = useState<boolean>(initialPrefs.showGrid ?? true);
  const [showAxes, setShowAxes] = useState<boolean>(initialPrefs.showAxes ?? true);
  const [showLocalAxes, setShowLocalAxes] = useState<boolean>(initialPrefs.showLocalAxes ?? false);
  const [showNodeNumbers, setShowNodeNumbers] = useState<boolean>(initialPrefs.showNodeNumbers ?? false);
  const [showElementNumbers, setShowElementNumbers] = useState<boolean>(initialPrefs.showElementNumbers ?? false);
  const [showSectionNames, setShowSectionNames] = useState<boolean>(initialPrefs.showSectionNames ?? false);
  const [showMaterialNames, setShowMaterialNames] = useState<boolean>(initialPrefs.showMaterialNames ?? false);
  const [showSupports, setShowSupports] = useState<boolean>(initialPrefs.showSupports ?? true);
  const [showProfileSketches, setShowProfileSketches] = useState<boolean>(initialPrefs.showProfileSketches ?? true);
  const [showPanels, setShowPanels] = useState<boolean>(initialPrefs.showPanels ?? true);
  const [showLoads, setShowLoads] = useState<boolean>(initialPrefs.showLoads ?? true);
  const [showLoadValues, setShowLoadValues] = useState<boolean>(initialPrefs.showLoadValues ?? true);
  const [showHingeLabels, setShowHingeLabels] = useState<boolean>(initialPrefs.showHingeLabels ?? true);
  const [showDimensions, setShowDimensions] = useState<boolean>(initialPrefs.showDimensions ?? false);
  const [gridPlane, setGridPlane] = useState<'XY' | 'XZ' | 'YZ'>('XY');
  const [gridOffset, setGridOffset] = useState<number>(0);
  const [drawConstructionGrid, setDrawConstructionGrid] = useState<boolean>(initialPrefs.drawConstructionGrid ?? true);
  const [drawOuterDimensionLines, setDrawOuterDimensionLines] = useState<boolean>(initialPrefs.drawOuterDimensionLines ?? true);

  useEffect(() => {
    if (mode === 'select') {
      setStatusHint('Tryb: Zaznacz');
    } else if (mode === 'addBar') {
      setStatusHint('Tryb: Rysuj pręt – kliknij na węzeł lub siatkę, aby utworzyć węzeł.');
    } else if (mode === 'addPanel') {
      setStatusHint(`Tryb: Obrys (${panelShape === 'triangle' ? 'Trójkąt' : 'Prostokąt'}) – kliknij węzły, aby zdefiniować obrys.`);
    } else if (mode === 'grid') {
      const coordName = gridPlane === 'XY' ? 'Z' : gridPlane === 'XZ' ? 'Y' : 'X';
      setStatusHint(`Tryb: Siatka (${gridPlane}, ${coordName} = ${gridOffset.toFixed(2)} m) – kliknij na węzeł, aby przenieść siatkę.`);
    } else if (mode === 'lines') {
      setStatusHint(`Tryb: Linie (${linesSubMode === 'construction' ? 'Konstrukcyjne' : 'Wymiarowe'}) – kliknij 1. punkt.`);
    }
  }, [mode, gridPlane, gridOffset, panelShape, linesSubMode]);

  const [snapEnabled, setSnapEnabled] = useState<boolean>(initialPrefs.snapEnabled ?? true);
  const [allowNewNodesInBarMode, setAllowNewNodesInBarMode] = useState<boolean>(initialPrefs.allowNewNodesInBarMode ?? true);
  const [snapSize, setSnapSize] = useState<number>(initialPrefs.snapSize ?? 0.5);
  const [mergeTolerance, setMergeTolerance] = useState<number>(initialPrefs.mergeTolerance ?? 0.001);
  const [showCanvasUI, setShowCanvasUI] = useState<boolean>(true);

  const [includeSelfWeight, setIncludeSelfWeight] = useState<boolean>(initialPrefs.includeSelfWeight ?? false);
  const [momentsAsArcs, setMomentsAsArcs] = useState<boolean>(initialPrefs.momentsAsArcs ?? false);

  // Transform Tools (Przenieś, Obróć, Lustro, Skaluj) & Vector/Point Picking State
  const [activeTransformMode, setActiveTransformMode] = useState<'none' | 'move' | 'rotate' | 'mirror' | 'scale'>('none');
  const [transformWithCopy, setTransformWithCopy] = useState(false);
  const [transformConnect, setTransformConnect] = useState(false);
  const [transformRepeat, setTransformRepeat] = useState(1);
  const [transformLoads, setTransformLoads] = useState(true);

  const [moveDx, setMoveDx] = useState(2);
  const [moveDy, setMoveDy] = useState(0);
  const [moveDz, setMoveDz] = useState(0);

  const [rotateCx, setRotateCx] = useState(0);
  const [rotateCy, setRotateCy] = useState(0);
  const [rotateCz, setRotateCz] = useState(0);
  const [rotateAxis, setRotateAxis] = useState<'X' | 'Y' | 'Z'>('Z');
  const [rotateAngle, setRotateAngle] = useState(90);

  const [mirrorPx, setMirrorPx] = useState(0);
  const [mirrorPy, setMirrorPy] = useState(0);
  const [mirrorPz, setMirrorPz] = useState(0);
  const [mirrorPlane, setMirrorPlane] = useState<'XY' | 'YZ' | 'XZ'>('XZ');

  const [scaleCx, setScaleCx] = useState(0);
  const [scaleCy, setScaleCy] = useState(0);
  const [scaleCz, setScaleCz] = useState(0);
  const [scaleFactor, setScaleFactor] = useState(1.5);

  const [pickMoveVector, setPickMoveVector] = useState<{
    active: boolean;
    step: 1 | 2;
    p1: [number, number, number] | null;
  }>({
    active: false,
    step: 1,
    p1: null,
  });

  const [pickTransformPoint, setPickTransformPoint] = useState<{
    active: boolean;
    target: 'rotateCenter' | 'mirrorPoint' | 'scaleCenter' | null;
  }>({
    active: false,
    target: null,
  });

  const handleStartPickMoveVector = useCallback(() => {
    setPickTransformPoint({ active: false, target: null });
    setPickMoveVector({ active: true, step: 1, p1: null });
    setStatusHint('Tryb wskazywania: Kliknij na modelu punkt początkowy P1 (1/2) wektora [Esc = anuluj].');
  }, []);

  const handleStartPickPoint = useCallback((target: 'rotateCenter' | 'mirrorPoint' | 'scaleCenter') => {
    setPickMoveVector({ active: false, step: 1, p1: null });
    setPickTransformPoint({ active: true, target });
    let msg = '';
    if (target === 'rotateCenter') msg = 'Tryb wskazywania: Kliknij na modelu lub siatce środek obrotu [Esc = anuluj].';
    else if (target === 'mirrorPoint') msg = 'Tryb wskazywania: Kliknij na modelu lub siatce punkt płaszczyzny odbicia [Esc = anuluj].';
    else if (target === 'scaleCenter') msg = 'Tryb wskazywania: Kliknij na modelu lub siatce środek skalowania [Esc = anuluj].';
    setStatusHint(msg);
  }, []);

  const handleCancelPickMode = useCallback(() => {
    setPickMoveVector({ active: false, step: 1, p1: null });
    setPickTransformPoint({ active: false, target: null });
  }, []);

  const handleOpenTransformMode = useCallback((tMode: 'none' | 'move' | 'rotate' | 'mirror' | 'scale') => {
    setActiveTransformMode(tMode);
    handleCancelPickMode();
  }, [handleCancelPickMode]);

  // Split tool state
  const [splitFormOpen, setSplitFormOpen] = useState(false);
  const [splitMode, setSplitMode] = useState<'single' | 'multi'>('single');
  const [splitT, setSplitT] = useState(0.5);
  const [splitN, setSplitN] = useState(2);

  useEffect(() => {
    if (selectedElemIds.length === 0 && splitFormOpen) {
      setSplitFormOpen(false);
    }
  }, [selectedElemIds.length, splitFormOpen]);

  useEffect(() => {
    if (mode !== 'select' && splitFormOpen) {
      setSplitFormOpen(false);
    }
  }, [mode, splitFormOpen]);

  useEffect(() => {
    if (selectedNodeIds.length === 0 && selectedElemIds.length === 0 && selectedPanelIds.length === 0) {
      if (activeTransformMode !== 'none') setActiveTransformMode('none');
      handleCancelPickMode();
    }
  }, [selectedNodeIds, selectedElemIds, selectedPanelIds, activeTransformMode, handleCancelPickMode]);

  useEffect(() => {
    if (mode !== 'select') {
      if (activeTransformMode !== 'none') setActiveTransformMode('none');
      handleCancelPickMode();
    }
  }, [mode, activeTransformMode, handleCancelPickMode]);

  // Analysis & Results
  const [analysisSettings, setAnalysisSettings] = useState<AnalysisSettings>({
    type: 'linear_static',
    params: {
      bucklingModes: 4,
      modalModes: 4,
      includeElementMass: true,
      includeSelfWeight: false,
    },
  });

  const [solved, setSolved] = useState<SolverResult3D | null>(null);
  const [solveWarning, setSolveWarning] = useState<string | null>(null);

  // Load Cases & Combinations State (Eurocode EN 1990)
  const [loadCases, setLoadCases] = useState<LoadCase3D[]>([INITIAL_DEFAULT_LOAD_CASE]);
  const [activeLoadCaseId, setActiveLoadCaseId] = useState<number>(1);
  const [autoCombinations, setAutoCombinations] = useState<boolean>(true);
  const [customCombinations, setCustomCombinations] = useState<LoadCombination3D[]>([]);
  const [multiSolved, setMultiSolved] = useState<MultiCaseResults3D | null>(null);
  const [activeResultKey, setActiveResultKey] = useState<string>('');

  // Result Toggles
  const [showDeform, setShowDeform] = useState<boolean>(initialPrefs.showDeform ?? true);
  const [showMy, setShowMy] = useState<boolean>(initialPrefs.showMy ?? false);
  const [showMz, setShowMz] = useState<boolean>(initialPrefs.showMz ?? false);
  const [showMx, setShowMx] = useState<boolean>(initialPrefs.showMx ?? false);
  const [showVy, setShowVy] = useState<boolean>(initialPrefs.showVy ?? false);
  const [showVz, setShowVz] = useState<boolean>(initialPrefs.showVz ?? false);
  const [showN, setShowN] = useState<boolean>(initialPrefs.showN ?? false);
  const [showStress, setShowStress] = useState<boolean>(initialPrefs.showStress ?? false);
  const [showReactions, setShowReactions] = useState<boolean>(initialPrefs.showReactions ?? true);
  const [hideLoadsInResults, setHideLoadsInResults] = useState<boolean>(false);
  const [hideSupportsInResults, setHideSupportsInResults] = useState<boolean>(false);

  const [deformScaleMult, setDeformScaleMult] = useState<number>(initialPrefs.deformScaleMult ?? 1.0);
  const [diagramScaleMult, setDiagramScaleMult] = useState<number>(initialPrefs.diagramScaleMult ?? 1.0);
  const [diagramLabelMode, setDiagramLabelMode] = useState<'none' | 'minmax' | 'all'>(initialPrefs.diagramLabelMode ?? 'all');

  // Save preferences to localStorage automatically whenever any preference changes
  useEffect(() => {
    saveUserPreferences({
      theme,
      accent,
      graphicsMode,
      showAxes,
      includeSelfWeight,
      showNodeNumbers,
      showElementNumbers,
      showSectionNames,
      showMaterialNames,
      showSupports,
      showPanels,
      showProfileSketches,
      showLocalAxes,
      showHingeLabels,
      showLoads,
      showLoadValues,
      showDimensions,
      showDeform,
      showMy,
      showMz,
      showMx,
      showVy,
      showVz,
      showN,
      showStress,
      showReactions,
      deformScaleMult,
      diagramScaleMult,
      diagramLabelMode,
      snapSize,
      snapEnabled,
      showGrid,
      mergeTolerance,
      allowNewNodesInBarMode,
      drawConstructionGrid,
      drawOuterDimensionLines,
      momentsAsArcs,
    });
  }, [
    theme,
    accent,
    graphicsMode,
    showAxes,
    includeSelfWeight,
    showNodeNumbers,
    showElementNumbers,
    showSectionNames,
    showMaterialNames,
    showSupports,
    showPanels,
    showProfileSketches,
    showLocalAxes,
    showHingeLabels,
    showLoads,
    showLoadValues,
    showDimensions,
    showDeform,
    showMy,
    showMz,
    showMx,
    showVy,
    showVz,
    showN,
    showStress,
    showReactions,
    deformScaleMult,
    diagramScaleMult,
    diagramLabelMode,
    snapSize,
    snapEnabled,
    showGrid,
    mergeTolerance,
    allowNewNodesInBarMode,
    drawConstructionGrid,
    drawOuterDimensionLines,
    momentsAsArcs,
  ]);
  const [probe, setProbe] = useState<{ elId: number | null; t: number }>({ elId: null, t: 0.5 });

  // Modals
  const [optionsOpen, setOptionsOpen] = useState<boolean>(false);
  const [aboutOpen, setAboutOpen] = useState<boolean>(false);
  const [templatesModalOpen, setTemplatesModalOpen] = useState<boolean>(false);
  const [selectByOpen, setSelectByOpen] = useState<boolean>(false);
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [loadModalOpen, setLoadModalOpen] = useState<boolean>(false);
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [currentModelName, setCurrentModelName] = useState<string>('Projekt konstrukcji');
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  // Undo / Redo Stack
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const historyRef = useRef<HistoryState[]>([]);
  historyRef.current = history;
  const historyIndexRef = useRef<number>(-1);
  historyIndexRef.current = historyIndex;
  const isUndoingOrRedoingRef = useRef<boolean>(false);

  // Canvas and 3D Engine Ref
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<RenderEngine3D>(new RenderEngine3D());

  // Mouse Interaction Drag State
  const dragRef = useRef<{
    isDragging: boolean;
    dragType: 'orbit' | 'pan' | 'zoom';
    startX: number;
    startY: number;
    startAzimuth: number;
    startElevation: number;
    startPanX: number;
    startPanY: number;
    startScale: number;
    hasMoved: boolean;
  }>({
    isDragging: false,
    dragType: 'orbit',
    startX: 0,
    startY: 0,
    startAzimuth: 0,
    startElevation: 0,
    startPanX: 0,
    startPanY: 0,
    startScale: 60,
    hasMoved: false,
  });

  // Touch Gesture Ref
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    startDist: number;
    startScale: number;
    isPinching: boolean;
    dragType: 'orbit' | 'pan' | 'zoom';
    startAzimuth: number;
    startElevation: number;
    startPanX: number;
    startPanY: number;
  }>({
    startX: 0,
    startY: 0,
    startDist: 0,
    startScale: 60,
    isPinching: false,
    dragType: 'orbit',
    startAzimuth: 0,
    startElevation: 0,
    startPanX: 0,
    startPanY: 0,
  });

  // Apply Theme & Accent to document HTML
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const def = APP_ACCENTS[accent] || APP_ACCENTS.blue;
    const root = document.documentElement;
    const [r, g, b] = def.rgb;
    const isDark = theme === 'dark';

    root.style.setProperty('--accent', def.hex);
    root.style.setProperty('--accent-dark', def.darkHex);
    root.style.setProperty('--accent-light', def.lightHex);
    root.style.setProperty('--accent-soft', isDark ? `rgba(${r}, ${g}, ${b}, 0.22)` : `rgba(${r}, ${g}, ${b}, 0.12)`);
    root.style.setProperty('--accent-tag-bg', isDark ? `rgba(${r}, ${g}, ${b}, 0.22)` : `rgba(${r}, ${g}, ${b}, 0.12)`);
    root.style.setProperty('--accent-tag-fg', isDark ? def.lightHex : def.darkHex);
    root.style.setProperty('--accent-tag-border', isDark ? `rgba(${r}, ${g}, ${b}, 0.40)` : `rgba(${r}, ${g}, ${b}, 0.30)`);
  }, [theme, accent]);

  // Push state to undo/redo history
  const commitHistory = useCallback(() => {
    if (isUndoingOrRedoingRef.current) return;

    const currentSnap: HistoryState = {
      nodes,
      elements,
      panels,
      sections,
      materials,
      groups,
      analysisSettings,
    };

    const currHistory = historyRef.current;
    const currIdx = historyIndexRef.current;

    if (currIdx >= 0 && currHistory[currIdx]) {
      const lastSnapStr = JSON.stringify(currHistory[currIdx]);
      const newSnapStr = JSON.stringify(currentSnap);
      if (lastSnapStr === newSnapStr) {
        return;
      }
    }

    const snapCopy: HistoryState = JSON.parse(JSON.stringify(currentSnap));
    const newHistory = [...currHistory.slice(0, currIdx + 1), snapCopy];

    if (newHistory.length > 100) {
      newHistory.shift();
    }

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [nodes, elements, panels, sections, materials, groups, analysisSettings]);

  const resetHistoryWithModel = useCallback(
    (
      n: Node3D[],
      el: Element3D[],
      p: Panel3D[],
      sec: Section[],
      mat: Material[],
      ans: AnalysisSettings,
      grp?: import('./fem/types').ElementGroupDef[]
    ) => {
      isUndoingOrRedoingRef.current = true;
      const initialSnap: HistoryState = {
        nodes: JSON.parse(JSON.stringify(n)),
        elements: JSON.parse(JSON.stringify(el)),
        panels: JSON.parse(JSON.stringify(p)),
        sections: JSON.parse(JSON.stringify(sec)),
        materials: JSON.parse(JSON.stringify(mat)),
        groups: JSON.parse(JSON.stringify(grp || INITIAL_GROUPS)),
        analysisSettings: JSON.parse(JSON.stringify(ans)),
      };
      setHistory([initialSnap]);
      setHistoryIndex(0);
    },
    []
  );

  // Automatically track model state changes in history (deferring while actively typing in text/number fields)
  useEffect(() => {
    if (isUndoingOrRedoingRef.current) {
      isUndoingOrRedoingRef.current = false;
      return;
    }

    if (historyRef.current.length === 0) {
      const initialSnap: HistoryState = {
        nodes,
        elements,
        panels,
        sections,
        materials,
        groups,
        analysisSettings,
      };
      setHistory([JSON.parse(JSON.stringify(initialSnap))]);
      setHistoryIndex(0);
      return;
    }

    if (isTextEditingElement(document.activeElement)) {
      return;
    }

    commitHistory();
  }, [nodes, elements, panels, sections, materials, groups, analysisSettings, commitHistory]);

  // Commit history when focus leaves input fields (finish typing edit)
  useEffect(() => {
    const handleFocusOut = () => {
      setTimeout(() => {
        if (!isTextEditingElement(document.activeElement)) {
          commitHistory();
        }
      }, 10);
    };

    window.addEventListener('focusout', handleFocusOut);
    return () => {
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, [commitHistory]);

  const handleUndo = useCallback(() => {
    const currIdx = historyIndexRef.current;
    const currHist = historyRef.current;

    if (currIdx > 0 && currHist[currIdx - 1]) {
      if (isTextEditingElement(document.activeElement)) {
        (document.activeElement as HTMLElement)?.blur();
      }

      isUndoingOrRedoingRef.current = true;
      const prevState = currHist[currIdx - 1];

      const restoredNodes = JSON.parse(JSON.stringify(prevState.nodes));
      const restoredElems = JSON.parse(JSON.stringify(prevState.elements));
      const restoredPanels = JSON.parse(JSON.stringify(prevState.panels || []));

      setNodes(restoredNodes);
      setElements(restoredElems);
      setPanels(restoredPanels);
      setSections(JSON.parse(JSON.stringify(prevState.sections)));
      setMaterials(JSON.parse(JSON.stringify(prevState.materials)));
      if (prevState.groups) setGroups(JSON.parse(JSON.stringify(prevState.groups)));
      setAnalysisSettings(JSON.parse(JSON.stringify(prevState.analysisSettings)));
      setHistoryIndex(currIdx - 1);
      setSolved(null);
      setSolveWarning(null);

      const validNodeIds = new Set(restoredNodes.map((n: Node3D) => n.id));
      const validElemIds = new Set(restoredElems.map((e: Element3D) => e.id));
      const validPanelIds = new Set(restoredPanels.map((p: Panel3D) => p.id));

      setSelectedNodeIds((prev) => prev.filter((id) => validNodeIds.has(id)));
      setSelectedElemIds((prev) => prev.filter((id) => validElemIds.has(id)));
      setSelectedPanelIds((prev) => prev.filter((id) => validPanelIds.has(id)));
    }
  }, []);

  const handleRedo = useCallback(() => {
    const currIdx = historyIndexRef.current;
    const currHist = historyRef.current;

    if (currIdx < currHist.length - 1 && currHist[currIdx + 1]) {
      if (isTextEditingElement(document.activeElement)) {
        (document.activeElement as HTMLElement)?.blur();
      }

      isUndoingOrRedoingRef.current = true;
      const nextState = currHist[currIdx + 1];

      const restoredNodes = JSON.parse(JSON.stringify(nextState.nodes));
      const restoredElems = JSON.parse(JSON.stringify(nextState.elements));
      const restoredPanels = JSON.parse(JSON.stringify(nextState.panels || []));

      setNodes(restoredNodes);
      setElements(restoredElems);
      setPanels(restoredPanels);
      setSections(JSON.parse(JSON.stringify(nextState.sections)));
      setMaterials(JSON.parse(JSON.stringify(nextState.materials)));
      if (nextState.groups) setGroups(JSON.parse(JSON.stringify(nextState.groups)));
      setAnalysisSettings(JSON.parse(JSON.stringify(nextState.analysisSettings)));
      setHistoryIndex(currIdx + 1);
      setSolved(null);
      setSolveWarning(null);

      const validNodeIds = new Set(restoredNodes.map((n: Node3D) => n.id));
      const validElemIds = new Set(restoredElems.map((e: Element3D) => e.id));
      const validPanelIds = new Set(restoredPanels.map((p: Panel3D) => p.id));

      setSelectedNodeIds((prev) => prev.filter((id) => validNodeIds.has(id)));
      setSelectedElemIds((prev) => prev.filter((id) => validElemIds.has(id)));
      setSelectedPanelIds((prev) => prev.filter((id) => validPanelIds.has(id)));
    }
  }, []);

  const handleInvalidateResults = () => {
    setSolved(null);
    setSolveWarning(null);
    setProbe({ elId: null, t: 0.5 });
  };

  // Model storage and file operations
  const handleNewModel = () => {
    setNodes([]);
    setElements([]);
    setPanels([]);
    setPanelPoints([]);
    setSolved(null);
    setSelectedNodeIds([]);
    setSelectedElemIds([]);
    setSelectedPanelIds([]);
    setCurrentModelName('Projekt konstrukcji');
    setCurrentModelId(null);
    resetHistoryWithModel([], [], [], sections, materials, analysisSettings);
    setStatusHint('Utworzono nowy czysty model.');
  };

  const handleApplyTemplate = (newNodes: Node3D[], newElements: Element3D[]) => {
    setNodes(newNodes);
    setElements(newElements);
    setPanels([]);
    setPanelPoints([]);
    setSolved(null);
    setSelectedNodeIds([]);
    setSelectedElemIds([]);
    setSelectedPanelIds([]);
    setCurrentModelName('Szablon modelu');
    setCurrentModelId(null);
    resetHistoryWithModel(newNodes, newElements, [], sections, materials, analysisSettings, groups);
    setStatusHint(`Wygenerowano model z szablonu (${newNodes.length} węzłów, ${newElements.length} prętów).`);
    setTimeout(() => {
      if (engineRef.current && newNodes.length > 0) {
        engineRef.current.fitView(newNodes);
        redraw();
      }
    }, 60);
  };

  const handleSaveModel = () => {
    if (currentModelId) {
      const list = getStoredModelsList();
      const idx = list.findIndex((m) => m.id === currentModelId);
      const data = { nodes, elements, panels, sections, materials, groups, analysisSettings };
      const now = new Date().toISOString();
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          name: currentModelName,
          updatedAt: now,
          nodesCount: nodes.length,
          elementsCount: elements.length,
          data,
        };
        saveStoredModelsList(list);
        setStatusHint(`Zapisano model "${currentModelName}" w pamięci przeglądarki.`);
        return;
      }
    }
    setSaveModalOpen(true);
  };

  const handleSaveAsModel = () => {
    setSaveModalOpen(true);
  };

  const handleLoadModel = () => {
    setLoadModalOpen(true);
  };

  const handleConfirmSaveLocal = (name: string) => {
    const list = getStoredModelsList();
    const cleanName = name.trim() || 'Projekt konstrukcji';
    const existingIdx = list.findIndex(
      (m) => m.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    const id =
      existingIdx >= 0
        ? list[existingIdx].id
        : 'model_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const data = { nodes, elements, panels, sections, materials, groups, analysisSettings };
    const now = new Date().toISOString();
    const record: StoredModelRecord = {
      id,
      name: cleanName,
      updatedAt: now,
      nodesCount: nodes.length,
      elementsCount: elements.length,
      data,
    };
    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }
    saveStoredModelsList(list);
    setCurrentModelName(record.name);
    setCurrentModelId(record.id);
    setSaveModalOpen(false);
    setStatusHint(`Zapisano model "${record.name}" w pamięci przeglądarki.`);
  };

  const handleSelectLocalModel = (record: StoredModelRecord) => {
    if (record.data) {
      const loadedNodes = record.data.nodes || [];
      const loadedElems = record.data.elements || [];
      const loadedPanels = record.data.panels || [];
      const loadedSections = record.data.sections || sections;
      const loadedMaterials = record.data.materials || materials;
      const loadedGroups = record.data.groups || INITIAL_GROUPS;
      const loadedAnalysis = record.data.analysisSettings || analysisSettings;

      setNodes(loadedNodes);
      setElements(loadedElems);
      setPanels(loadedPanels);
      setSections(loadedSections);
      setMaterials(loadedMaterials);
      setGroups(loadedGroups);
      setAnalysisSettings(loadedAnalysis);
      setSolved(null);
      setSelectedNodeIds([]);
      setSelectedElemIds([]);
      setSelectedPanelIds([]);

      resetHistoryWithModel(
        loadedNodes,
        loadedElems,
        loadedPanels,
        loadedSections,
        loadedMaterials,
        loadedAnalysis,
        loadedGroups
      );

      if (loadedNodes.length > 0) {
        engineRef.current.fitView(loadedNodes);
      }
      setCurrentModelName(record.name);
      setCurrentModelId(record.id);
      setLoadModalOpen(false);
      setStatusHint(`Wczytano model "${record.name}" z pamięci przeglądarki.`);
    }
  };

  const handleImportJson = () => {
    if (jsonFileInputRef.current) {
      jsonFileInputRef.current.value = '';
      jsonFileInputRef.current.click();
    }
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed.nodes && parsed.elements) {
          const loadedNodes = parsed.nodes || [];
          const loadedElems = parsed.elements || [];
          const loadedPanels = parsed.panels || [];
          const loadedSections = parsed.sections || sections;
          const loadedMaterials = parsed.materials || materials;
          const loadedGroups = parsed.groups || INITIAL_GROUPS;
          const loadedAnalysis = parsed.analysisSettings || analysisSettings;

          setNodes(loadedNodes);
          setElements(loadedElems);
          setPanels(loadedPanels);
          setSections(loadedSections);
          setMaterials(loadedMaterials);
          setGroups(loadedGroups);
          setAnalysisSettings(loadedAnalysis);
          setSolved(null);
          setSelectedNodeIds([]);
          setSelectedElemIds([]);
          setSelectedPanelIds([]);

          resetHistoryWithModel(
            loadedNodes,
            loadedElems,
            loadedPanels,
            loadedSections,
            loadedMaterials,
            loadedAnalysis,
            loadedGroups
          );

          if (loadedNodes.length > 0) {
            engineRef.current.fitView(loadedNodes);
          }
          const baseName = file.name.replace(/\.json$/i, '');
          setCurrentModelName(baseName);
          setCurrentModelId(null);
          setStatusHint(`Zaimportowano model z pliku JSON: ${file.name}`);
        } else {
          alert('Plik nie zawiera poprawnej struktury modelu (węzły i pręty).');
        }
      } catch (err: any) {
        alert('Błąd podczas importu pliku JSON: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportJson = () => {
    setExportModalOpen(true);
  };

  const handleConfirmExportJson = (filename: string) => {
    const cleanName = filename.trim().replace(/\.json$/i, '') || 'model-3d';
    const data = { nodes, elements, panels, sections, materials, groups, analysisSettings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 10000);
    setExportModalOpen(false);
    setStatusHint(`Wyeksportowano model do pliku ${cleanName}.json`);
  };

  const handleAddBasicDimensions = () => {
    if (nodes.length === 0) {
      setStatusHint('Brak węzłów w modelu do wyznaczenia gabarytów.');
      return;
    }
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    nodes.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
      if (n.z < minZ) minZ = n.z;
      if (n.z > maxZ) maxZ = n.z;
    });

    const newDLs: DimensionLine3D[] = [];
    let startId = dimensionLines.length > 0 ? Math.max(...dimensionLines.map((d) => d.id)) + 1 : 1;

    // Dimension X
    if (Math.abs(maxX - minX) > 1e-4) {
      newDLs.push({
        id: startId++,
        p1: [minX, minY, minZ],
        p2: [maxX, minY, minZ],
        name: 'Gabaryt X',
      });
    }
    // Dimension Y
    if (Math.abs(maxY - minY) > 1e-4) {
      newDLs.push({
        id: startId++,
        p1: [minX, minY, minZ],
        p2: [minX, maxY, minZ],
        name: 'Gabaryt Y',
      });
    }
    // Dimension Z
    if (Math.abs(maxZ - minZ) > 1e-4) {
      newDLs.push({
        id: startId++,
        p1: [minX, minY, minZ],
        p2: [minX, minY, maxZ],
        name: 'Gabaryt Z',
      });
    }

    if (newDLs.length > 0) {
      setDimensionLines((prev) => [...prev, ...newDLs]);
      setStatusHint(`Dodano ${newDLs.length} podstawowe linie wymiarowe gabarytów.`);
    } else {
      setStatusHint('Wszystkie węzły znajdują się w jednym punkcie.');
    }
  };

  const handleClearConstructionLines = () => {
    setGridCoords({ x: [], y: [], z: [] });
    setSelectedConstructionLineIds([]);
    setStatusHint('Wyczyszczono wszystkie osie siatki konstrukcyjnej.');
  };

  const handleClearDimensionLines = () => {
    setDimensionLines([]);
    setSelectedDimensionLineIds([]);
    setStatusHint('Usunięto wszystkie linie wymiarowe.');
  };

  // Helper functions to sync loads between Model (nodes/elements/panels) and Load Cases
  const extractLoadsFromModel = useCallback(
    (nodesList: Node3D[], elementsList: Element3D[], panelsList: Panel3D[]) => {
      const nodeForces: Record<number, any> = {};
      const nodeMoments: Record<number, any> = {};
      const elementLoads: Record<number, any> = {};
      const elementThermals: Record<number, any> = {};
      const panelPressures: Record<number, any> = {};

      nodesList.forEach((n) => {
        if (n.force && (n.force.Fx || n.force.Fy || n.force.Fz)) {
          nodeForces[n.id] = { ...n.force };
        }
        if (n.moment && (n.moment.Mx || n.moment.My || n.moment.Mz)) {
          nodeMoments[n.id] = { ...n.moment };
        }
      });

      elementsList.forEach((el) => {
        if (
          el.q &&
          (el.q.qxStart || el.q.qxEnd || el.q.qyStart || el.q.qyEnd || el.q.qzStart || el.q.qzEnd)
        ) {
          elementLoads[el.id] = { ...el.q };
        }
        if (
          el.thermal &&
          (el.thermal.deltaTx || el.thermal.deltaTy || el.thermal.deltaTz || el.thermal.dT_axial)
        ) {
          elementThermals[el.id] = { ...el.thermal };
        }
      });

      panelsList.forEach((p) => {
        if (p.pressure && p.pressure.value) {
          panelPressures[p.id] = { ...p.pressure };
        }
      });

      return { nodeForces, nodeMoments, elementLoads, elementThermals, panelPressures };
    },
    []
  );

  const applyCaseLoadsToModel = useCallback(
    (lc: LoadCase3D, nodesList: Node3D[], elementsList: Element3D[], panelsList: Panel3D[]) => {
      const nextNodes = nodesList.map((n) => ({
        ...n,
        force: lc.nodeForces?.[n.id] ? { ...lc.nodeForces[n.id] } : undefined,
        moment: lc.nodeMoments?.[n.id] ? { ...lc.nodeMoments[n.id] } : undefined,
      }));

      const nextElements = elementsList.map((el) => ({
        ...el,
        q: lc.elementLoads?.[el.id] ? { ...lc.elementLoads[el.id] } : undefined,
        thermal: lc.elementThermals?.[el.id] ? { ...lc.elementThermals[el.id] } : undefined,
      }));

      const nextPanels = panelsList.map((p) => ({
        ...p,
        pressure: lc.panelPressures?.[p.id] ? { ...lc.panelPressures[p.id] } : undefined,
      }));

      return { nextNodes, nextElements, nextPanels };
    },
    []
  );

  const handleSelectLoadCase = useCallback(
    (newId: number) => {
      if (newId === activeLoadCaseId) return;

      const currentLoads = extractLoadsFromModel(nodes, elements, panels);
      const updatedCases = loadCases.map((lc) =>
        lc.id === activeLoadCaseId ? { ...lc, ...currentLoads } : lc
      );

      const targetCase = updatedCases.find((lc) => lc.id === newId);
      if (targetCase) {
        const { nextNodes, nextElements, nextPanels } = applyCaseLoadsToModel(
          targetCase,
          nodes,
          elements,
          panels
        );
        setNodes(nextNodes);
        setElements(nextElements);
        setPanels(nextPanels);
      }

      setLoadCases(updatedCases);
      setActiveLoadCaseId(newId);

      if (multiSolved) {
        const caseKey = `case_${newId}`;
        if (multiSolved.cases[newId]) {
          setActiveResultKey(caseKey);
          setSolved(multiSolved.cases[newId].result);
        }
      }
    },
    [activeLoadCaseId, extractLoadsFromModel, applyCaseLoadsToModel, loadCases, nodes, elements, panels, multiSolved]
  );

  const handleAddLoadCase = useCallback(
    (nature: LoadNature, category?: EurocodeCategory, name?: string) => {
      const currentLoads = extractLoadsFromModel(nodes, elements, panels);
      const nextId = (loadCases.length > 0 ? Math.max(...loadCases.map((c) => c.id)) : 0) + 1;
      const defaults = getDefaultPsiAndGammas(nature, category);

      const defaultName = name || `${getNatureLabel(nature).split(' ')[0]} ${nextId}`;

      const newCase: LoadCase3D = {
        id: nextId,
        name: defaultName,
        nature,
        category,
        includeSelfWeight: nature === 'permanent' && loadCases.filter((c) => c.nature === 'permanent').length === 0,
        ...defaults,
        nodeForces: {},
        nodeMoments: {},
        elementLoads: {},
        elementThermals: {},
        panelPressures: {},
      };

      const updatedCases = [
        ...loadCases.map((lc) => (lc.id === activeLoadCaseId ? { ...lc, ...currentLoads } : lc)),
        newCase,
      ];

      const { nextNodes, nextElements, nextPanels } = applyCaseLoadsToModel(
        newCase,
        nodes,
        elements,
        panels
      );
      setNodes(nextNodes);
      setElements(nextElements);
      setPanels(nextPanels);

      setLoadCases(updatedCases);
      setActiveLoadCaseId(nextId);
      if (solved) setSolved(null);
      if (multiSolved) setMultiSolved(null);
    },
    [
      activeLoadCaseId,
      extractLoadsFromModel,
      applyCaseLoadsToModel,
      loadCases,
      nodes,
      elements,
      panels,
      solved,
      multiSolved,
    ]
  );

  const handleUpdateLoadCase = useCallback(
    (updatedCase: LoadCase3D) => {
      setLoadCases((prev) => prev.map((lc) => (lc.id === updatedCase.id ? updatedCase : lc)));
      if (solved) setSolved(null);
      if (multiSolved) setMultiSolved(null);
    },
    [solved, multiSolved]
  );

  const handleDeleteLoadCase = useCallback(
    (id: number) => {
      if (loadCases.length <= 1) return;
      const updatedCases = loadCases.filter((lc) => lc.id !== id);
      setLoadCases(updatedCases);

      if (activeLoadCaseId === id) {
        const fallbackCase = updatedCases[0];
        const { nextNodes, nextElements, nextPanels } = applyCaseLoadsToModel(
          fallbackCase,
          nodes,
          elements,
          panels
        );
        setNodes(nextNodes);
        setElements(nextElements);
        setPanels(nextPanels);
        setActiveLoadCaseId(fallbackCase.id);
      }

      if (solved) setSolved(null);
      if (multiSolved) setMultiSolved(null);
    },
    [loadCases, activeLoadCaseId, applyCaseLoadsToModel, nodes, elements, panels, solved, multiSolved]
  );

  const handleSelectResultKey = useCallback(
    (key: string) => {
      setActiveResultKey(key);
      if (!multiSolved) return;

      if (multiSolved.type === 'stability' || solved?.type === 'stability') {
        let activeStab: import('./fem/types').StabilityResult3D | null = null;

        if (multiSolved.envelopes[key]?.stabilityResult) {
          activeStab = multiSolved.envelopes[key].stabilityResult || null;
        } else if (multiSolved.combinations[key]?.stabilityResult) {
          activeStab = multiSolved.combinations[key].stabilityResult || null;
        } else if (key.startsWith('case_')) {
          const cId = Number(key.replace('case_', ''));
          activeStab = multiSolved.cases[cId]?.stabilityResult || null;
          if (cId !== activeLoadCaseId) {
            const targetCase = loadCases.find((lc) => lc.id === cId);
            if (targetCase) {
              const { nextNodes, nextElements, nextPanels } = applyCaseLoadsToModel(
                targetCase,
                nodes,
                elements,
                panels
              );
              setNodes(nextNodes);
              setElements(nextElements);
              setPanels(nextPanels);
              setActiveLoadCaseId(cId);
            }
          }
        }

        if (activeStab) {
          setSolved(activeStab);
        }
        return;
      }

      let activeRes: import('./fem/types').LinearStaticResult3D | null = null;
      if (multiSolved.envelopes[key]) {
        activeRes = multiSolved.envelopes[key].result;
      } else if (multiSolved.combinations[key]) {
        activeRes = multiSolved.combinations[key].result;
      } else if (key.startsWith('case_')) {
        const cId = Number(key.replace('case_', ''));
        activeRes = multiSolved.cases[cId]?.result || null;
        if (cId !== activeLoadCaseId) {
          const targetCase = loadCases.find((lc) => lc.id === cId);
          if (targetCase) {
            const { nextNodes, nextElements, nextPanels } = applyCaseLoadsToModel(
              targetCase,
              nodes,
              elements,
              panels
            );
            setNodes(nextNodes);
            setElements(nextElements);
            setPanels(nextPanels);
            setActiveLoadCaseId(cId);
          }
        }
      }

      if (activeRes) {
        setSolved(activeRes);
      }
    },
    [multiSolved, solved, activeLoadCaseId, loadCases, applyCaseLoadsToModel, nodes, elements, panels]
  );

  // Perform 3D FEM Analysis
  const handleSolveOrBack = () => {
    if (solved) {
      setSolved(null);
      setMultiSolved(null);
      setActiveResultKey('');
      setSolveWarning(null);
      setProbe({ elId: null, t: 0.5 });
      setStatusHint('Tryb: Zaznacz');
      return;
    }

    if (nodes.length < 2 || elements.length < 1) {
      setSolveWarning('Model musi zawierać co najmniej dwa węzły i jeden pręt.');
      return;
    }

    const hasSupport = nodes.some(
      (n) =>
        n.support &&
        (n.support.ux.type !== 'free' ||
          n.support.uy.type !== 'free' ||
          n.support.uz.type !== 'free' ||
          n.support.rx.type !== 'free' ||
          n.support.ry.type !== 'free' ||
          n.support.rz.type !== 'free')
    );

    if (!hasSupport) {
      setSolveWarning('Model nie posiada żadnych podpór (układ geometrycznie zmienny).');
      return;
    }

    // Always reset probe to inactive state when running calculation
    setProbe({ elId: null, t: 0.5 });

    // Sync current canvas loads into active load case
    const currentLoads = extractLoadsFromModel(nodes, elements, panels);
    const finalLoadCases = loadCases.map((lc) =>
      lc.id === activeLoadCaseId ? { ...lc, ...currentLoads } : lc
    );
    setLoadCases(finalLoadCases);

    try {
      if (analysisSettings.type === 'stability') {
        const multiRes = solveAllLoadCasesAndCombinations3D(
          nodes,
          elements,
          panels,
          materials,
          sections,
          finalLoadCases,
          autoCombinations,
          customCombinations,
          analysisSettings
        );

        const bucklingModesCount = analysisSettings.params.bucklingModes || 4;

        // 1. Solve stability for each base load case
        for (const cIdStr of Object.keys(multiRes.cases)) {
          const cId = Number(cIdStr);
          const caseObj = multiRes.cases[cId];
          const caseModel = createModelForLoadCase(
            nodes,
            elements,
            panels,
            materials,
            sections,
            caseObj.loadCase,
            analysisSettings
          );
          caseObj.stabilityResult = solveStability3D(caseModel, bucklingModesCount, caseObj.result);
        }

        // 2. Solve stability for each combination
        let minAlphaSgn = Infinity;
        let minSgnStabRes: import('./fem/types').StabilityResult3D | null = null;

        for (const combId of Object.keys(multiRes.combinations)) {
          const combObj = multiRes.combinations[combId];
          const baseModel = {
            nodes: nodes.map((n) => ({ ...n, force: null, moment: null })),
            elements: elements.map((e) => ({ ...e, q: null, thermal: null })),
            panels: panels.map((p) => ({ ...p, pressure: null })),
            materials,
            sections,
            settings: {
              ...analysisSettings,
              params: {
                ...analysisSettings.params,
                includeSelfWeight,
              },
            },
          };
          const stabRes = solveStability3D(baseModel, bucklingModesCount, combObj.result);
          combObj.stabilityResult = stabRes;

          if (combObj.comb.type === 'SGN' && stabRes.modes && stabRes.modes.length > 0) {
            const firstAlpha = stabRes.modes[0].alphaCr;
            if (firstAlpha < minAlphaSgn) {
              minAlphaSgn = firstAlpha;
              minSgnStabRes = stabRes;
            }
          }
        }

        // 3. Attach governing envelope stability result (lowest alpha_cr)
        if (multiRes.envelopes['env_sgn'] && minSgnStabRes) {
          multiRes.envelopes['env_sgn'].stabilityResult = minSgnStabRes;
        }

        multiRes.type = 'stability';
        setMultiSolved(multiRes);

        const initialKey = multiRes.envelopes['env_sgn']
          ? 'env_sgn'
          : multiRes.cases[activeLoadCaseId]
          ? `case_${activeLoadCaseId}`
          : Object.keys(multiRes.cases)[0]
          ? `case_${Object.keys(multiRes.cases)[0]}`
          : 'case_1';

        setActiveResultKey(initialKey);

        const activeStabRes =
          (initialKey === 'env_sgn' ? multiRes.envelopes['env_sgn']?.stabilityResult : null) ||
          multiRes.cases[activeLoadCaseId]?.stabilityResult ||
          multiRes.combinations[initialKey]?.stabilityResult ||
          Object.values(multiRes.cases)[0]?.stabilityResult;

        if (activeStabRes) {
          setSolved(activeStabRes);
          if (activeStabRes.singular) setSolveWarning('Osobliwa macierz sztywności. Sprawdź schemat statyczny.');
          else if (activeStabRes.noCompression) setSolveWarning('Brak elementów ściskanych w tym układzie obciążeń.');
          else setStatusHint(`Obliczono stateczność dla ${Object.keys(multiRes.cases).length} przypadków i ${Object.keys(multiRes.combinations).length} kombinacji.`);
        }
      } else if (analysisSettings.type === 'modal') {
        const solverModel = {
          nodes,
          elements,
          panels,
          materials,
          sections,
          settings: {
            ...analysisSettings,
            params: {
              ...analysisSettings.params,
              includeSelfWeight,
            },
          },
        };
        const out = solveModal3D(solverModel, analysisSettings.params.modalModes || 4);
        setSolved(out);
        if (out.singular) setSolveWarning('Osobliwa macierz sztywności.');
        else if (out.noMass) setSolveWarning('Brak masy w modelu (zdefiniuj masy w węzłach lub włącz masę prętów).');
        else setStatusHint(`Obliczono drgania własne: ${out.modes.length} form drgań.`);
      } else {
        const multiRes = solveAllLoadCasesAndCombinations3D(
          nodes,
          elements,
          panels,
          materials,
          sections,
          finalLoadCases,
          autoCombinations,
          customCombinations,
          analysisSettings
        );

        setMultiSolved(multiRes);

        const initialKey = multiRes.activeKey;
        setActiveResultKey(initialKey);

        let activeRes: import('./fem/types').LinearStaticResult3D | null = null;
        if (multiRes.envelopes[initialKey]) {
          activeRes = multiRes.envelopes[initialKey].result;
        } else if (multiRes.combinations[initialKey]) {
          activeRes = multiRes.combinations[initialKey].result;
        } else if (initialKey.startsWith('case_')) {
          const cId = Number(initialKey.replace('case_', ''));
          activeRes = multiRes.cases[cId]?.result || null;
        }

        if (activeRes) {
          setSolved(activeRes);
          const combCount = Object.keys(multiRes.combinations).length;
          setStatusHint(
            `Obliczono statykę: ${finalLoadCases.length} przypadków obciążeń i ${combCount} kombinacji (EN 1990).`
          );
        }
      }
    } catch (e: any) {
      setSolveWarning('Błąd obliczeń MES: ' + e.message);
    }
  };

  const autoDimensionLines = useMemo<DimensionLine3D[]>(() => {
    const xVals = Array.from(new Set<number>(gridCoords.x.map((v) => Math.round(v * 1000) / 1000))).sort((a, b) => a - b);
    const yVals = Array.from(new Set<number>(gridCoords.y.map((v) => Math.round(v * 1000) / 1000))).sort((a, b) => a - b);
    const zVals = Array.from(new Set<number>(gridCoords.z.map((v) => Math.round(v * 1000) / 1000))).sort((a, b) => a - b);

    const hasX = xVals.length > 0;
    const hasY = yVals.length > 0;
    const hasZ = zVals.length > 0;

    const activeCount = (hasX ? 1 : 0) + (hasY ? 1 : 0) + (hasZ ? 1 : 0);
    if (activeCount < 2) return [];

    const effX: number[] = hasX ? xVals : [0];
    const effY: number[] = hasY ? yVals : [0];
    const effZ: number[] = hasZ ? zVals : [0];

    const minX = effX[0];
    const maxX = effX[effX.length - 1];
    const minY = effY[0];
    const maxY = effY[effY.length - 1];
    const minZ = effZ[0];
    const maxZ = effZ[effZ.length - 1];

    const offset = 0.8;
    const mainOffset = 0.55;
    const autoLines: DimensionLine3D[] = [];
    let dId = 10000;

    if (hasX && xVals.length >= 2) {
      for (let i = 0; i < xVals.length - 1; i++) {
        autoLines.push({
          id: dId++,
          p1: [xVals[i], minY - offset, minZ - offset],
          p2: [xVals[i + 1], minY - offset, minZ - offset],
          name: `Grid X ${xVals[i].toFixed(2)} - ${xVals[i + 1].toFixed(2)}`,
        });
      }
      if (xVals.length >= 3) {
        autoLines.push({
          id: dId++,
          p1: [xVals[0], minY - offset - mainOffset, minZ - offset - mainOffset],
          p2: [xVals[xVals.length - 1], minY - offset - mainOffset, minZ - offset - mainOffset],
          name: `Grid X Główny ${xVals[0].toFixed(2)} - ${xVals[xVals.length - 1].toFixed(2)}`,
        });
      }
    }

    if (hasY && yVals.length >= 2) {
      for (let i = 0; i < yVals.length - 1; i++) {
        autoLines.push({
          id: dId++,
          p1: [minX - offset, yVals[i], minZ - offset],
          p2: [minX - offset, yVals[i + 1], minZ - offset],
          name: `Grid Y ${yVals[i].toFixed(2)} - ${yVals[i + 1].toFixed(2)}`,
        });
      }
      if (yVals.length >= 3) {
        autoLines.push({
          id: dId++,
          p1: [minX - offset - mainOffset, yVals[0], minZ - offset - mainOffset],
          p2: [minX - offset - mainOffset, yVals[yVals.length - 1], minZ - offset - mainOffset],
          name: `Grid Y Główny ${yVals[0].toFixed(2)} - ${yVals[yVals.length - 1].toFixed(2)}`,
        });
      }
    }

    if (hasZ && zVals.length >= 2) {
      for (let i = 0; i < zVals.length - 1; i++) {
        autoLines.push({
          id: dId++,
          p1: [minX - offset, minY - offset, zVals[i]],
          p2: [minX - offset, minY - offset, zVals[i + 1]],
          name: `Grid Z ${zVals[i].toFixed(2)} - ${zVals[i + 1].toFixed(2)}`,
        });
      }
      if (zVals.length >= 3) {
        autoLines.push({
          id: dId++,
          p1: [minX - offset - mainOffset, minY - offset - mainOffset, zVals[0]],
          p2: [minX - offset - mainOffset, minY - offset - mainOffset, zVals[zVals.length - 1]],
          name: `Grid Z Główny ${zVals[0].toFixed(2)} - ${zVals[zVals.length - 1].toFixed(2)}`,
        });
      }
    }

    return autoLines;
  }, [gridCoords]);

  // Render loop
  const redraw = useCallback(() => {
    const webglCanvas = webglCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!webglCanvas || !overlayCanvas) return;
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!overlayCtx) return;

    const engine = engineRef.current;
    const rect = overlayCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const displayW = Math.round(rect.width * dpr);
    const displayH = Math.round(rect.height * dpr);

    if (displayW === 0 || displayH === 0) return;

    if (webglCanvas.width !== displayW || webglCanvas.height !== displayH) {
      webglCanvas.width = displayW;
      webglCanvas.height = displayH;
    }
    if (overlayCanvas.width !== displayW || overlayCanvas.height !== displayH) {
      overlayCanvas.width = displayW;
      overlayCanvas.height = displayH;
    }
    overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    engine.setCanvas(webglCanvas);
    engine.setSize(rect.width, rect.height, dpr);

    const accentDef = APP_ACCENTS[accent] || APP_ACCENTS.blue;

    const renderOpts: SceneRenderOptions = {
      showGrid,
      showAxes,
      showLocalAxes,
      showPanels,
      showNodeNumbers,
      showElementNumbers,
      showSectionNames,
      showMaterialNames,
      showSupports,
      showProfileSketches,
      showLoads,
      showLoadValues,
      showHingeLabels,
      showDimensions,
      showDeform,
      showMy,
      showMz,
      showMx,
      showVy,
      showVz,
      showN,
      showStress,
      showReactions,
      hideLoadsInResults,
      hideSupportsInResults,
      deformScaleMult,
      diagramScaleMult,
      diagramLabelMode,
      selectedNodeIds,
      selectedElemIds,
      selectedPanelIds,
      selectedConstructionLineIds,
      selectedDimensionLineIds,
      hoverNodeId: hoverNodeIdRef.current,
      hoverElemId: hoverElemIdRef.current,
      hoverPanelId: hoverPanelIdRef.current,
      hoverConstructionLineId: hoverConstructionLineIdRef.current,
      hoverDimensionLineId: hoverDimensionLineIdRef.current,
      constructionLines: drawConstructionGrid ? constructionLines : [],
      dimensionLines: [...dimensionLines, ...(drawOuterDimensionLines ? autoDimensionLines : [])],
      groups,
      mode,
      probe,
      theme,
      accentColor: accentDef.hex,
      graphicsMode,
      gridPlane,
      gridOffset,
      momentsAsArcs,
      activeResultKey,
    };

    // 1. Draw 3D Three.js WebGL Scene & 2D Text/Overlay Labels
    drawScene3D(overlayCtx, engine, nodes, elements, sections, materials, solved, renderOpts, panels);

    // 2. Draw Interactive 3D ViewCube in Top-Right
    if (showCanvasUI) {
      engine.drawViewCube(overlayCtx, hoverViewCubeRef.current);
    }

    // 3. Draw 2D Box Selection Overlay if active
    if (boxSelectStateRef.current.isDragging && boxSelectStateRef.current.hasMoved) {
      const { startX, startY, curX, curY } = boxSelectStateRef.current;
      const x0 = Math.min(startX, curX);
      const x1 = Math.max(startX, curX);
      const y0 = Math.min(startY, curY);
      const y1 = Math.max(startY, curY);
      const isWindow = curX >= startX;

      overlayCtx.save();
      overlayCtx.lineWidth = 1.4;
      overlayCtx.strokeStyle = isWindow ? (accentDef.hex || '#2563eb') : '#16a34a';
      overlayCtx.setLineDash(isWindow ? [] : [5, 4]);
      overlayCtx.fillStyle = isWindow ? 'rgba(37, 99, 235, 0.12)' : 'rgba(22, 163, 74, 0.12)';
      overlayCtx.fillRect(x0, y0, x1 - x0, y1 - y0);
      overlayCtx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      overlayCtx.restore();
    }

    // 4. Draw Transient Drawing Overlays (Guide line, dimension line, node coordinate tip)
    const isTouch = isTouchRef.current || (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
    drawTransientOverlays(
      overlayCtx,
      engine,
      nodes,
      elements,
      panels,
      mode,
      panelShape,
      panelPoints,
      barStartNodeId,
      lastPlacedNodeId,
      lastDrawnElemId,
      mousePosRef.current,
      gridPlane,
      gridOffset,
      snapEnabled,
      snapSize,
      hoverNodeIdRef.current,
      accentDef.hex,
      isTouch,
      selectedNodeIds,
      selectedElemIds,
      selectedPanelIds,
      activeTransformMode,
      transformWithCopy,
      transformConnect,
      transformRepeat,
      moveDx,
      moveDy,
      moveDz,
      [rotateCx, rotateCy, rotateCz],
      rotateAxis,
      rotateAngle,
      [mirrorPx, mirrorPy, mirrorPz],
      mirrorPlane,
      [scaleCx, scaleCy, scaleCz],
      scaleFactor,
      pickMoveVector,
      pickTransformPoint,
      splitFormOpen,
      splitMode,
      splitT,
      splitN,
      linesSubMode,
      lineStartPoint,
      activeGridAxis,
      drawConstructionGrid,
      drawConstructionGrid ? constructionPoints : []
    );
  }, [
    nodes,
    elements,
    panels,
    constructionLines,
    dimensionLines,
    activeGridAxis,
    gridCoords,
    selectedConstructionLineIds,
    selectedDimensionLineIds,
    linesSubMode,
    lineStartPoint,
    panelShape,
    panelPoints,
    sections,
    materials,
    solved,
    selectedNodeIds,
    selectedElemIds,
    selectedPanelIds,
    mode,
    barStartNodeId,
    lastPlacedNodeId,
    lastDrawnElemId,
    snapEnabled,
    snapSize,
    theme,
    accent,
    showGrid,
    showAxes,
    showLocalAxes,
    showPanels,
    showNodeNumbers,
    showElementNumbers,
    showSectionNames,
    showMaterialNames,
    showSupports,
    showProfileSketches,
    showLoads,
    showLoadValues,
    showHingeLabels,
    showDimensions,
    showDeform,
    showMy,
    showMz,
    showMx,
    showVy,
    showVz,
    showN,
    showStress,
    showReactions,
    hideLoadsInResults,
    hideSupportsInResults,
    deformScaleMult,
    diagramScaleMult,
    diagramLabelMode,
    probe,
    showCanvasUI,
    gridPlane,
    gridOffset,
    activeTransformMode,
    transformWithCopy,
    transformConnect,
    transformRepeat,
    moveDx,
    moveDy,
    moveDz,
    rotateCx,
    rotateCy,
    rotateCz,
    rotateAxis,
    rotateAngle,
    mirrorPx,
    mirrorPy,
    mirrorPz,
    mirrorPlane,
    scaleCx,
    scaleCy,
    scaleCz,
    scaleFactor,
    pickMoveVector,
    pickTransformPoint,
    splitFormOpen,
    splitMode,
    splitT,
    splitN,
    drawConstructionGrid,
    constructionPoints,
    drawOuterDimensionLines,
    autoDimensionLines,
    momentsAsArcs,
    graphicsMode,
  ]);

  useEffect(() => {
    const animId = requestAnimationFrame(() => {
      redraw();
    });
    return () => cancelAnimationFrame(animId);
  }, [redraw]);

  // Window resize listener
  useEffect(() => {
    const handleResize = () => {
      redraw();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redraw]);

  // Panel height resize for vertical / mobile mode
  const [panelHeight, setPanelHeight] = useState<number | null>(null);

  const handlePanelResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    const isFromStatusbar = target.closest('#statusbar') !== null;
    if (isFromStatusbar && !showCanvasUI) return;

    const sidebarEl = document.getElementById('sidebar');
    const mainEl = document.getElementById('main');
    if (!sidebarEl) return;
    const isVerticalLayout = mainEl
      ? window.getComputedStyle(mainEl).flexDirection === 'column'
      : window.innerWidth <= 860;
    if (!isVerticalLayout) return;

    if (e.cancelable) e.preventDefault();
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startH = sidebarEl.getBoundingClientRect().height;

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      const currentY = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      const dy = startY - currentY;
      // Min height: 20px (height of the handle, collapsing everything under it)
      const newH = Math.max(20, Math.min(window.innerHeight * 0.88, startH + dy));
      setPanelHeight(newH);
    };

    const handleEnd = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
  };

  // ResizeObserver for canvas wrapper
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver(() => {
      redraw();
    });
    ro.observe(canvas);

    return () => ro.disconnect();
  }, [redraw]);

  // Initial fit view on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      engineRef.current.fitView(nodes);
      redraw();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Dynamically update rotation center to centroid of selection (or model centroid if nothing selected)
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const center = calculateRotationCenter(
      selectedNodeIds,
      selectedElemIds,
      selectedPanelIds,
      nodes,
      elements,
      panels
    );
    engine.setRotationCenter(center);
    redraw();
  }, [selectedNodeIds, selectedElemIds, selectedPanelIds, nodes, elements, panels, redraw]);

  // --- Camera & Selection Actions ---
  const handleFitView = () => {
    engineRef.current.fitView(nodes);
    redraw();
    setStatusHint('Dopasowano widok do geometrii modelu.');
  };

  const pluralUnit = (n: number, one: string, few: string, many: string) => {
    if (n === 1) return `${n} ${one}`;
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
      return `${n} ${few}`;
    }
    return `${n} ${many}`;
  };

  const rectContainsPoint = (rect: { x0: number; x1: number; y0: number; y1: number }, p: { x: number; y: number }) => {
    return p.x >= rect.x0 && p.x <= rect.x1 && p.y >= rect.y0 && p.y <= rect.y1;
  };

  const ccw2D = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) => {
    return (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);
  };

  const segSegIntersect = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number },
    p4: { x: number; y: number }
  ) => {
    const d1 = ccw2D(p3, p4, p1);
    const d2 = ccw2D(p3, p4, p2);
    const d3 = ccw2D(p1, p2, p3);
    const d4 = ccw2D(p1, p2, p4);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
    return false;
  };

  const segIntersectsRect = (
    pa: { x: number; y: number },
    pb: { x: number; y: number },
    rect: { x0: number; x1: number; y0: number; y1: number }
  ) => {
    if (rectContainsPoint(rect, pa) || rectContainsPoint(rect, pb)) return true;
    const c1 = { x: rect.x0, y: rect.y0 };
    const c2 = { x: rect.x1, y: rect.y0 };
    const c3 = { x: rect.x1, y: rect.y1 };
    const c4 = { x: rect.x0, y: rect.y1 };
    return (
      segSegIntersect(pa, pb, c1, c2) ||
      segSegIntersect(pa, pb, c2, c3) ||
      segSegIntersect(pa, pb, c3, c4) ||
      segSegIntersect(pa, pb, c4, c1)
    );
  };

  const isPointInPolygon2D = (px: number, py: number, poly: { x: number; y: number }[]): boolean => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const getHitPanelAt = (
    px: number,
    py: number,
    panelsList: Panel3D[],
    nodesList: Node3D[],
    engine: RenderEngine3D
  ): number | null => {
    let bestPanelId: number | null = null;
    let minDepth = Infinity;

    for (const pan of panelsList) {
      const corners = getPanelCorners(pan, nodesList);
      if (corners.length < 3) continue;

      const pts = corners.map((c) => engine.project(c));
      if (!pts.every((p) => p.visible)) continue;

      if (isPointInPolygon2D(px, py, pts)) {
        const avgDepth = pts.reduce((sum, p) => sum + p.depth, 0) / pts.length;
        if (avgDepth < minDepth) {
          minDepth = avgDepth;
          bestPanelId = pan.id;
        }
      }
    }

    return bestPanelId;
  };

  const updateSelection = (
    currentIds: number[],
    newIds: number[],
    selMode: 'replace' | 'add' | 'subtract' | 'toggle'
  ): number[] => {
    if (selMode === 'replace') {
      return newIds;
    } else if (selMode === 'add') {
      const set = new Set([...currentIds, ...newIds]);
      return Array.from(set);
    } else if (selMode === 'subtract') {
      return currentIds.filter((id) => !newIds.includes(id));
    } else if (selMode === 'toggle') {
      const result = [...currentIds];
      newIds.forEach((id) => {
        const idx = result.indexOf(id);
        if (idx !== -1) {
          result.splice(idx, 1);
        } else {
          result.push(id);
        }
      });
      return result;
    }
    return newIds;
  };

  const applyBoxSelection = (
    startX: number,
    startY: number,
    curX: number,
    curY: number,
    selMode: 'replace' | 'add' | 'subtract' | 'toggle' = 'replace'
  ) => {
    const engine = engineRef.current;
    const x0 = Math.min(startX, curX);
    const x1 = Math.max(startX, curX);
    const y0 = Math.min(startY, curY);
    const y1 = Math.max(startY, curY);
    const rect = { x0, x1, y0, y1 };
    const isWindow = curX >= startX;

    const hitNodeIds: number[] = [];
    nodes.forEach((n) => {
      const p = engine.project([n.x, n.y, n.z]);
      if (rectContainsPoint(rect, p)) {
        hitNodeIds.push(n.id);
      }
    });

    const hitElemIds: number[] = [];
    elements.forEach((el) => {
      const n1 = nodes.find((n) => n.id === el.n1);
      const n2 = nodes.find((n) => n.id === el.n2);
      if (!n1 || !n2) return;
      const p1 = engine.project([n1.x, n1.y, n1.z]);
      const p2 = engine.project([n2.x, n2.y, n2.z]);

      if (isWindow) {
        if (rectContainsPoint(rect, p1) && rectContainsPoint(rect, p2)) {
          hitElemIds.push(el.id);
        }
      } else {
        if (segIntersectsRect(p1, p2, rect)) {
          hitElemIds.push(el.id);
        }
      }
    });

    const hitPanelIds: number[] = [];
    panels.forEach((pan) => {
      const corners = getPanelCorners(pan, nodes);
      if (corners.length < 3) return;
      const pts = corners.map((c) => engine.project(c));

      if (isWindow) {
        if (pts.every((p) => rectContainsPoint(rect, p))) {
          hitPanelIds.push(pan.id);
        }
      } else {
        const anyNodeIn = pts.some((p) => rectContainsPoint(rect, p));
        if (anyNodeIn) {
          hitPanelIds.push(pan.id);
          return;
        }
        let edgeIntersects = false;
        for (let i = 0; i < pts.length; i++) {
          const pA = pts[i];
          const pB = pts[(i + 1) % pts.length];
          if (segIntersectsRect(pA, pB, rect)) {
            edgeIntersects = true;
            break;
          }
        }
        if (edgeIntersects) {
          hitPanelIds.push(pan.id);
          return;
        }
        const boxCenterX = (x0 + x1) / 2;
        const boxCenterY = (y0 + y1) / 2;
        if (isPointInPolygon2D(boxCenterX, boxCenterY, pts)) {
          hitPanelIds.push(pan.id);
        }
      }
    });

    setSelectedNodeIds((prev) => updateSelection(prev, hitNodeIds, selMode));
    setSelectedElemIds((prev) => updateSelection(prev, hitElemIds, selMode));
    setSelectedPanelIds((prev) => updateSelection(prev, hitPanelIds, selMode));

    let actionLabel = '';
    if (selMode === 'add') actionLabel = 'Dodano do zaznaczenia';
    else if (selMode === 'subtract') actionLabel = 'Odjęto od zaznaczenia';
    else if (selMode === 'toggle') actionLabel = 'Przełączono zaznaczenie';
    else actionLabel = 'Zaznaczono ramką';

    const parts = [
      hitNodeIds.length ? pluralUnit(hitNodeIds.length, 'węzeł', 'węzły', 'węzłów') : null,
      hitElemIds.length ? pluralUnit(hitElemIds.length, 'pręt', 'pręty', 'prętów') : null,
      hitPanelIds.length ? pluralUnit(hitPanelIds.length, 'okładzina', 'okładziny', 'okładzin') : null,
    ].filter(Boolean);

    setStatusHint(
      `${actionLabel} (${isWindow ? 'okno' : 'przecięcie'}): ` + (parts.join(', ') || 'brak obiektów') + '.'
    );
  };

  // --- Mouse / Touch Handlers & Cursor Management ---
  const updateCanvasCursor = useCallback(
    (modifiers?: { ctrl?: boolean; shift?: boolean }) => {
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;

      const ctrl = modifiers?.ctrl !== undefined ? modifiers.ctrl : keyModifiersRef.current.ctrl;
      const shift = modifiers?.shift !== undefined ? modifiers.shift : keyModifiersRef.current.shift;
      const selMode = getEffectiveSelectionMode(ctrl, shift, mobileSelMode);

      const isHoverInteractive =
        hoverViewCubeRef.current != null ||
        hoverNodeIdRef.current != null ||
        hoverElemIdRef.current != null ||
        hoverPanelIdRef.current != null;

      const isDraggingBox = boxSelectStateRef.current.isDragging;
      const isDraggingNav = dragRef.current.isDragging;

      const newCursor = getCanvasCursor({
        mode,
        navMode,
        isHoverInteractive,
        selMode,
        isDraggingBox,
        isDraggingNav,
      });

      if (canvas.style.cursor !== newCursor) {
        canvas.style.cursor = newCursor;
      }
      const wrap = canvas.parentElement;
      if (wrap && wrap.style.cursor !== newCursor) {
        wrap.style.cursor = newCursor;
      }
    },
    [mobileSelMode, mode, navMode]
  );

  // Sync cursor whenever selection modes, tools, or navigation states change
  useEffect(() => {
    updateCanvasCursor();
  }, [updateCanvasCursor]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Ignore simulated mouse events from touches
    if (Date.now() - lastTouchTimeRef.current < 800) {
      return;
    }
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const engine = engineRef.current;

    // 1. Check if clicking on ViewCube on canvas
    const cubeHit = showCanvasUI ? engine.hitTestViewCube(px, py) : null;
    if (cubeHit) {
      if (cubeHit === 'FIT') {
        handleFitView();
      } else {
        const angles = engine.getViewAngles(cubeHit);
        engine.animateCameraTo(
          angles.az,
          angles.el,
          300,
          () => {
            redraw();
          }
        );
      }
      return;
    }

    // Stop any ongoing camera animation if user initiates manual drag
    engine.stopCameraAnimation();

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    if (ctrl !== keyModifiersRef.current.ctrl || shift !== keyModifiersRef.current.shift) {
      keyModifiersRef.current = { ctrl, shift };
      setKeyModifiers({ ctrl, shift });
    }

    // Standard mouse behaviors:
    // Middle button (e.button === 1) = ALWAYS Pan
    // Right button (e.button === 2) = ALWAYS Orbit
    if (e.button === 1) {
      dragRef.current = {
        isDragging: true,
        dragType: 'pan',
        startX: px,
        startY: py,
        startAzimuth: engine.camera.azimuth,
        startElevation: engine.camera.elevation,
        startPanX: engine.camera.panX,
        startPanY: engine.camera.panY,
        startScale: engine.camera.scale,
        hasMoved: false,
      };
      updateCanvasCursor({ ctrl, shift });
      return;
    }

    if (e.button === 2) {
      dragRef.current = {
        isDragging: true,
        dragType: 'orbit',
        startX: px,
        startY: py,
        startAzimuth: engine.camera.azimuth,
        startElevation: engine.camera.elevation,
        startPanX: engine.camera.panX,
        startPanY: engine.camera.panY,
        startScale: engine.camera.scale,
        hasMoved: false,
      };
      updateCanvasCursor({ ctrl, shift });
      return;
    }

    // Left click (e.button === 0):
    if (e.button === 0) {
      // 2. Check if Box Selection mode is active (Left click in select mode when navMode === 'boxSelect')
      if (mode === 'select' && navMode === 'boxSelect') {
        boxSelectStateRef.current = {
          isDragging: true,
          startX: px,
          startY: py,
          curX: px,
          curY: py,
          hasMoved: false,
        };
        updateCanvasCursor({ ctrl, shift });
        return;
      }

      // 3. Zoom mode (Lupa): Left click drag vertically zooms in/out
      if (navMode === 'zoom') {
        dragRef.current = {
          isDragging: true,
          dragType: 'zoom',
          startX: px,
          startY: py,
          startAzimuth: engine.camera.azimuth,
          startElevation: engine.camera.elevation,
          startPanX: engine.camera.panX,
          startPanY: engine.camera.panY,
          startScale: engine.camera.scale,
          hasMoved: false,
        };
        updateCanvasCursor({ ctrl, shift });
        return;
      }

      // 4. Pan mode (Łapka)
      if (navMode === 'pan') {
        dragRef.current = {
          isDragging: true,
          dragType: 'pan',
          startX: px,
          startY: py,
          startAzimuth: engine.camera.azimuth,
          startElevation: engine.camera.elevation,
          startPanX: engine.camera.panX,
          startPanY: engine.camera.panY,
          startScale: engine.camera.scale,
          hasMoved: false,
        };
        updateCanvasCursor({ ctrl, shift });
        return;
      }

      // 5. Default Orbit mode: left click rotates 3D scene (or clicks items on mouseUp if not dragged)
      dragRef.current = {
        isDragging: true,
        dragType: 'orbit',
        startX: px,
        startY: py,
        startAzimuth: engine.camera.azimuth,
        startElevation: engine.camera.elevation,
        startPanX: engine.camera.panX,
        startPanY: engine.camera.panY,
        startScale: engine.camera.scale,
        hasMoved: false,
      };
      updateCanvasCursor({ ctrl, shift });
    }
  };

  const getClosestEntityAt = (
    px: number,
    py: number,
    options: {
      includeNodes?: boolean;
      includeElements?: boolean;
      includePanels?: boolean;
    } = { includeNodes: true, includeElements: true, includePanels: true }
  ) => {
    const engine = engineRef.current;
    if (!engine) return null;

    interface Candidate {
      type: 'node' | 'element' | 'panel';
      id: number;
      depth: number;
      dist2D: number;
      t?: number;
    }

    const candidates: Candidate[] = [];

    // 1. Check nodes
    if (options.includeNodes) {
      nodes.forEach((n) => {
        const p = engine.project([n.x, n.y, n.z]);
        const d = Math.hypot(p.x - px, p.y - py);
        if (d < 14) {
          // Subtract a tiny depth bias so nodes are preferred over elements/panels at the exact same depth/position
          candidates.push({
            type: 'node',
            id: n.id,
            depth: p.depth - 0.05,
            dist2D: d,
          });
        }
      });
    }

    // 2. Check elements
    if (options.includeElements) {
      elements.forEach((el) => {
        const n1 = nodes.find((n) => n.id === el.n1);
        const n2 = nodes.find((n) => n.id === el.n2);
        if (!n1 || !n2) return;
        const p1 = engine.project([n1.x, n1.y, n1.z]);
        const p2 = engine.project([n2.x, n2.y, n2.z]);

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lenSq = dx * dx + dy * dy;
        let t = lenSq > 0 ? ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq : 0;
        t = Math.max(0, Math.min(1, t));
        const cx = p1.x + t * dx;
        const cy = p1.y + t * dy;
        const d = Math.hypot(px - cx, py - cy);
        if (d < 10) {
          // Calculate precise 3D point on the element to get its depth
          const x3D = n1.x + t * (n2.x - n1.x);
          const y3D = n1.y + t * (n2.y - n1.y);
          const z3D = n1.z + t * (n2.z - n1.z);
          const proj3D = engine.project([x3D, y3D, z3D]);

          // Subtract a tiny depth bias so elements are preferred over panels at the same depth
          candidates.push({
            type: 'element',
            id: el.id,
            depth: proj3D.depth - 0.02,
            dist2D: d,
            t,
          });
        }
      });
    }

    // 3. Check panels
    if (options.includePanels) {
      panels.forEach((pan) => {
        const corners = getPanelCorners(pan, nodes);
        if (corners.length < 3) return;

        const pts = corners.map((c) => engine.project(c));
        if (!pts.every((p) => p.visible)) return;

        if (isPointInPolygon2D(px, py, pts)) {
          const avgDepth = pts.reduce((sum, p) => sum + p.depth, 0) / pts.length;
          candidates.push({
            type: 'panel',
            id: pan.id,
            depth: avgDepth,
            dist2D: 0,
          });
        }
      });
    }

    if (candidates.length === 0) return null;

    // Sort by depth ascending (closest first)
    candidates.sort((a, b) => a.depth - b.depth);

    return candidates[0];
  };

  const getSnapped3DPoint = useCallback((
    px: number,
    py: number,
    customGridPlane: 'XY' | 'XZ' | 'YZ' = gridPlane,
    customGridOffset: number = gridOffset
  ): [number, number, number] => {
    const engine = engineRef.current;
    if (!engine) return [0, 0, 0];

    // 1. If there's an existing node near the cursor, snap to it!
    const closestNodeCandidate = getClosestEntityAt(px, py, { includeNodes: true, includeElements: false, includePanels: false });
    if (closestNodeCandidate && closestNodeCandidate.type === 'node') {
      const n = nodes.find((node) => node.id === closestNodeCandidate.id);
      if (n) return [n.x, n.y, n.z];
    }

    // 2. If drawing construction grid is enabled, check if we snap to a construction point!
    if (drawConstructionGrid && constructionPoints && constructionPoints.length > 0) {
      let closestCP: [number, number, number] | null = null;
      let minCPDist = 14; // Snapping radius of 14px
      for (const cp of constructionPoints) {
        const proj = engine.project(cp);
        if (proj.visible) {
          const d = Math.hypot(proj.x - px, proj.y - py);
          if (d < minCPDist) {
            minCPDist = d;
            closestCP = cp;
          }
        }
      }
      if (closestCP) {
        return closestCP;
      }
    }

    // 3. Fallback: unproject and snap to grid size if enabled
    const pt = engine.unprojectToPlane(px, py, customGridPlane, customGridOffset);
    let x = pt[0], y = pt[1], z = pt[2];
    if (snapEnabled) {
      if (customGridPlane === 'XY') {
        x = Math.round(x / snapSize) * snapSize;
        y = Math.round(y / snapSize) * snapSize;
        z = customGridOffset;
      } else if (customGridPlane === 'XZ') {
        x = Math.round(x / snapSize) * snapSize;
        y = customGridOffset;
        z = Math.round(z / snapSize) * snapSize;
      } else if (customGridPlane === 'YZ') {
        x = customGridOffset;
        y = Math.round(y / snapSize) * snapSize;
        z = Math.round(z / snapSize) * snapSize;
      }
    } else {
      if (customGridPlane === 'XY') z = customGridOffset;
      else if (customGridPlane === 'XZ') y = customGridOffset;
      else if (customGridPlane === 'YZ') x = customGridOffset;
    }
    return [
      Math.round(x * 1000) / 1000,
      Math.round(y * 1000) / 1000,
      Math.round(z * 1000) / 1000,
    ];
  }, [gridPlane, gridOffset, snapEnabled, snapSize, drawConstructionGrid, constructionPoints, nodes, getClosestEntityAt]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Ignore simulated mouse events from touches
    if (Date.now() - lastTouchTimeRef.current < 800) {
      return;
    }
    isTouchRef.current = false;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    mousePosRef.current = { px, py };

    const engine = engineRef.current;

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    if (ctrl !== keyModifiersRef.current.ctrl || shift !== keyModifiersRef.current.shift) {
      keyModifiersRef.current = { ctrl, shift };
      setKeyModifiers({ ctrl, shift });
    }

    if (boxSelectStateRef.current.isDragging) {
      const dx = px - boxSelectStateRef.current.startX;
      const dy = py - boxSelectStateRef.current.startY;
      boxSelectStateRef.current.curX = px;
      boxSelectStateRef.current.curY = py;

      if (Math.hypot(dx, dy) > 4) {
        boxSelectStateRef.current.hasMoved = true;
      }
      updateCanvasCursor({ ctrl, shift });
      redraw();
      return;
    }

    if (dragRef.current.isDragging) {
      const dx = px - dragRef.current.startX;
      const dy = py - dragRef.current.startY;

      if (Math.hypot(dx, dy) > 4) {
        dragRef.current.hasMoved = true;
      }

      if (dragRef.current.dragType === 'zoom') {
        // Drag up: zoom in (scale increases), Drag down: zoom out (scale decreases)
        const zoomFactor = Math.exp(-dy * 0.01);
        const startScale = dragRef.current.startScale;
        const newScale = Math.max(2, Math.min(1000, startScale * zoomFactor));
        const centerX = dragRef.current.startX;
        const centerY = dragRef.current.startY;

        engine.camera.panX = centerX - ((centerX - dragRef.current.startPanX) / startScale) * newScale;
        engine.camera.panY = centerY - ((centerY - dragRef.current.startPanY) / startScale) * newScale;
        engine.camera.scale = newScale;
      } else if (dragRef.current.dragType === 'pan') {
        // Pan
        engine.camera.panX = dragRef.current.startPanX + dx;
        engine.camera.panY = dragRef.current.startPanY + dy;
      } else {
        // Orbit rotation around target (360° free rotation)
        engine.camera.azimuth = (dragRef.current.startAzimuth - dx * 0.5) % 360;
        engine.camera.elevation = Math.max(-89.9, Math.min(89.9, dragRef.current.startElevation + dy * 0.5));
      }
      updateCanvasCursor({ ctrl, shift });
      redraw();
      return;
    }

    // ViewCube Hover Detection
    const cubeHit = showCanvasUI ? engine.hitTestViewCube(px, py) : null;

    // Unproject to current active grid plane for status coords
    const groundPt = getSnapped3DPoint(px, py);
    if (coordsSpanRef.current) {
      coordsSpanRef.current.textContent = `x=${groundPt[0].toFixed(2)} m, y=${groundPt[1].toFixed(2)} m, z=${groundPt[2].toFixed(2)} m`;
    }

    // Depth-sorted hit testing
    let foundNodeId: number | null = null;
    let foundElemId: number | null = null;
    let foundPanelId: number | null = null;

    if (mode === 'addBar' || mode === 'addPanel' || mode === 'grid') {
      const closestNode = getClosestEntityAt(px, py, { includeNodes: true, includeElements: false, includePanels: false });
      if (closestNode && closestNode.type === 'node') {
        foundNodeId = closestNode.id;
      }
    } else {
      const closest = getClosestEntityAt(px, py);
      if (closest) {
        if (closest.type === 'node') foundNodeId = closest.id;
        else if (closest.type === 'element') foundElemId = closest.id;
        else if (closest.type === 'panel') foundPanelId = closest.id;
      }
    }

    // Direct hover refs update
    const hoverChanged =
      cubeHit !== hoverViewCubeRef.current ||
      foundNodeId !== hoverNodeIdRef.current ||
      foundElemId !== hoverElemIdRef.current ||
      foundPanelId !== hoverPanelIdRef.current;

    hoverViewCubeRef.current = cubeHit;
    hoverNodeIdRef.current = foundNodeId;
    hoverElemIdRef.current = foundElemId;
    hoverPanelIdRef.current = foundPanelId;

    // Dynamic smart cursor update
    updateCanvasCursor({ ctrl, shift });

    // Redraw immediately during drawing mode, live vector/point picking, transform preview, split preview, or when hover/mouse position changes
    if (
      mode === 'addBar' ||
      mode === 'addPanel' ||
      mode === 'grid' ||
      mode === 'lines' ||
      pickMoveVector.active ||
      pickTransformPoint.active ||
      activeTransformMode !== 'none' ||
      splitFormOpen ||
      hoverChanged ||
      mousePosRef.current !== null
    ) {
      redraw();
    }
  };

  const handleMouseLeave = () => {
    mousePosRef.current = null;
    hoverViewCubeRef.current = null;
    hoverNodeIdRef.current = null;
    hoverElemIdRef.current = null;
    if (
      mode === 'addBar' ||
      mode === 'addPanel' ||
      mode === 'grid' ||
      pickMoveVector.active ||
      pickTransformPoint.active ||
      activeTransformMode !== 'none' ||
      splitFormOpen
    ) {
      redraw();
    }
  };

  const handleCanvasClickAt = (
    px: number,
    py: number,
    selMode: 'replace' | 'add' | 'subtract' | 'toggle' = 'replace'
  ) => {
    const engine = engineRef.current;

    // Ignore clicks on ViewCube (do not trigger selection changes or UI toggle)
    if (showCanvasUI && engine.hitTestViewCube(px, py) != null) {
      return;
    }

    if (pickTransformPoint.active && pickTransformPoint.target) {
      const pt = getSnapped3DPoint(px, py);

      const rx = Math.round(pt[0] * 1000) / 1000;
      const ry = Math.round(pt[1] * 1000) / 1000;
      const rz = Math.round(pt[2] * 1000) / 1000;

      if (pickTransformPoint.target === 'rotateCenter') {
        setRotateCx(rx);
        setRotateCy(ry);
        setRotateCz(rz);
        setStatusHint(`Ustawiono środek obrotu: (${rx}, ${ry}, ${rz}) m.`);
      } else if (pickTransformPoint.target === 'mirrorPoint') {
        setMirrorPx(rx);
        setMirrorPy(ry);
        setMirrorPz(rz);
        setStatusHint(`Ustawiono punkt płaszczyzny odbicia: (${rx}, ${ry}, ${rz}) m.`);
      } else if (pickTransformPoint.target === 'scaleCenter') {
        setScaleCx(rx);
        setScaleCy(ry);
        setScaleCz(rz);
        setStatusHint(`Ustawiono środek skalowania: (${rx}, ${ry}, ${rz}) m.`);
      }

      setPickTransformPoint({ active: false, target: null });
      redraw();
      return;
    }

    if (pickMoveVector.active) {
      const pt = getSnapped3DPoint(px, py);

      if (pickMoveVector.step === 1) {
        setPickMoveVector({
          active: true,
          step: 2,
          p1: pt,
        });
        setStatusHint(`Wskazano P1 (${pt[0].toFixed(2)}, ${pt[1].toFixed(2)}, ${pt[2].toFixed(2)}) m. Wskaż punkt końcowy P2 (2/2) wektora.`);
      } else if (pickMoveVector.step === 2 && pickMoveVector.p1) {
        const p1 = pickMoveVector.p1;
        const dx = Math.round((pt[0] - p1[0]) * 1000) / 1000;
        const dy = Math.round((pt[1] - p1[1]) * 1000) / 1000;
        const dz = Math.round((pt[2] - p1[2]) * 1000) / 1000;
        setMoveDx(dx);
        setMoveDy(dy);
        setMoveDz(dz);
        setPickMoveVector({ active: false, step: 1, p1: null });
        setStatusHint(`Ustawiono wektor przeniesienia: Δx = ${dx} m, Δy = ${dy} m, Δz = ${dz} m.`);
      }
      redraw();
      return;
    }
  
    // Check node hit (sorted by depth to pick closest node first)
    const closestNodeCandidate = getClosestEntityAt(px, py, { includeNodes: true, includeElements: false, includePanels: false });
    const clickedNodeId = closestNodeCandidate && closestNodeCandidate.type === 'node' ? closestNodeCandidate.id : null;

    if (mode === 'addBar') {
      if (clickedNodeId != null) {
        if (barStartNodeId == null) {
          setBarStartNodeId(clickedNodeId);
          setLastPlacedNodeId(clickedNodeId);
          setStatusHint(`Wybrano węzeł startowy W${clickedNodeId}. Wybierz punkt końcowy.`);
        } else {
          const startNode = nodes.find((n) => n.id === barStartNodeId);
          const endNode = nodes.find((n) => n.id === clickedNodeId);
          const dist3D = startNode && endNode
            ? Math.hypot(endNode.x - startNode.x, endNode.y - startNode.y, endNode.z - startNode.z)
            : 0;
          const isZeroLength = barStartNodeId === clickedNodeId || dist3D < 1e-4;

          const isDuplicate = elements.some(
            (e) =>
              (e.n1 === barStartNodeId && e.n2 === clickedNodeId) ||
              (e.n1 === clickedNodeId && e.n2 === barStartNodeId)
          );

          if (isZeroLength) {
            setBarStartNodeId(clickedNodeId);
            setLastPlacedNodeId(clickedNodeId);
            setStatusHint(`Nie można utworzyć pręta o długości 0 m – zmieniono węzeł startowy na W${clickedNodeId}.`);
          } else if (isDuplicate) {
            setBarStartNodeId(clickedNodeId);
            setLastPlacedNodeId(clickedNodeId);
            setStatusHint(`Pręt (W${barStartNodeId}—W${clickedNodeId}) już istnieje – zmieniono węzeł startowy na W${clickedNodeId}.`);
          } else {
            const nextElemId = elements.length > 0 ? Math.max(...elements.map((e) => e.id)) + 1 : 1;
            const newElem: Element3D = {
              id: nextElemId,
              n1: barStartNodeId,
              n2: clickedNodeId,
              sectionId: activeSectionIdForDrawing,
              materialId: activeMaterialIdForDrawing,
              groupId: defaultGroupId || undefined,
              rollAngle: 0,
              hinges: {},
              q: null,
              thermal: null,
            };
            setElements((prev) => [...prev, newElem]);
            setSelectedElemIds([nextElemId]);
            setSelectedNodeIds([]);
            setBarStartNodeId(clickedNodeId);
            setLastDrawnElemId(nextElemId);
            setLastPlacedNodeId(clickedNodeId);
            setStatusHint(`Połączono prętem P${nextElemId} (W${barStartNodeId} → W${clickedNodeId}).`);
            handleInvalidateResults();
          }
        }
      } else {
        // Clicked on empty space in addBar mode
        if (allowNewNodesInBarMode) {
          const pt = getSnapped3DPoint(px, py);
          const x = pt[0];
          const y = pt[1];
          const z = pt[2];

          const existingNode = nodes.find(
            (n) => Math.hypot(n.x - x, n.y - y, n.z - z) < 1e-3
          );
          let targetNodeId: number;

          if (existingNode) {
            targetNodeId = existingNode.id;
          } else {
            const nextNodeId = nodes.length > 0 ? Math.max(...nodes.map((n) => n.id)) + 1 : 1;
            const newNode: Node3D = {
              id: nextNodeId,
              x,
              y,
              z,
              support: null,
              force: null,
              moment: null,
              mass: null,
            };
            setNodes((prev) => [...prev, newNode]);
            targetNodeId = nextNodeId;
            setLastPlacedNodeId(targetNodeId);
          }

          if (barStartNodeId == null) {
            setBarStartNodeId(targetNodeId);
            setLastPlacedNodeId(targetNodeId);
            setStatusHint(`Utworzono węzeł W${targetNodeId} (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)} m). Wybierz punkt końcowy.`);
          } else {
            const startNode = nodes.find((n) => n.id === barStartNodeId);
            const targetNode = existingNode || { id: targetNodeId, x, y, z };
            const dist3D = startNode && targetNode
              ? Math.hypot(targetNode.x - startNode.x, targetNode.y - startNode.y, targetNode.z - startNode.z)
              : 0;
            const isZeroLength = barStartNodeId === targetNodeId || dist3D < 1e-4;

            const isDuplicate = elements.some(
              (e) =>
                (e.n1 === barStartNodeId && e.n2 === targetNodeId) ||
                (e.n1 === targetNodeId && e.n2 === barStartNodeId)
            );

            if (isZeroLength) {
              setBarStartNodeId(targetNodeId);
              setLastPlacedNodeId(targetNodeId);
              setStatusHint(`Nie można utworzyć pręta o długości 0 m – zmieniono węzeł startowy na W${targetNodeId}.`);
            } else if (isDuplicate) {
              setBarStartNodeId(targetNodeId);
              setLastPlacedNodeId(targetNodeId);
              setStatusHint(`Pręt (W${barStartNodeId}—W${targetNodeId}) już istnieje – zmieniono węzeł startowy na W${targetNodeId}.`);
            } else {
              const nextElemId = elements.length > 0 ? Math.max(...elements.map((e) => e.id)) + 1 : 1;
              const newElem: Element3D = {
                id: nextElemId,
                n1: barStartNodeId,
                n2: targetNodeId,
                sectionId: activeSectionIdForDrawing,
                materialId: activeMaterialIdForDrawing,
                groupId: defaultGroupId || undefined,
                rollAngle: 0,
                hinges: {},
                q: null,
                thermal: null,
              };
              setElements((prev) => [...prev, newElem]);
              setSelectedElemIds([nextElemId]);
              setSelectedNodeIds([]);
              setBarStartNodeId(targetNodeId);
              setLastDrawnElemId(nextElemId);
              setLastPlacedNodeId(targetNodeId);
              setStatusHint(`Połączono prętem P${nextElemId} (W${barStartNodeId} → W${targetNodeId}).`);
              handleInvalidateResults();
            }
          }
        } else {
          setShowCanvasUI((prev) => !prev);
        }
      }
    } else if (mode === 'addPanel') {
      const currentPts = panelPoints || [];

      let targetNodeId: number | null = clickedNodeId;
      let targetPt: [number, number, number] | null = null;

      if (targetNodeId != null) {
        const n = nodes.find((node) => node.id === targetNodeId);
        if (n) targetPt = [n.x, n.y, n.z];
      } else {
        if (allowNewNodesInBarMode) {
          const pt = getSnapped3DPoint(px, py);
          const x = pt[0];
          const y = pt[1];
          const z = pt[2];

          const existingNode = nodes.find(
            (n) => Math.hypot(n.x - x, n.y - y, n.z - z) < 1e-3
          );

          if (existingNode) {
            targetNodeId = existingNode.id;
            targetPt = [existingNode.x, existingNode.y, existingNode.z];
          } else {
            targetPt = [x, y, z];
            const nextNodeId = nodes.length > 0 ? Math.max(...nodes.map((n) => n.id)) + 1 : 1;
            const newNode: Node3D = {
              id: nextNodeId,
              x,
              y,
              z,
              support: null,
              force: null,
              moment: null,
              mass: null,
            };
            setNodes((prev) => [...prev, newNode]);
            targetNodeId = nextNodeId;
            setLastPlacedNodeId(targetNodeId);
          }
        } else {
          setShowCanvasUI((prev) => !prev);
          return;
        }
      }

      if (!targetPt && targetNodeId == null) return;

      if (panelShape === 'triangle') {
        if (targetNodeId == null) return;
        if (currentPts.length === 0) {
          setPanelPoints([targetNodeId]);
          setStatusHint(`Wybrano 1. punkt trójkąta (W${targetNodeId}). Wybierz 2. punkt.`);
        } else if (currentPts.length === 1) {
          if (currentPts[0] === targetNodeId) {
            setStatusHint(`Wybierz inny węzeł dla 2. punktu trójkąta.`);
          } else {
            setPanelPoints([currentPts[0], targetNodeId]);
            setStatusHint(`Wybrano 2. punkt trójkąta (W${targetNodeId}). Wybierz 3. punkt.`);
          }
        } else if (currentPts.length >= 2) {
          const n1Id = currentPts[0];
          const n2Id = currentPts[1];
          if (targetNodeId === n1Id || targetNodeId === n2Id) {
            setStatusHint(`3. punkt musi być inny niż punkty 1 i 2.`);
            return;
          }
          const nextPanelId = panels.length > 0 ? Math.max(...panels.map((p) => p.id)) + 1 : 1;
          const newPanel: Panel3D = {
            id: nextPanelId,
            shape: 'triangle',
            nodeIds: [n1Id, n2Id, targetNodeId],
          };
          setPanels((prev) => [...prev, newPanel]);
          setPanelPoints([]);
          setStatusHint(`Utworzono okładzinę trójkątną O${nextPanelId} (W${n1Id}, W${n2Id}, W${targetNodeId}).`);
          handleInvalidateResults();
        }
      } else {
        // panelShape === 'rectangle'
        if (currentPts.length === 0) {
          if (targetNodeId == null) return;
          setPanelPoints([targetNodeId]);
          setStatusHint(`Wybrano 1. punkt boku prostokąta (W${targetNodeId}). Wybierz 2. punkt.`);
        } else if (currentPts.length === 1) {
          if (targetNodeId == null) return;
          if (currentPts[0] === targetNodeId) {
            setStatusHint(`Wybierz inny węzeł dla 2. punktu boku prostokąta.`);
          } else {
            setPanelPoints([currentPts[0], targetNodeId]);
            setStatusHint(`Wybrano 2. punkt boku prostokąta (W${targetNodeId}). Wybierz 3. punkt (przez który przechodzi przeciwległy bok).`);
          }
        } else if (currentPts.length >= 2) {
          const p1 = nodes.find((n) => n.id === currentPts[0]);
          const p2 = nodes.find((n) => n.id === currentPts[1]);
          if (!p1 || !p2 || targetNodeId == null) return;

          if (targetNodeId === p1.id || targetNodeId === p2.id) {
            setStatusHint(`3. punkt musi być inny niż punkty 1 i 2.`);
            return;
          }

          const n3 = nodes.find((n) => n.id === targetNodeId) || (targetPt ? { x: targetPt[0], y: targetPt[1], z: targetPt[2] } : null);
          if (!n3) return;

          // Base vector u = p2 - p1
          const ux = p2.x - p1.x;
          const uy = p2.y - p1.y;
          const uz = p2.z - p1.z;
          const uLenSq = ux * ux + uy * uy + uz * uz;
          if (uLenSq < 1e-8) {
            setStatusHint(`Punkty 1 i 2 nakładają się – nie można wyznaczyć prostokąta.`);
            return;
          }

          // Vector v = n3 - p1
          const vx = n3.x - p1.x;
          const vy = n3.y - p1.y;
          const vz = n3.z - p1.z;

          // Projection dot product
          const dot = (vx * ux + vy * uy + vz * uz) / uLenSq;
          const wx = vx - dot * ux;
          const wy = vy - dot * uy;
          const wz = vz - dot * uz;
          const wLen = Math.hypot(wx, wy, wz);

          if (wLen < 1e-4) {
            setStatusHint(`3. punkt leży na prostej wyznaczonej przez krawędź – wybierz punkt obok.`);
            return;
          }

          const nextPanelId = panels.length > 0 ? Math.max(...panels.map((p) => p.id)) + 1 : 1;
          const newPanel: Panel3D = {
            id: nextPanelId,
            shape: 'rectangle',
            nodeIds: [p1.id, p2.id, targetNodeId],
          };

          setPanels((prev) => [...prev, newPanel]);
          setPanelPoints([]);
          setStatusHint(`Utworzono okładzinę prostokątną O${newPanel.id} (W${p1.id}, W${p2.id}, W${targetNodeId}).`);
          handleInvalidateResults();
        }
      }
    } else if (mode === 'grid') {
      if (clickedNodeId != null) {
        const clickedNode = nodes.find((n) => n.id === clickedNodeId);
        if (clickedNode) {
          const offset = gridPlane === 'XY' ? clickedNode.z : gridPlane === 'XZ' ? clickedNode.y : clickedNode.x;
          setGridOffset(offset);
          const coordName = gridPlane === 'XY' ? 'Z' : gridPlane === 'XZ' ? 'Y' : 'X';
          setStatusHint(`Przeniesiono siatkę ${gridPlane} na poziom ${coordName} = ${offset.toFixed(2)} m (węzeł W${clickedNode.id}).`);
          redraw();
        }
      } else {
        const coordName = gridPlane === 'XY' ? 'Z' : gridPlane === 'XZ' ? 'Y' : 'X';
        setStatusHint(`Siatka robocza ${gridPlane} (${coordName} = ${gridOffset.toFixed(2)} m) – kliknij na węzeł, aby przenieść siatkę.`);
      }
    } else if (mode === 'lines') {
      let val = 0;
      if (clickedNodeId != null) {
        const clickedNode = nodes.find((n) => n.id === clickedNodeId);
        if (clickedNode) {
          val = activeGridAxis === 'X' ? clickedNode.x : activeGridAxis === 'Y' ? clickedNode.y : clickedNode.z;
        }
      } else {
        const pt = engine.unprojectToPlane(px, py, gridPlane, gridOffset);
        let x = pt[0];
        let y = pt[1];
        let z = pt[2];
        if (snapEnabled) {
          if (gridPlane === 'XY') {
            x = Math.round(x / snapSize) * snapSize;
            y = Math.round(y / snapSize) * snapSize;
            z = gridOffset;
          } else if (gridPlane === 'XZ') {
            x = Math.round(x / snapSize) * snapSize;
            y = gridOffset;
            z = Math.round(z / snapSize) * snapSize;
          } else if (gridPlane === 'YZ') {
            x = gridOffset;
            y = Math.round(y / snapSize) * snapSize;
            z = Math.round(z / snapSize) * snapSize;
          }
        }
        val = activeGridAxis === 'X' ? x : activeGridAxis === 'Y' ? y : z;
      }

      val = Math.round(val * 1000) / 1000;

      setGridCoords((prev) => {
        const axisKey = activeGridAxis.toLowerCase() as 'x' | 'y' | 'z';
        const currentList = prev[axisKey];
        if (currentList.includes(val)) return prev;
        const updated = [...currentList, val].sort((a, b) => a - b);
        return {
          ...prev,
          [axisKey]: updated,
        };
      });

      setStatusHint(`Dodano współrzędną ${activeGridAxis} = ${val.toFixed(2)} m z kliknięcia na modelu.`);
    } else {
      // Selection Mode
      const closest = getClosestEntityAt(px, py);
      if (closest) {
        if (closest.type === 'node') {
          const clickedNodeId = closest.id;
          setSelectedNodeIds((prev) => updateSelection(prev, [clickedNodeId], selMode));
          if (selMode === 'replace') {
            setSelectedElemIds([]);
            setSelectedPanelIds([]);
          }
        } else if (closest.type === 'element') {
          const clickedElemId = closest.id;
          setProbe({ elId: clickedElemId, t: closest.t ?? 0.5 });
          setSelectedElemIds((prev) => updateSelection(prev, [clickedElemId], selMode));
          if (selMode === 'replace') {
            setSelectedNodeIds([]);
            setSelectedPanelIds([]);
          }
        } else if (closest.type === 'panel') {
          const clickedPanelId = closest.id;
          setSelectedPanelIds((prev) => updateSelection(prev, [clickedPanelId], selMode));
          if (selMode === 'replace') {
            setSelectedNodeIds([]);
            setSelectedElemIds([]);
          }
        }
      } else {
        // Clicked on empty space
        if (selMode === 'replace') {
          if (selectedNodeIds.length > 0 || selectedElemIds.length > 0 || selectedPanelIds.length > 0) {
            setSelectedNodeIds([]);
            setSelectedElemIds([]);
            setSelectedPanelIds([]);
          } else {
            setShowCanvasUI((prev) => !prev);
          }
          setLastPlacedNodeId(null);
          setLastDrawnElemId(null);
        } else {
          setShowCanvasUI((prev) => !prev);
        }
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Ignore simulated mouse events from touches
    if (Date.now() - lastTouchTimeRef.current < 800) {
      return;
    }
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    if (ctrl !== keyModifiersRef.current.ctrl || shift !== keyModifiersRef.current.shift) {
      keyModifiersRef.current = { ctrl, shift };
      setKeyModifiers({ ctrl, shift });
    }
    const selMode = getEffectiveSelectionMode(ctrl, shift, mobileSelMode);

    if (boxSelectStateRef.current.isDragging) {
      const { startX, startY, curX, curY, hasMoved } = boxSelectStateRef.current;
      boxSelectStateRef.current.isDragging = false;
      if (hasMoved) {
        applyBoxSelection(startX, startY, curX, curY, selMode);
      } else {
        handleCanvasClickAt(px, py, selMode);
      }
      updateCanvasCursor({ ctrl, shift });
      redraw();
      return;
    }

    const wasMoved = dragRef.current.hasMoved;
    dragRef.current.isDragging = false;

    // Only process selection or point creation if user didn't drag/orbit
    if (!wasMoved) {
      handleCanvasClickAt(px, py, selMode);
    }
    updateCanvasCursor({ ctrl, shift });
    redraw();
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const engine = engineRef.current;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const startScale = engine.camera.scale;
    const newScale = Math.max(2, Math.min(1000, startScale * factor));

    // Zoom centered on cursor position (px, py)
    engine.camera.panX = px - ((px - engine.camera.panX) / startScale) * newScale;
    engine.camera.panY = py - ((py - engine.camera.panY) / startScale) * newScale;
    engine.camera.scale = newScale;

    redraw();
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    isTouchRef.current = true;
    lastTouchTimeRef.current = Date.now();
    mousePosRef.current = null;
    hoverNodeIdRef.current = null;
    hoverElemIdRef.current = null;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const engine = engineRef.current;

    if (e.touches.length === 1) {
      const t0 = e.touches[0];
      const px = t0.clientX - rect.left;
      const py = t0.clientY - rect.top;

      const cubeHit = showCanvasUI ? engine.hitTestViewCube(px, py) : null;
      if (cubeHit) {
        if (cubeHit === 'FIT') {
          handleFitView();
        } else {
          const angles = engine.getViewAngles(cubeHit);
          engine.animateCameraTo(angles.az, angles.el, 320, () => {
            redraw();
          });
        }
        return;
      }

      engine.stopCameraAnimation();

      if (mode === 'select' && navMode === 'boxSelect') {
        boxSelectStateRef.current = {
          isDragging: true,
          startX: px,
          startY: py,
          curX: px,
          curY: py,
          hasMoved: false,
        };
        touchStateRef.current = {
          startX: px,
          startY: py,
          startDist: 0,
          startScale: engine.camera.scale,
          isPinching: false,
          dragType: 'orbit',
          startAzimuth: engine.camera.azimuth,
          startElevation: engine.camera.elevation,
          startPanX: engine.camera.panX,
          startPanY: engine.camera.panY,
        };
        dragRef.current.isDragging = false;
        dragRef.current.hasMoved = false;
        return;
      }

      const activeDragType: 'orbit' | 'pan' | 'zoom' =
        navMode === 'zoom' ? 'zoom' : navMode === 'pan' ? 'pan' : 'orbit';

      touchStateRef.current = {
        startX: px,
        startY: py,
        startDist: 0,
        startScale: engine.camera.scale,
        isPinching: false,
        dragType: activeDragType,
        startAzimuth: engine.camera.azimuth,
        startElevation: engine.camera.elevation,
        startPanX: engine.camera.panX,
        startPanY: engine.camera.panY,
      };
      dragRef.current.isDragging = true;
      dragRef.current.hasMoved = false;
      dragRef.current.dragType = activeDragType;
      dragRef.current.startX = px;
      dragRef.current.startY = py;
      dragRef.current.startScale = engine.camera.scale;
      dragRef.current.startPanX = engine.camera.panX;
      dragRef.current.startPanY = engine.camera.panY;
      dragRef.current.startAzimuth = engine.camera.azimuth;
      dragRef.current.startElevation = engine.camera.elevation;
    } else if (e.touches.length >= 2) {
      // cancel touch box selection dragging if multi-touch zooming/pan starts
      if (boxSelectStateRef.current.isDragging) {
        boxSelectStateRef.current.isDragging = false;
      }

      engine.stopCameraAnimation();
      dragRef.current.isDragging = false;
      dragRef.current.hasMoved = true;

      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const midX = (t0.clientX + t1.clientX) / 2 - rect.left;
      const midY = (t0.clientY + t1.clientY) / 2 - rect.top;
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      const dist = Math.hypot(dx, dy);

      touchStateRef.current = {
        startX: midX,
        startY: midY,
        startDist: Math.max(10, dist),
        startScale: engine.camera.scale,
        isPinching: true,
        dragType: 'orbit',
        startAzimuth: engine.camera.azimuth,
        startElevation: engine.camera.elevation,
        startPanX: engine.camera.panX,
        startPanY: engine.camera.panY,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    lastTouchTimeRef.current = Date.now();
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const engine = engineRef.current;

    if (e.touches.length >= 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const midX = (t0.clientX + t1.clientX) / 2 - rect.left;
      const midY = (t0.clientY + t1.clientY) / 2 - rect.top;
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      const dist = Math.hypot(dx, dy);

      if (!touchStateRef.current.isPinching || touchStateRef.current.startDist <= 0) {
        touchStateRef.current = {
          startX: midX,
          startY: midY,
          startDist: Math.max(10, dist),
          startScale: engine.camera.scale,
          isPinching: true,
          dragType: 'orbit',
          startAzimuth: engine.camera.azimuth,
          startElevation: engine.camera.elevation,
          startPanX: engine.camera.panX,
          startPanY: engine.camera.panY,
        };
        return;
      }

      const startDist = touchStateRef.current.startDist;
      const startScale = touchStateRef.current.startScale;
      const startPanX = touchStateRef.current.startPanX;
      const startPanY = touchStateRef.current.startPanY;
      const startMidX = touchStateRef.current.startX;
      const startMidY = touchStateRef.current.startY;

      // Smooth Pinch Scale around the fingers' center point
      const factor = dist / startDist;
      const newScale = Math.max(2, Math.min(1000, startScale * factor));
      engine.camera.scale = newScale;

      // Pan so the point originally beneath (startMidX, startMidY) tracks the current (midX, midY)
      engine.camera.panX = midX - ((startMidX - startPanX) / startScale) * newScale;
      engine.camera.panY = midY - ((startMidY - startPanY) / startScale) * newScale;

      redraw();
    } else if (e.touches.length === 1) {
      // If we were previously in a multi-finger pinch/pan gesture, IGNORE the remaining finger
      // to avoid violent angular rotation when one finger is lifted slightly before the other!
      if (touchStateRef.current.isPinching) {
        return;
      }

      const t0 = e.touches[0];
      const px = t0.clientX - rect.left;
      const py = t0.clientY - rect.top;

      if (boxSelectStateRef.current.isDragging) {
        const dx = px - boxSelectStateRef.current.startX;
        const dy = py - boxSelectStateRef.current.startY;
        boxSelectStateRef.current.curX = px;
        boxSelectStateRef.current.curY = py;

        if (Math.hypot(dx, dy) > 4) {
          boxSelectStateRef.current.hasMoved = true;
        }
        redraw();
        return;
      }

      const dx = px - touchStateRef.current.startX;
      const dy = py - touchStateRef.current.startY;

      if (Math.hypot(dx, dy) > 5) {
        dragRef.current.hasMoved = true;
      }

      if (touchStateRef.current.dragType === 'zoom') {
        const zoomFactor = Math.exp(-dy * 0.01);
        const startScale = touchStateRef.current.startScale;
        const newScale = Math.max(2, Math.min(1000, startScale * zoomFactor));
        const centerX = touchStateRef.current.startX;
        const centerY = touchStateRef.current.startY;

        engine.camera.panX = centerX - ((centerX - touchStateRef.current.startPanX) / startScale) * newScale;
        engine.camera.panY = centerY - ((centerY - touchStateRef.current.startPanY) / startScale) * newScale;
        engine.camera.scale = newScale;
      } else if (touchStateRef.current.dragType === 'pan') {
        engine.camera.panX = touchStateRef.current.startPanX + dx;
        engine.camera.panY = touchStateRef.current.startPanY + dy;
      } else {
        // Orbit
        engine.camera.azimuth = (touchStateRef.current.startAzimuth - dx * 0.5) % 360;
        engine.camera.elevation = Math.max(-89.9, Math.min(89.9, touchStateRef.current.startElevation + dy * 0.5));
      }
      redraw();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    lastTouchTimeRef.current = Date.now();
    if (e.touches.length === 0) {
      const wasPinching = touchStateRef.current.isPinching;
      const wasDragging = dragRef.current.isDragging;
      const wasMoved = dragRef.current.hasMoved;

      touchStateRef.current.isPinching = false;
      dragRef.current.isDragging = false;

      if (boxSelectStateRef.current.isDragging) {
        const { startX, startY, curX, curY, hasMoved } = boxSelectStateRef.current;
        boxSelectStateRef.current.isDragging = false;
        if (hasMoved) {
          applyBoxSelection(startX, startY, curX, curY, mobileSelMode);
        } else {
          handleCanvasClickAt(startX, startY, mobileSelMode);
        }
        redraw();
        return;
      }

      // Only handle single-tap click if it was purely a 1-finger tap without moving
      if (!wasPinching && wasDragging && !wasMoved) {
        handleCanvasClickAt(touchStateRef.current.startX, touchStateRef.current.startY, mobileSelMode);
        redraw();
      }
    } else if (e.touches.length === 1) {
      // One finger was lifted while one still touches screen.
      // If we were in pinch mode, keep isPinching = true to prevent sudden rotation.
      dragRef.current.isDragging = false;
    }
  };

  // Keyboard Shortcuts & Modifier Tracking
  useEffect(() => {
    const syncModifiers = (e: KeyboardEvent | MouseEvent | FocusEvent) => {
      let ctrl = false;
      let shift = false;

      if ('getModifierState' in e && typeof (e as any).getModifierState === 'function') {
        ctrl = Boolean((e as any).getModifierState('Control') || (e as any).getModifierState('Meta'));
        shift = Boolean((e as any).getModifierState('Shift'));
      } else if ('ctrlKey' in e) {
        ctrl = Boolean((e as MouseEvent).ctrlKey || (e as MouseEvent).metaKey);
        shift = Boolean((e as MouseEvent).shiftKey);
      }

      if (e.type === 'keydown') {
        const k = (e as KeyboardEvent).key;
        if (k === 'Control' || k === 'Meta') ctrl = true;
        if (k === 'Shift') shift = true;
      } else if (e.type === 'keyup') {
        const k = (e as KeyboardEvent).key;
        if (k === 'Control' || k === 'Meta') ctrl = false;
        if (k === 'Shift') shift = false;
      }

      if (ctrl !== keyModifiersRef.current.ctrl || shift !== keyModifiersRef.current.shift) {
        keyModifiersRef.current = { ctrl, shift };
        setKeyModifiers({ ctrl, shift });
        updateCanvasCursor({ ctrl, shift });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      syncModifiers(e);

      const targetTag = (e.target as HTMLElement)?.tagName?.toUpperCase();
      if (targetTag === 'INPUT' || targetTag === 'SELECT' || targetTag === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSolveOrBack();
      } else if (e.key === 'v' || e.key === 'V') {
        setMode('select');
        setNavMode('select');
      } else if (e.key === 'o' || e.key === 'O') {
        setMode('addPanel');
        setPanelPoints([]);
      } else if (e.key === 'p' || e.key === 'P') {
        setNavMode('pan');
      } else if (e.key === 'f' || e.key === 'F') {
        handleFitView();
      } else if (e.key === 'r' || e.key === 'R' || e.key === 'b' || e.key === 'B') {
        setMode('addBar');
        setBarStartNodeId(null);
      } else if (e.key === 'g' || e.key === 'G') {
        setMode('grid');
      } else if (e.key === 'Escape') {
        if (pickMoveVector.active || pickTransformPoint.active) {
          handleCancelPickMode();
          setStatusHint('Anulowano wskazywanie punktu/wektora.');
          return;
        }
        setBarStartNodeId(null);
        setPanelPoints([]);
        setSelectedNodeIds([]);
        setSelectedElemIds([]);
        setSelectedPanelIds([]);
        if (mode === 'addBar' || mode === 'addPanel' || mode === 'grid') {
          setMode('select');
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0 || selectedElemIds.length > 0 || selectedPanelIds.length > 0) {
          const nodeIdsToDelete = new Set(selectedNodeIds);
          const elemIdsToDelete = new Set(selectedElemIds);
          const panelIdsToDelete = new Set(selectedPanelIds);

          const deletedElements = elements.filter(
            (el) =>
              elemIdsToDelete.has(el.id) ||
              nodeIdsToDelete.has(el.n1) ||
              nodeIdsToDelete.has(el.n2)
          );
          const deletedPanels = panels.filter(
            (p) =>
              panelIdsToDelete.has(p.id) ||
              p.nodeIds.some((nid) => nodeIdsToDelete.has(nid))
          );
          const deletedNodeCount = selectedNodeIds.length;
          const deletedElemCount = deletedElements.length;
          const deletedPanelCount = deletedPanels.length;

          setElements((prev) =>
            prev.filter(
              (el) =>
                !elemIdsToDelete.has(el.id) &&
                !nodeIdsToDelete.has(el.n1) &&
                !nodeIdsToDelete.has(el.n2)
            )
          );
          setPanels((prev) =>
            prev.filter(
              (p) =>
                !panelIdsToDelete.has(p.id) &&
                p.nodeIds.every((nid) => !nodeIdsToDelete.has(nid))
            )
          );
          setNodes((prev) => prev.filter((n) => !nodeIdsToDelete.has(n.id)));
          setSelectedNodeIds([]);
          setSelectedElemIds([]);
          setSelectedPanelIds([]);
          handleInvalidateResults();

          const parts: string[] = [];
          if (deletedElemCount > 0) parts.push(pluralUnit(deletedElemCount, 'pręt', 'pręty', 'prętów'));
          if (deletedNodeCount > 0) parts.push(pluralUnit(deletedNodeCount, 'węzeł', 'węzły', 'węzłów'));
          if (deletedPanelCount > 0) parts.push(pluralUnit(deletedPanelCount, 'okładzinę', 'okładziny', 'okładzin'));
          if (parts.length > 0) {
            setStatusHint(`Usunięto: ${parts.join(', ')}.`);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      syncModifiers(e);
    };

    const handleBlur = () => {
      if (keyModifiersRef.current.ctrl || keyModifiersRef.current.shift) {
        keyModifiersRef.current = { ctrl: false, shift: false };
        setKeyModifiers({ ctrl: false, shift: false });
        updateCanvasCursor({ ctrl: false, shift: false });
      }
    };

    const handlePointer = (e: MouseEvent) => {
      syncModifiers(e);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });
    document.addEventListener('keyup', handleKeyUp, { capture: true });
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pointerdown', handlePointer, { capture: true });
    window.addEventListener('pointerup', handlePointer, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
      document.removeEventListener('keyup', handleKeyUp, { capture: true });
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pointerdown', handlePointer, { capture: true });
      window.removeEventListener('pointerup', handlePointer, { capture: true });
    };
  }, [handleUndo, handleRedo, handleSolveOrBack, handleFitView, updateCanvasCursor]);

  return (
    <div id="app">
      {/* Exact Toolbar from original Materia Lite design */}
      <Toolbar
        mode={mode}
        setMode={(m) => {
          setMode(m);
          setBarStartNodeId(null);
          setLastPlacedNodeId(null);
          setLastDrawnElemId(null);
          setPanelPoints([]);
          setLineStartPoint(null);
        }}
        activeGridAxis={activeGridAxis}
        setActiveGridAxis={setActiveGridAxis}
        linesSubMode={linesSubMode}
        setLinesSubMode={setLinesSubMode}
        onAddBasicDimensions={handleAddBasicDimensions}
        onClearConstructionLines={handleClearConstructionLines}
        onClearDimensionLines={handleClearDimensionLines}
        panelShape={panelShape}
        setPanelShape={(shape) => {
          setPanelShape(shape);
          setPanelPoints([]);
        }}
        gridPlane={gridPlane}
        setGridPlane={setGridPlane}
        gridOffset={gridOffset}
        setGridOffset={setGridOffset}
        navMode={navMode}
        setNavMode={setNavMode}
        effectiveSelMode={effectiveSelMode}
        setMobileSelMode={setMobileSelMode}
        onOpenSelectBy={() => setSelectByOpen(true)}
        selectByOpen={selectByOpen}
        isSolved={!!solved}
        onSolveOrBack={handleSolveOrBack}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onNewModel={handleNewModel}
        onOpenTemplates={() => setTemplatesModalOpen(true)}
        onSaveModel={handleSaveModel}
        onSaveAsModel={handleSaveAsModel}
        onLoadModel={handleLoadModel}
        onImportJson={handleImportJson}
        onExportJson={handleExportJson}
        onOpenOptions={() => setOptionsOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
        snapEnabled={snapEnabled}
        setSnapEnabled={setSnapEnabled}
        drawConstructionGrid={drawConstructionGrid}
        setDrawConstructionGrid={setDrawConstructionGrid}
        drawOuterDimensionLines={drawOuterDimensionLines}
        setDrawOuterDimensionLines={setDrawOuterDimensionLines}
        allowNewNodesInBarMode={allowNewNodesInBarMode}
        setAllowNewNodesInBarMode={setAllowNewNodesInBarMode}
        sections={sections}
        materials={materials}
        groups={groups}
        defaultSectionId={defaultSectionId}
        setDefaultSectionId={setDefaultSectionId}
        defaultMaterialId={defaultMaterialId}
        setDefaultMaterialId={setDefaultMaterialId}
        defaultGroupId={defaultGroupId}
        setDefaultGroupId={setDefaultGroupId}
        snapSize={snapSize}
      />

      {/* Main Workspace (Canvas 3D + Sidebar) matching #main */}
      <div id="main">
        {/* Canvas Wrap */}
        <div id="canvasWrap" onMouseEnter={() => { try { window.focus(); } catch {} }}>
          <canvas id="cv-webgl" ref={webglCanvasRef} />
          <canvas
            id="cv-overlay"
            ref={overlayCanvasRef}
            tabIndex={0}
            style={{ outline: 'none' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
          />

          {/* Contextual Sub-Toolbar on canvas (Visible in vertical/portrait mode or narrower screens) */}
          <div
            id="contextualTopOverlay"
            className={`transition-all duration-200 ${
              showCanvasUI ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'
            }`}
          >
            {mode === 'select' && (
              <>
                <button
                  className={`zbtn ${navMode === 'boxSelect' ? 'active' : ''}`}
                  onClick={() => setNavMode(navMode === 'boxSelect' ? 'orbit' : 'boxSelect')}
                  title="Zaznaczanie ramką / obszarem (Ramka)"
                >
                  {ICONS.boxselect}
                </button>
                <button
                  className={`zbtn ${effectiveSelMode === 'replace' ? 'active' : ''}`}
                  onClick={() => setMobileSelMode('replace')}
                  title="Wybór zwykły (Zastąp zaznaczenie)"
                >
                  {ICONS.selReplace}
                </button>
                <button
                  className={`zbtn ${effectiveSelMode === 'add' ? 'active' : ''}`}
                  onClick={() => setMobileSelMode('add')}
                  title="Dodaj do zaznaczenia (Przytrzymaj Ctrl na komputerze)"
                >
                  {ICONS.selAdd}
                </button>
                <button
                  className={`zbtn ${effectiveSelMode === 'subtract' ? 'active' : ''}`}
                  onClick={() => setMobileSelMode('subtract')}
                  title="Odejmij od zaznaczenia (Przytrzymaj Shift na komputerze)"
                >
                  {ICONS.selSubtract}
                </button>
                <button
                  className={`zbtn ${effectiveSelMode === 'toggle' ? 'active' : ''}`}
                  onClick={() => setMobileSelMode('toggle')}
                  title="Odwróć zaznaczenie (Przytrzymaj Ctrl + Shift na komputerze)"
                >
                  {ICONS.selToggle}
                </button>
                <button
                  className={`zbtn ${selectByOpen ? 'active' : ''}`}
                  onClick={() => setSelectByOpen(true)}
                  title="Zaznacz według kryteriów... (długości, profilu, materiału)"
                >
                  {ICONS.filterBy}
                </button>
              </>
            )}

            {mode === 'addBar' && (
              <>
                <select
                  className="zselect"
                  value={activeSectionIdForDrawing}
                  onChange={(e) => setDefaultSectionId(parseInt(e.target.value))}
                  disabled={selectedDrawingGroup?.sectionId !== undefined}
                  title={selectedDrawingGroup?.sectionId !== undefined ? "Przekrój narzucony przez grupę" : "Domyślny przekrój"}
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  className="zselect"
                  value={activeMaterialIdForDrawing}
                  onChange={(e) => setDefaultMaterialId(parseInt(e.target.value))}
                  disabled={selectedDrawingGroup?.materialId !== undefined}
                  title={selectedDrawingGroup?.materialId !== undefined ? "Materiał narzucony przez grupę" : "Domyślny materiał"}
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>

                <select
                  className="zselect"
                  value={defaultGroupId}
                  onChange={(e) => setDefaultGroupId(e.target.value)}
                  title="Domyślna grupa"
                >
                  <option value="">(brak grupy)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>

                <button
                  className={`zbtn ${snapEnabled ? 'active' : ''}`}
                  onClick={() => setSnapEnabled(!snapEnabled)}
                  title={`Przyciąganie do siatki (${snapSize} m)`}
                >
                  {ICONS.grid}
                </button>
                <button
                  className={`zbtn ${allowNewNodesInBarMode ? 'active' : ''}`}
                  onClick={() => setAllowNewNodesInBarMode(!allowNewNodesInBarMode)}
                  title="Twórz nowe węzły podczas rysowania pręta (Autowęzły)"
                >
                  {ICONS.node}
                </button>
              </>
            )}

            {mode === 'addPanel' && (
              <>
                <button
                  className={`zbtn ${panelShape === 'triangle' ? 'active' : ''}`}
                  onClick={() => {
                    setPanelShape('triangle');
                    setPanelPoints([]);
                  }}
                  title="Okładzina trójkątna (3 węzły)"
                >
                  {ICONS.triangle}
                </button>
                <button
                  className={`zbtn ${panelShape === 'rectangle' ? 'active' : ''}`}
                  onClick={() => {
                    setPanelShape('rectangle');
                    setPanelPoints([]);
                  }}
                  title="Okładzina prostokątna (2 węzły boku + 3. węzeł szerokości)"
                >
                  {ICONS.rectangle}
                </button>
                <button
                  className={`zbtn ${snapEnabled ? 'active' : ''}`}
                  onClick={() => setSnapEnabled(!snapEnabled)}
                  title={`Przyciąganie do siatki (${snapSize} m)`}
                >
                  {ICONS.grid}
                </button>
                <button
                  className={`zbtn ${allowNewNodesInBarMode ? 'active' : ''}`}
                  onClick={() => setAllowNewNodesInBarMode(!allowNewNodesInBarMode)}
                  title="Twórz nowe węzły podczas rysowania obrysu (Autowęzły)"
                >
                  {ICONS.node}
                </button>
              </>
            )}

            {mode === 'grid' && (
              <>
                <button
                  className={`zbtn ${gridPlane === 'XY' ? 'active' : ''}`}
                  onClick={() => setGridPlane('XY')}
                  title="Siatka pozioma XY (z=const)"
                >
                  XY
                </button>
                <button
                  className={`zbtn ${gridPlane === 'YZ' ? 'active' : ''}`}
                  onClick={() => setGridPlane('YZ')}
                  title="Siatka pionowa YZ (x=const)"
                >
                  YZ
                </button>
                <button
                  className={`zbtn ${gridPlane === 'XZ' ? 'active' : ''}`}
                  onClick={() => setGridPlane('XZ')}
                  title="Siatka pionowa XZ (y=const)"
                >
                  XZ
                </button>
                <button
                  className={`zbtn ${snapEnabled ? 'active' : ''}`}
                  onClick={() => setSnapEnabled(!snapEnabled)}
                  title={`Przyciąganie do siatki (${snapSize} m)`}
                >
                  {ICONS.grid}
                </button>
              </>
            )}

            {mode === 'lines' && (
              <>
                <button
                  className={`zbtn ${activeGridAxis === 'X' ? 'active' : ''}`}
                  onClick={() => setActiveGridAxis('X')}
                  title="Aktywna oś X"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0 8px' }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
                  <span>X</span>
                </button>
                <button
                  className={`zbtn ${activeGridAxis === 'Y' ? 'active' : ''}`}
                  onClick={() => setActiveGridAxis('Y')}
                  title="Aktywna oś Y"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0 8px' }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
                  <span>Y</span>
                </button>
                <button
                  className={`zbtn ${activeGridAxis === 'Z' ? 'active' : ''}`}
                  onClick={() => setActiveGridAxis('Z')}
                  title="Aktywna oś Z"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0 8px' }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'inline-block' }} />
                  <span>Z</span>
                </button>
                <button
                  className={`zbtn ${drawConstructionGrid ? 'active' : ''}`}
                  onClick={() => setDrawConstructionGrid(!drawConstructionGrid)}
                  title="Linie konstrukcyjne osi"
                >
                  {ICONS.constructionLine}
                </button>
                <button
                  className={`zbtn ${drawOuterDimensionLines ? 'active' : ''}`}
                  onClick={() => setDrawOuterDimensionLines(!drawOuterDimensionLines)}
                  title="Linie wymiarowe osi"
                >
                  {ICONS.dimensionLine}
                </button>
                <button
                  className={`zbtn ${snapEnabled ? 'active' : ''}`}
                  onClick={() => setSnapEnabled(!snapEnabled)}
                  title={`Przyciąganie do siatki (${snapSize} m)`}
                >
                  {ICONS.grid}
                </button>
              </>
            )}
          </div>

          {/* Bottom Overlay containing:
              - #overlayRow with the navigation and display switch buttons (bottom-left and bottom-right)
              - #statusbar with Hint and Coordinates
          */}
          <div id="canvasBottomOverlay" className={`transition-all duration-200 ${showCanvasUI ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
            <div id="overlayRow">
              <div id="quickTogglesBar" style={{ pointerEvents: showCanvasUI ? 'auto' : 'none' }}>
                <button
                  className={`zbtn ${showNodeNumbers ? 'active' : ''}`}
                  onClick={() => setShowNodeNumbers(!showNodeNumbers)}
                  title="Pokaż numery węzłów (W1, W2...)"
                >
                  {TOGGLE_ICONS.nodeNumbers}
                </button>
                <button
                  className={`zbtn ${showElementNumbers ? 'active' : ''}`}
                  onClick={() => setShowElementNumbers(!showElementNumbers)}
                  title="Pokaż numery prętów (P1, P2...)"
                >
                  {TOGGLE_ICONS.elementNumbers}
                </button>
                <button
                  className={`zbtn ${showSectionNames ? 'active' : ''}`}
                  onClick={() => setShowSectionNames(!showSectionNames)}
                  title="Pokaż nazwę przekroju na pręcie"
                >
                  {TOGGLE_ICONS.sectionNames}
                </button>
                <button
                  className={`zbtn ${showMaterialNames ? 'active' : ''}`}
                  onClick={() => setShowMaterialNames(!showMaterialNames)}
                  title="Pokaż materiał na pręcie"
                >
                  {TOGGLE_ICONS.materialNames}
                </button>
                <button
                  className={`zbtn ${showSupports ? 'active' : ''}`}
                  onClick={() => setShowSupports(!showSupports)}
                  title="Pokaż podpory"
                >
                  {TOGGLE_ICONS.supports}
                </button>
                <button
                  className={`zbtn ${showPanels ? 'active' : ''}`}
                  onClick={() => setShowPanels(!showPanels)}
                  title="Pokaż okładziny"
                >
                  {TOGGLE_ICONS.panels}
                </button>
                <button
                  className={`zbtn ${showProfileSketches ? 'active' : ''}`}
                  onClick={() => setShowProfileSketches(!showProfileSketches)}
                  title="Pokaż szkice profili (geometria przekroju)"
                >
                  {TOGGLE_ICONS.profileSketches}
                </button>
                <button
                  className={`zbtn ${showLocalAxes ? 'active' : ''}`}
                  onClick={() => setShowLocalAxes(!showLocalAxes)}
                  title="Pokaż układy lokalne prętów (RGB)"
                >
                  {TOGGLE_ICONS.localAxes}
                </button>
                <button
                  className={`zbtn ${showHingeLabels ? 'active' : ''}`}
                  onClick={() => setShowHingeLabels(!showHingeLabels)}
                  title="Pokaż opisy przegubów (Ux, Ry...)"
                >
                  {TOGGLE_ICONS.hingeLabels}
                </button>
                <button
                  className={`zbtn ${showLoads ? 'active' : ''}`}
                  onClick={() => setShowLoads(!showLoads)}
                  title="Pokaż obciążenia"
                >
                  {TOGGLE_ICONS.loads}
                </button>
                <button
                  className={`zbtn ${showLoadValues ? 'active' : ''}`}
                  onClick={() => setShowLoadValues(!showLoadValues)}
                  title="Pokaż wartości obciążeń"
                >
                  {TOGGLE_ICONS.loadValues}
                </button>
              </div>

              <div id="zoomCtl" style={{ pointerEvents: showCanvasUI ? 'auto' : 'none' }}>
                <button
                  className={`zbtn ${navMode === 'pan' ? 'active' : ''}`}
                  onClick={() => setNavMode(navMode === 'pan' ? 'orbit' : 'pan')}
                  title="Przesuwanie widoku (Łapka)"
                >
                  {ICONS.pan}
                </button>
                <button
                  className={`zbtn ${navMode === 'zoom' ? 'active' : ''}`}
                  onClick={() => setNavMode(navMode === 'zoom' ? 'orbit' : 'zoom')}
                  title="Przybliżanie i oddalanie przeciąganiem (Lupa)"
                >
                  {ICONS.zoom}
                </button>
              </div>
            </div>
            <div
              id="statusbar"
              style={{ pointerEvents: showCanvasUI ? 'auto' : 'none' }}
              onMouseDown={handlePanelResizeStart}
              onTouchStart={handlePanelResizeStart}
            >
              <span id="hint">{statusHint}</span>
              <span id="coords" ref={coordsSpanRef}>
                x=0.00 m, y=0.00 m, z=0.00 m
              </span>
            </div>
          </div>
        </div>

        {/* Sidebar matching #sidebar */}
        <Sidebar
          nodes={nodes}
          setNodes={setNodes}
          elements={elements}
          setElements={setElements}
          panels={panels}
          setPanels={setPanels}
          panelShape={panelShape}
          setPanelShape={setPanelShape}
          panelPoints={panelPoints}
          setPanelPoints={setPanelPoints}
          sections={sections}
          setSections={setSections}
          materials={materials}
          setMaterials={setMaterials}
          groups={groups}
          setGroups={setGroups}
          selectedNodeIds={selectedNodeIds}
          setSelectedNodeIds={setSelectedNodeIds}
          selectedElemIds={selectedElemIds}
          setSelectedElemIds={setSelectedElemIds}
          selectedPanelIds={selectedPanelIds}
          setSelectedPanelIds={setSelectedPanelIds}
          mode={mode}
          setMode={setMode}
          barStartNodeId={barStartNodeId}
          setBarStartNodeId={setBarStartNodeId}
          analysisSettings={analysisSettings}
          setAnalysisSettings={setAnalysisSettings}
          solved={solved}
          setSolved={setSolved}
          solveWarning={solveWarning}
          showDeform={showDeform}
          setShowDeform={setShowDeform}
          showMy={showMy}
          setShowMy={setShowMy}
          showMz={showMz}
          setShowMz={setShowMz}
          showMx={showMx}
          setShowMx={setShowMx}
          showVy={showVy}
          setShowVy={setShowVy}
          showVz={showVz}
          setShowVz={setShowVz}
          showN={showN}
          setShowN={setShowN}
          showStress={showStress}
          setShowStress={setShowStress}
          showReactions={showReactions}
          setShowReactions={setShowReactions}
          deformScaleMult={deformScaleMult}
          setDeformScaleMult={setDeformScaleMult}
          diagramScaleMult={diagramScaleMult}
          setDiagramScaleMult={setDiagramScaleMult}
          diagramLabelMode={diagramLabelMode}
          setDiagramLabelMode={setDiagramLabelMode}
          probe={probe}
          setProbe={setProbe}
          onInvalidateResults={handleInvalidateResults}
          onNodePlaced={(id) => setLastPlacedNodeId(id)}
          onElemDrawn={(id) => setLastDrawnElemId(id)}
          defaultSectionId={defaultSectionId}
          defaultMaterialId={defaultMaterialId}
          defaultGroupId={defaultGroupId}
          setDefaultGroupId={setDefaultGroupId}
          loadCases={loadCases}
          activeLoadCaseId={activeLoadCaseId}
          onSelectLoadCase={handleSelectLoadCase}
          onAddLoadCase={handleAddLoadCase}
          onUpdateLoadCase={handleUpdateLoadCase}
          onDeleteLoadCase={handleDeleteLoadCase}
          autoCombinations={autoCombinations}
          setAutoCombinations={setAutoCombinations}
          customCombinations={customCombinations}
          multiSolved={multiSolved}
          activeResultKey={activeResultKey}
          onSelectResultKey={handleSelectResultKey}
          gridPlane={gridPlane}
          setGridPlane={setGridPlane}
          gridOffset={gridOffset}
          setGridOffset={setGridOffset}
          snapEnabled={snapEnabled}
          setSnapEnabled={setSnapEnabled}
          snapSize={snapSize}
          setSnapSize={setSnapSize}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          showAxes={showAxes}
          setShowAxes={setShowAxes}
          panelHeight={panelHeight}
          onPanelHandleStart={handlePanelResizeStart}
          activeTransformMode={activeTransformMode}
          setActiveTransformMode={handleOpenTransformMode}
          transformWithCopy={transformWithCopy}
          setTransformWithCopy={setTransformWithCopy}
          transformConnect={transformConnect}
          setTransformConnect={setTransformConnect}
          transformRepeat={transformRepeat}
          setTransformRepeat={setTransformRepeat}
          transformLoads={transformLoads}
          setTransformLoads={setTransformLoads}
          moveDx={moveDx}
          setMoveDx={setMoveDx}
          moveDy={moveDy}
          setMoveDy={setMoveDy}
          moveDz={moveDz}
          setMoveDz={setMoveDz}
          rotateCx={rotateCx}
          setRotateCx={setRotateCx}
          rotateCy={rotateCy}
          setRotateCy={setRotateCy}
          rotateCz={rotateCz}
          setRotateCz={setRotateCz}
          rotateAxis={rotateAxis}
          setRotateAxis={setRotateAxis}
          rotateAngle={rotateAngle}
          setRotateAngle={setRotateAngle}
          mirrorPx={mirrorPx}
          setMirrorPx={setMirrorPx}
          mirrorPy={mirrorPy}
          setMirrorPy={setMirrorPy}
          mirrorPz={mirrorPz}
          setMirrorPz={setMirrorPz}
          mirrorPlane={mirrorPlane}
          setMirrorPlane={setMirrorPlane}
          scaleCx={scaleCx}
          setScaleCx={setScaleCx}
          scaleCy={scaleCy}
          setScaleCy={setScaleCy}
          scaleCz={scaleCz}
          setScaleCz={setScaleCz}
          scaleFactor={scaleFactor}
          setScaleFactor={setScaleFactor}
          pickMoveVectorActive={pickMoveVector.active}
          pickMoveVectorStep={pickMoveVector.step}
          onStartPickMoveVector={handleStartPickMoveVector}
          pickTransformPointActive={pickTransformPoint.active}
          pickTransformPointTarget={pickTransformPoint.target}
          onStartPickPoint={handleStartPickPoint}
          onCancelPickMode={handleCancelPickMode}
          splitFormOpen={splitFormOpen}
          setSplitFormOpen={setSplitFormOpen}
          splitMode={splitMode}
          setSplitMode={setSplitMode}
          splitT={splitT}
          setSplitT={setSplitT}
          splitN={splitN}
          setSplitN={setSplitN}
          mergeTolerance={mergeTolerance}
          setMergeTolerance={setMergeTolerance}
          setStatusHint={setStatusHint}
          gridCoords={gridCoords}
          setGridCoords={setGridCoords}
          activeGridAxis={activeGridAxis}
          setActiveGridAxis={setActiveGridAxis}
          drawConstructionGrid={drawConstructionGrid}
          setDrawConstructionGrid={setDrawConstructionGrid}
          drawOuterDimensionLines={drawOuterDimensionLines}
          setDrawOuterDimensionLines={setDrawOuterDimensionLines}
        />
      </div>

      {/* Modals */}
      <OptionsModal
        isOpen={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        accent={accent}
        setAccent={setAccent}
        graphicsMode={graphicsMode}
        setGraphicsMode={setGraphicsMode}
        includeSelfWeight={includeSelfWeight}
        setIncludeSelfWeight={setIncludeSelfWeight}
        momentsAsArcs={momentsAsArcs}
        setMomentsAsArcs={setMomentsAsArcs}
      />

      <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />

      <TemplatesModal
        isOpen={templatesModalOpen}
        onClose={() => setTemplatesModalOpen(false)}
        onApplyTemplate={handleApplyTemplate}
        sections={sections}
        materials={materials}
        defaultSectionId={defaultSectionId}
        defaultMaterialId={defaultMaterialId}
      />

      <SaveLocalModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleConfirmSaveLocal}
        currentName={currentModelName}
      />

      <LoadLocalModal
        isOpen={loadModalOpen}
        onClose={() => setLoadModalOpen(false)}
        onSelectModel={handleSelectLocalModel}
        currentModelId={currentModelId}
      />

      <ExportJsonModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleConfirmExportJson}
        defaultName={currentModelName}
      />

      {/* Ukryty input do importu plików JSON */}
      <input
        type="file"
        ref={jsonFileInputRef}
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleJsonFileChange}
      />

      <SelectByModal
        isOpen={selectByOpen}
        onClose={() => setSelectByOpen(false)}
        nodes={nodes}
        elements={elements}
        sections={sections}
        materials={materials}
        groups={groups}
        onSelectElements={(elemIds, desc) => {
          setSelectedElemIds(elemIds);
          setSelectedNodeIds([]);
          setMode('select');
          setStatusHint(
            elemIds.length > 0
              ? `Zaznaczono ${elemIds.length} ${elemIds.length === 1 ? 'pręt' : elemIds.length < 5 ? 'pręty' : 'prętów'} według ${desc}`
              : `Brak prętów spełniających kryterium (${desc})`
          );
        }}
      />
    </div>
  );
}
