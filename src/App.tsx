import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RenderEngine3D, ViewCubeHit } from './render/engine3d';
import { drawScene3D, SceneRenderOptions } from './render/scene3d';
import {
  Node3D,
  Element3D,
  Section,
  Material,
  SolverResult3D,
  AnalysisSettings,
} from './fem/types';
import { INITIAL_SECTIONS, INITIAL_MATERIALS } from './fem/catalogs';
import { generate3DPortalFrame } from './fem/templates';
import { solveLinearStatic3D, solveStability3D, solveModal3D } from './fem/solver3d';
import { Toolbar, ICONS } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { OptionsModal, APP_ACCENTS } from './components/OptionsModal';
import { AboutModal } from './components/AboutModal';
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
};

interface HistoryState {
  nodes: Node3D[];
  elements: Element3D[];
  sections: Section[];
  materials: Material[];
  analysisSettings: AnalysisSettings;
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

function drawTransientOverlays(
  ctx: CanvasRenderingContext2D,
  engine: RenderEngine3D,
  nodes: Node3D[],
  elements: Element3D[],
  mode: 'select' | 'addBar',
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
  isTouch: boolean
) {
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

  // 3. Mode 'addBar' preview: guide line, dimension line, and target node tip (mouse only, disabled on touch)
  if (mode === 'addBar' && !isTouch) {
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
      const tipLabel = targetNodeId != null
        ? `W${targetNodeId} (${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`
        : `(${targetPt[0].toFixed(2)}, ${targetPt[1].toFixed(2)}, ${targetPt[2].toFixed(2)}) m`;
      drawNodeCoordTip(ctx, pb, tipLabel, '#2563eb');
    }
  }
}

export default function App() {
  // Initial 3D structure: 3D Portal Frame
  const initialData = generate3DPortalFrame(6.0, 6.0, 4.0, 1, 1, 1, 1);

  const [nodes, setNodes] = useState<Node3D[]>(initialData.nodes);
  const [elements, setElements] = useState<Element3D[]>(initialData.elements);
  const [sections, setSections] = useState<Section[]>(INITIAL_SECTIONS);
  const [materials, setMaterials] = useState<Material[]>(INITIAL_MATERIALS);

  const [defaultSectionId, setDefaultSectionId] = useState<number>(1);
  const [defaultMaterialId, setDefaultMaterialId] = useState<number>(1);

  // Interaction Mode & 3D Navigation Mode
  const [mode, setMode] = useState<'select' | 'addBar'>('select');
  const [navMode, setNavMode] = useState<'orbit' | 'boxSelect' | 'pan' | 'zoom'>('orbit');

  const [selectedNodeIds, setSelectedNodeIds] = useState<number[]>([]);
  const [selectedElemIds, setSelectedElemIds] = useState<number[]>([]);
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

  // Settings & Display Options
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [accent, setAccent] = useState<string>('blue');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [showLocalAxes, setShowLocalAxes] = useState<boolean>(false);
  const [showNodeNumbers, setShowNodeNumbers] = useState<boolean>(false);
  const [showElementNumbers, setShowElementNumbers] = useState<boolean>(false);
  const [showSectionNames, setShowSectionNames] = useState<boolean>(false);
  const [showMaterialNames, setShowMaterialNames] = useState<boolean>(false);
  const [showSupports, setShowSupports] = useState<boolean>(true);
  const [showProfileSketches, setShowProfileSketches] = useState<boolean>(true);
  const [showLoads, setShowLoads] = useState<boolean>(true);
  const [showLoadValues, setShowLoadValues] = useState<boolean>(true);
  const [showHingeLabels, setShowHingeLabels] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(false);
  const [gridPlane, setGridPlane] = useState<'XY' | 'XZ' | 'YZ'>('XY');
  const [gridOffset, setGridOffset] = useState<number>(0);

  const handleNodeCoordinateSet = useCallback((coord: { x: number; y: number; z: number }) => {
    if (gridPlane === 'XY') setGridOffset(coord.z);
    else if (gridPlane === 'XZ') setGridOffset(coord.y);
    else if (gridPlane === 'YZ') setGridOffset(coord.x);
  }, [gridPlane]);
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [allowNewNodesInBarMode, setAllowNewNodesInBarMode] = useState<boolean>(true);
  const [snapSize, setSnapSize] = useState<number>(0.5);
  const [showCanvasUI, setShowCanvasUI] = useState<boolean>(true);

  const [includeSelfWeight, setIncludeSelfWeight] = useState<boolean>(false);

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

  // Result Toggles
  const [showDeform, setShowDeform] = useState<boolean>(true);
  const [showMy, setShowMy] = useState<boolean>(false);
  const [showMz, setShowMz] = useState<boolean>(false);
  const [showMx, setShowMx] = useState<boolean>(false);
  const [showVy, setShowVy] = useState<boolean>(false);
  const [showVz, setShowVz] = useState<boolean>(false);
  const [showN, setShowN] = useState<boolean>(false);
  const [showStress, setShowStress] = useState<boolean>(false);
  const [showReactions, setShowReactions] = useState<boolean>(true);
  const [hideLoadsInResults, setHideLoadsInResults] = useState<boolean>(false);
  const [hideSupportsInResults, setHideSupportsInResults] = useState<boolean>(false);

  const [deformScaleMult, setDeformScaleMult] = useState<number>(1.0);
  const [diagramScaleMult, setDiagramScaleMult] = useState<number>(1.0);
  const [probe, setProbe] = useState<{ elId: number | null; t: number }>({ elId: null, t: 0.5 });

  // Modals
  const [optionsOpen, setOptionsOpen] = useState<boolean>(false);
  const [aboutOpen, setAboutOpen] = useState<boolean>(false);
  const [selectByOpen, setSelectByOpen] = useState<boolean>(false);
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [loadModalOpen, setLoadModalOpen] = useState<boolean>(false);
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [currentModelName, setCurrentModelName] = useState<string>('Projekt konstrukcji 3D');
  const [currentModelId, setCurrentModelId] = useState<string | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);

  // Undo / Redo Stack
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

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
  const pushHistory = useCallback(() => {
    const state: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      elements: JSON.parse(JSON.stringify(elements)),
      sections: JSON.parse(JSON.stringify(sections)),
      materials: JSON.parse(JSON.stringify(materials)),
      analysisSettings: JSON.parse(JSON.stringify(analysisSettings)),
    };
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), state]);
    setHistoryIndex((prev) => prev + 1);
  }, [nodes, elements, sections, materials, analysisSettings, historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setElements(prevState.elements);
      setSections(prevState.sections);
      setMaterials(prevState.materials);
      setAnalysisSettings(prevState.analysisSettings);
      setHistoryIndex(historyIndex - 1);
      setSolved(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setElements(nextState.elements);
      setSections(nextState.sections);
      setMaterials(nextState.materials);
      setAnalysisSettings(nextState.analysisSettings);
      setHistoryIndex(historyIndex + 1);
      setSolved(null);
    }
  };

  const handleInvalidateResults = () => {
    setSolved(null);
    setSolveWarning(null);
    setProbe({ elId: null, t: 0.5 });
  };

  // Model storage and file operations
  const handleNewModel = () => {
    setNodes([]);
    setElements([]);
    setSolved(null);
    setSelectedNodeIds([]);
    setSelectedElemIds([]);
    setCurrentModelName('Projekt konstrukcji 3D');
    setCurrentModelId(null);
    setHistory([]);
    setHistoryIndex(-1);
    setStatusHint('Utworzono nowy czysty model 3D.');
  };

  const handleSaveModel = () => {
    if (currentModelId) {
      const list = getStoredModelsList();
      const idx = list.findIndex((m) => m.id === currentModelId);
      const data = { nodes, elements, sections, materials, analysisSettings };
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
    const cleanName = name.trim() || 'Projekt konstrukcji 3D';
    const existingIdx = list.findIndex(
      (m) => m.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    const id =
      existingIdx >= 0
        ? list[existingIdx].id
        : 'model_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const data = { nodes, elements, sections, materials, analysisSettings };
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
      if (record.data.nodes) setNodes(record.data.nodes);
      if (record.data.elements) setElements(record.data.elements);
      if (record.data.sections) setSections(record.data.sections);
      if (record.data.materials) setMaterials(record.data.materials);
      if (record.data.analysisSettings) setAnalysisSettings(record.data.analysisSettings);
      setSolved(null);
      setSelectedNodeIds([]);
      setSelectedElemIds([]);
      if (record.data.nodes && record.data.nodes.length > 0) {
        engineRef.current.fitView(record.data.nodes);
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
          setNodes(parsed.nodes);
          setElements(parsed.elements);
          if (parsed.sections) setSections(parsed.sections);
          if (parsed.materials) setMaterials(parsed.materials);
          if (parsed.analysisSettings) setAnalysisSettings(parsed.analysisSettings);
          setSolved(null);
          setSelectedNodeIds([]);
          setSelectedElemIds([]);
          engineRef.current.fitView(parsed.nodes);
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
    const data = { nodes, elements, sections, materials, analysisSettings };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportModalOpen(false);
    setStatusHint(`Wyeksportowano model do pliku ${cleanName}.json`);
  };

  // Perform 3D FEM Analysis
  const handleSolveOrBack = () => {
    if (solved) {
      setSolved(null);
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

    const solverModel = {
      nodes,
      elements,
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

    try {
      if (analysisSettings.type === 'stability') {
        const out = solveStability3D(solverModel, analysisSettings.params.bucklingModes || 4);
        setSolved(out);
        if (out.singular) setSolveWarning('Osobliwa macierz sztywności. Sprawdź schemat statyczny.');
        else if (out.noCompression) setSolveWarning('Brak elementów ściskanych w modelu.');
        else setStatusHint(`Obliczono stateczność: ${out.modes.length} form wyboczenia.`);
      } else if (analysisSettings.type === 'modal') {
        const out = solveModal3D(solverModel, analysisSettings.params.modalModes || 4);
        setSolved(out);
        if (out.singular) setSolveWarning('Osobliwa macierz sztywności.');
        else if (out.noMass) setSolveWarning('Brak masy w modelu (zdefiniuj masy w węzłach lub włącz masę prętów).');
        else setStatusHint(`Obliczono drgania własne: ${out.modes.length} form drgań.`);
      } else {
        const out = solveLinearStatic3D(solverModel);
        setSolved(out);
        if (out.singular) setSolveWarning('Osobliwa macierz sztywności. Sprawdź podparcie konstrukcji.');
        else setStatusHint('Obliczono statykę 3D: wyznaczono siły, ugięcia i reakcje.');
      }
    } catch (e: any) {
      setSolveWarning('Błąd obliczeń MES: ' + e.message);
    }
  };

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
      selectedNodeIds,
      selectedElemIds,
      hoverNodeId: hoverNodeIdRef.current,
      hoverElemId: hoverElemIdRef.current,
      mode,
      probe,
      theme,
      accentColor: accentDef.hex,
      gridPlane,
      gridOffset,
    };

    // 1. Draw 3D Three.js WebGL Scene & 2D Text/Overlay Labels
    drawScene3D(overlayCtx, engine, nodes, elements, sections, materials, solved, renderOpts);

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
      mode,
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
      isTouch
    );
  }, [
    nodes,
    elements,
    sections,
    materials,
    solved,
    selectedNodeIds,
    selectedElemIds,
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
    probe,
    showCanvasUI,
    gridPlane,
    gridOffset,
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

    setSelectedNodeIds((prev) => updateSelection(prev, hitNodeIds, selMode));
    setSelectedElemIds((prev) => updateSelection(prev, hitElemIds, selMode));

    let actionLabel = '';
    if (selMode === 'add') actionLabel = 'Dodano do zaznaczenia';
    else if (selMode === 'subtract') actionLabel = 'Odjęto od zaznaczenia';
    else if (selMode === 'toggle') actionLabel = 'Przełączono zaznaczenie';
    else actionLabel = 'Zaznaczono ramką';

    setStatusHint(
      `${actionLabel} (${isWindow ? 'okno' : 'przecięcie'}): ${pluralUnit(hitNodeIds.length, 'węzeł', 'węzły', 'węzłów')}, ${pluralUnit(hitElemIds.length, 'pręt', 'pręty', 'prętów')}.`
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
        hoverElemIdRef.current != null;

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
          },
          () => {
            if (cubeHit === 'FRONT' || cubeHit === 'BACK') {
              setGridPlane('XZ');
              setStatusHint('Zmieniono płaszczyznę siatki na XZ (y=0).');
            } else if (cubeHit === 'LEFT' || cubeHit === 'RIGHT') {
              setGridPlane('YZ');
              setStatusHint('Zmieniono płaszczyznę siatki na YZ (x=0).');
            } else if (cubeHit === 'TOP' || cubeHit === 'BOTTOM') {
              setGridPlane('XY');
              setStatusHint('Zmieniono płaszczyznę siatki na XY (z=0).');
            }
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
    const groundPt = engine.unprojectToPlane(px, py, gridPlane, gridOffset);
    if (coordsSpanRef.current) {
      coordsSpanRef.current.textContent = `x=${groundPt[0].toFixed(2)} m, y=${groundPt[1].toFixed(2)} m, z=${groundPt[2].toFixed(2)} m`;
    }

    // Hit testing on nodes
    let foundNodeId: number | null = null;
    let minNodeDist = 14;

    nodes.forEach((n) => {
      const p = engine.project([n.x, n.y, n.z]);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < minNodeDist) {
        minNodeDist = d;
        foundNodeId = n.id;
      }
    });

    // Hit testing on elements (bars) when no node is hovered
    let foundElemId: number | null = null;
    if (foundNodeId == null) {
      let minElemDist = 10;
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
        if (d < minElemDist) {
          minElemDist = d;
          foundElemId = el.id;
        }
      });
    }

    // Direct hover refs update
    const hoverChanged =
      cubeHit !== hoverViewCubeRef.current ||
      foundNodeId !== hoverNodeIdRef.current ||
      foundElemId !== hoverElemIdRef.current;

    hoverViewCubeRef.current = cubeHit;
    hoverNodeIdRef.current = foundNodeId;
    hoverElemIdRef.current = foundElemId;

    // Dynamic smart cursor update
    updateCanvasCursor({ ctrl, shift });

    // Redraw immediately during drawing mode for live preview or when hover state changes
    if (mode === 'addBar' || hoverChanged) {
      redraw();
    }
  };

  const handleMouseLeave = () => {
    mousePosRef.current = null;
    hoverViewCubeRef.current = null;
    hoverNodeIdRef.current = null;
    hoverElemIdRef.current = null;
    if (mode === 'addBar') {
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
  
    // Check node hit
    let clickedNodeId: number | null = null;
    let minNodeDist = 14;
    nodes.forEach((n) => {
      const p = engine.project([n.x, n.y, n.z]);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < minNodeDist) {
        minNodeDist = d;
        clickedNodeId = n.id;
      }
    });

    if (clickedNodeId != null) {
      const clickedNode = nodes.find((n) => n.id === clickedNodeId);
      if (clickedNode) {
        const offset = gridPlane === 'XY' ? clickedNode.z : gridPlane === 'XZ' ? clickedNode.y : clickedNode.x;
        setGridOffset(offset);
        engine.setRotationCenter([clickedNode.x, clickedNode.y, clickedNode.z]);
      }
    }
  
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
              sectionId: defaultSectionId,
              materialId: defaultMaterialId,
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
          } else {
            if (gridPlane === 'XY') z = gridOffset;
            else if (gridPlane === 'XZ') y = gridOffset;
            else if (gridPlane === 'YZ') x = gridOffset;
          }

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
          engine.setRotationCenter([x, y, z]);

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
                sectionId: defaultSectionId,
                materialId: defaultMaterialId,
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
    } else {
      // Selection Mode
      if (clickedNodeId != null) {
        setSelectedNodeIds((prev) => updateSelection(prev, [clickedNodeId!], selMode));
        if (selMode === 'replace') {
          setSelectedElemIds([]);
        }
      } else {
        // Check element hit
        let clickedElemId: number | null = null;
        let minElemDist = 10;
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
          if (d < minElemDist) {
            minElemDist = d;
            clickedElemId = el.id;
            setProbe({ elId: el.id, t });
          }
        });

        if (clickedElemId != null) {
          const el = elements.find((e) => e.id === clickedElemId);
          if (el) {
            const n1 = nodes.find((n) => n.id === el.n1);
            const n2 = nodes.find((n) => n.id === el.n2);
            if (n1 && n2) {
              const midX = (n1.x + n2.x) / 2;
              const midY = (n1.y + n2.y) / 2;
              const midZ = (n1.z + n2.z) / 2;
              engine.setRotationCenter([midX, midY, midZ]);
            }
          }
          setSelectedElemIds((prev) => updateSelection(prev, [clickedElemId!], selMode));
          if (selMode === 'replace') {
            setSelectedNodeIds([]);
          }
        } else {
          // Clicked on empty space
          if (selMode === 'replace') {
            if (selectedNodeIds.length > 0 || selectedElemIds.length > 0) {
              setSelectedNodeIds([]);
              setSelectedElemIds([]);
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
          if (cubeHit === 'FRONT' || cubeHit === 'BACK') {
            setGridPlane('XZ');
            setStatusHint('Zmieniono płaszczyznę siatki na XZ (y=0).');
          } else if (cubeHit === 'LEFT' || cubeHit === 'RIGHT') {
            setGridPlane('YZ');
            setStatusHint('Zmieniono płaszczyznę siatki na YZ (x=0).');
          } else if (cubeHit === 'TOP' || cubeHit === 'BOTTOM') {
            setGridPlane('XY');
            setStatusHint('Zmieniono płaszczyznę siatki na XY (z=0).');
          }

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
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      if (ctrl !== keyModifiersRef.current.ctrl || shift !== keyModifiersRef.current.shift) {
        keyModifiersRef.current = { ctrl, shift };
        setKeyModifiers({ ctrl, shift });
        updateCanvasCursor({ ctrl, shift });
      }

      const targetTag = (e.target as HTMLElement)?.tagName?.toUpperCase();
      if (targetTag === 'INPUT' || targetTag === 'SELECT' || targetTag === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSolveOrBack();
      } else if (e.key === 'v' || e.key === 'V') {
        setMode('select');
        setNavMode('select');
      } else if (e.key === 'o' || e.key === 'O') {
        setNavMode('orbit');
      } else if (e.key === 'p' || e.key === 'P') {
        setNavMode('pan');
      } else if (e.key === 'f' || e.key === 'F') {
        handleFitView();
      } else if (e.key === 'r' || e.key === 'R' || e.key === 'b' || e.key === 'B') {
        setMode('addBar');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      if (ctrl !== keyModifiersRef.current.ctrl || shift !== keyModifiersRef.current.shift) {
        keyModifiersRef.current = { ctrl, shift };
        setKeyModifiers({ ctrl, shift });
        updateCanvasCursor({ ctrl, shift });
      }
    };

    const handleBlur = () => {
      if (keyModifiersRef.current.ctrl || keyModifiersRef.current.shift) {
        keyModifiersRef.current = { ctrl: false, shift: false };
        setKeyModifiers({ ctrl: false, shift: false });
        updateCanvasCursor({ ctrl: false, shift: false });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
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
        }}
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
        onSaveModel={handleSaveModel}
        onSaveAsModel={handleSaveAsModel}
        onLoadModel={handleLoadModel}
        onImportJson={handleImportJson}
        onExportJson={handleExportJson}
        onOpenOptions={() => setOptionsOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
        snapEnabled={snapEnabled}
        setSnapEnabled={setSnapEnabled}
        allowNewNodesInBarMode={allowNewNodesInBarMode}
        setAllowNewNodesInBarMode={setAllowNewNodesInBarMode}
        sections={sections}
        materials={materials}
        defaultSectionId={defaultSectionId}
        setDefaultSectionId={setDefaultSectionId}
        defaultMaterialId={defaultMaterialId}
        setDefaultMaterialId={setDefaultMaterialId}
        snapSize={snapSize}
      />

      {/* Main Workspace (Canvas 3D + Sidebar) matching #main */}
      <div id="main">
        {/* Canvas Wrap */}
        <div id="canvasWrap">
          <canvas id="cv-webgl" ref={webglCanvasRef} />
          <canvas
            id="cv-overlay"
            ref={overlayCanvasRef}
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
                  value={defaultSectionId}
                  onChange={(e) => setDefaultSectionId(parseInt(e.target.value))}
                  title="Domyślny przekrój"
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <select
                  className="zselect"
                  value={defaultMaterialId}
                  onChange={(e) => setDefaultMaterialId(parseInt(e.target.value))}
                  title="Domyślny materiał"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
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
                  className={`zbtn ${showProfileSketches ? 'active' : ''}`}
                  onClick={() => setShowProfileSketches(!showProfileSketches)}
                  title="Pokaż szkice profili (geometria 3D przekroju)"
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
          sections={sections}
          setSections={setSections}
          materials={materials}
          setMaterials={setMaterials}
          selectedNodeIds={selectedNodeIds}
          setSelectedNodeIds={setSelectedNodeIds}
          selectedElemIds={selectedElemIds}
          setSelectedElemIds={setSelectedElemIds}
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
          probe={probe}
          setProbe={setProbe}
          onInvalidateResults={handleInvalidateResults}
          onNodeCoordinateSet={handleNodeCoordinateSet}
          onNodePlaced={(id) => setLastPlacedNodeId(id)}
          onElemDrawn={(id) => setLastDrawnElemId(id)}
          defaultSectionId={defaultSectionId}
          defaultMaterialId={defaultMaterialId}
          panelHeight={panelHeight}
          onPanelHandleStart={handlePanelResizeStart}
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
        showGrid={showGrid}
        setShowGrid={setShowGrid}
        showAxes={showAxes}
        setShowAxes={setShowAxes}
        includeSelfWeight={includeSelfWeight}
        setIncludeSelfWeight={setIncludeSelfWeight}
        snapSize={snapSize}
        setSnapSize={setSnapSize}
      />

      <AboutModal isOpen={aboutOpen} onClose={() => setAboutOpen(false)} />

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
