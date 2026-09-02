import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Node3D,
  Element3D,
  Section,
  Material,
  Support3D,
  SolverResult3D,
  AnalysisSettings,
  AnalysisType,
  MemberHinges3D,
  Panel3D,
  PanelShape,
  PanelLoadTransferDir,
  PanelPressureLoad,
  ElementGroupDef,
} from '../fem/types';
import {
  LoadCase3D,
  LoadNature,
  EurocodeCategory,
  LoadCombination3D,
  MultiCaseResults3D,
  getNatureLabel,
} from '../fem/loadcases';
import { LoadCasesPanel } from './LoadCasesPanel';

export const GROUP_PALETTE_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1', '#14b8a6', '#d97706', '#0284c7', '#dc2626', '#059669', '#7c3aed',
  '#db2777', '#0891b2', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#b45309', '#0369a1',
  '#b91c1c', '#047857', '#6d28d9', '#be185d', '#0e7490', '#4d7c0f', '#c2410c', '#3730a3',
  '#0f766e', '#92400e', '#1e3a8a', '#831843'
];
import { ICONS } from './Toolbar';
import { CATALOG_DEFS, CATALOG_ORDER } from '../fem/catalogs';
import { SmartNumberInput } from './SmartNumberInput';
import { mergeOverlapping } from '../utils/merge';
import { findAndSplitIntersections } from '../utils/intersect';

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
  return p;
}

function transformVector(
  v: [number, number, number],
  mode: 'move' | 'rotate' | 'mirror' | 'scale',
  params: {
    moveDx: number; moveDy: number; moveDz: number;
    rotateCenter: [number, number, number]; rotateAxis: 'X' | 'Y' | 'Z'; rotateAngleDeg: number;
    mirrorPoint: [number, number, number]; mirrorPlane: 'XY' | 'YZ' | 'XZ';
    scaleCenter: [number, number, number]; scaleFactor: number;
  },
  step: number
): [number, number, number] {
  let [x, y, z] = v;
  if (mode === 'move') {
    return [x, y, z];
  } else if (mode === 'rotate') {
    const rad = (params.rotateAngleDeg * step * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    let x1 = x, y1 = y, z1 = z;
    if (params.rotateAxis === 'X') {
      y1 = y * cos - z * sin;
      z1 = y * sin + z * cos;
    } else if (params.rotateAxis === 'Y') {
      x1 = x * cos + z * sin;
      z1 = -x * sin + z * cos;
    } else if (params.rotateAxis === 'Z') {
      x1 = x * cos - y * sin;
      y1 = x * sin + y * cos;
    }
    return [x1, y1, z1];
  } else if (mode === 'mirror') {
    if (params.mirrorPlane === 'XY') {
      return [x, y, -z];
    } else if (params.mirrorPlane === 'YZ') {
      return [-x, y, z];
    } else { // XZ
      return [x, -y, z];
    }
  } else if (mode === 'scale') {
    return [x, y, z];
  }
  return v;
}

function cross3D(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function dot3D(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function norm3D(a: [number, number, number]): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function round4(v: number): number {
  if (Math.abs(v) < 1e-6) return 0;
  return Math.round(v * 1e4) / 1e4;
}

function computeSingleAxisRotationMatrix(axis: 'X' | 'Y' | 'Z', angleDeg: number): number[][] {
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  if (axis === 'X') {
    return [
      [1, 0, 0],
      [0, c, -s],
      [0, s, c]
    ];
  } else if (axis === 'Y') {
    return [
      [c, 0, s],
      [0, 1, 0],
      [-s, 0, c]
    ];
  } else { // Z
    return [
      [c, -s, 0],
      [s, c, 0],
      [0, 0, 1]
    ];
  }
}

function computeSupportRotationMatrix(
  rotXDeg = 0,
  rotYDeg = 0,
  rotZDeg = 0
): number[][] {
  const rx = (rotXDeg || 0) * (Math.PI / 180);
  const ry = (rotYDeg || 0) * (Math.PI / 180);
  const rz = (rotZDeg || 0) * (Math.PI / 180);

  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const cz = Math.cos(rz);
  const sz = Math.sin(rz);

  const R = [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx]
  ];
  return R;
}

function matMul3x3(A: number[][], B: number[][]): number[][] {
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let sum = 0;
      for (let k = 0; k < 3; k++) {
        sum += A[i][k] * B[k][j];
      }
      C[i][j] = sum;
    }
  }
  return C;
}

function extractEulerAngles(R: number[][]): { rotX: number; rotY: number; rotZ: number } {
  let rx = 0;
  let ry = 0;
  let rz = 0;

  const sy = -R[2][0];
  if (Math.abs(sy) < 0.99999) {
    ry = Math.asin(sy);
    rx = Math.atan2(R[2][1], R[2][2]);
    rz = Math.atan2(R[1][0], R[0][0]);
  } else {
    ry = sy > 0 ? Math.PI / 2 : -Math.PI / 2;
    rz = 0;
    rx = Math.atan2(-R[1][2], R[1][1]);
  }

  return {
    rotX: Math.round(rx * (180 / Math.PI) * 1e4) / 1e4,
    rotY: Math.round(ry * (180 / Math.PI) * 1e4) / 1e4,
    rotZ: Math.round(rz * (180 / Math.PI) * 1e4) / 1e4,
  };
}

function transformSupport(
  sup: Support3D | null,
  mode: 'move' | 'rotate' | 'mirror' | 'scale',
  params: {
    moveDx: number; moveDy: number; moveDz: number;
    rotateCenter: [number, number, number]; rotateAxis: 'X' | 'Y' | 'Z'; rotateAngleDeg: number;
    mirrorPoint: [number, number, number]; mirrorPlane: 'XY' | 'YZ' | 'XZ';
    scaleCenter: [number, number, number]; scaleFactor: number;
  },
  step: number,
  shouldTransformLoadsAndDisplacements: boolean
): Support3D | null {
  if (!sup) return null;
  const newSup: Support3D = JSON.parse(JSON.stringify(sup));

  // 1. Transform the support orientation angles (rotX, rotY, rotZ) themselves (unconditional, so symbols rotate!)
  if (mode === 'rotate') {
    const rx = newSup.rotX || 0;
    const ry = newSup.rotY || 0;
    const rz = newSup.rotZ || 0;

    const R_tool = computeSingleAxisRotationMatrix(params.rotateAxis, params.rotateAngleDeg * step);
    const R_old = computeSupportRotationMatrix(rx, ry, rz);
    const R_new = matMul3x3(R_tool, R_old);
    const rot_new = extractEulerAngles(R_new);

    newSup.rotX = round4(rot_new.rotX);
    newSup.rotY = round4(rot_new.rotY);
    newSup.rotZ = round4(rot_new.rotZ);
  } else if (mode === 'mirror') {
    let tRx = newSup.rotX || 0;
    let tRy = newSup.rotY || 0;
    let tRz = newSup.rotZ || 0;
    if (params.mirrorPlane === 'YZ') {
      tRy = -tRy;
      tRz = -tRz;
    } else if (params.mirrorPlane === 'XZ') {
      tRx = -tRx;
      tRz = -tRz;
    } else if (params.mirrorPlane === 'XY') {
      tRx = -tRx;
      tRy = -tRy;
    }
    newSup.rotX = round4(tRx);
    newSup.rotY = round4(tRy);
    newSup.rotZ = round4(tRz);
  }

  if (!shouldTransformLoadsAndDisplacements) return newSup;

  // Transform translational settlements / forced displacements (delta)
  const hasTransDelta = (newSup.ux.delta || 0) !== 0 || (newSup.uy.delta || 0) !== 0 || (newSup.uz.delta || 0) !== 0;
  if (hasTransDelta) {
    const vTrans: [number, number, number] = [
      newSup.ux.delta || 0,
      newSup.uy.delta || 0,
      newSup.uz.delta || 0,
    ];
    const [tDx, tDy, tDz] = transformVector(vTrans, mode, params, step);
    if (newSup.ux.delta !== undefined) newSup.ux.delta = round4(tDx);
    if (newSup.uy.delta !== undefined) newSup.uy.delta = round4(tDy);
    if (newSup.uz.delta !== undefined) newSup.uz.delta = round4(tDz);
  }

  // Transform rotational settlements / forced displacements (delta)
  const hasRotDelta = (newSup.rx.delta || 0) !== 0 || (newSup.ry.delta || 0) !== 0 || (newSup.rz.delta || 0) !== 0;
  if (hasRotDelta) {
    const vRot: [number, number, number] = [
      newSup.rx.delta || 0,
      newSup.ry.delta || 0,
      newSup.rz.delta || 0,
    ];
    if (mode === 'rotate') {
      const [tRx, tRy, tRz] = transformVector(vRot, 'rotate', params, step);
      if (newSup.rx.delta !== undefined) newSup.rx.delta = round4(tRx);
      if (newSup.ry.delta !== undefined) newSup.ry.delta = round4(tRy);
      if (newSup.rz.delta !== undefined) newSup.rz.delta = round4(tRz);
    } else if (mode === 'mirror') {
      let tRx = vRot[0];
      let tRy = vRot[1];
      let tRz = vRot[2];
      if (params.mirrorPlane === 'YZ') {
        tRy = -tRy;
        tRz = -tRz;
      } else if (params.mirrorPlane === 'XZ') {
        tRx = -tRx;
        tRz = -tRz;
      } else if (params.mirrorPlane === 'XY') {
        tRx = -tRx;
        tRy = -tRy;
      }
      if (newSup.rx.delta !== undefined) newSup.rx.delta = round4(tRx);
      if (newSup.ry.delta !== undefined) newSup.ry.delta = round4(tRy);
      if (newSup.rz.delta !== undefined) newSup.rz.delta = round4(tRz);
    }
  }

  return newSup;
}

function normalize3D(a: [number, number, number]): [number, number, number] {
  const n = Math.hypot(a[0], a[1], a[2]) || 1e-6;
  return [a[0] / n, a[1] / n, a[2] / n];
}

function computeLocalAxesForNodes(
  n1: { x: number; y: number; z: number },
  n2: { x: number; y: number; z: number },
  rollAngleDeg = 0
): { vx: [number, number, number]; vy: [number, number, number]; vz: [number, number, number] } {
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const dz = n2.z - n1.z;
  const L = Math.hypot(dx, dy, dz) || 1e-6;

  const vx: [number, number, number] = [dx / L, dy / L, dz / L];

  let vRef: [number, number, number] = [0, 0, 1];
  if (Math.abs(vx[2]) > 0.999) {
    vRef = [0, 1, 0];
  }

  let vy0 = cross3D(vRef, vx);
  if (norm3D(vy0) < 1e-6) {
    vRef = [1, 0, 0];
    vy0 = cross3D(vRef, vx);
  }
  vy0 = normalize3D(vy0);

  const vz0 = normalize3D(cross3D(vx, vy0));

  const beta = rollAngleDeg * (Math.PI / 180);
  const cosB = Math.cos(beta);
  const sinB = Math.sin(beta);

  const vy: [number, number, number] = [
    vy0[0] * cosB + vz0[0] * sinB,
    vy0[1] * cosB + vz0[1] * sinB,
    vy0[2] * cosB + vz0[2] * sinB,
  ];

  const vz: [number, number, number] = [
    -vy0[0] * sinB + vz0[0] * cosB,
    -vy0[1] * sinB + vz0[1] * cosB,
    -vy0[2] * sinB + vz0[2] * cosB,
  ];

  return { vx, vy, vz };
}

function getTransformedRollAngle(
  n1: { x: number; y: number; z: number },
  n2: { x: number; y: number; z: number },
  rollAngleDeg: number,
  mode: 'move' | 'rotate' | 'mirror' | 'scale',
  params: any,
  step: number
): number {
  if (mode === 'move' || mode === 'scale') {
    return rollAngleDeg;
  }

  const origAxes = computeLocalAxesForNodes(n1, n2, rollAngleDeg);

  const t_n1 = {
    x: transformPoint([n1.x, n1.y, n1.z], mode, params, step)[0],
    y: transformPoint([n1.x, n1.y, n1.z], mode, params, step)[1],
    z: transformPoint([n1.x, n1.y, n1.z], mode, params, step)[2],
  };
  const t_n2 = {
    x: transformPoint([n2.x, n2.y, n2.z], mode, params, step)[0],
    y: transformPoint([n2.x, n2.y, n2.z], mode, params, step)[1],
    z: transformPoint([n2.x, n2.y, n2.z], mode, params, step)[2],
  };

  const t_vy = transformVector(origAxes.vy, mode, params, step);

  const defaultNewAxes = computeLocalAxesForNodes(t_n1, t_n2, 0);

  const vy0_new = defaultNewAxes.vy;
  const vz0_new = defaultNewAxes.vz;

  const cosBeta = dot3D(t_vy, vy0_new);
  const sinBeta = dot3D(t_vy, vz0_new);

  const newBetaRad = Math.atan2(sinBeta, cosBeta);
  let newBetaDeg = (newBetaRad * 180) / Math.PI;

  newBetaDeg = Math.round(newBetaDeg * 100) / 100;

  if (newBetaDeg < -180) newBetaDeg += 360;
  if (newBetaDeg > 180) newBetaDeg -= 360;

  return newBetaDeg;
}

interface SidebarProps {
  nodes: Node3D[];
  setNodes: React.Dispatch<React.SetStateAction<Node3D[]>>;
  elements: Element3D[];
  setElements: React.Dispatch<React.SetStateAction<Element3D[]>>;
  panels?: Panel3D[];
  setPanels?: React.Dispatch<React.SetStateAction<Panel3D[]>>;
  sections: Section[];
  setSections: React.Dispatch<React.SetStateAction<Section[]>>;
  materials: Material[];
  setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
  selectedNodeIds: number[];
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<number[]>>;
  selectedElemIds: number[];
  setSelectedElemIds: React.Dispatch<React.SetStateAction<number[]>>;
  selectedPanelIds?: number[];
  setSelectedPanelIds?: React.Dispatch<React.SetStateAction<number[]>>;
  mode: 'select' | 'addBar' | 'addPanel' | 'grid' | 'lines';
  setMode: (m: 'select' | 'addBar' | 'addPanel' | 'grid' | 'lines') => void;
  gridCoords?: { x: number[]; y: number[]; z: number[] };
  setGridCoords?: React.Dispatch<React.SetStateAction<{ x: number[]; y: number[]; z: number[] }>>;
  activeGridAxis?: 'X' | 'Y' | 'Z';
  setActiveGridAxis?: (axis: 'X' | 'Y' | 'Z') => void;
  panelShape?: PanelShape;
  setPanelShape?: (s: PanelShape) => void;
  panelPoints?: number[];
  setPanelPoints?: React.Dispatch<React.SetStateAction<number[]>>;
  gridPlane?: 'XY' | 'XZ' | 'YZ';
  setGridPlane?: (p: 'XY' | 'XZ' | 'YZ') => void;
  gridOffset?: number;
  setGridOffset?: (o: number) => void;
  snapEnabled?: boolean;
  setSnapEnabled?: (v: boolean) => void;
  snapSize?: number;
  setSnapSize?: (v: number) => void;
  showGrid?: boolean;
  setShowGrid?: (v: boolean) => void;
  showAxes?: boolean;
  setShowAxes?: (v: boolean) => void;
  barStartNodeId: number | null;
  setBarStartNodeId: (id: number | null) => void;
  analysisSettings: AnalysisSettings;
  setAnalysisSettings: React.Dispatch<React.SetStateAction<AnalysisSettings>>;
  solved: SolverResult3D | null;
  setSolved?: React.Dispatch<React.SetStateAction<SolverResult3D | null>>;
  solveWarning: string | null;
  showDeform: boolean;
  setShowDeform: (v: boolean) => void;
  showMy: boolean;
  setShowMy: (v: boolean) => void;
  showMz: boolean;
  setShowMz: (v: boolean) => void;
  showMx: boolean;
  setShowMx: (v: boolean) => void;
  showVy: boolean;
  setShowVy: (v: boolean) => void;
  showVz: boolean;
  setShowVz: (v: boolean) => void;
  showN: boolean;
  setShowN: (v: boolean) => void;
  showStress: boolean;
  setShowStress: (v: boolean) => void;
  showReactions: boolean;
  setShowReactions: (v: boolean) => void;
  deformScaleMult: number;
  setDeformScaleMult: (v: number) => void;
  diagramScaleMult: number;
  setDiagramScaleMult: (v: number) => void;
  diagramLabelMode?: 'none' | 'minmax' | 'all';
  setDiagramLabelMode?: (mode: 'none' | 'minmax' | 'all') => void;
  probe: { elId: number | null; t: number };
  setProbe: React.Dispatch<React.SetStateAction<{ elId: number | null; t: number }>>;
  onInvalidateResults: () => void;
  onNodePlaced?: (id: number) => void;
  onElemDrawn?: (id: number) => void;
  defaultSectionId: number;
  defaultMaterialId: number;
  isVertical?: boolean;
  panelHeight?: number | null;
  onPanelHandleStart?: (e: React.MouseEvent | React.TouchEvent) => void;
  activeTransformMode?: 'none' | 'move' | 'rotate' | 'mirror' | 'scale';
  setActiveTransformMode?: (mode: 'none' | 'move' | 'rotate' | 'mirror' | 'scale') => void;
  transformWithCopy?: boolean;
  setTransformWithCopy?: React.Dispatch<React.SetStateAction<boolean>>;
  transformConnect?: boolean;
  setTransformConnect?: React.Dispatch<React.SetStateAction<boolean>>;
  transformRepeat?: number;
  setTransformRepeat?: React.Dispatch<React.SetStateAction<number>>;
  transformLoads?: boolean;
  setTransformLoads?: React.Dispatch<React.SetStateAction<boolean>>;
  moveDx?: number;
  setMoveDx?: React.Dispatch<React.SetStateAction<number>>;
  moveDy?: number;
  setMoveDy?: React.Dispatch<React.SetStateAction<number>>;
  moveDz?: number;
  setMoveDz?: React.Dispatch<React.SetStateAction<number>>;
  rotateCx?: number;
  setRotateCx?: React.Dispatch<React.SetStateAction<number>>;
  rotateCy?: number;
  setRotateCy?: React.Dispatch<React.SetStateAction<number>>;
  rotateCz?: number;
  setRotateCz?: React.Dispatch<React.SetStateAction<number>>;
  rotateAxis?: 'X' | 'Y' | 'Z';
  setRotateAxis?: React.Dispatch<React.SetStateAction<'X' | 'Y' | 'Z'>>;
  rotateAngle?: number;
  setRotateAngle?: React.Dispatch<React.SetStateAction<number>>;
  mirrorPx?: number;
  setMirrorPx?: React.Dispatch<React.SetStateAction<number>>;
  mirrorPy?: number;
  setMirrorPy?: React.Dispatch<React.SetStateAction<number>>;
  mirrorPz?: number;
  setMirrorPz?: React.Dispatch<React.SetStateAction<number>>;
  mirrorPlane?: 'XY' | 'YZ' | 'XZ';
  setMirrorPlane?: React.Dispatch<React.SetStateAction<'XY' | 'YZ' | 'XZ'>>;
  scaleCx?: number;
  setScaleCx?: React.Dispatch<React.SetStateAction<number>>;
  scaleCy?: number;
  setScaleCy?: React.Dispatch<React.SetStateAction<number>>;
  scaleCz?: number;
  setScaleCz?: React.Dispatch<React.SetStateAction<number>>;
  scaleFactor?: number;
  setScaleFactor?: React.Dispatch<React.SetStateAction<number>>;
  splitFormOpen?: boolean;
  setSplitFormOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  splitMode?: 'single' | 'multi';
  setSplitMode?: React.Dispatch<React.SetStateAction<'single' | 'multi'>>;
  splitT?: number;
  setSplitT?: React.Dispatch<React.SetStateAction<number>>;
  splitN?: number;
  setSplitN?: React.Dispatch<React.SetStateAction<number>>;
  pickMoveVectorActive?: boolean;
  pickMoveVectorStep?: 1 | 2;
  onStartPickMoveVector?: () => void;
  pickTransformPointActive?: boolean;
  pickTransformPointTarget?: 'rotateCenter' | 'mirrorPoint' | 'scaleCenter' | null;
  onStartPickPoint?: (target: 'rotateCenter' | 'mirrorPoint' | 'scaleCenter') => void;
  onCancelPickMode?: () => void;
  mergeTolerance?: number;
  setMergeTolerance?: React.Dispatch<React.SetStateAction<number>> | ((v: number) => void);
  setStatusHint?: (msg: string) => void;
  drawConstructionGrid?: boolean;
  setDrawConstructionGrid?: React.Dispatch<React.SetStateAction<boolean>>;
  drawOuterDimensionLines?: boolean;
  setDrawOuterDimensionLines?: React.Dispatch<React.SetStateAction<boolean>>;
  groups?: ElementGroupDef[];
  setGroups?: React.Dispatch<React.SetStateAction<ElementGroupDef[]>>;
  defaultGroupId?: string;
  setDefaultGroupId?: (id: string) => void;
  loadCases?: LoadCase3D[];
  activeLoadCaseId?: number;
  onSelectLoadCase?: (id: number) => void;
  onAddLoadCase?: (nature: LoadNature, category?: EurocodeCategory, name?: string) => void;
  onUpdateLoadCase?: (updated: LoadCase3D) => void;
  onDeleteLoadCase?: (id: number) => void;
  autoCombinations?: boolean;
  setAutoCombinations?: (v: boolean) => void;
  customCombinations?: LoadCombination3D[];
  multiSolved?: MultiCaseResults3D | null;
  activeResultKey?: string;
  onSelectResultKey?: (key: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  nodes,
  setNodes,
  elements,
  setElements,
  panels = [],
  setPanels,
  sections,
  setSections,
  materials,
  setMaterials,
  selectedNodeIds,
  setSelectedNodeIds,
  selectedElemIds,
  setSelectedElemIds,
  selectedPanelIds = [],
  setSelectedPanelIds = (_: React.SetStateAction<number[]>) => {},
  mode,
  setMode,
  panelShape = 'triangle',
  setPanelShape,
  panelPoints = [],
  setPanelPoints,
  gridPlane = 'XY',
  setGridPlane,
  gridOffset = 0,
  setGridOffset,
  snapEnabled = true,
  setSnapEnabled,
  snapSize = 0.5,
  setSnapSize,
  showGrid = true,
  setShowGrid,
  showAxes = true,
  setShowAxes,
  barStartNodeId,
  setBarStartNodeId,
  analysisSettings,
  setAnalysisSettings,
  solved,
  setSolved,
  solveWarning,
  showDeform,
  setShowDeform,
  showMy,
  setShowMy,
  showMz,
  setShowMz,
  showMx,
  setShowMx,
  showVy,
  setShowVy,
  showVz,
  setShowVz,
  showN,
  setShowN,
  showStress,
  setShowStress,
  showReactions,
  setShowReactions,
  deformScaleMult,
  setDeformScaleMult,
  diagramScaleMult,
  setDiagramScaleMult,
  diagramLabelMode = 'all',
  setDiagramLabelMode,
  probe,
  setProbe,
  onInvalidateResults,
  onNodePlaced,
  onElemDrawn,
  defaultSectionId,
  defaultMaterialId,
  panelHeight,
  onPanelHandleStart,
  activeTransformMode = 'none',
  setActiveTransformMode = (_mode: 'none' | 'move' | 'rotate' | 'mirror' | 'scale') => {},
  transformWithCopy: propTransformWithCopy,
  setTransformWithCopy: propSetTransformWithCopy,
  transformConnect: propTransformConnect,
  setTransformConnect: propSetTransformConnect,
  transformRepeat: propTransformRepeat,
  setTransformRepeat: propSetTransformRepeat,
  transformLoads: propTransformLoads,
  setTransformLoads: propSetTransformLoads,
  moveDx: propMoveDx,
  setMoveDx: propSetMoveDx,
  moveDy: propMoveDy,
  setMoveDy: propSetMoveDy,
  moveDz: propMoveDz,
  setMoveDz: propSetMoveDz,
  rotateCx = 0,
  setRotateCx = (_v: React.SetStateAction<number>) => {},
  rotateCy = 0,
  setRotateCy = (_v: React.SetStateAction<number>) => {},
  rotateCz = 0,
  setRotateCz = (_v: React.SetStateAction<number>) => {},
  rotateAxis = 'Z',
  setRotateAxis = (_v: React.SetStateAction<'X' | 'Y' | 'Z'>) => {},
  rotateAngle = 90,
  setRotateAngle = (_v: React.SetStateAction<number>) => {},
  mirrorPx = 0,
  setMirrorPx = (_v: React.SetStateAction<number>) => {},
  mirrorPy = 0,
  setMirrorPy = (_v: React.SetStateAction<number>) => {},
  mirrorPz = 0,
  setMirrorPz = (_v: React.SetStateAction<number>) => {},
  mirrorPlane = 'XZ',
  setMirrorPlane = (_v: React.SetStateAction<'XY' | 'YZ' | 'XZ'>) => {},
  scaleCx = 0,
  setScaleCx = (_v: React.SetStateAction<number>) => {},
  scaleCy = 0,
  setScaleCy = (_v: React.SetStateAction<number>) => {},
  scaleCz = 0,
  setScaleCz = (_v: React.SetStateAction<number>) => {},
  scaleFactor = 1.5,
  setScaleFactor = (_v: React.SetStateAction<number>) => {},
  splitFormOpen: propSplitFormOpen,
  setSplitFormOpen: propSetSplitFormOpen,
  splitMode: propSplitMode,
  setSplitMode: propSetSplitMode,
  splitT: propSplitT,
  setSplitT: propSetSplitT,
  splitN: propSplitN,
  setSplitN: propSetSplitN,
  pickMoveVectorActive = false,
  pickMoveVectorStep = 1,
  onStartPickMoveVector = () => {},
  pickTransformPointActive = false,
  pickTransformPointTarget = null,
  onStartPickPoint = (_target: 'rotateCenter' | 'mirrorPoint' | 'scaleCenter') => {},
  onCancelPickMode = () => {},
  mergeTolerance = 0.001,
  setMergeTolerance,
  setStatusHint,
  gridCoords = { x: [], y: [], z: [] },
  setGridCoords = (_action) => {},
  activeGridAxis = 'X',
  setActiveGridAxis = (_axis) => {},
  drawConstructionGrid = true,
  setDrawConstructionGrid = (_val: boolean | ((prev: boolean) => boolean)) => {},
  drawOuterDimensionLines = true,
  setDrawOuterDimensionLines = (_val: boolean | ((prev: boolean) => boolean)) => {},
  groups = [],
  setGroups = (_val: any) => {},
  defaultGroupId,
  setDefaultGroupId,
  loadCases,
  activeLoadCaseId = 1,
  onSelectLoadCase,
  onAddLoadCase,
  onUpdateLoadCase,
  onDeleteLoadCase,
  autoCombinations = true,
  setAutoCombinations,
  customCombinations = [],
  multiSolved,
  activeResultKey,
  onSelectResultKey,
}) => {
  const [addBarCoordsCollapsed, setAddBarCoordsCollapsed] = useState(false);
  const [nodesGroupCollapsed, setNodesGroupCollapsed] = useState(false);
  const [elementsGroupCollapsed, setElementsGroupCollapsed] = useState(false);
  const [panelsGroupCollapsed, setPanelsGroupCollapsed] = useState(false);
  const [calcGroupCollapsed, setCalcGroupCollapsed] = useState(false);
  const [analysisCollapsed, setAnalysisCollapsed] = useState(false);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);

  // Collapsed states for results sub-panels
  const [reactionsCollapsed, setReactionsCollapsed] = useState(false);
  const [stabilityCollapsed, setStabilityCollapsed] = useState(false);
  const [modalCollapsed, setModalCollapsed] = useState(false);
  const [resultsViewCollapsed, setResultsViewCollapsed] = useState(false);
  const [probeCollapsed, setProbeCollapsed] = useState(false);
  const [utilizationCollapsed, setUtilizationCollapsed] = useState(false);

  // State for Group management
  const [addGroupFormOpen, setAddGroupFormOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#3b82f6');
  const [newGroupSectionId, setNewGroupSectionId] = useState<number | undefined>(undefined);
  const [newGroupMaterialId, setNewGroupMaterialId] = useState<number | undefined>(undefined);

  // State for axis grid custom coordinate input
  const [newCoordVal, setNewCoordVal] = useState<string>('');
  const [selectedGridItems, setSelectedGridItems] = useState<{ axis: 'x' | 'y' | 'z'; val: number }[]>([]);

  const toggleSelectGridItem = (axis: 'x' | 'y' | 'z', val: number) => {
    setSelectedGridItems((prev) => {
      const exists = prev.some((item) => item.axis === axis && item.val === val);
      if (exists) {
        return prev.filter((item) => !(item.axis === axis && item.val === val));
      } else {
        return [...prev, { axis, val }];
      }
    });
  };

  const parseCoordsText = (text: string): number[] => {
    return text
      .split(/[\s,;]+/)
      .map(val => val.trim())
      .filter(val => val !== '' && !isNaN(Number(val)))
      .map(val => Math.round(Number(val) * 1000) / 1000);
  };

  const handleAddCoordinates = () => {
    if (!newCoordVal.trim()) return;
    const values = parseCoordsText(newCoordVal);
    if (values.length === 0) return;

    setGridCoords(prev => {
      const axisKey = activeGridAxis.toLowerCase() as 'x' | 'y' | 'z';
      const currentList = prev[axisKey] || [];
      const updated = Array.from(new Set([...currentList, ...values])).sort((a, b) => a - b);
      return {
        ...prev,
        [axisKey]: updated
      };
    });
    setNewCoordVal('');
  };

  const handleRemoveCoordinates = () => {
    if (selectedGridItems.length > 0) {
      setGridCoords((prev) => {
        const nextX = prev.x.filter((v) => !selectedGridItems.some((i) => i.axis === 'x' && i.val === v));
        const nextY = prev.y.filter((v) => !selectedGridItems.some((i) => i.axis === 'y' && i.val === v));
        const nextZ = prev.z.filter((v) => !selectedGridItems.some((i) => i.axis === 'z' && i.val === v));
        return { x: nextX, y: nextY, z: nextZ };
      });
      setSelectedGridItems([]);
      return;
    }

    if (newCoordVal.trim()) {
      const values = parseCoordsText(newCoordVal);
      if (values.length > 0) {
        setGridCoords((prev) => {
          const axisKey = activeGridAxis.toLowerCase() as 'x' | 'y' | 'z';
          const currentList = prev[axisKey] || [];
          const updated = currentList.filter((v) => !values.includes(v));
          return {
            ...prev,
            [axisKey]: updated,
          };
        });
        setNewCoordVal('');
      }
    }
  };

  const handleClearCoordinates = () => {
    if (selectedGridItems.length > 0) {
      setSelectedGridItems([]);
      return;
    }
    setGridCoords(prev => {
      const axisKey = activeGridAxis.toLowerCase() as 'x' | 'y' | 'z';
      return {
        ...prev,
        [axisKey]: []
      };
    });
    setSelectedGridItems(prev => prev.filter(i => i.axis !== activeGridAxis.toLowerCase()));
  };

  // Internal Form states fallback for unified operations in Properties (Move, Rotate, Mirror, Scale)
  const [internalTransformWithCopy, setInternalTransformWithCopy] = useState(false);
  const [internalTransformConnect, setInternalTransformConnect] = useState(false);
  const [internalTransformRepeat, setInternalTransformRepeat] = useState(1);
  const [internalTransformLoads, setInternalTransformLoads] = useState(true);
  const [internalMoveDx, setInternalMoveDx] = useState(2);
  const [internalMoveDy, setInternalMoveDy] = useState(0);
  const [internalMoveDz, setInternalMoveDz] = useState(0);

  const transformWithCopy = propTransformWithCopy !== undefined ? propTransformWithCopy : internalTransformWithCopy;
  const setTransformWithCopy = propSetTransformWithCopy || setInternalTransformWithCopy;

  const transformConnect = propTransformConnect !== undefined ? propTransformConnect : internalTransformConnect;
  const setTransformConnect = propSetTransformConnect || setInternalTransformConnect;

  const transformRepeat = propTransformRepeat !== undefined ? propTransformRepeat : internalTransformRepeat;
  const setTransformRepeat = propSetTransformRepeat || setInternalTransformRepeat;

  const transformLoads = propTransformLoads !== undefined ? propTransformLoads : internalTransformLoads;
  const setTransformLoads = propSetTransformLoads || setInternalTransformLoads;

  const moveDx = propMoveDx !== undefined ? propMoveDx : internalMoveDx;
  const setMoveDx = propSetMoveDx || setInternalMoveDx;

  const moveDy = propMoveDy !== undefined ? propMoveDy : internalMoveDy;
  const setMoveDy = propSetMoveDy || setInternalMoveDy;

  const moveDz = propMoveDz !== undefined ? propMoveDz : internalMoveDz;
  const setMoveDz = propSetMoveDz || setInternalMoveDz;

  const [memberLoadCoordSys, setMemberLoadCoordSys] = useState<'global' | 'local'>('global');

  const transformCardRef = useRef<HTMLDivElement | null>(null);
  const transformBtnRef = useRef<HTMLDivElement | null>(null);

  const handleSidebarInteractionCapture = useCallback(
    (e: React.SyntheticEvent) => {
      if (activeTransformMode === 'none' && !pickMoveVectorActive && !pickTransformPointActive) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isInsideCard = transformCardRef.current && transformCardRef.current.contains(target);
      const isInsideBtn = transformBtnRef.current && transformBtnRef.current.contains(target);

      if (!isInsideCard && !isInsideBtn) {
        if (setActiveTransformMode) setActiveTransformMode('none');
        if (onCancelPickMode) onCancelPickMode();
      }
    },
    [activeTransformMode, pickMoveVectorActive, pickTransformPointActive, setActiveTransformMode, onCancelPickMode]
  );

  const [internalSplitFormOpen, setInternalSplitFormOpen] = useState(false);
  const [internalSplitMode, setInternalSplitMode] = useState<'single' | 'multi'>('single');
  const [internalSplitT, setInternalSplitT] = useState(0.5);
  const [internalSplitN, setInternalSplitN] = useState(2);

  const splitFormOpen = propSplitFormOpen !== undefined ? propSplitFormOpen : internalSplitFormOpen;
  const setSplitFormOpen = propSetSplitFormOpen || setInternalSplitFormOpen;
  const splitMode = propSplitMode !== undefined ? propSplitMode : internalSplitMode;
  const setSplitMode = propSetSplitMode || setInternalSplitMode;
  const splitT = propSplitT !== undefined ? propSplitT : internalSplitT;
  const setSplitT = propSetSplitT || setInternalSplitT;
  const splitN = propSplitN !== undefined ? propSplitN : internalSplitN;
  const setSplitN = propSetSplitN || setInternalSplitN;

  // Add Bar coordinate inputs state
  const [addBarRel, setAddBarRel] = useState(false);
  const [addBarValX, setAddBarValX] = useState<number>(0);
  const [addBarValY, setAddBarValY] = useState<number>(0);
  const [addBarValZ, setAddBarValZ] = useState<number>(0);

  // Add Material / Section form state
  const [addMatFormOpen, setAddMatFormOpen] = useState(false);
  const [editingMatId, setEditingMatId] = useState<number | null>(null);
  const backupMaterialRef = useRef<Material | null>(null);
  const [newMatName, setNewMatName] = useState('Nowy materiał');
  const [newMatE, setNewMatE] = useState(210);
  const [newMatNu, setNewMatNu] = useState(0.3);
  const [newMatAlpha, setNewMatAlpha] = useState(1.2);
  const [newMatDensity, setNewMatDensity] = useState(7850);
  const [newMatFd, setNewMatFd] = useState(235);

  const [addSecFormOpen, setAddSecFormOpen] = useState(false);
  const [editingSecId, setEditingSecId] = useState<number | null>(null);
  const backupSectionRef = useRef<Section | null>(null);
  const [newSecName, setNewSecName] = useState('Nowy przekrój');
  const [newSecCategory, setNewSecCategory] = useState<'katalog' | 'ksztalt' | 'wlasny'>('katalog');
  const [newSecCatType, setNewSecCatType] = useState('IPE');
  const [newSecCatSizeIdx, setNewSecCatSizeIdx] = useState(0);
  const [newSecShape, setNewSecShape] = useState<'rect' | 'circ' | 'pipe' | 'box' | 'ibeam' | 'tee' | 'angle'>('rect');
  const [newSecB, setNewSecB] = useState(20);
  const [newSecH, setNewSecH] = useState(40);
  const [newSecD, setNewSecD] = useState(30);
  const [newSecT, setNewSecT] = useState(1);
  const [newSecTf, setNewSecTf] = useState(1.2);
  const [newSecTw, setNewSecTw] = useState(0.8);
  const [newSecA, setNewSecA] = useState(80);
  const [newSecIy, setNewSecIy] = useState(1000);
  const [newSecIz, setNewSecIz] = useState(1000);
  const [newSecIt, setNewSecIt] = useState(500);
  const [newSecCTopY, setNewSecCTopY] = useState(10);
  const [newSecCBotY, setNewSecCBotY] = useState(10);
  const [newSecCTopZ, setNewSecCTopZ] = useState(10);
  const [newSecCBotZ, setNewSecCBotZ] = useState(10);

  // Active Buckling / Modal mode selection
  const [activeBucklingMode, setActiveBucklingMode] = useState(0);
  const [activeModalMode, setActiveModalMode] = useState(0);

  // Helper getters
  const selectedNodes: Node3D[] = nodes.filter((n) => selectedNodeIds.includes(n.id));
  const selectedElements: Element3D[] = elements.filter((e) => selectedElemIds.includes(e.id));
  const selectedPanels: Panel3D[] = (panels || []).filter((p) => selectedPanelIds.includes(p.id));
  const getNode = (id: number) => nodes.find((n) => n.id === id);
  const getElement = (id: number) => elements.find((e) => e.id === id);
  const getSection = (id: number) => sections.find((s) => s.id === id);
  const getMaterial = (id: number) => materials.find((m) => m.id === id);

  const fmtSmart = (v: number | null | undefined, d = 2) => {
    if (v == null || isNaN(v)) return '—';
    const a = Math.abs(v);
    if (a < 1e-6) return '0';
    if (a < 0.001) return v.toExponential(2);
    let str: string;
    if (a < 10) str = v.toFixed(3);
    else if (a < 1000) str = v.toFixed(d);
    else str = v.toFixed(1);
    if (str === '-0.00' || str === '-0.000' || str === '-0.0' || str === '-0') return '0';
    return str;
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

  function commonVal<T, V>(items: T[], getter: (item: T) => V): V | undefined {
    if (items.length === 0) return undefined;
    const first = getter(items[0]);
    for (let i = 1; i < items.length; i++) {
      if (getter(items[i]) !== first) return undefined;
    }
    return first;
  }

  // Node editing handlers
  const updateNodeCoord = (axis: 'x' | 'y' | 'z', v: number, commit = false) => {
    const nextNodes = nodes.map((n) => {
      if (!selectedNodeIds.includes(n.id)) return n;
      const updated = { ...n, [axis]: v };
      return updated;
    });
    
    if (!commit) {
      setNodes(nextNodes);
      onInvalidateResults();
      return;
    }
    
    const { mergedNodes, mergedElements, mergedPanels, nodeMap } = mergeOverlapping(nextNodes, elements, panels || [], mergeTolerance ?? 0.001);
    
    setNodes(mergedNodes);
    setElements(mergedElements);
    if (setPanels) setPanels(mergedPanels);

    const newSelectedNodes = selectedNodeIds.map(id => nodeMap.get(id) ?? id);
    setSelectedNodeIds([...new Set(newSelectedNodes)]);

    onInvalidateResults();
  };

  // Manual explicit merge of overlapping nodes in model
  const handleMergeNodes = () => {
    const initialNodeCount = nodes.length;
    const initialElemCount = elements.length;
    const initialPanelCount = (panels || []).length;

    if (initialNodeCount === 0) {
      if (setStatusHint) {
        setStatusHint('Łączenie węzłów: Model nie zawiera żadnych węzłów.');
      }
      return;
    }

    const { mergedNodes, mergedElements, mergedPanels, nodeMap } = mergeOverlapping(
      nodes,
      elements,
      panels || [],
      mergeTolerance ?? 0.001
    );

    const removedNodesCount = initialNodeCount - mergedNodes.length;
    const removedElemCount = initialElemCount - mergedElements.length;
    const removedPanelCount = initialPanelCount - mergedPanels.length;

    if (removedNodesCount === 0 && removedElemCount === 0 && removedPanelCount === 0) {
      if (setStatusHint) {
        setStatusHint(`Łączenie węzłów: Brak nakładających się węzłów w tolerancji ${mergeTolerance ?? 0.001} m.`);
      }
      return;
    }

    setNodes(mergedNodes);
    setElements(mergedElements);
    if (setPanels) setPanels(mergedPanels);

    if (selectedNodeIds.length > 0) {
      const newSelectedNodes = selectedNodeIds.map(id => nodeMap.get(id) ?? id);
      setSelectedNodeIds([...new Set(newSelectedNodes)].filter(id => mergedNodes.some(n => n.id === id)));
    }
    if (selectedElemIds.length > 0) {
      setSelectedElemIds(prev => prev.filter(id => mergedElements.some(e => e.id === id)));
    }
    if (selectedPanelIds && selectedPanelIds.length > 0 && setSelectedPanelIds) {
      setSelectedPanelIds(prev => prev.filter(id => mergedPanels.some(p => p.id === id)));
    }

    onInvalidateResults();

    const msgParts: string[] = [];
    if (removedNodesCount > 0) msgParts.push(`połączono ${removedNodesCount} węzłów`);
    if (removedElemCount > 0) msgParts.push(`usunięto ${removedElemCount} zduplikowanych prętów`);
    if (removedPanelCount > 0) msgParts.push(`zaktualizowano panele`);

    const summary = msgParts.join(', ');
    if (setStatusHint) {
      setStatusHint(`Połączono węzły (tolerancja ${mergeTolerance ?? 0.001} m): ${summary}.`);
    }
  };

  // Unified Delete Selected (all selected nodes, elements & panels)
  const handleDeleteSelected = () => {
    const nodeIdsToDelete = new Set(selectedNodeIds);
    const elemIdsToDelete = new Set(selectedElemIds);
    const panelIdsToDelete = new Set(selectedPanelIds);

    const deletedElements = elements.filter(
      (e) =>
        elemIdsToDelete.has(e.id) ||
        nodeIdsToDelete.has(e.n1) ||
        nodeIdsToDelete.has(e.n2)
    );
    const deletedPanels = (panels || []).filter(
      (p) =>
        panelIdsToDelete.has(p.id) ||
        p.nodeIds.some((nid) => nodeIdsToDelete.has(nid))
    );
    const deletedNodeCount = selectedNodeIds.length;
    const deletedElemCount = deletedElements.length;
    const deletedPanelCount = deletedPanels.length;

    setElements((prev) =>
      prev.filter(
        (e) =>
          !elemIdsToDelete.has(e.id) &&
          !nodeIdsToDelete.has(e.n1) &&
          !nodeIdsToDelete.has(e.n2)
      )
    );
    if (setPanels) {
      setPanels((prev) =>
        prev.filter(
          (p) =>
            !panelIdsToDelete.has(p.id) &&
            p.nodeIds.every((nid) => !nodeIdsToDelete.has(nid))
        )
      );
    }
    setNodes((prev) => prev.filter((n) => !nodeIdsToDelete.has(n.id)));
    setSelectedNodeIds([]);
    setSelectedElemIds([]);
    setSelectedPanelIds([]);
    if (setActiveTransformMode) setActiveTransformMode('none');
    setSplitFormOpen(false);
    onInvalidateResults();

    if (setStatusHint) {
      const parts: string[] = [];
      if (deletedElemCount > 0) parts.push(pluralUnit(deletedElemCount, 'pręt', 'pręty', 'prętów'));
      if (deletedNodeCount > 0) parts.push(pluralUnit(deletedNodeCount, 'węzeł', 'węzły', 'węzłów'));
      if (deletedPanelCount > 0) parts.push(pluralUnit(deletedPanelCount, 'okładzinę', 'okładziny', 'okładzin'));
      if (parts.length > 0) {
        setStatusHint(`Usunięto: ${parts.join(', ')}.`);
      }
    }
  };

  // Unified Transformation Action (Move, Rotate, Mirror, Scale)
  const confirmTransform = (tMode: 'move' | 'rotate' | 'mirror' | 'scale') => {
    if (onCancelPickMode) onCancelPickMode();
    const hasNodes = selectedNodeIds.length > 0;
    const hasElements = selectedElemIds.length > 0;
    const hasPanels = selectedPanelIds.length > 0;
    if (!hasNodes && !hasElements && !hasPanels) {
      if (setActiveTransformMode) setActiveTransformMode('none');
      return;
    }

    const repeat = (tMode === 'mirror')
      ? 1
      : (transformWithCopy ? Math.max(1, Math.min(50, Math.round(transformRepeat || 1))) : 1);

    const params = {
      moveDx,
      moveDy,
      moveDz,
      rotateCenter: [rotateCx, rotateCy, rotateCz] as [number, number, number],
      rotateAxis: rotateAxis as 'X' | 'Y' | 'Z',
      rotateAngleDeg: rotateAngle,
      mirrorPoint: [mirrorPx, mirrorPy, mirrorPz] as [number, number, number],
      mirrorPlane: mirrorPlane as 'XY' | 'YZ' | 'XZ',
      scaleCenter: [scaleCx, scaleCy, scaleCz] as [number, number, number],
      scaleFactor,
    };

    let nextNodes = [...nodes];
    let nextElements = [...elements];
    let nextPanels = panels ? [...panels] : [];
    
    let allCreatedElemIds: number[] = [];
    let allCreatedNodeIds: number[] = [];
    let allCreatedPanelIds: number[] = [];

    // Pure Transformation (without copying)
    if (!transformWithCopy) {
      const allNodeIdsToTransform = new Set<number>(selectedNodeIds);
      selectedElements.forEach((el) => {
        allNodeIdsToTransform.add(el.n1);
        allNodeIdsToTransform.add(el.n2);
      });
      selectedPanels.forEach((p) => {
        p.nodeIds.forEach((nid) => allNodeIdsToTransform.add(nid));
      });

      nextNodes = nextNodes.map((n) => {
        if (!allNodeIdsToTransform.has(n.id)) return n;
        const [tx, ty, tz] = transformPoint([n.x, n.y, n.z], tMode, params, 1);
        
        let transformedForce = n.force;
        let transformedMoment = n.moment;
        let transformedSupport = n.support;
        if (transformLoads) {
          if (n.force) {
            const [fx, fy, fz] = transformVector([n.force.Fx, n.force.Fy, n.force.Fz], tMode, params, 1);
            transformedForce = { Fx: round4(fx), Fy: round4(fy), Fz: round4(fz) };
          }
          if (n.moment) {
            const [mx, my, mz] = transformVector([n.moment.Mx, n.moment.My, n.moment.Mz], tMode, params, 1);
            transformedMoment = { Mx: round4(mx), My: round4(my), Mz: round4(mz) };
          }
          if (n.support) {
            transformedSupport = transformSupport(n.support, tMode, params, 1, true);
          }
        }

        return {
          ...n,
          x: Math.round(tx * 1e6) / 1e6,
          y: Math.round(ty * 1e6) / 1e6,
          z: Math.round(tz * 1e6) / 1e6,
          force: transformedForce,
          moment: transformedMoment,
          support: transformedSupport,
        };
      });

      nextElements = nextElements.map((el) => {
        if (!selectedElemIds.includes(el.id)) return el;
        const origN1 = nodes.find((n) => n.id === el.n1);
        const origN2 = nodes.find((n) => n.id === el.n2);
        if (!origN1 || !origN2) return el;

        const newRollAngle = getTransformedRollAngle(origN1, origN2, el.rollAngle || 0, tMode, params, 1);

        let transformedQ = el.q;
        if (el.q && transformLoads) {
          if (el.q.coordinateSystem === 'global') {
            const [qxS, qyS, qzS] = transformVector([el.q.qxStart, el.q.qyStart, el.q.qzStart], tMode, params, 1);
            const [qxE, qyE, qzE] = transformVector([el.q.qxEnd, el.q.qyEnd, el.q.qzEnd], tMode, params, 1);
            transformedQ = {
              ...el.q,
              qxStart: round4(qxS), qxEnd: round4(qxE),
              qyStart: round4(qyS), qyEnd: round4(qyE),
              qzStart: round4(qzS), qzEnd: round4(qzE),
            };
          } else {
            const origAxes = computeLocalAxesForNodes(origN1, origN2, el.rollAngle || 0);
            const t_vy = transformVector(origAxes.vy, tMode, params, 1);
            const t_vz = transformVector(origAxes.vz, tMode, params, 1);

            const t_n1 = {
              x: transformPoint([origN1.x, origN1.y, origN1.z], tMode, params, 1)[0],
              y: transformPoint([origN1.x, origN1.y, origN1.z], tMode, params, 1)[1],
              z: transformPoint([origN1.x, origN1.y, origN1.z], tMode, params, 1)[2],
            };
            const t_n2 = {
              x: transformPoint([origN2.x, origN2.y, origN2.z], tMode, params, 1)[0],
              y: transformPoint([origN2.x, origN2.y, origN2.z], tMode, params, 1)[1],
              z: transformPoint([origN2.x, origN2.y, origN2.z], tMode, params, 1)[2],
            };
            const defaultNewAxes = computeLocalAxesForNodes(t_n1, t_n2, newRollAngle);

            const dotY = dot3D(t_vy, defaultNewAxes.vy);
            const dotZ = dot3D(t_vz, defaultNewAxes.vz);

            let qyS = el.q.qyStart;
            let qyE = el.q.qyEnd;
            let qzS = el.q.qzStart;
            let qzE = el.q.qzEnd;

            if (dotY < 0) {
              qyS = -qyS;
              qyE = -qyE;
            }
            if (dotZ < 0) {
              qzS = -qzS;
              qzE = -qzE;
            }

            transformedQ = {
              ...el.q,
              qxStart: round4(el.q.qxStart),
              qxEnd: round4(el.q.qxEnd),
              qyStart: round4(qyS),
              qyEnd: round4(qyE),
              qzStart: round4(qzS),
              qzEnd: round4(qzE),
            };
          }
        }

        return {
          ...el,
          rollAngle: newRollAngle,
          q: transformedQ,
        };
      });

      nextPanels = nextPanels.map((p) => {
        if (!selectedPanelIds.includes(p.id)) return p;
        let transformedPressure = p.pressure;
        if (p.pressure && transformLoads) {
          if (p.pressure.dir !== 'normal') {
            const [vx, vy, vz] = transformVector(
              [
                p.pressure.dir === 'X' ? 1 : 0,
                p.pressure.dir === 'Y' ? 1 : 0,
                p.pressure.dir === 'Z' ? 1 : 0,
              ],
              tMode,
              params,
              1
            );
            const absX = Math.abs(vx);
            const absY = Math.abs(vy);
            const absZ = Math.abs(vz);
            if (absX >= absY && absX >= absZ && absX > 1e-4) {
              transformedPressure = { dir: 'X', value: Math.round(p.pressure.value * (vx > 0 ? 1 : -1) * 1e4) / 1e4 };
            } else if (absY >= absX && absY >= absZ && absY > 1e-4) {
              transformedPressure = { dir: 'Y', value: Math.round(p.pressure.value * (vy > 0 ? 1 : -1) * 1e4) / 1e4 };
            } else if (absZ >= absX && absZ >= absY && absZ > 1e-4) {
              transformedPressure = { dir: 'Z', value: Math.round(p.pressure.value * (vz > 0 ? 1 : -1) * 1e4) / 1e4 };
            }
          }
        }
        return {
          ...p,
          pressure: transformedPressure,
        };
      });

      allCreatedElemIds = selectedElemIds;
      allCreatedNodeIds = selectedNodeIds;
      allCreatedPanelIds = selectedPanelIds;

    } else {
      // Transformation With Copy
      const baseNodeIds = new Set<number>(selectedNodeIds);
      selectedElements.forEach((el) => {
        baseNodeIds.add(el.n1);
        baseNodeIds.add(el.n2);
      });
      selectedPanels.forEach((p) => {
        p.nodeIds.forEach((nid) => baseNodeIds.add(nid));
      });

      const baseNodes = Array.from(baseNodeIds)
        .map((id) => nodes.find(n => n.id === id))
        .filter((n): n is Node3D => !!n);

      let nextNId = nodes.length > 0 ? Math.max(...nodes.map((n) => n.id)) + 1 : 1;
      let nextEId = elements.length > 0 ? Math.max(...elements.map((e) => e.id)) + 1 : 1;
      let nextPanId = (panels && panels.length > 0) ? Math.max(...panels.map((p) => p.id)) + 1 : 1;

      let prevStepNodeMap = new Map<number, number>();
      baseNodes.forEach((n) => {
        prevStepNodeMap.set(n.id, n.id);
      });

      for (let step = 1; step <= repeat; step++) {
        const currentStepNodeMap = new Map<number, number>();

        baseNodes.forEach((origNode) => {
          const newNodeId = nextNId++;
          currentStepNodeMap.set(origNode.id, newNodeId);
          allCreatedNodeIds.push(newNodeId);

          const [tx, ty, tz] = transformPoint([origNode.x, origNode.y, origNode.z], tMode, params, step);

          let transformedForce = origNode.force;
          let transformedMoment = origNode.moment;
          let transformedSupport = origNode.support
            ? transformSupport(origNode.support, tMode, params, step, transformLoads)
            : null;

          if (transformLoads) {
            if (origNode.force) {
              const [fx, fy, fz] = transformVector([origNode.force.Fx, origNode.force.Fy, origNode.force.Fz], tMode, params, step);
              transformedForce = { Fx: round4(fx), Fy: round4(fy), Fz: round4(fz) };
            }
            if (origNode.moment) {
              const [mx, my, mz] = transformVector([origNode.moment.Mx, origNode.moment.My, origNode.moment.Mz], tMode, params, step);
              transformedMoment = { Mx: round4(mx), My: round4(my), Mz: round4(mz) };
            }
          }

          const newN: Node3D = {
            ...JSON.parse(JSON.stringify(origNode)),
            id: newNodeId,
            x: Math.round(tx * 1e6) / 1e6,
            y: Math.round(ty * 1e6) / 1e6,
            z: Math.round(tz * 1e6) / 1e6,
            force: transformedForce,
            moment: transformedMoment,
            support: transformedSupport,
          };
          nextNodes.push(newN);

          if (transformConnect) {
            const prevNodeId = prevStepNodeMap.get(origNode.id);
            if (prevNodeId != null) {
              const connElId = nextEId++;
              nextElements.push({
                id: connElId,
                n1: prevNodeId,
                n2: newNodeId,
                sectionId: defaultSectionId,
                materialId: defaultMaterialId,
                rollAngle: 0,
                hinges: {},
                q: null,
                thermal: null,
              });
              allCreatedElemIds.push(connElId);
            }
          }
        });

        selectedElements.forEach((origEl) => {
          const newElemId = nextEId++;
          allCreatedElemIds.push(newElemId);

          const n1Mapped = currentStepNodeMap.get(origEl.n1)!;
          const n2Mapped = currentStepNodeMap.get(origEl.n2)!;

          const origN1 = nodes.find((n) => n.id === origEl.n1);
          const origN2 = nodes.find((n) => n.id === origEl.n2);
          let newRollAngle = origEl.rollAngle || 0;
          let transformedQ = origEl.q;

          if (origN1 && origN2) {
            newRollAngle = getTransformedRollAngle(origN1, origN2, origEl.rollAngle || 0, tMode, params, step);

            if (origEl.q && transformLoads) {
              if (origEl.q.coordinateSystem === 'global') {
                const [qxS, qyS, qzS] = transformVector([origEl.q.qxStart, origEl.q.qyStart, origEl.q.qzStart], tMode, params, step);
                const [qxE, qyE, qzE] = transformVector([origEl.q.qxEnd, origEl.q.qyEnd, origEl.q.qzEnd], tMode, params, step);
                transformedQ = {
                  ...origEl.q,
                  qxStart: round4(qxS), qxEnd: round4(qxE),
                  qyStart: round4(qyS), qyEnd: round4(qyE),
                  qzStart: round4(qzS), qzEnd: round4(qzE),
                };
              } else {
                const origAxes = computeLocalAxesForNodes(origN1, origN2, origEl.rollAngle || 0);
                const t_vy = transformVector(origAxes.vy, tMode, params, step);
                const t_vz = transformVector(origAxes.vz, tMode, params, step);

                const t_n1 = {
                  x: transformPoint([origN1.x, origN1.y, origN1.z], tMode, params, step)[0],
                  y: transformPoint([origN1.x, origN1.y, origN1.z], tMode, params, step)[1],
                  z: transformPoint([origN1.x, origN1.y, origN1.z], tMode, params, step)[2],
                };
                const t_n2 = {
                  x: transformPoint([origN2.x, origN2.y, origN2.z], tMode, params, step)[0],
                  y: transformPoint([origN2.x, origN2.y, origN2.z], tMode, params, step)[1],
                  z: transformPoint([origN2.x, origN2.y, origN2.z], tMode, params, step)[2],
                };
                const defaultNewAxes = computeLocalAxesForNodes(t_n1, t_n2, newRollAngle);

                const dotY = dot3D(t_vy, defaultNewAxes.vy);
                const dotZ = dot3D(t_vz, defaultNewAxes.vz);

                let qyS = origEl.q.qyStart;
                let qyE = origEl.q.qyEnd;
                let qzS = origEl.q.qzStart;
                let qzE = origEl.q.qzEnd;

                if (dotY < 0) {
                  qyS = -qyS;
                  qyE = -qyE;
                }
                if (dotZ < 0) {
                  qzS = -qzS;
                  qzE = -qzE;
                }

                transformedQ = {
                  ...origEl.q,
                  qxStart: round4(origEl.q.qxStart),
                  qxEnd: round4(origEl.q.qxEnd),
                  qyStart: round4(qyS),
                  qyEnd: round4(qyE),
                  qzStart: round4(qzS),
                  qzEnd: round4(qzE),
                };
              }
            }
          }

          const newEl: Element3D = {
            ...JSON.parse(JSON.stringify(origEl)),
            id: newElemId,
            n1: n1Mapped,
            n2: n2Mapped,
            rollAngle: newRollAngle,
            q: transformedQ,
          };
          nextElements.push(newEl);
        });

        selectedPanels.forEach((origPan) => {
          const newPanelId = nextPanId++;
          allCreatedPanelIds.push(newPanelId);
          const mappedNodeIds = origPan.nodeIds.map((nid) => currentStepNodeMap.get(nid)!);

          let transformedPressure = origPan.pressure;
          if (origPan.pressure && transformLoads) {
            if (origPan.pressure.dir !== 'normal') {
              const [vx, vy, vz] = transformVector(
                [
                  origPan.pressure.dir === 'X' ? 1 : 0,
                  origPan.pressure.dir === 'Y' ? 1 : 0,
                  origPan.pressure.dir === 'Z' ? 1 : 0,
                ],
                tMode,
                params,
                step
              );
              const absX = Math.abs(vx);
              const absY = Math.abs(vy);
              const absZ = Math.abs(vz);
              if (absX >= absY && absX >= absZ && absX > 1e-4) {
                transformedPressure = { dir: 'X', value: Math.round(origPan.pressure.value * (vx > 0 ? 1 : -1) * 1e4) / 1e4 };
              } else if (absY >= absX && absY >= absZ && absY > 1e-4) {
                transformedPressure = { dir: 'Y', value: Math.round(origPan.pressure.value * (vy > 0 ? 1 : -1) * 1e4) / 1e4 };
              } else if (absZ >= absX && absZ >= absY && absZ > 1e-4) {
                transformedPressure = { dir: 'Z', value: Math.round(origPan.pressure.value * (vz > 0 ? 1 : -1) * 1e4) / 1e4 };
              }
            }
          }

          const newPan: Panel3D = {
            ...JSON.parse(JSON.stringify(origPan)),
            id: newPanelId,
            nodeIds: mappedNodeIds,
            pressure: transformedPressure,
          };
          nextPanels.push(newPan);
        });

        prevStepNodeMap = currentStepNodeMap;
      }
    }

    const { mergedNodes, mergedElements, mergedPanels, nodeMap } = mergeOverlapping(nextNodes, nextElements, nextPanels, mergeTolerance ?? 0.001);
    
    setNodes(mergedNodes);
    setElements(mergedElements);
    if (setPanels) setPanels(mergedPanels);

    const mappedElemIds = [...new Set(allCreatedElemIds.map(id => id))].filter(id => mergedElements.some(e => e.id === id));
    const mappedNodeIds = [...new Set(allCreatedNodeIds.map(id => nodeMap.get(id) ?? id))];
    const mappedPanelIds = [...new Set(allCreatedPanelIds.map(id => id))].filter(id => mergedPanels.some(p => p.id === id));

    if (transformWithCopy) {
      if (mappedElemIds.length > 0) {
        setSelectedElemIds(mappedElemIds);
        setSelectedNodeIds([]);
        setSelectedPanelIds([]);
      } else if (mappedPanelIds.length > 0) {
        setSelectedPanelIds(mappedPanelIds);
        setSelectedNodeIds([]);
        setSelectedElemIds([]);
      } else {
        setSelectedNodeIds(mappedNodeIds);
        setSelectedElemIds([]);
        setSelectedPanelIds([]);
      }
    } else {
      setSelectedElemIds(mappedElemIds);
      setSelectedNodeIds(mappedNodeIds);
      setSelectedPanelIds(mappedPanelIds);
    }

    if (setActiveTransformMode) setActiveTransformMode('none');
    onInvalidateResults();

    if (setStatusHint) {
      const parts: string[] = [];
      if (transformWithCopy) {
        if (mappedElemIds.length > 0) parts.push(pluralUnit(mappedElemIds.length, 'pręt', 'pręty', 'prętów'));
        if (mappedNodeIds.length > 0) parts.push(pluralUnit(mappedNodeIds.length, 'węzeł', 'węzły', 'węzłów'));
        if (mappedPanelIds.length > 0) parts.push(pluralUnit(mappedPanelIds.length, 'okładzinę', 'okładziny', 'okładzin'));
        const createdSummary = parts.length > 0 ? parts.join(', ') : 'elementy';

        if (tMode === 'move') {
          setStatusHint(`Przeniesiono z kopią (${repeat}x): utworzono ${createdSummary} [dx=${params.moveDx}, dy=${params.moveDy}, dz=${params.moveDz}] m.`);
        } else if (tMode === 'rotate') {
          setStatusHint(`Obrócono z kopią (${repeat}x): utworzono ${createdSummary} (o ${params.rotateAngleDeg * repeat}° wokół osi ${params.rotateAxis}).`);
        } else if (tMode === 'mirror') {
          setStatusHint(`Odbito lustrzanie z kopią: utworzono ${createdSummary} względem płaszczyzny ${params.mirrorPlane}.`);
        } else if (tMode === 'scale') {
          setStatusHint(`Przeskalowano z kopią (${repeat}x): utworzono ${createdSummary} (skala ${params.scaleFactor}).`);
        }
      } else {
        if (selectedElemIds.length > 0) parts.push(pluralUnit(selectedElemIds.length, 'pręt', 'pręty', 'prętów'));
        if (selectedNodeIds.length > 0) parts.push(pluralUnit(selectedNodeIds.length, 'węzeł', 'węzły', 'węzłów'));
        if (selectedPanelIds.length > 0) parts.push(pluralUnit(selectedPanelIds.length, 'okładzinę', 'okładziny', 'okładzin'));
        const transformedSummary = parts.length > 0 ? parts.join(', ') : 'zaznaczenie';

        if (tMode === 'move') {
          setStatusHint(`Przesunięto: ${transformedSummary} o wektor [dx=${params.moveDx}, dy=${params.moveDy}, dz=${params.moveDz}] m.`);
        } else if (tMode === 'rotate') {
          setStatusHint(`Obrócono: ${transformedSummary} o kąt ${params.rotateAngleDeg}° wokół osi ${params.rotateAxis}.`);
        } else if (tMode === 'mirror') {
          setStatusHint(`Odbito lustrzanie: ${transformedSummary} względem płaszczyzny ${params.mirrorPlane}.`);
        } else if (tMode === 'scale') {
          setStatusHint(`Przeskalowano: ${transformedSummary} ze współczynnikiem skali ${params.scaleFactor}.`);
        }
      }
    }
  };
  // Split element action
  const confirmSplit = (elId: number | '__bulk__' = '__bulk__') => {
    const targetEls =
      elId === '__bulk__'
        ? selectedElements
        : elements.filter((e) => e.id === elId);

    if (!targetEls.length) return;

    let nextNId = nodes.length > 0 ? Math.max(...nodes.map((n) => n.id)) + 1 : 1;
    let nextEId = elements.length > 0 ? Math.max(...elements.map((e) => e.id)) + 1 : 1;

    const addedNodes: Node3D[] = [];
    const addedElements: Element3D[] = [];
    const removedElemIds = new Set(targetEls.map((e) => e.id));

    targetEls.forEach((el) => {
      const a = getNode(el.n1);
      const b = getNode(el.n2);
      if (!a || !b) return;

      const numParts = splitMode === 'single' ? 2 : splitN;
      const chain: { t: number; nodeId: number }[] = [{ t: 0, nodeId: el.n1 }];

      for (let i = 1; i < numParts; i++) {
        const t = splitMode === 'single' ? splitT : i / numParts;
        const midN: Node3D = {
          id: nextNId++,
          x: Math.round((a.x + (b.x - a.x) * t) * 1e6) / 1e6,
          y: Math.round((a.y + (b.y - a.y) * t) * 1e6) / 1e6,
          z: Math.round((a.z + (b.z - a.z) * t) * 1e6) / 1e6,
          support: null,
          force: null,
          moment: null,
          mass: null,
        };
        addedNodes.push(midN);
        chain.push({ t, nodeId: midN.id });
      }
      chain.push({ t: 1, nodeId: el.n2 });

      const lerp = (v0: number, v1: number, param: number) => v0 + (v1 - v0) * param;

      for (let i = 0; i < chain.length - 1; i++) {
        const isFirst = i === 0;
        const isLast = i === chain.length - 2;
        const ta = chain[i].t;
        const tb = chain[i + 1].t;

        const segHinges: MemberHinges3D = {
          start_ux: isFirst ? !!el.hinges?.start_ux : false,
          start_uy: isFirst ? !!el.hinges?.start_uy : false,
          start_uz: isFirst ? !!el.hinges?.start_uz : false,
          start_rx: isFirst ? !!el.hinges?.start_rx : false,
          start_ry: isFirst ? !!el.hinges?.start_ry : false,
          start_rz: isFirst ? !!el.hinges?.start_rz : false,
          end_ux: isLast ? !!el.hinges?.end_ux : false,
          end_uy: isLast ? !!el.hinges?.end_uy : false,
          end_uz: isLast ? !!el.hinges?.end_uz : false,
          end_rx: isLast ? !!el.hinges?.end_rx : false,
          end_ry: isLast ? !!el.hinges?.end_ry : false,
          end_rz: isLast ? !!el.hinges?.end_rz : false,
        };

        let segQ = null;
        if (el.q) {
          segQ = {
            coordinateSystem: el.q.coordinateSystem,
            qxStart: Math.round(lerp(el.q.qxStart, el.q.qxEnd, ta) * 1e4) / 1e4,
            qxEnd: Math.round(lerp(el.q.qxStart, el.q.qxEnd, tb) * 1e4) / 1e4,
            qyStart: Math.round(lerp(el.q.qyStart, el.q.qyEnd, ta) * 1e4) / 1e4,
            qyEnd: Math.round(lerp(el.q.qyStart, el.q.qyEnd, tb) * 1e4) / 1e4,
            qzStart: Math.round(lerp(el.q.qzStart, el.q.qzEnd, ta) * 1e4) / 1e4,
            qzEnd: Math.round(lerp(el.q.qzStart, el.q.qzEnd, tb) * 1e4) / 1e4,
          };
        }

        const seg: Element3D = {
          id: nextEId++,
          n1: chain[i].nodeId,
          n2: chain[i + 1].nodeId,
          sectionId: el.sectionId,
          materialId: el.materialId,
          rollAngle: el.rollAngle,
          hinges: segHinges,
          q: segQ,
          thermal: el.thermal ? { ...el.thermal } : null,
        };
        addedElements.push(seg);
      }
    });

    setNodes((prev) => [...prev, ...addedNodes]);
    setElements((prev) => [
      ...prev.filter((e) => !removedElemIds.has(e.id)),
      ...addedElements,
    ]);
    setSplitFormOpen(false);
    setSelectedElemIds(addedElements.map((e) => e.id));
    onInvalidateResults();

    if (setStatusHint) {
      const barsText = pluralUnit(targetEls.length, 'pręt', 'pręty', 'prętów');
      const segsText = pluralUnit(addedElements.length, 'odcinek', 'odcinki', 'odcinków');
      const nodesText = pluralUnit(addedNodes.length, 'nowy węzeł', 'nowe węzły', 'nowych węzłów');
      if (splitMode === 'single') {
        setStatusHint(`Podzielono: ${barsText} w punkcie t=${splitT} (powstało ${segsText}, dodano ${nodesText}).`);
      } else {
        setStatusHint(`Podzielono: ${barsText} na ${splitN} części (powstało ${segsText}, dodano ${nodesText}).`);
      }
    }
  };

  // Find & split intersections of selected elements
  const handleFindIntersections = () => {
    if (selectedElemIds.length < 2) return;

    const res = findAndSplitIntersections(
      nodes,
      elements,
      selectedElemIds,
      mergeTolerance || 1e-4
    );

    if (!res || res.splitElementCount === 0) {
      if (setStatusHint) {
        setStatusHint('Znajdź przecięcia: Nie znaleziono żadnych punktów przecięcia między zaznaczonymi prętami.');
      } else {
        alert('Nie znaleziono żadnych punktów przecięcia między zaznaczonymi prętami.');
      }
      return;
    }

    const removedSet = new Set(res.removedElementIds);
    setNodes((prev) => [...prev, ...res.newNodes]);
    setElements((prev) => [
      ...prev.filter((e) => !removedSet.has(e.id)),
      ...res.newElements,
    ]);

    setSelectedElemIds(res.newElements.map((e) => e.id));
    onInvalidateResults();

    if (setStatusHint) {
      const barsText = res.splitElementCount === 1 ? '1 pręt' : res.splitElementCount >= 2 && res.splitElementCount <= 4 ? `${res.splitElementCount} pręty` : `${res.splitElementCount} prętów`;
      const nodesText = res.createdNodeCount === 1 ? '1 nowy węzeł' : res.createdNodeCount >= 2 && res.createdNodeCount <= 4 ? `${res.createdNodeCount} nowe węzły` : `${res.createdNodeCount} nowych węzłów`;
      const segsText = res.newSegmentCount === 1 ? '1 odcinek' : res.newSegmentCount >= 2 && res.newSegmentCount <= 4 ? `${res.newSegmentCount} odcinki` : `${res.newSegmentCount} odcinków`;
      setStatusHint(`Znaleziono przecięcia: podzielono ${barsText} (powstało ${segsText}), dodano ${nodesText}.`);
    }
  };

  // Support presets matching helper (like Materia Lite)
  const presetMatches = (n: Node3D, preset: 'none' | 'fixed' | 'pin' | 'rollerZ' | 'rollerX' | 'guideZ') => {
    const sp = n.support;
    const t = (k: 'ux' | 'uy' | 'uz' | 'rx' | 'ry' | 'rz') => sp?.[k]?.type || 'free';
    if (preset === 'none') {
      return !sp || (t('ux') === 'free' && t('uy') === 'free' && t('uz') === 'free' && t('rx') === 'free' && t('ry') === 'free' && t('rz') === 'free');
    }
    if (!sp) return false;
    if (preset === 'fixed') {
      return t('ux') === 'fixed' && t('uy') === 'fixed' && t('uz') === 'fixed' && t('rx') === 'fixed' && t('ry') === 'fixed' && t('rz') === 'fixed';
    }
    if (preset === 'pin') {
      return t('ux') === 'fixed' && t('uy') === 'fixed' && t('uz') === 'fixed' && t('rx') === 'free' && t('ry') === 'free' && t('rz') === 'free';
    }
    if (preset === 'rollerZ') {
      return t('ux') === 'free' && t('uy') === 'free' && t('uz') === 'fixed' && t('rx') === 'free' && t('ry') === 'free' && t('rz') === 'free';
    }
    if (preset === 'rollerX') {
      return t('ux') === 'fixed' && t('uy') === 'free' && t('uz') === 'free' && t('rx') === 'free' && t('ry') === 'free' && t('rz') === 'free';
    }
    if (preset === 'guideZ') {
      return t('ux') === 'fixed' && t('uy') === 'fixed' && t('uz') === 'free' && t('rx') === 'free' && t('ry') === 'free' && t('rz') === 'fixed';
    }
    return false;
  };

  // Support presets
  const applySupportPreset = (preset: 'none' | 'fixed' | 'pin' | 'rollerZ' | 'rollerX' | 'guideZ') => {
    setNodes((prev) =>
      prev.map((n) => {
        if (!selectedNodeIds.includes(n.id)) return n;
        if (preset === 'none') return { ...n, support: null };

        let sup: Support3D = {
          ux: { type: 'free' },
          uy: { type: 'free' },
          uz: { type: 'free' },
          rx: { type: 'free' },
          ry: { type: 'free' },
          rz: { type: 'free' },
        };

        if (preset === 'fixed') {
          sup = {
            ux: { type: 'fixed' },
            uy: { type: 'fixed' },
            uz: { type: 'fixed' },
            rx: { type: 'fixed' },
            ry: { type: 'fixed' },
            rz: { type: 'fixed' },
          };
        } else if (preset === 'pin') {
          sup = {
            ux: { type: 'fixed' },
            uy: { type: 'fixed' },
            uz: { type: 'fixed' },
            rx: { type: 'free' },
            ry: { type: 'free' },
            rz: { type: 'free' },
          };
        } else if (preset === 'rollerZ') {
          sup = {
            ux: { type: 'free' },
            uy: { type: 'free' },
            uz: { type: 'fixed' },
            rx: { type: 'free' },
            ry: { type: 'free' },
            rz: { type: 'free' },
          };
        } else if (preset === 'rollerX') {
          sup = {
            ux: { type: 'fixed' },
            uy: { type: 'free' },
            uz: { type: 'free' },
            rx: { type: 'free' },
            ry: { type: 'free' },
            rz: { type: 'free' },
          };
        } else if (preset === 'guideZ') {
          sup = {
            ux: { type: 'fixed' },
            uy: { type: 'fixed' },
            uz: { type: 'free' },
            rx: { type: 'free' },
            ry: { type: 'free' },
            rz: { type: 'fixed' },
          };
        }

        if (n.support) {
          if (n.support.rotX !== undefined) sup.rotX = n.support.rotX;
          if (n.support.rotY !== undefined) sup.rotY = n.support.rotY;
          if (n.support.rotZ !== undefined) sup.rotZ = n.support.rotZ;
        }

        return { ...n, support: sup };
      })
    );
    onInvalidateResults();
  };

  const updateSupportRotation = (
    key: 'rotX' | 'rotY' | 'rotZ',
    val: number
  ) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (!selectedNodeIds.includes(n.id)) return n;
        const sup: Support3D = n.support
          ? { ...n.support }
          : {
              ux: { type: 'free' },
              uy: { type: 'free' },
              uz: { type: 'free' },
              rx: { type: 'free' },
              ry: { type: 'free' },
              rz: { type: 'free' },
            };
        sup[key] = val;
        return { ...n, support: sup };
      })
    );
    onInvalidateResults();
  };

  const updateSupportDir = (
    key: 'ux' | 'uy' | 'uz' | 'rx' | 'ry' | 'rz',
    field: 'type' | 'k' | 'delta',
    val: string | number
  ) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (!selectedNodeIds.includes(n.id)) return n;
        const sup: Support3D = n.support
          ? { ...n.support }
          : {
              ux: { type: 'free' },
              uy: { type: 'free' },
              uz: { type: 'free' },
              rx: { type: 'free' },
              ry: { type: 'free' },
              rz: { type: 'free' },
            };

        const prevComp = sup[key] || { type: 'free' };

        if (field === 'type') {
          sup[key] = {
            type: val as any,
            k: val === 'spring' ? (prevComp.k ?? 1000) : undefined,
            delta: prevComp.delta ?? 0,
          };
        } else if (field === 'k') {
          sup[key] = { ...prevComp, k: typeof val === 'number' ? val : parseFloat(val) || 0 };
        } else if (field === 'delta') {
          sup[key] = { ...prevComp, delta: typeof val === 'number' ? val : parseFloat(val) || 0 };
        }

        const isAllFree =
          sup.ux.type === 'free' &&
          sup.uy.type === 'free' &&
          sup.uz.type === 'free' &&
          sup.rx.type === 'free' &&
          sup.ry.type === 'free' &&
          sup.rz.type === 'free';

        return { ...n, support: isAllFree ? null : sup };
      })
    );
    onInvalidateResults();
  };

  // Node forces (Fx, Fy, Fz)
  const updateNodeForce = (field: 'Fx' | 'Fy' | 'Fz', v: number) => {
    const val = round4(v);
    setNodes((prev) =>
      prev.map((n) => {
        if (!selectedNodeIds.includes(n.id)) return n;
        const f = n.force ? { ...n.force } : { Fx: 0, Fy: 0, Fz: 0 };
        f[field] = val;
        const isAllZero = (f.Fx === 0 || !f.Fx) && (f.Fy === 0 || !f.Fy) && (f.Fz === 0 || !f.Fz);
        return { ...n, force: isAllZero ? null : f };
      })
    );
    onInvalidateResults();
  };

  // Node moments (Mx, My, Mz)
  const updateNodeMoment = (field: 'Mx' | 'My' | 'Mz', v: number) => {
    const val = round4(v);
    setNodes((prev) =>
      prev.map((n) => {
        if (!selectedNodeIds.includes(n.id)) return n;
        const m = n.moment ? { ...n.moment } : { Mx: 0, My: 0, Mz: 0 };
        m[field] = val;
        const isAllZero = (m.Mx === 0 || !m.Mx) && (m.My === 0 || !m.My) && (m.Mz === 0 || !m.Mz);
        return { ...n, moment: isAllZero ? null : m };
      })
    );
    onInvalidateResults();
  };

  // Node mass (mx, my, mz, Imx, Imy, Imz)
  const updateNodeMass = (field: 'mx' | 'my' | 'mz' | 'Imx' | 'Imy' | 'Imz', v: number) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (!selectedNodeIds.includes(n.id)) return n;
        const m = n.mass ? { ...n.mass } : { mx: 0, my: 0, mz: 0 };
        (m as any)[field] = v;
        return { ...n, mass: m };
      })
    );
    onInvalidateResults();
  };

  // Confirm Add Bar with coordinates
  const confirmAddBarCoords = () => {
    const vX = addBarValX;
    const vY = addBarValY;
    const vZ = addBarValZ;

    let targetX = vX;
    let targetY = vY;
    let targetZ = vZ;

    const sn = barStartNodeId != null ? getNode(barStartNodeId) : null;
    if (sn && addBarRel) {
      targetX = sn.x + vX;
      targetY = sn.y + vY;
      targetZ = sn.z + vZ;
    }

    let targetNodeId: number;
    const existing = nodes.find(
      (n) => Math.hypot(n.x - targetX, n.y - targetY, n.z - targetZ) < 1e-4
    );

    if (existing) {
      targetNodeId = existing.id;
    } else {
      targetNodeId = nodes.length > 0 ? Math.max(...nodes.map((n) => n.id)) + 1 : 1;
      setNodes((prev) => [
        ...prev,
        {
          id: targetNodeId,
          x: targetX,
          y: targetY,
          z: targetZ,
          support: null,
          force: null,
          mass: null,
        },
      ]);
    }

    if (onNodePlaced) {
      onNodePlaced(targetNodeId);
    }

    if (barStartNodeId == null) {
      setBarStartNodeId(targetNodeId);
      setAddBarValX(0);
      setAddBarValY(0);
      setAddBarValZ(0);
    } else {
      const startNode = nodes.find((n) => n.id === barStartNodeId);
      const dist3D = startNode
        ? Math.hypot(targetX - startNode.x, targetY - startNode.y, targetZ - startNode.z)
        : 0;
      const isZeroLength = barStartNodeId === targetNodeId || dist3D < 1e-4;

      const isDuplicate = elements.some(
        (e) =>
          (e.n1 === barStartNodeId && e.n2 === targetNodeId) ||
          (e.n1 === targetNodeId && e.n2 === barStartNodeId)
      );

      if (isZeroLength || isDuplicate) {
        setBarStartNodeId(targetNodeId);
        setAddBarValX(0);
        setAddBarValY(0);
        setAddBarValZ(0);
      } else {
        const selectedDrawingGroup = groups ? groups.find((g) => g.id === defaultGroupId) : undefined;
        const activeSectionId = (selectedDrawingGroup && selectedDrawingGroup.sectionId !== undefined)
          ? selectedDrawingGroup.sectionId
          : defaultSectionId;
        const activeMaterialId = (selectedDrawingGroup && selectedDrawingGroup.materialId !== undefined)
          ? selectedDrawingGroup.materialId
          : defaultMaterialId;

        const nextElemId = elements.length > 0 ? Math.max(...elements.map((e) => e.id)) + 1 : 1;
        const newElem: Element3D = {
          id: nextElemId,
          n1: barStartNodeId,
          n2: targetNodeId,
          sectionId: activeSectionId,
          materialId: activeMaterialId,
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
        setAddBarValX(0);
        setAddBarValY(0);
        setAddBarValZ(0);
        if (onElemDrawn) {
          onElemDrawn(nextElemId);
        }
        onInvalidateResults();
      }
    }
  };

  // Confirm Add Panel with coordinates
  const confirmAddPanelCoords = () => {
    const vX = addBarValX;
    const vY = addBarValY;
    const vZ = addBarValZ;

    let targetX = vX;
    let targetY = vY;
    let targetZ = vZ;

    const currentPts = panelPoints || [];
    const isRect3rdPt = panelShape === 'rectangle' && currentPts.length >= 2;

    const lastPointNodeId = currentPts.length > 0 ? currentPts[currentPts.length - 1] : null;
    const lastNode = lastPointNodeId != null ? getNode(lastPointNodeId) : null;
    if (lastNode && addBarRel) {
      targetX = lastNode.x + vX;
      targetY = lastNode.y + vY;
      targetZ = lastNode.z + vZ;
    }

    let targetNodeId: number | null = null;
    const existing = nodes.find(
      (n) => Math.hypot(n.x - targetX, n.y - targetY, n.z - targetZ) < 1e-4
    );

    if (existing) {
      targetNodeId = existing.id;
    } else if (!isRect3rdPt) {
      targetNodeId = nodes.length > 0 ? Math.max(...nodes.map((n) => n.id)) + 1 : 1;
      setNodes((prev) => [
        ...prev,
        {
          id: targetNodeId!,
          x: targetX,
          y: targetY,
          z: targetZ,
          support: null,
          force: null,
          moment: null,
          mass: null,
        },
      ]);
    }

    if (targetNodeId != null && onNodePlaced) {
      onNodePlaced(targetNodeId);
    }

    if (panelShape === 'triangle') {
      if (targetNodeId == null) return;
      if (currentPts.length === 0) {
        setPanelPoints?.([targetNodeId]);
        setAddBarValX(0);
        setAddBarValY(0);
        setAddBarValZ(0);
      } else if (currentPts.length === 1) {
        if (currentPts[0] === targetNodeId) {
          // Same node, ignore duplicate
        } else {
          setPanelPoints?.([currentPts[0], targetNodeId]);
          setAddBarValX(0);
          setAddBarValY(0);
          setAddBarValZ(0);
        }
      } else if (currentPts.length >= 2) {
        const n1Id = currentPts[0];
        const n2Id = currentPts[1];
        if (targetNodeId === n1Id || targetNodeId === n2Id) {
          return;
        }
        const nextPanelId = (panels && panels.length > 0 ? Math.max(...panels.map((p) => p.id)) : 0) + 1;
        const newPanel: Panel3D = {
          id: nextPanelId,
          shape: 'triangle',
          nodeIds: [n1Id, n2Id, targetNodeId],
        };
        setPanels?.((prev) => [...prev, newPanel]);
        setPanelPoints?.([]);
        setAddBarValX(0);
        setAddBarValY(0);
        setAddBarValZ(0);
        onInvalidateResults();
      }
    } else {
      // rectangle
      if (currentPts.length === 0) {
        if (targetNodeId == null) return;
        setPanelPoints?.([targetNodeId]);
        setAddBarValX(0);
        setAddBarValY(0);
        setAddBarValZ(0);
      } else if (currentPts.length === 1) {
        if (targetNodeId == null) return;
        if (currentPts[0] === targetNodeId) {
          // Same node
        } else {
          setPanelPoints?.([currentPts[0], targetNodeId]);
          setAddBarValX(0);
          setAddBarValY(0);
          setAddBarValZ(0);
        }
      } else if (currentPts.length >= 2) {
        const p1 = nodes.find((n) => n.id === currentPts[0]);
        const p2 = nodes.find((n) => n.id === currentPts[1]);
        if (!p1 || !p2) return;

        let n3Id: number;
        if (existing) {
          n3Id = existing.id;
        } else {
          const maxId = nodes.length > 0 ? Math.max(...nodes.map((n) => n.id)) : 0;
          n3Id = maxId + 1;
          const newNode: Node3D = {
            id: n3Id,
            x: targetX,
            y: targetY,
            z: targetZ,
            support: null,
            force: null,
            moment: null,
            mass: null,
          };
          setNodes((prev) => [...prev, newNode]);
        }

        const n3 = nodes.find((n) => n.id === n3Id) || { x: targetX, y: targetY, z: targetZ };

        // Base vector u = p2 - p1
        const ux = p2.x - p1.x;
        const uy = p2.y - p1.y;
        const uz = p2.z - p1.z;
        const uLenSq = ux * ux + uy * uy + uz * uz;
        if (uLenSq < 1e-8) return;

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
          return;
        }

        const nextPanelId = (panels && panels.length > 0 ? Math.max(...panels.map((p) => p.id)) : 0) + 1;
        const newPanel: Panel3D = {
          id: nextPanelId,
          shape: 'rectangle',
          nodeIds: [p1.id, p2.id, n3Id],
        };

        setPanels?.((prev) => [...prev, newPanel]);
        setPanelPoints?.([]);
        setAddBarValX(0);
        setAddBarValY(0);
        setAddBarValZ(0);
        onInvalidateResults();
      }
    }
  };

  // Add or Edit Material
  const handleAddMaterial = () => {
    const G = newMatE / (2 * (1 + (newMatNu || 0.3)));
    if (editingMatId !== null) {
      setMaterials((prev) =>
        prev.map((mat) =>
          mat.id === editingMatId
            ? {
                ...mat,
                name: newMatName.trim() || mat.name,
                E: newMatE,
                nu: newMatNu,
                G: G,
                alpha: newMatAlpha,
                density: newMatDensity,
                fd: newMatFd,
              }
            : mat
        )
      );
      setEditingMatId(null);
      backupMaterialRef.current = null;
    } else {
      const nextId = materials.length > 0 ? Math.max(...materials.map((m) => m.id)) + 1 : 1;
      const mat: Material = {
        id: nextId,
        name: newMatName.trim() || 'Materiał',
        E: newMatE,
        nu: newMatNu,
        G: G,
        alpha: newMatAlpha,
        density: newMatDensity,
        fd: newMatFd,
      };
      setMaterials((prev) => [...prev, mat]);
    }
    setAddMatFormOpen(false);
    onInvalidateResults();
  };

  // Helper to compute section properties based on current form states
  const getTempSectionProps = (): Omit<Section, 'id' | 'name'> => {
    if (newSecCategory === 'katalog') {
      const def = CATALOG_DEFS[newSecCatType];
      const data = def.data[newSecCatSizeIdx] || def.data[0];
      const h = data.h;
      const b = data.b;
      const tf = data.tf ?? 0;
      const tw = data.tw ?? 0;
      const t = data.t ?? 0;
      const A = data.A;
      const Iy = data.Iy;
      const Iz = data.Iz;
      const It = data.It;

      let cTopY = h / 2;
      let cBotY = h / 2;
      let cTopZ = b / 2;
      let cBotZ = b / 2;

      if (newSecCatType === 'L') {
        const zs = data.zs ?? (h * 0.28);
        cTopY = h - zs;
        cBotY = zs;
        cTopZ = b - zs;
        cBotZ = zs;
      } else if (newSecCatType === 'UPN' || newSecCatType === 'UPE') {
        const tw_val = tw || 0.5;
        const tf_val = tf || 0.8;
        const hw = h - 2 * tf_val;
        const A1 = 2 * b * tf_val;
        const A2 = hw * tw_val;
        const totalA = A1 + A2;
        const zs = totalA > 0 ? (A1 * (b / 2) + A2 * (tw_val / 2)) / totalA : b / 2;
        cTopY = h / 2;
        cBotY = h / 2;
        cTopZ = b - zs;
        cBotZ = zs;
      } else if (newSecCatType === 'T') {
        const tw_val = tw || 0.5;
        const tf_val = tf || 0.5;
        const hw = h - tf_val;
        const A1 = b * tf_val;
        const A2 = hw * tw_val;
        const totalA = A1 + A2;
        const ys = totalA > 0 ? (A1 * (h - tf_val / 2) + A2 * (hw / 2)) / totalA : h / 2;
        cTopY = h - ys;
        cBotY = ys;
        cTopZ = b / 2;
        cBotZ = b / 2;
      }

      return {
        shape: 'cat' + newSecCatType,
        category: 'katalog',
        A, Iy, Iz, It, h, b, tf, tw, t,
        cTopY, cBotY, cTopZ, cBotZ
      };
    } else if (newSecCategory === 'ksztalt') {
      if (newSecShape === 'rect') {
        const h = newSecH;
        const b = newSecB;
        const A = b * h;
        const Iy = (b * Math.pow(h, 3)) / 12;
        const Iz = (h * Math.pow(b, 3)) / 12;
        const a = Math.max(b, h);
        const d = Math.min(b, h);
        const beta = (1/3) - 0.21 * (d/a) * (1 - Math.pow(d, 4) / (12 * Math.pow(a, 4)));
        const It = beta * a * Math.pow(d, 3);
        return {
          shape: 'rect',
          category: 'ksztalt',
          A, Iy, Iz, It, h, b,
          cTopY: h / 2, cBotY: h / 2, cTopZ: b / 2, cBotZ: b / 2
        };
      } else if (newSecShape === 'circ') {
        const h = newSecD;
        const b = newSecD;
        const A = (Math.PI * h * h) / 4;
        const I = (Math.PI * Math.pow(h, 4)) / 64;
        const It = 2 * I;
        return {
          shape: 'circ',
          category: 'ksztalt',
          A, Iy: I, Iz: I, It, h, b,
          cTopY: h / 2, cBotY: h / 2, cTopZ: b / 2, cBotZ: b / 2
        };
      } else if (newSecShape === 'pipe') {
        const h = newSecD;
        const b = newSecD;
        const t = newSecT;
        const Di = h - 2 * t;
        const A = (Math.PI / 4) * (h * h - Di * Di);
        const I = (Math.PI / 64) * (Math.pow(h, 4) - Math.pow(Di, 4));
        const It = 2 * I;
        return {
          shape: 'pipe',
          category: 'ksztalt',
          A, Iy: I, Iz: I, It, h, b, t,
          cTopY: h / 2, cBotY: h / 2, cTopZ: b / 2, cBotZ: b / 2
        };
      } else if (newSecShape === 'box') {
        const h = newSecH;
        const b = newSecB;
        const t = newSecT;
        const hi = h - 2 * t;
        const bi = b - 2 * t;
        const A = b * h - bi * hi;
        const Iy = (b * Math.pow(h, 3) - bi * Math.pow(hi, 3)) / 12;
        const Iz = (h * Math.pow(b, 3) - hi * Math.pow(bi, 3)) / 12;
        const bm = b - t;
        const hm = h - t;
        const It = (2 * t * Math.pow(bm * hm, 2)) / (bm + hm);
        return {
          shape: 'box',
          category: 'ksztalt',
          A, Iy, Iz, It, h, b, t,
          cTopY: h / 2, cBotY: h / 2, cTopZ: b / 2, cBotZ: b / 2
        };
      } else if (newSecShape === 'ibeam') {
        const h = newSecH;
        const b = newSecB;
        const tf = newSecTf;
        const tw = newSecTw;
        const hw = h - 2 * tf;
        const A = 2 * b * tf + hw * tw;
        const Iy = (b * Math.pow(h, 3) - (b - tw) * Math.pow(hw, 3)) / 12;
        const Iz = (2 * tf * Math.pow(b, 3)) / 12 + (hw * Math.pow(tw, 3)) / 12;
        const It = (1 / 3) * (2 * b * Math.pow(tf, 3) + hw * Math.pow(tw, 3));
        return {
          shape: 'ibeam',
          category: 'ksztalt',
          A, Iy, Iz, It, h, b, tf, tw,
          cTopY: h / 2, cBotY: h / 2, cTopZ: b / 2, cBotZ: b / 2
        };
      } else if (newSecShape === 'tee') {
        const h = newSecH;
        const b = newSecB;
        const tf = newSecTf;
        const tw = newSecTw;
        const hw = h - tf;
        const A1 = b * tf;
        const A2 = hw * tw;
        const A = A1 + A2;
        const y1 = h - tf / 2;
        const y2 = hw / 2;
        const ys = A > 0 ? (A1 * y1 + A2 * y2) / A : h / 2;
        const cTopY = h - ys;
        const cBotY = ys;
        const cTopZ = b / 2;
        const cBotZ = b / 2;
        const Iy = (b * Math.pow(tf, 3)) / 12 + A1 * Math.pow(y1 - ys, 2) +
                   (tw * Math.pow(hw, 3)) / 12 + A2 * Math.pow(y2 - ys, 2);
        const Iz = (tf * Math.pow(b, 3)) / 12 + (hw * Math.pow(tw, 3)) / 12;
        const It = (1 / 3) * (b * Math.pow(tf, 3) + hw * Math.pow(tw, 3));
        return {
          shape: 'tee',
          category: 'ksztalt',
          A, Iy, Iz, It, h, b, tf, tw,
          cTopY, cBotY, cTopZ, cBotZ
        };
      } else { // angle
        const a = newSecH;
        const h = a;
        const b = a;
        const t = newSecT;
        const A = 2 * a * t - t * t;
        const ys = A > 0 ? (a * t * (a / 2) + (a - t) * t * (t / 2)) / A : a / 2;
        const cTopY = a - ys;
        const cBotY = ys;
        const cTopZ = a - ys;
        const cBotZ = ys;
        const Iy = (t * Math.pow(a, 3)) / 12 + a * t * Math.pow(a / 2 - ys, 2) +
                   ((a - t) * Math.pow(t, 3)) / 12 + (a - t) * t * Math.pow(t / 2 - ys, 2);
        const Iz = Iy;
        const It = (1 / 3) * (2 * a - t) * Math.pow(t, 3);
        return {
          shape: 'angle',
          category: 'ksztalt',
          A, Iy, Iz, It, h, b, t,
          cTopY, cBotY, cTopZ, cBotZ
        };
      }
    } else { // custom / wlasny
      const h = newSecCTopY + newSecCBotY;
      const b = newSecCTopZ + newSecCBotZ;
      return {
        shape: 'custom',
        category: 'wlasny',
        A: newSecA,
        Iy: newSecIy,
        Iz: newSecIz,
        It: newSecIt,
        h,
        b,
        cTopY: newSecCTopY,
        cBotY: newSecCBotY,
        cTopZ: newSecCTopZ,
        cBotZ: newSecCBotZ
      };
    }
  };

  // Live update the section in the 3D model visualization while editing in the form
  useEffect(() => {
    if (editingSecId !== null && addSecFormOpen) {
      const props = getTempSectionProps();
      let autoName = newSecName;
      if (!autoName || autoName === 'Nowy przekrój' || autoName.trim() === '') {
        if (newSecCategory === 'katalog') {
          const def = CATALOG_DEFS[newSecCatType];
          const data = def?.data[newSecCatSizeIdx] || def?.data[0];
          autoName = data?.name || 'Przekrój katalogowy';
        }
      }
      setSections((prev) =>
        prev.map((sec) =>
          sec.id === editingSecId
            ? {
                ...sec,
                name: autoName || sec.name,
                ...props,
              }
            : sec
        )
      );
    }
  }, [
    editingSecId,
    addSecFormOpen,
    newSecName,
    newSecCategory,
    newSecCatType,
    newSecCatSizeIdx,
    newSecShape,
    newSecB,
    newSecH,
    newSecD,
    newSecT,
    newSecTf,
    newSecTw,
    newSecA,
    newSecIy,
    newSecIz,
    newSecIt,
    newSecCTopY,
    newSecCBotY,
    newSecCTopZ,
    newSecCBotZ,
  ]);

  // Live update the material while editing in the form
  useEffect(() => {
    if (editingMatId !== null && addMatFormOpen) {
      const G = newMatE / (2 * (1 + (newMatNu || 0.3)));
      setMaterials((prev) =>
        prev.map((mat) =>
          mat.id === editingMatId
            ? {
                ...mat,
                E: newMatE,
                nu: newMatNu,
                G: G,
                alpha: newMatAlpha,
                density: newMatDensity,
                fd: newMatFd,
              }
            : mat
        )
      );
    }
  }, [
    editingMatId,
    addMatFormOpen,
    newMatE,
    newMatNu,
    newMatAlpha,
    newMatDensity,
    newMatFd,
  ]);

  // Add or Edit Section
  const handleAddSection = () => {
    const props = getTempSectionProps();

    let finalName = newSecName;
    if (!finalName || finalName === 'Nowy przekrój' || finalName.trim() === '') {
      if (newSecCategory === 'katalog') {
        const def = CATALOG_DEFS[newSecCatType];
        const data = def.data[newSecCatSizeIdx] || def.data[0];
        finalName = data.name;
      } else if (newSecCategory === 'ksztalt') {
        const labels: Record<string, string> = {
          rect: `Prostokąt ${newSecB}×${newSecH}`,
          circ: `Okrągły Ø${newSecD}`,
          pipe: `Rura okrągła Ø${newSecD}×${newSecT}`,
          box: `Profil skrzynkowy ${newSecB}×${newSecH}×${newSecT}`,
          ibeam: `Dwuteownik ${newSecB}×${newSecH}`,
          tee: `Teownik ${newSecB}×${newSecH}`,
          angle: `Kątownik L ${newSecH}×${newSecH}×${newSecT}`,
        };
        finalName = labels[newSecShape] || 'Kształt';
      } else {
        finalName = 'Przekrój własny';
      }
    }

    if (editingSecId !== null) {
      setSections((prev) =>
        prev.map((sec) =>
          sec.id === editingSecId
            ? {
                ...sec,
                name: finalName,
                ...props,
              }
            : sec
        )
      );
      setEditingSecId(null);
      backupSectionRef.current = null;
    } else {
      const nextId = sections.length > 0 ? Math.max(...sections.map((s) => s.id)) + 1 : 1;
      const sec: Section = {
        id: nextId,
        name: finalName,
        ...props,
      };
      setSections((prev) => [...prev, sec]);
    }

    setAddSecFormOpen(false);
    onInvalidateResults();
  };

  const singleNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const singleElem = selectedElements.length === 1 ? selectedElements[0] : null;

  return (
    <div
      id="sidebar"
      style={panelHeight ? ({ '--panel-height': `${panelHeight}px` } as React.CSSProperties) : undefined}
      onPointerDownCapture={handleSidebarInteractionCapture}
      onFocusCapture={handleSidebarInteractionCapture}
    >
      {/* Draggable handle for mobile layout */}
      <div
        id="panelHandle"
        aria-hidden="true"
        onMouseDown={onPanelHandleStart}
        onTouchStart={onPanelHandleStart}
      >
        <div className="panel-grip"></div>
      </div>

      <div id="sidebarScroll">
        {/* GROUP 1: WSPÓŁRZĘDNE (w trybie Rysuj / Obrys) LUB WŁAŚCIWOŚCI (w trybie Zaznacz) */}
        {mode === 'addBar' ? (
          <div className="sidebar-group">
            <div className="group-header" onClick={() => setAddBarCoordsCollapsed(!addBarCoordsCollapsed)}>
              <div className="group-title">
                <span>Współrzędne</span>
                <span className="group-tag">
                  {barStartNodeId != null ? `Start: W${barStartNodeId}` : 'Nowy pręt'}
                </span>
              </div>
              <span className="subtle-icon">{addBarCoordsCollapsed ? '▸' : '▾'}</span>
            </div>
            {!addBarCoordsCollapsed && (
              <div className="group-body">
                <div className="panel">
                  <h3>Współrzędne</h3>
                  {barStartNodeId != null ? (
                    <div
                      className="card"
                      style={{
                        marginBottom: '10px',
                        background: 'var(--surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderColor: 'var(--input-border)',
                      }}
                    >
                      <div style={{ fontSize: '12px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                          Początek: W{barStartNodeId}
                        </span>
                        {getNode(barStartNodeId) && (
                          <span className="muted" style={{ marginLeft: '4px' }}>
                            (x={fmtSmart(getNode(barStartNodeId)!.x)}, y={fmtSmart(getNode(barStartNodeId)!.y)}, z=
                            {fmtSmart(getNode(barStartNodeId)!.z)})
                          </span>
                        )}
                      </div>
                      <button className="mini" onClick={() => setBarStartNodeId(null)} title="Zresetuj punkt startowy">
                        Zmień
                      </button>
                    </div>
                  ) : (
                    <div className="muted" style={{ marginBottom: '10px' }}>
                      Wpisz współrzędne pierwszego węzła:
                    </div>
                  )}

                  <div className="checkline" style={{ marginBottom: '10px' }}>
                    <input
                      type="checkbox"
                      id="chkAddBarRel"
                      checked={addBarRel}
                      onChange={(e) => setAddBarRel(e.target.checked)}
                    />
                    <label htmlFor="chkAddBarRel" style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Względnie (przyrosty ΔX, ΔY, ΔZ)
                    </label>
                  </div>

                  <div className="row-triple" style={{ marginBottom: '10px' }}>
                    <div className="third">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                        {addBarRel ? 'ΔX' : 'X'}
                      </label>
                      <div className="inp-unit">
                        <SmartNumberInput
                          step="0.5"
                          value={addBarValX}
                          onFocus={onInvalidateResults}
                          onChange={(v) => setAddBarValX(v)}
                        />
                        <span className="unit">m</span>
                      </div>
                    </div>
                    <div className="third">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
                        {addBarRel ? 'ΔY' : 'Y'}
                      </label>
                      <div className="inp-unit">
                        <SmartNumberInput
                          step="0.5"
                          value={addBarValY}
                          onFocus={onInvalidateResults}
                          onChange={(v) => setAddBarValY(v)}
                        />
                        <span className="unit">m</span>
                      </div>
                    </div>
                    <div className="third">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                        {addBarRel ? 'ΔZ' : 'Z'}
                      </label>
                      <div className="inp-unit">
                        <SmartNumberInput
                          step="0.5"
                          value={addBarValZ}
                          onFocus={onInvalidateResults}
                          onChange={(v) => setAddBarValZ(v)}
                        />
                        <span className="unit">m</span>
                      </div>
                    </div>
                  </div>

                  <button className="primary-btn" onClick={confirmAddBarCoords}>
                    Zatwierdź
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : mode === 'addPanel' ? (
          <div className="sidebar-group">
            <div className="group-header" onClick={() => setAddBarCoordsCollapsed(!addBarCoordsCollapsed)}>
              <div className="group-title">
                <span>Współrzędne</span>
                <span className="group-tag">
                  {panelShape === 'triangle'
                    ? `Trójkąt (${panelPoints.length}/3)`
                    : `Prostokąt (${panelPoints.length}/3)`}
                </span>
              </div>
              <span className="subtle-icon">{addBarCoordsCollapsed ? '▸' : '▾'}</span>
            </div>
            {!addBarCoordsCollapsed && (
              <div className="group-body">
                <div className="panel">
                  <h3>Obrys / Okładzina</h3>

                  {/* Kształt obrysu */}
                  <div className="btnrow" style={{ marginTop: '4px', marginBottom: '10px' }}>
                    <button
                      type="button"
                      className={`mini ${panelShape === 'triangle' ? 'on' : ''}`}
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                      onClick={() => setPanelShape?.('triangle')}
                    >
                      <span style={{ width: 14, height: 14, display: 'inline-flex' }}>{ICONS.triangle}</span>
                      Trójkąt
                    </button>
                    <button
                      type="button"
                      className={`mini ${panelShape === 'rectangle' ? 'on' : ''}`}
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                      onClick={() => setPanelShape?.('rectangle')}
                    >
                      <span style={{ width: 14, height: 14, display: 'inline-flex' }}>{ICONS.rectangle}</span>
                      Prostokąt
                    </button>
                  </div>

                  {/* Wybrane punkty */}
                  {panelPoints.length > 0 && (
                    <div
                      className="card"
                      style={{
                        marginBottom: '10px',
                        background: 'var(--surface)',
                        padding: '8px 10px',
                        borderColor: 'var(--input-border)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                        }}
                      >
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)' }}>
                          Wybrane węzły:
                        </span>
                        <button
                          className="mini danger"
                          onClick={() => setPanelPoints?.([])}
                          title="Zresetuj wybrane punkty"
                        >
                          Zresetuj
                        </button>
                      </div>
                      <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {panelPoints.map((ptId, idx) => {
                          const n = getNode(ptId);
                          return (
                            <div key={idx} style={{ color: 'var(--text)' }}>
                              <strong>Punkt {idx + 1}: W{ptId}</strong>
                              {n && (
                                <span className="muted" style={{ marginLeft: '4px' }}>
                                  ({fmtSmart(n.x)}, {fmtSmart(n.y)}, {fmtSmart(n.z)})
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="muted" style={{ marginBottom: '10px', fontSize: '12px' }}>
                    {panelShape === 'triangle'
                      ? panelPoints.length === 0
                        ? 'Wpisz współrzędne 1. węzła trójkąta:'
                        : panelPoints.length === 1
                        ? 'Wpisz współrzędne 2. węzła trójkąta:'
                        : 'Wpisz współrzędne 3. węzła (domyka trójkąt):'
                      : panelPoints.length === 0
                      ? 'Wpisz współrzędne 1. węzła bazowego prostokąta:'
                      : panelPoints.length === 1
                      ? 'Wpisz współrzędne 2. węzła (wyznacza 1. bok prostokąta):'
                      : 'Wpisz współrzędne 3. punktu (wyznacza kąt i szerokość):'}
                  </div>

                  <div className="checkline" style={{ marginBottom: '10px' }}>
                    <input
                      type="checkbox"
                      id="chkAddPanelRel"
                      checked={addBarRel}
                      onChange={(e) => setAddBarRel(e.target.checked)}
                    />
                    <label htmlFor="chkAddPanelRel" style={{ cursor: 'pointer', userSelect: 'none' }}>
                      Względnie (przyrosty ΔX, ΔY, ΔZ)
                    </label>
                  </div>

                  <div className="row-triple" style={{ marginBottom: '10px' }}>
                    <div className="third">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                        {addBarRel ? 'ΔX' : 'X'}
                      </label>
                      <div className="inp-unit">
                        <SmartNumberInput
                          step="0.5"
                          value={addBarValX}
                          onFocus={onInvalidateResults}
                          onChange={(v) => setAddBarValX(v)}
                        />
                        <span className="unit">m</span>
                      </div>
                    </div>
                    <div className="third">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
                        {addBarRel ? 'ΔY' : 'Y'}
                      </label>
                      <div className="inp-unit">
                        <SmartNumberInput
                          step="0.5"
                          value={addBarValY}
                          onFocus={onInvalidateResults}
                          onChange={(v) => setAddBarValY(v)}
                        />
                        <span className="unit">m</span>
                      </div>
                    </div>
                    <div className="third">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                        {addBarRel ? 'ΔZ' : 'Z'}
                      </label>
                      <div className="inp-unit">
                        <SmartNumberInput
                          step="0.5"
                          value={addBarValZ}
                          onFocus={onInvalidateResults}
                          onChange={(v) => setAddBarValZ(v)}
                        />
                        <span className="unit">m</span>
                      </div>
                    </div>
                  </div>

                  <button className="primary-btn" onClick={confirmAddPanelCoords}>
                    {panelShape === 'triangle' && panelPoints.length === 2
                      ? 'Utwórz trójkąt'
                      : panelShape === 'rectangle' && panelPoints.length === 2
                      ? 'Utwórz prostokąt'
                      : 'Dodaj punkt'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : mode === 'grid' ? (
          <div className="sidebar-group">
            <div className="group-header" onClick={() => setAddBarCoordsCollapsed(!addBarCoordsCollapsed)}>
              <div className="group-title">
                <span>Płaszczyzna siatki</span>
                <span className="group-tag">
                  {gridPlane} ({gridPlane === 'XY' ? 'Z' : gridPlane === 'XZ' ? 'Y' : 'X'} = {gridOffset.toFixed(2)} m)
                </span>
              </div>
              <span className="subtle-icon">{addBarCoordsCollapsed ? '▸' : '▾'}</span>
            </div>
            {!addBarCoordsCollapsed && (
              <div className="group-body">
                <div className="panel">
                  <h3>Płaszczyzna robocza</h3>

                  {/* Wybór płaszczyzny XY / YZ / XZ */}
                  <div className="btnrow" style={{ marginTop: '4px', marginBottom: '10px' }}>
                    <button
                      type="button"
                      className={`mini ${gridPlane === 'XY' ? 'on' : ''}`}
                      style={{ flex: 1, transition: 'none' }}
                      id="sbGridPlaneXY"
                      onClick={() => setGridPlane?.('XY')}
                      title="Płaszczyzna pozioma XY (z=const)"
                    >
                      XY (pozioma)
                    </button>
                    <button
                      type="button"
                      className={`mini ${gridPlane === 'YZ' ? 'on' : ''}`}
                      style={{ flex: 1, transition: 'none' }}
                      id="sbGridPlaneYZ"
                      onClick={() => setGridPlane?.('YZ')}
                      title="Płaszczyzna pionowa YZ (x=const)"
                    >
                      YZ (boczna)
                    </button>
                    <button
                      type="button"
                      className={`mini ${gridPlane === 'XZ' ? 'on' : ''}`}
                      style={{ flex: 1, transition: 'none' }}
                      id="sbGridPlaneXZ"
                      onClick={() => setGridPlane?.('XZ')}
                      title="Płaszczyzna pionowa XZ (y=const)"
                    >
                      XZ (czołowa)
                    </button>
                  </div>

                  {/* Położenie / offset płaszczyzny */}
                  <div className="row" style={{ marginBottom: '8px' }}>
                    <label style={{ flex: '0 0 auto', width: '68px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {gridPlane === 'XY' ? 'Poziom Z' : gridPlane === 'XZ' ? 'Położenie Y' : 'Położenie X'}
                    </label>
                    <div className="inp-unit">
                      <SmartNumberInput
                        step="0.5"
                        value={gridOffset}
                        onChange={(v) => setGridOffset?.(v)}
                      />
                      <span className="unit">m</span>
                    </div>
                    <button
                      type="button"
                      className="mini danger"
                      style={{ flex: '0 0 auto', padding: '4px 8px', height: '27px', fontSize: '11px', whiteSpace: 'nowrap' }}
                      onClick={() => setGridOffset?.(0)}
                      title="Ustaw położenie na 0.00 m"
                    >
                      Reset
                    </button>
                  </div>

                  {/* Krok dociągania (Snap) przeniesiony z opcji */}
                  <div className="row" style={{ marginBottom: '10px' }}>
                    <label style={{ minWidth: '70px', fontSize: '11px', whiteSpace: 'nowrap' }}>Krok snapu</label>
                    <div className="inp-unit">
                      <SmartNumberInput
                        min={0.01}
                        step="0.05"
                        value={snapSize}
                        onChange={(v) => setSnapSize?.(Math.max(0.01, v || 0.5))}
                      />
                      <span className="unit">m</span>
                    </div>
                  </div>

                  {/* Wskazówka bez prefiksu */}
                <div className="muted" style={{ marginBottom: '10px'}}>
                    Wybierz płaszczyznę i poziom odniesienia do tworzenia oraz przyciągania węzłów i prętów.
                  </div>

                  {/* Poziomy z istniejących węzłów modelu */}
                  {(() => {
                    const uniqueLevels: number[] = Array.from(
                      new Set<number>(
                        nodes.map((n) =>
                          gridPlane === 'XY' ? n.z : gridPlane === 'XZ' ? n.y : n.x
                        )
                      )
                    ).sort((a: number, b: number) => a - b);

                    if (uniqueLevels.length === 0) return null;

                    return (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', marginBottom: '6px' }}>
                          Poziomy węzłów z modelu:
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {uniqueLevels.map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              className={`mini ${Math.abs(gridOffset - lvl) < 1e-4 ? 'on' : ''}`}
                              style={{
                                padding: '3px 8px',
                                fontSize: '11px',
                              }}
                              onClick={() => setGridOffset?.(lvl)}
                            >
                              {gridPlane === 'XY' ? 'Z' : gridPlane === 'XZ' ? 'Y' : 'X'} = {lvl.toFixed(2)} m
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Przyciąganie do siatki */}
                  <div className="checkline" style={{ marginTop: '8px' }}>
                    <input
                      type="checkbox"
                      id="chkGridSnapSb"
                      checked={snapEnabled}
                      onChange={(e) => setSnapEnabled?.(e.target.checked)}
                    />
                    <label htmlFor="chkGridSnapSb" style={{ cursor: 'pointer', userSelect: 'none', fontSize: '12px' }}>
                      Przyciągaj kursor do siatki (Snap)
                    </label>
                  </div>

                  {/* Widoczność siatki */}
                  {setShowGrid && (
                    <div className="checkline" style={{ marginTop: '6px' }}>
                      <input
                        type="checkbox"
                        id="chkGridVisibilitySb"
                        checked={showGrid}
                        onChange={(e) => setShowGrid?.(e.target.checked)}
                      />
                      <label htmlFor="chkGridVisibilitySb" style={{ cursor: 'pointer', userSelect: 'none', fontSize: '12px' }}>
                        Wyświetlaj siatkę w przestrzeni 3D
                      </label>
                    </div>
                  )}

                  {/* Osie globalne układu (XYZ) */}
                  {setShowAxes && (
                    <div className="checkline" style={{ marginTop: '6px' }}>
                      <input
                        type="checkbox"
                        id="chkShowAxesSb"
                        checked={showAxes}
                        onChange={(e) => setShowAxes?.(e.target.checked)}
                      />
                      <label htmlFor="chkShowAxesSb" style={{ cursor: 'pointer', userSelect: 'none', fontSize: '12px' }}>
                        Osie globalne układu (XYZ)
                      </label>
                    </div>
                  )}

                  <hr className="sep" style={{ margin: '10px 0 8px 0' }} />

                  {/* Tolerancja łączenia węzłów i przycisk Połącz */}
                  <div className="row" style={{ marginTop: '4px', marginBottom: '4px' }}>
                    <label style={{ minWidth: '70px', fontSize: '11px', whiteSpace: 'nowrap' }} title="Tolerancja łączenia węzłów (m)">
                      Łączenie węzłów
                    </label>
                    <div className="inp-unit">
                      <SmartNumberInput
                        min={0}
                        step="0.001"
                        value={mergeTolerance}
                        onChange={(v) => setMergeTolerance?.(Math.max(0, v ?? 0.001))}
                      />
                      <span className="unit">m</span>
                    </div>
                    <button
                      type="button"
                      className="mini"
                      style={{
                        flex: '0 0 auto',
                        padding: '4px 9px',
                        height: '27px',
                        fontSize: '11px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                      id="btnMergeNodesWorkPlane"
                      onClick={handleMergeNodes}
                      title="Połącz węzły znajdujące się bliżej siebie niż zadana tolerancja"
                    >
                      Połącz
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : mode === 'lines' ? (
          <div className="sidebar-group">
            <div className="group-header">
              <div className="group-title">
                <span>Siatka osiowa (XYZ)</span>
                <span className="group-tag">Główna siatka konstrukcyjna</span>
              </div>
            </div>
            <div className="group-body">
              <div className="panel">
                <div className="muted" style={{ marginBottom: '10px'}}>
                  Wskaż aktywną oś, wpisz współrzędne i kliknij <strong>Dodaj</strong>, lub klikaj bezpośrednio na modelu 3D.
                </div>

                {/* Input control row matching standard sidebar .row and .inp-unit styling */}
                <div className="row" style={{ marginBottom: '8px' }}>
                  <label style={{ minWidth: '70px' }}>Oś {activeGridAxis}</label>
                  <div className="inp-unit" style={{ flex: 1 }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="np. 3.5 lub 0, 3, 6"
                      value={newCoordVal}
                      onChange={(e) => setNewCoordVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddCoordinates();
                      }}
                      style={{ width: '100%' }}
                    />
                    <span className="unit">m</span>
                  </div>
                </div>

                <div className="btnrow" style={{ marginBottom: '14px', gap: '6px' }}>
                  <button
                    type="button"
                    className="mini on"
                    style={{ flex: 1, padding: '5px 8px', fontSize: '11.5px' }}
                    onClick={handleAddCoordinates}
                  >
                    Dodaj
                  </button>
                  <button
                    type="button"
                    className="mini"
                    style={{
                      flex: 1,
                      padding: '5px 8px',
                      fontSize: '11.5px',
                      color: selectedGridItems.length > 0 ? 'var(--danger)' : undefined,
                      borderColor: selectedGridItems.length > 0 ? 'var(--danger)' : undefined,
                      fontWeight: selectedGridItems.length > 0 ? 600 : undefined,
                    }}
                    onClick={handleRemoveCoordinates}
                    title={selectedGridItems.length > 0 ? 'Usuń zaznaczone współrzędne' : 'Usuń wpisaną współrzędną'}
                  >
                    Usuń {selectedGridItems.length > 0 ? `(${selectedGridItems.length})` : ''}
                  </button>
                  <button
                    type="button"
                    className="mini danger"
                    style={{ flex: 1, padding: '5px 8px', fontSize: '11.5px' }}
                    onClick={handleClearCoordinates}
                  >
                    {selectedGridItems.length > 0 ? 'Odznacz' : 'Wyczyść'}
                  </button>
                </div>

                {/* 3 columns of data */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '14px' }}>
                  {/* Column X */}
                  <div
                    style={{
                      border: activeGridAxis === 'X' ? '1.5px solid #ef4444' : '1px solid var(--surface-border)',
                      borderRadius: '6px',
                      padding: '7px 6px',
                      background: activeGridAxis === 'X' ? 'var(--surface-2)' : 'var(--surface)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: '130px',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                    onClick={() => setActiveGridAxis?.('X')}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                        borderBottom: '1px solid var(--surface-border)',
                        paddingBottom: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#ef4444',
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '11px',
                            color: activeGridAxis === 'X' ? '#ef4444' : 'var(--text)',
                          }}
                        >
                          Oś X
                        </span>
                      </div>
                      <span style={{ fontSize: '9.5px', color: 'var(--text-dim)', fontWeight: 600 }}>
                        {gridCoords.x.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto', flex: 1, maxHeight: '180px' }}>
                      {gridCoords.x.length === 0 ? (
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic', textAlign: 'center', marginTop: '12px' }}>
                          Brak
                        </span>
                      ) : (
                        gridCoords.x.map((val) => {
                          const isSelected = selectedGridItems.some((i) => i.axis === 'x' && i.val === val);
                          return (
                            <div
                              key={val}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectGridItem('x', val);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: isSelected ? 'rgba(239, 68, 68, 0.15)' : 'var(--panel-gutter)',
                                color: isSelected ? '#ef4444' : 'var(--text)',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                border: isSelected ? '1px solid #ef4444' : '1px solid var(--surface-border-soft)',
                                cursor: 'pointer',
                                userSelect: 'none',
                                fontWeight: isSelected ? 600 : 400,
                                transition: 'all 0.12s ease',
                              }}
                              title="Kliknij, aby zaznaczyć/odznaczyć do usunięcia"
                            >
                              <span>{val.toFixed(2)} m</span>
                              {isSelected && (
                                <span style={{ fontSize: '9px', fontWeight: 'bold' }}>✓</span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Column Y */}
                  <div
                    style={{
                      border: activeGridAxis === 'Y' ? '1.5px solid #22c55e' : '1px solid var(--surface-border)',
                      borderRadius: '6px',
                      padding: '7px 6px',
                      background: activeGridAxis === 'Y' ? 'var(--surface-2)' : 'var(--surface)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: '130px',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                    onClick={() => setActiveGridAxis?.('Y')}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                        borderBottom: '1px solid var(--surface-border)',
                        paddingBottom: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#22c55e',
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '11px',
                            color: activeGridAxis === 'Y' ? '#16a34a' : 'var(--text)',
                          }}
                        >
                          Oś Y
                        </span>
                      </div>
                      <span style={{ fontSize: '9.5px', color: 'var(--text-dim)', fontWeight: 600 }}>
                        {gridCoords.y.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto', flex: 1, maxHeight: '180px' }}>
                      {gridCoords.y.length === 0 ? (
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic', textAlign: 'center', marginTop: '12px' }}>
                          Brak
                        </span>
                      ) : (
                        gridCoords.y.map((val) => {
                          const isSelected = selectedGridItems.some((i) => i.axis === 'y' && i.val === val);
                          return (
                            <div
                              key={val}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectGridItem('y', val);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: isSelected ? 'rgba(34, 197, 94, 0.15)' : 'var(--panel-gutter)',
                                color: isSelected ? '#15803d' : 'var(--text)',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                border: isSelected ? '1px solid #22c55e' : '1px solid var(--surface-border-soft)',
                                cursor: 'pointer',
                                userSelect: 'none',
                                fontWeight: isSelected ? 600 : 400,
                                transition: 'all 0.12s ease',
                              }}
                              title="Kliknij, aby zaznaczyć/odznaczyć do usunięcia"
                            >
                              <span>{val.toFixed(2)} m</span>
                              {isSelected && (
                                <span style={{ fontSize: '9px', fontWeight: 'bold' }}>✓</span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Column Z */}
                  <div
                    style={{
                      border: activeGridAxis === 'Z' ? '1.5px solid #3b82f6' : '1px solid var(--surface-border)',
                      borderRadius: '6px',
                      padding: '7px 6px',
                      background: activeGridAxis === 'Z' ? 'var(--surface-2)' : 'var(--surface)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: '130px',
                      transition: 'border-color 0.15s, background-color 0.15s',
                    }}
                    onClick={() => setActiveGridAxis?.('Z')}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                        borderBottom: '1px solid var(--surface-border)',
                        paddingBottom: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: '#3b82f6',
                            display: 'inline-block',
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '11px',
                            color: activeGridAxis === 'Z' ? '#2563eb' : 'var(--text)',
                          }}
                        >
                          Oś Z
                        </span>
                      </div>
                      <span style={{ fontSize: '9.5px', color: 'var(--text-dim)', fontWeight: 600 }}>
                        {gridCoords.z.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto', flex: 1, maxHeight: '180px' }}>
                      {gridCoords.z.length === 0 ? (
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontStyle: 'italic', textAlign: 'center', marginTop: '12px' }}>
                          Brak
                        </span>
                      ) : (
                        gridCoords.z.map((val) => {
                          const isSelected = selectedGridItems.some((i) => i.axis === 'z' && i.val === val);
                          return (
                            <div
                              key={val}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectGridItem('z', val);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--panel-gutter)',
                                color: isSelected ? '#2563eb' : 'var(--text)',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                border: isSelected ? '1px solid #3b82f6' : '1px solid var(--surface-border-soft)',
                                cursor: 'pointer',
                                userSelect: 'none',
                                fontWeight: isSelected ? 600 : 400,
                                transition: 'all 0.12s ease',
                              }}
                              title="Kliknij, aby zaznaczyć/odznaczyć do usunięcia"
                            >
                              <span>{val.toFixed(2)} m</span>
                              {isSelected && (
                                <span style={{ fontSize: '9px', fontWeight: 'bold' }}>✓</span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Display settings and persistence checkboxes */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginBottom: '10px',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      margin: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={drawConstructionGrid}
                      onChange={(e) => setDrawConstructionGrid?.(e.target.checked)}
                      style={{ cursor: 'pointer', margin: 0, accentColor: 'var(--accent)' }}
                    />
                    Rysuj punkty i linie konstrukcyjne
                  </label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      margin: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={drawOuterDimensionLines}
                      onChange={(e) => setDrawOuterDimensionLines?.(e.target.checked)}
                      style={{ cursor: 'pointer', margin: 0, accentColor: 'var(--accent)' }}
                    />
                    Rysuj linie wymiarowe
                  </label>
                </div>

                {/* HELP CARD */}
                <div
                  className="muted"

                >
                  Siatka jest automatycznie rysowana, gdy co najmniej dwie osie mają zdefiniowane współrzędne. Kliknij wartość w kolumnie, aby zaznaczyć i usunąć przyciskiem <em>Usuń</em>.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* WŁAŚCIWOŚCI GÓRNY KOMUNIKAT */}
            {selectedNodeIds.length === 0 && selectedElemIds.length === 0 && selectedPanelIds.length === 0 ? (
              <div className="panel">
                <h3>Właściwości</h3>
                <div className="empty-state">
                  Zaznacz węzeł, pręt lub okładzinę na rysunku (tryb „Zaznacz”),<br />
                  aby edytować ich właściwości lub wykonać operacje.
                </div>
              </div>
            ) : (
              <div className="panel">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <h3 style={{ margin: 0 }}>Właściwości</h3>
                  <div className="muted" style={{ fontSize: '11px', fontWeight: 600 }}>
                    {selectedNodeIds.length === 1 && selectedElemIds.length === 0 && selectedPanelIds.length === 0
                      ? `Węzeł W${selectedNodeIds[0]}`
                      : selectedElemIds.length === 1 && selectedNodeIds.length === 0 && selectedPanelIds.length === 0
                      ? `Pręt P${selectedElemIds[0]} (W${selectedElements[0]?.n1}→W${selectedElements[0]?.n2})`
                      : selectedPanelIds.length === 1 && selectedNodeIds.length === 0 && selectedElemIds.length === 0
                      ? `Okładzina O${selectedPanelIds[0]} (${selectedPanels[0]?.shape === 'triangle' ? 'trójkątna' : 'prostokątna'}, W${selectedPanels[0]?.nodeIds.join(', W')})`
                      : [
                          selectedNodeIds.length ? pluralUnit(selectedNodeIds.length, 'węzeł', 'węzły', 'węzłów') : null,
                          selectedElemIds.length ? pluralUnit(selectedElemIds.length, 'pręt', 'pręty', 'prętów') : null,
                          selectedPanelIds.length ? pluralUnit(selectedPanelIds.length, 'okładzina', 'okładziny', 'okładzin') : null,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                  </div>
                </div>

                {/* Wspólne przyciski operacji */}
                <div ref={transformBtnRef} className="btnrow" style={{ marginTop: '6px', gap: '4px', flexWrap: 'wrap' }}>
                  <button
                    className="mini mini-icon danger"
                    onClick={handleDeleteSelected}
                    title="Usuń zaznaczone obiekty (Delete / Backspace)"
                  >
                    {ICONS.del}
                  </button>
                  <button
                    className={`mini mini-icon ${activeTransformMode === 'move' ? 'on' : ''}`}
                    onClick={() => {
                      if (activeTransformMode === 'move') {
                        if (setActiveTransformMode) setActiveTransformMode('none');
                        if (onCancelPickMode) onCancelPickMode();
                      } else {
                        if (setActiveTransformMode) setActiveTransformMode('move');
                        if (splitFormOpen) setSplitFormOpen(false);
                      }
                    }}
                    title="Przenieś lub kopiuj zaznaczone obiekty"
                  >
                    {ICONS.moveNode}
                  </button>
                  <button
                    className={`mini mini-icon ${activeTransformMode === 'rotate' ? 'on' : ''}`}
                    onClick={() => {
                      if (activeTransformMode === 'rotate') {
                        if (setActiveTransformMode) setActiveTransformMode('none');
                        if (onCancelPickMode) onCancelPickMode();
                      } else {
                        if (setActiveTransformMode) setActiveTransformMode('rotate');
                        if (splitFormOpen) setSplitFormOpen(false);
                      }
                    }}
                    title="Obróć zaznaczone obiekty"
                  >
                    {ICONS.rotate}
                  </button>
                  <button
                    className={`mini mini-icon ${activeTransformMode === 'mirror' ? 'on' : ''}`}
                    onClick={() => {
                      if (activeTransformMode === 'mirror') {
                        if (setActiveTransformMode) setActiveTransformMode('none');
                        if (onCancelPickMode) onCancelPickMode();
                      } else {
                        if (setActiveTransformMode) setActiveTransformMode('mirror');
                        if (splitFormOpen) setSplitFormOpen(false);
                      }
                    }}
                    title="Lustrzane odbicie zaznaczonych obiektów"
                  >
                    {ICONS.mirror}
                  </button>
                  <button
                    className={`mini mini-icon ${activeTransformMode === 'scale' ? 'on' : ''}`}
                    onClick={() => {
                      if (activeTransformMode === 'scale') {
                        if (setActiveTransformMode) setActiveTransformMode('none');
                        if (onCancelPickMode) onCancelPickMode();
                      } else {
                        if (setActiveTransformMode) setActiveTransformMode('scale');
                        if (splitFormOpen) setSplitFormOpen(false);
                      }
                    }}
                    title="Skaluj zaznaczone obiekty"
                  >
                    {ICONS.scale}
                  </button>
                  {selectedElemIds.length > 0 && (
                    <button
                      className={`mini mini-icon ${splitFormOpen ? 'on' : ''}`}
                      onClick={() => {
                        setSplitFormOpen(!splitFormOpen);
                        if (activeTransformMode !== 'none') {
                          if (setActiveTransformMode) setActiveTransformMode('none');
                          if (onCancelPickMode) onCancelPickMode();
                        }
                      }}
                      title="Podziel zaznaczone pręty"
                    >
                      {ICONS.splitBar}
                    </button>
                  )}
                  {selectedElemIds.length >= 2 && (
                    <button
                      className="mini mini-icon"
                      onClick={handleFindIntersections}
                      title="Znajdź punkty przecięcia zaznaczonych prętów i podziel je w tych miejscach"
                    >
                      {ICONS.intersect}
                    </button>
                  )}
                </div>

                {/* Unified Formularz Transformacji (Przenieś, Obróć, Lustro, Skaluj) */}
                {activeTransformMode !== 'none' && (
                  <div
                    ref={transformCardRef}
                    className="card"
                    style={{
                      marginTop: '10px',
                      background: 'var(--surface)',
                      borderColor: 'var(--input-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text)' }}>
                        {activeTransformMode === 'move' && 'Opcje przenoszenia'}
                        {activeTransformMode === 'rotate' && 'Opcje obrotu'}
                        {activeTransformMode === 'mirror' && 'Opcje lustrzanego odbicia'}
                        {activeTransformMode === 'scale' && 'Opcje skalowania'}
                      </span>
                    </div>

                    <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ margin: 0 }}>Tryb</label>
                      <div className="btnrow" style={{ margin: 0, gap: '4px' }}>
                        <button
                          type="button"
                          className={`mini ${!transformWithCopy ? 'on' : ''}`}
                          style={{ padding: '3px 8px', fontSize: '10.5px' }}
                          onClick={() => setTransformWithCopy(false)}
                        >
                          {activeTransformMode === 'move' && 'Przesuń'}
                          {activeTransformMode === 'rotate' && 'Obróć'}
                          {activeTransformMode === 'mirror' && 'Odbij'}
                          {activeTransformMode === 'scale' && 'Skaluj'}
                        </button>
                        <button
                          type="button"
                          className={`mini ${transformWithCopy ? 'on' : ''}`}
                          style={{ padding: '3px 8px', fontSize: '10.5px' }}
                          onClick={() => setTransformWithCopy(true)}
                        >
                          Z kopiowaniem
                        </button>
                      </div>
                    </div>

                    {transformWithCopy && (
                      <>
                        <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <label style={{ margin: 0 }} title="Łączy stary węzeł z nowym węzłem nowym prętem">Połącz</label>
                          <button
                            type="button"
                            className={`mini ${transformConnect ? 'on' : ''}`}
                            style={{ padding: '3px 8px', fontSize: '10.5px' }}
                            onClick={() => setTransformConnect(!transformConnect)}
                            title="Łączy węzły prętami o przekroju i materiale z paska"
                          >
                            {transformConnect ? 'Połącz: WŁ' : 'Połącz: WYŁ'}
                          </button>
                        </div>
                        {activeTransformMode !== 'mirror' && (
                          <div className="row" style={{ marginBottom: '8px' }}>
                            <label>Wielokrotność</label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                min={1}
                                max={50}
                                step="1"
                                value={transformRepeat}
                                onChange={(v) => setTransformRepeat(Math.max(1, Math.round(v)))}
                              />
                              <span className="unit">×</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Mode specific fields */}
                    {activeTransformMode === 'move' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span className="muted" style={{ fontSize: '10px' }}>
                            Wektor przeniesienia (krok):
                          </span>
                          <button
                            type="button"
                            className={`mini ${pickMoveVectorActive ? 'on' : ''}`}
                            style={{ padding: '2px 7px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={pickMoveVectorActive ? onCancelPickMode : onStartPickMoveVector}
                            title="Wskaż wektor na modelu (kliknij 2 punkty: początek i koniec)"
                          >
                            {pickMoveVectorActive
                              ? (pickMoveVectorStep === 1 ? 'Wskaż P1 (1/2)...' : 'Wskaż P2 (2/2)...')
                              : 'Wskaż wektor'}
                          </button>
                        </div>
                        {pickMoveVectorActive && (
                          <div style={{ marginBottom: '6px', fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                            {pickMoveVectorStep === 1
                              ? 'Kliknij na modelu punkt początkowy P1...'
                              : 'Kliknij na modelu punkt końcowy P2 (ruch myszą pokazuje podgląd)...'}
                          </div>
                        )}
                        <div className="row-triple">
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                              Δx
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput step="0.5" value={moveDx} onChange={(v) => setMoveDx(v)} />
                              <span className="unit">m</span>
                            </div>
                          </div>
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
                              Δy
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput step="0.5" value={moveDy} onChange={(v) => setMoveDy(v)} />
                              <span className="unit">m</span>
                            </div>
                          </div>
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                              Δz
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput step="0.5" value={moveDz} onChange={(v) => setMoveDz(v)} />
                              <span className="unit">m</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {activeTransformMode === 'rotate' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span className="muted" style={{ fontSize: '10px' }}>
                            Środek obrotu:
                          </span>
                          <button
                            type="button"
                            className={`mini ${pickTransformPointActive && pickTransformPointTarget === 'rotateCenter' ? 'on' : ''}`}
                            style={{ padding: '2px 7px', fontSize: '10px' }}
                            onClick={() => {
                              if (pickTransformPointActive && pickTransformPointTarget === 'rotateCenter') {
                                onCancelPickMode();
                              } else {
                                onStartPickPoint('rotateCenter');
                              }
                            }}
                            title="Wskaż środek obrotu na modelu"
                          >
                            {pickTransformPointActive && pickTransformPointTarget === 'rotateCenter'
                              ? 'Wskaż na modelu...'
                              : 'Wskaż środek'}
                          </button>
                        </div>
                        {pickTransformPointActive && pickTransformPointTarget === 'rotateCenter' && (
                          <div style={{ marginBottom: '6px', fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                            Kliknij na modelu węzeł lub punkt siatki...
                          </div>
                        )}
                        <div className="row-triple" style={{ marginBottom: '8px' }}>
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                              Cx
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput step="0.5" value={rotateCx} onChange={(v) => setRotateCx(v)} />
                              <span className="unit">m</span>
                            </div>
                          </div>
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
                              Cy
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput step="0.5" value={rotateCy} onChange={(v) => setRotateCy(v)} />
                              <span className="unit">m</span>
                            </div>
                          </div>
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                              Cz
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput step="0.5" value={rotateCz} onChange={(v) => setRotateCz(v)} />
                              <span className="unit">m</span>
                            </div>
                          </div>
                        </div>

                        <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <label style={{ margin: 0 }}>Oś obrotu</label>
                          <div className="btnrow" style={{ margin: 0, gap: '4px' }}>
                            {(['X', 'Y', 'Z'] as const).map((axis) => (
                              <button
                                key={axis}
                                type="button"
                                className={`mini ${rotateAxis === axis ? 'on' : ''}`}
                                style={{ padding: '3px 10px', fontSize: '10.5px' }}
                                onClick={() => setRotateAxis(axis)}
                              >
                                {axis}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="row">
                          <label>Kąt obrotu</label>
                          <div className="inp-unit">
                            <SmartNumberInput step="15" value={rotateAngle} onChange={(v) => setRotateAngle(v)} />
                            <span className="unit">°</span>
                          </div>
                        </div>

                        <div className="checkline" style={{ marginTop: '8px', marginBottom: '2px' }}>
                          <input
                            type="checkbox"
                            id="chkRotateLoads"
                            checked={transformLoads}
                            onChange={(e) => setTransformLoads(e.target.checked)}
                          />
                          <label htmlFor="chkRotateLoads" style={{ cursor: 'pointer', userSelect: 'none', fontSize: '11px' }}>
                            Obróć obciążenia i wymuszenia
                          </label>
                        </div>
                      </>
                    )}

                    {activeTransformMode === 'mirror' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span className="muted" style={{ fontSize: '10px' }}>
                            Punkt płaszczyzny odbicia:
                          </span>
                          <button
                            type="button"
                            className={`mini ${pickTransformPointActive && pickTransformPointTarget === 'mirrorPoint' ? 'on' : ''}`}
                            style={{ padding: '2px 7px', fontSize: '10px' }}
                            onClick={() => {
                              if (pickTransformPointActive && pickTransformPointTarget === 'mirrorPoint') {
                                onCancelPickMode();
                              } else {
                                onStartPickPoint('mirrorPoint');
                              }
                            }}
                            title="Wskaż punkt płaszczyzny na modelu"
                          >
                            {pickTransformPointActive && pickTransformPointTarget === 'mirrorPoint'
                              ? 'Wskaż na modelu...'
                              : 'Wskaż punkt'}
                          </button>
                        </div>
                        {pickTransformPointActive && pickTransformPointTarget === 'mirrorPoint' && (
                          <div style={{ marginBottom: '6px', fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                            Kliknij na modelu węzeł lub punkt siatki...
                          </div>
                        )}
                        <div className="row-triple" style={{ marginBottom: '8px' }}>
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                              Px
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput step="0.5" value={mirrorPx} onChange={(v) => setMirrorPx(v)} />
                              <span className="unit">m</span>
                            </div>
                          </div>
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
                              Py
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput step="0.5" value={mirrorPy} onChange={(v) => setMirrorPy(v)} />
                              <span className="unit">m</span>
                            </div>
                          </div>
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                              Pz
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput step="0.5" value={mirrorPz} onChange={(v) => setMirrorPz(v)} />
                              <span className="unit">m</span>
                            </div>
                          </div>
                        </div>

                        <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
                          <label style={{ margin: 0 }}>Płaszczyzna</label>
                          <div className="btnrow" style={{ margin: 0, gap: '4px' }}>
                            {(['XY', 'YZ', 'XZ'] as const).map((plane) => (
                              <button
                                key={plane}
                                type="button"
                                className={`mini ${mirrorPlane === plane ? 'on' : ''}`}
                                style={{ padding: '3px 8px', fontSize: '10.5px' }}
                                onClick={() => setMirrorPlane(plane)}
                              >
                                {plane}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="checkline" style={{ marginTop: '8px', marginBottom: '2px' }}>
                          <input
                            type="checkbox"
                            id="chkMirrorLoads"
                            checked={transformLoads}
                            onChange={(e) => setTransformLoads(e.target.checked)}
                          />
                          <label htmlFor="chkMirrorLoads" style={{ cursor: 'pointer', userSelect: 'none', fontSize: '11px' }}>
                            Odwróć obciążenia i wymuszenia
                          </label>
                        </div>
                      </>
                    )}

                    {activeTransformMode === 'scale' && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span className="muted" style={{ fontSize: '10px' }}>
                            Środek skalowania:
                          </span>
                          <button
                            type="button"
                            className={`mini ${pickTransformPointActive && pickTransformPointTarget === 'scaleCenter' ? 'on' : ''}`}
                            style={{ padding: '2px 7px', fontSize: '10px' }}
                            onClick={() => {
                              if (pickTransformPointActive && pickTransformPointTarget === 'scaleCenter') {
                                onCancelPickMode();
                              } else {
                                onStartPickPoint('scaleCenter');
                              }
                            }}
                            title="Wskaż środek skalowania na modelu"
                          >
                            {pickTransformPointActive && pickTransformPointTarget === 'scaleCenter'
                              ? 'Wskaż na modelu...'
                              : 'Wskaż środek'}
                          </button>
                        </div>
                        {pickTransformPointActive && pickTransformPointTarget === 'scaleCenter' && (
                          <div style={{ marginBottom: '6px', fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                            Kliknij na modelu węzeł lub punkt siatki...
                          </div>
                        )}
                        <div className="row-triple" style={{ marginBottom: '8px' }}>
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                              Cx
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput step="0.5" value={scaleCx} onChange={(v) => setScaleCx(v)} />
                              <span className="unit">m</span>
                            </div>
                          </div>
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
                              Cy
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput step="0.5" value={scaleCy} onChange={(v) => setScaleCy(v)} />
                              <span className="unit">m</span>
                            </div>
                          </div>
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                              Cz
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput step="0.5" value={scaleCz} onChange={(v) => setScaleCz(v)} />
                              <span className="unit">m</span>
                            </div>
                          </div>
                        </div>

                        <div className="row">
                          <label>Skala</label>
                          <div className="inp-unit">
                            <SmartNumberInput step="0.1" min={0.01} max={100} value={scaleFactor} onChange={(v) => setScaleFactor(v)} />
                            <span className="unit">×</span>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="btnrow" style={{ marginTop: '10px', justifyContent: 'flex-end', gap: '6px' }}>
                      <button className="mini" onClick={() => { if (setActiveTransformMode) setActiveTransformMode('none'); if (onCancelPickMode) onCancelPickMode(); }}>
                        Anuluj
                      </button>
                      <button className="mini on" onClick={() => confirmTransform(activeTransformMode as 'move' | 'rotate' | 'mirror' | 'scale')}>
                        {activeTransformMode === 'move' && (transformWithCopy ? (transformRepeat > 1 ? `Kopiuj (${transformRepeat}×)` : 'Kopiuj') : 'Przenieś')}
                        {activeTransformMode === 'rotate' && (transformWithCopy ? (transformRepeat > 1 ? `Kopiuj i obróć (${transformRepeat}×)` : 'Kopiuj i obróć') : 'Obróć')}
                        {activeTransformMode === 'mirror' && (transformWithCopy ? 'Kopiuj z odbiciem' : 'Lustrzane odbicie')}
                        {activeTransformMode === 'scale' && (transformWithCopy ? (transformRepeat > 1 ? `Kopiuj i skaluj (${transformRepeat}×)` : 'Kopiuj i skaluj') : 'Skaluj')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Formularz Podziału */}
                {splitFormOpen && selectedElemIds.length > 0 && (() => {
                  const singleSelectedEl = selectedElements.length === 1 ? selectedElements[0] : null;
                  const singleElN1 = singleSelectedEl ? getNode(singleSelectedEl.n1) : null;
                  const singleElN2 = singleSelectedEl ? getNode(singleSelectedEl.n2) : null;
                  const singleElLen = singleElN1 && singleElN2
                    ? Math.hypot(singleElN2.x - singleElN1.x, singleElN2.y - singleElN1.y, singleElN2.z - singleElN1.z)
                    : null;

                  return (
                    <div
                      className="card"
                      style={{
                        marginTop: '10px',
                        background: 'var(--surface)',
                        borderColor: 'var(--input-border)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 600, fontSize: '11px', color: 'var(--text)' }}>
                          {selectedElements.length > 1 ? `Podział (${selectedElements.length} prętów)` : `Podział pręta P${selectedElements[0]?.id}`}
                        </span>
                      </div>

                      <div className="btnrow" style={{ marginBottom: '8px' }}>
                        <button
                          type="button"
                          className={`mini ${splitMode === 'single' ? 'on' : ''}`}
                          style={{ flex: 1 }}
                          onClick={() => setSplitMode('single')}
                        >
                          Pojedynczy podział
                        </button>
                        <button
                          type="button"
                          className={`mini ${splitMode === 'multi' ? 'on' : ''}`}
                          style={{ flex: 1 }}
                          onClick={() => setSplitMode('multi')}
                        >
                          Podział na N części
                        </button>
                      </div>

                      {splitMode === 'single' ? (
                        <>
                          <div style={{ marginBottom: '6px' }}>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginBottom: '4px', fontWeight: 600 }}>
                              Szybki wybór punktu cięcia:
                            </div>
                            <div className="btnrow" style={{ gap: '4px' }}>
                              {[
                                { label: '1/2 (50%)', val: 0.5 },
                                { label: '1/3 (33%)', val: 0.333333 },
                                { label: '2/3 (67%)', val: 0.666667 },
                                { label: '1/4 (25%)', val: 0.25 },
                                { label: '3/4 (75%)', val: 0.75 },
                              ].map((preset) => (
                                <button
                                  key={preset.label}
                                  type="button"
                                  className={`mini ${Math.abs(splitT - preset.val) < 0.01 ? 'on' : ''}`}
                                  style={{ padding: '2px 5px', fontSize: '10px', flex: 1 }}
                                  onClick={() => setSplitT(preset.val)}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="row">
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flex: '0 0 auto' }}>
                              <span>Współczynnik t</span>
                              <button
                                type="button"
                                className="mini"
                                style={{ padding: '2px 6px', fontSize: '10.5px', height: '22px', whiteSpace: 'nowrap' }}
                                title="Odwróć kierunek pomiaru t (1 - t)"
                                onClick={() => setSplitT(Math.max(0.01, Math.min(0.99, Math.round((1 - splitT) * 1000) / 1000)))}
                              >
                                ⇄ 1 - t
                              </button>
                            </label>
                            <SmartNumberInput
                              min={0.01}
                              max={0.99}
                              step="0.05"
                              value={splitT}
                              onChange={(v) => setSplitT(Math.max(0.01, Math.min(0.99, v)))}
                            />
                          </div>

                          {/* Szczegóły podziału w pojedynczym trybie */}
                          <div
                            style={{
                              marginTop: '6px',
                              padding: '6px 8px',
                              borderRadius: '4px',
                              background: 'var(--surface)',
                              fontSize: '10.5px',
                              lineHeight: '1.4',
                              border: '1px solid var(--surface-border-soft)',
                            }}
                          >
                            {singleElLen != null && singleElN1 && singleElN2 ? (
                              <>
                                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
                                  Długość pręta: {singleElLen.toFixed(2)} m
                                </div>
                                <div style={{ color: '#2563eb', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>• Część 1 (od W{singleElN1.id}):</span>
                                  <strong>{(splitT * singleElLen).toFixed(2)} m ({Math.round(splitT * 100)}%)</strong>
                                </div>
                                <div style={{ color: '#059669', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>• Część 2 (do W{singleElN2.id}):</span>
                                  <strong>{((1 - splitT) * singleElLen).toFixed(2)} m ({Math.round((1 - splitT) * 100)}%)</strong>
                                </div>
                              </>
                            ) : (
                              <div style={{ color: 'var(--text-dim)' }}>
                                Podział {selectedElements.length} prętów w proporcji <strong>{(splitT * 100).toFixed(0)}% / {((1 - splitT) * 100).toFixed(0)}%</strong> (+{selectedElements.length} nowych węzłów).
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={{ marginBottom: '6px' }}>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', marginBottom: '4px', fontWeight: 600 }}>
                              Szybka liczba odcinków:
                            </div>
                            <div className="btnrow" style={{ gap: '4px' }}>
                              {[2, 3, 4, 5, 6, 10].map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  className={`mini ${splitN === num ? 'on' : ''}`}
                                  style={{ padding: '2px 6px', fontSize: '10px', flex: 1 }}
                                  onClick={() => setSplitN(num)}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="row">
                            <label>Liczba części</label>
                            <SmartNumberInput
                              min={2}
                              max={50}
                              step="1"
                              value={splitN}
                              onChange={(v) => setSplitN(Math.max(2, Math.min(50, Math.round(v))))}
                            />
                          </div>

                          {/* Szczegóły podziału na N części */}
                          <div
                            style={{
                              marginTop: '6px',
                              padding: '6px 8px',
                              borderRadius: '4px',
                              background: 'var(--surface)',
                              fontSize: '10.5px',
                              lineHeight: '1.4',
                              border: '1px solid var(--surface-border-soft)',
                            }}
                          >
                            {singleElLen != null ? (
                              <>
                                <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
                                  Długość pręta: {singleElLen.toFixed(2)} m
                                </div>
                                <div style={{ color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>• Długość każdego odcinka:</span>
                                  <strong>{(singleElLen / splitN).toFixed(2)} m</strong>
                                </div>
                                <div style={{ color: '#ef4444', display: 'flex', justifyContent: 'space-between' }}>
                                  <span>• Nowe węzły:</span>
                                  <strong>+{splitN - 1}</strong>
                                </div>
                              </>
                            ) : (
                              <div style={{ color: 'var(--text-dim)' }}>
                                Każdy z {selectedElements.length} prętów zostanie podzielony na {splitN} równych części (łącznie <strong>+{selectedElements.length * (splitN - 1)}</strong> nowych węzłów).
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      <div className="btnrow" style={{ marginTop: '10px', justifyContent: 'flex-end', gap: '6px' }}>
                        <button className="mini" onClick={() => setSplitFormOpen(false)}>
                          Anuluj
                        </button>
                        <button className="mini on" onClick={() => confirmSplit('__bulk__')}>
                          {selectedElements.length > 1 ? `Podziel (${selectedElements.length} pręty)` : 'Podziel pręt'}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* GRUPA WĘZŁY (gdy zaznaczony przynajmniej jeden węzeł) */}
            {selectedNodeIds.length > 0 && (
              <div className="sidebar-group">
                <div className="group-header" onClick={() => setNodesGroupCollapsed(!nodesGroupCollapsed)}>
                  <div className="group-title">
                    <span>Węzły</span>
                    <span className="group-tag">
                      {selectedNodeIds.length > 1 ? `${selectedNodeIds.length} zaznaczone` : `W${selectedNodeIds[0]}`}
                    </span>
                  </div>
                  <span className="subtle-icon">{nodesGroupCollapsed ? '▸' : '▾'}</span>
                </div>
                {!nodesGroupCollapsed && (
                  <div className="group-body">
                    <div className="panel">
                      <h3>
                        {selectedNodeIds.length > 1
                          ? `Węzły (${selectedNodeIds.length}): ${selectedNodeIds.map((id) => 'W' + id).join(', ')}`
                          : `Węzeł W${selectedNodeIds[0]}`}
                      </h3>

                      {singleNode ? (
                        <div className="row-triple">
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                              X
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="0.1"
                                value={singleNode.x}
                                onFocus={onInvalidateResults}
                                onChange={(v) => updateNodeCoord('x', v, false)}
                                onCommit={(v) => updateNodeCoord('x', v, true)}
                              />
                              <span className="unit">m</span>
                            </div>
                          </div>
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
                              Y
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="0.1"
                                value={singleNode.y}
                                onFocus={onInvalidateResults}
                                onChange={(v) => updateNodeCoord('y', v, false)}
                                onCommit={(v) => updateNodeCoord('y', v, true)}
                              />
                              <span className="unit">m</span>
                            </div>
                          </div>
                          <div className="third">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                              Z
                            </label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="0.1"
                                value={singleNode.z}
                                onFocus={onInvalidateResults}
                                onChange={(v) => updateNodeCoord('z', v, false)}
                                onCommit={(v) => updateNodeCoord('z', v, true)}
                              />
                              <span className="unit">m</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="muted">Aby edytować współrzędne X/Y/Z, zaznacz pojedynczy węzeł.</div>
                      )}
                    </div>

                    {/* PODPORA 3D */}
                    <div className="panel">
                      <h3>Podpora</h3>
                      <div className="btnrow">
                        <button
                          className={`mini mini-icon ${selectedNodes.length > 0 && selectedNodes.every((n) => presetMatches(n, 'none')) ? 'on' : ''}`}
                          onClick={() => applySupportPreset('none')}
                          title="Brak podpory"
                        >
                          {ICONS.supNone}
                        </button>
                        <button
                          className={`mini mini-icon ${selectedNodes.length > 0 && selectedNodes.every((n) => presetMatches(n, 'fixed')) ? 'on' : ''}`}
                          onClick={() => applySupportPreset('fixed')}
                          title="Utwierdzenie (Ux, Uy, Uz, Rx, Ry, Rz)"
                        >
                          {ICONS.supFixed}
                        </button>
                        <button
                          className={`mini mini-icon ${selectedNodes.length > 0 && selectedNodes.every((n) => presetMatches(n, 'pin')) ? 'on' : ''}`}
                          onClick={() => applySupportPreset('pin')}
                          title="Podpora przegubowo-stała (Ux, Uy, Uz)"
                        >
                          {ICONS.supPin}
                        </button>
                        <button
                          className={`mini mini-icon ${selectedNodes.length > 0 && selectedNodes.every((n) => presetMatches(n, 'rollerZ')) ? 'on' : ''}`}
                          onClick={() => applySupportPreset('rollerZ')}
                          title="Podpora przesuwna pozioma XY (blokuje Uz)"
                        >
                          {ICONS.supRollH}
                        </button>
                        <button
                          className={`mini mini-icon ${selectedNodes.length > 0 && selectedNodes.every((n) => presetMatches(n, 'rollerX')) ? 'on' : ''}`}
                          onClick={() => applySupportPreset('rollerX')}
                          title="Podpora przesuwna YZ (blokuje Ux)"
                        >
                          {ICONS.supRollV}
                        </button>
                        <button
                          className={`mini mini-icon ${selectedNodes.length > 0 && selectedNodes.every((n) => presetMatches(n, 'guideZ')) ? 'on' : ''}`}
                          onClick={() => applySupportPreset('guideZ')}
                          title="Łyżwa / prowadzenie Z (blokuje Ux, Uy, Rz)"
                        >
                          {ICONS.supGuideV}
                        </button>
                      </div>

                      <hr className="sep" />

                      <div className="row-pair" style={{ marginBottom: '8px' }}>
                        <div className="half">
                          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', fontWeight: 700, borderBottom: '1px solid var(--surface-border-soft)', paddingBottom: '3px' }}>
                            Przesuwy (Translacja)
                          </div>
                        </div>
                        <div className="half">
                          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', fontWeight: 700, borderBottom: '1px solid var(--surface-border-soft)', paddingBottom: '3px' }}>
                            Obroty (Rotacja)
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {([
                          { trans: 'ux', rot: 'rx', transLabel: 'Ux', rotLabel: 'Rx', transUnit: 'mm', rotUnit: '°', transSpringUnit: 'kN/m', rotSpringUnit: 'kNm/rad' },
                          { trans: 'uy', rot: 'ry', transLabel: 'Uy', rotLabel: 'Ry', transUnit: 'mm', rotUnit: '°', transSpringUnit: 'kN/m', rotSpringUnit: 'kNm/rad' },
                          { trans: 'uz', rot: 'rz', transLabel: 'Uz', rotLabel: 'Rz', transUnit: 'mm', rotUnit: '°', transSpringUnit: 'kN/m', rotSpringUnit: 'kNm/rad' }
                        ] as const).map(({ trans, rot, transLabel, rotLabel, transUnit, rotUnit, transSpringUnit, rotSpringUnit }, idx) => {
                          const transTypes = selectedNodes.map((n) => n.support?.[trans]?.type || 'free');
                          const transAllSame = transTypes.every((t) => t === transTypes[0]);
                          const transType = transAllSame ? transTypes[0] : 'mixed';
                          const transK = commonVal(selectedNodes, (n) => n.support?.[trans]?.k ?? 1000);
                          const transDelta = commonVal(selectedNodes, (n) => n.support?.[trans]?.delta ?? 0);
                          const transColor = trans.includes('x') ? '#ef4444' : trans.includes('y') ? '#22c55e' : '#3b82f6';

                          const rotTypes = selectedNodes.map((n) => n.support?.[rot]?.type || 'free');
                          const rotAllSame = rotTypes.every((t) => t === rotTypes[0]);
                          const rotType = rotAllSame ? rotTypes[0] : 'mixed';
                          const rotK = commonVal(selectedNodes, (n) => n.support?.[rot]?.k ?? 1000);
                          const rotDelta = commonVal(selectedNodes, (n) => n.support?.[rot]?.delta ?? 0);
                          const rotColor = rot.includes('x') ? '#ef4444' : rot.includes('y') ? '#22c55e' : '#3b82f6';

                          const transShowExtra = transType === 'fixed' || transType === 'spring';
                          const rotShowExtra = rotType === 'fixed' || rotType === 'spring';
                          const showExtraRow = transShowExtra || rotShowExtra;

                          const selectStyle: React.CSSProperties = {
                            width: '82px',
                            padding: '3px 4px',
                            fontSize: '11.5px',
                            height: '26px',
                            border: '1px solid var(--input-border)',
                            borderRadius: '5px',
                            background: 'var(--input-bg)',
                            color: 'var(--text)',
                            fontFamily: 'var(--sans)'
                          };

                          return (
                            <div
                              key={trans}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                paddingBottom: '8px',
                                borderBottom: idx < 2 ? '1px dashed var(--surface-border-soft)' : 'none'
                              }}
                            >
                              {/* 1. Selector Row */}
                              <div className="row-pair" style={{ marginBottom: showExtraRow ? '4px' : '0' }}>
                                <div className="half" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        backgroundColor: transColor,
                                        flexShrink: 0
                                      }}
                                    />
                                    {transLabel}
                                  </label>
                                  <select
                                    style={selectStyle}
                                    value={transType}
                                    onChange={(e) => updateSupportDir(trans, 'type', e.target.value)}
                                  >
                                    {transType === 'mixed' && (
                                      <option value="mixed" disabled hidden>— różne —</option>
                                    )}
                                    <option value="free">Swobodny</option>
                                    <option value="fixed">Sztywny</option>
                                    <option value="spring">Sprężysty</option>
                                  </select>
                                </div>

                                <div className="half" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        backgroundColor: rotColor,
                                        flexShrink: 0
                                      }}
                                    />
                                    {rotLabel}
                                  </label>
                                  <select
                                    style={selectStyle}
                                    value={rotType}
                                    onChange={(e) => updateSupportDir(rot, 'type', e.target.value)}
                                  >
                                    {rotType === 'mixed' && (
                                      <option value="mixed" disabled hidden>— różne —</option>
                                    )}
                                    <option value="free">Swobodny</option>
                                    <option value="fixed">Sztywny</option>
                                    <option value="spring">Sprężysty</option>
                                  </select>
                                </div>
                              </div>

                              {/* 2. Extra Inputs Row with exact height-matching for alignment */}
                              {showExtraRow && (
                                <div className="row-pair" style={{ alignItems: 'center' }}>
                                  <div className="half">
                                    {transType === 'fixed' && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', width: '100%' }}>
                                        <span style={{ fontSize: '9px', color: 'var(--text-dim)', whiteSpace: 'nowrap', width: '24px' }}>Wym:</span>
                                        <div className="inp-unit" style={{ flex: 1 }}>
                                          <SmartNumberInput
                                            step="1"
                                            value={transDelta}
                                            placeholder="0"
                                            onChange={(v) => updateSupportDir(trans, 'delta', v)}
                                          />
                                          <span className="unit">{transUnit}</span>
                                        </div>
                                      </div>
                                    )}
                                    {transType === 'spring' && (
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: '4px', width: '100%', alignItems: 'center' }}>
                                        <SmartNumberInput
                                          step="50"
                                          value={transK}
                                          placeholder="k"
                                          onChange={(v) => updateSupportDir(trans, 'k', v)}
                                        />
                                        <span className="unit" style={{ fontSize: '9px' }} title={`Sztywność sprężyny (${transSpringUnit})`}>{transSpringUnit}</span>
                                        <SmartNumberInput
                                          step="1"
                                          value={transDelta}
                                          placeholder="Δ"
                                          onChange={(v) => updateSupportDir(trans, 'delta', v)}
                                        />
                                        <span className="unit" title="Wymuszenie / osiadanie">{transUnit}</span>
                                      </div>
                                    )}
                                    {transType !== 'fixed' && transType !== 'spring' && (
                                      <div style={{ height: '26px' }} />
                                    )}
                                  </div>

                                  <div className="half">
                                    {rotType === 'fixed' && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', width: '100%' }}>
                                        <span style={{ fontSize: '9px', color: 'var(--text-dim)', whiteSpace: 'nowrap', width: '24px' }}>Wym:</span>
                                        <div className="inp-unit" style={{ flex: 1 }}>
                                          <SmartNumberInput
                                            step="0.5"
                                            value={rotDelta}
                                            placeholder="0"
                                            onChange={(v) => updateSupportDir(rot, 'delta', v)}
                                          />
                                          <span className="unit">{rotUnit}</span>
                                        </div>
                                      </div>
                                    )}
                                    {rotType === 'spring' && (
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: '4px', width: '100%', alignItems: 'center' }}>
                                        <SmartNumberInput
                                          step="50"
                                          value={rotK}
                                          placeholder="k"
                                          onChange={(v) => updateSupportDir(rot, 'k', v)}
                                        />
                                        <span className="unit" style={{ fontSize: '8.5px' }} title={`Sztywność sprężyny obrotowej (${rotSpringUnit})`}>{rotSpringUnit}</span>
                                        <SmartNumberInput
                                          step="0.5"
                                          value={rotDelta}
                                          placeholder="Δ"
                                          onChange={(v) => updateSupportDir(rot, 'delta', v)}
                                        />
                                        <span className="unit" title="Wymuszenie obrotu">{rotUnit}</span>
                                      </div>
                                    )}
                                    {rotType !== 'fixed' && rotType !== 'spring' && (
                                      <div style={{ height: '26px' }} />
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {selectedNodes.some((n) => !!n.support) && (
                        <>
                          <hr className="sep" />
                          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', fontWeight: 700, marginBottom: '6px' }}>
                            Obrót podpory
                          </div>
                          <div className="row-triple">
                            <div className="third">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                                Wokół X
                              </label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="5"
                                  value={commonVal(selectedNodes, (n) => n.support?.rotX ?? 0)}
                                  placeholder="0"
                                  onChange={(v) => updateSupportRotation('rotX', v)}
                                />
                                <span className="unit">°</span>
                              </div>
                            </div>
                            <div className="third">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
                                Wokół Y
                              </label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="5"
                                  value={commonVal(selectedNodes, (n) => n.support?.rotY ?? 0)}
                                  placeholder="0"
                                  onChange={(v) => updateSupportRotation('rotY', v)}
                                />
                                <span className="unit">°</span>
                              </div>
                            </div>
                            <div className="third">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                                Wokół Z
                              </label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="5"
                                  value={commonVal(selectedNodes, (n) => n.support?.rotZ ?? 0)}
                                  placeholder="0"
                                  onChange={(v) => updateSupportRotation('rotZ', v)}
                                />
                                <span className="unit">°</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* SIŁY SKUPIONE 3D */}
                    {(() => {
                      const curFx = commonVal(selectedNodes, (n) => n.force?.Fx ?? 0);
                      const curFy = commonVal(selectedNodes, (n) => n.force?.Fy ?? 0);
                      const curFz = commonVal(selectedNodes, (n) => n.force?.Fz ?? 0);

                      const hasNodeForce = selectedNodes.some(
                        (n) =>
                          n.force &&
                          (Math.abs(n.force.Fx || 0) > 1e-6 ||
                            Math.abs(n.force.Fy || 0) > 1e-6 ||
                            Math.abs(n.force.Fz || 0) > 1e-6)
                      );

                      const clearNodeForces = () => {
                        setNodes((prev) =>
                          prev.map((n) => (selectedNodeIds.includes(n.id) ? { ...n, force: null } : n))
                        );
                        onInvalidateResults();
                      };

                      return (
                        <div className="panel">
                          <div className="row" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
                            <h3 style={{ margin: 0 }}>Siły skupione</h3>
                            {hasNodeForce && (
                              <button
                                type="button"
                                className="mini danger"
                                style={{ fontSize: '10px', padding: '2px 6px' }}
                                onClick={clearNodeForces}
                                title="Wyczyść siły skupione z zaznaczonych węzłów"
                              >
                                Wyczyść
                              </button>
                            )}
                          </div>
                          <div className="row-triple">
                            <div className="third">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                                Fx
                              </label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curFx}
                                  placeholder={selectedNodes.length > 1 && curFx === undefined ? 'różne' : undefined}
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => updateNodeForce('Fx', v)}
                                />
                                <span className="unit">kN</span>
                              </div>
                            </div>
                            <div className="third">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
                                Fy
                              </label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curFy}
                                  placeholder={selectedNodes.length > 1 && curFy === undefined ? 'różne' : undefined}
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => updateNodeForce('Fy', v)}
                                />
                                <span className="unit">kN</span>
                              </div>
                            </div>
                            <div className="third">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                                Fz
                              </label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curFz}
                                  placeholder={selectedNodes.length > 1 && curFz === undefined ? 'różne' : undefined}
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => updateNodeForce('Fz', v)}
                                />
                                <span className="unit">kN</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* MOMENTY SKUPIONE 3D */}
                    {(() => {
                      const curMx = commonVal(selectedNodes, (n) => n.moment?.Mx ?? 0);
                      const curMy = commonVal(selectedNodes, (n) => n.moment?.My ?? 0);
                      const curMz = commonVal(selectedNodes, (n) => n.moment?.Mz ?? 0);

                      const hasNodeMoment = selectedNodes.some(
                        (n) =>
                          n.moment &&
                          (Math.abs(n.moment.Mx || 0) > 1e-6 ||
                            Math.abs(n.moment.My || 0) > 1e-6 ||
                            Math.abs(n.moment.Mz || 0) > 1e-6)
                      );

                      const clearNodeMoments = () => {
                        setNodes((prev) =>
                          prev.map((n) => (selectedNodeIds.includes(n.id) ? { ...n, moment: null } : n))
                        );
                        onInvalidateResults();
                      };

                      return (
                        <div className="panel">
                          <div className="row" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
                            <h3 style={{ margin: 0 }}>Momenty skupione</h3>
                            {hasNodeMoment && (
                              <button
                                type="button"
                                className="mini danger"
                                style={{ fontSize: '10px', padding: '2px 6px' }}
                                onClick={clearNodeMoments}
                                title="Wyczyść momenty skupione z zaznaczonych węzłów"
                              >
                                Wyczyść
                              </button>
                            )}
                          </div>
                          <div className="row-triple">
                            <div className="third">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                                Mx
                              </label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curMx}
                                  placeholder={selectedNodes.length > 1 && curMx === undefined ? 'różne' : undefined}
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => updateNodeMoment('Mx', v)}
                                />
                                <span className="unit">kNm</span>
                              </div>
                            </div>
                            <div className="third">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
                                My
                              </label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curMy}
                                  placeholder={selectedNodes.length > 1 && curMy === undefined ? 'różne' : undefined}
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => updateNodeMoment('My', v)}
                                />
                                <span className="unit">kNm</span>
                              </div>
                            </div>
                            <div className="third">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                                Mz
                              </label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curMz}
                                  placeholder={selectedNodes.length > 1 && curMz === undefined ? 'różne' : undefined}
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => updateNodeMoment('Mz', v)}
                                />
                                <span className="unit">kNm</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* MASY SKUPIONE */}
                    {(() => {
                      const curMxMass = commonVal(selectedNodes, (n) => n.mass?.mx ?? 0);
                      const curMyMass = commonVal(selectedNodes, (n) => n.mass?.my ?? 0);
                      const curMzMass = commonVal(selectedNodes, (n) => n.mass?.mz ?? 0);

                      const hasNodeMass = selectedNodes.some(
                        (n) =>
                          n.mass &&
                          (Math.abs(n.mass.mx || 0) > 1e-6 ||
                            Math.abs(n.mass.my || 0) > 1e-6 ||
                            Math.abs(n.mass.mz || 0) > 1e-6)
                      );

                      const clearNodeMass = () => {
                        setNodes((prev) =>
                          prev.map((n) => (selectedNodeIds.includes(n.id) ? { ...n, mass: null } : n))
                        );
                        onInvalidateResults();
                      };

                      return (
                        <div className="panel">
                          <div className="row" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
                            <h3 style={{ margin: 0 }}>Masa skupiona</h3>
                            {hasNodeMass && (
                              <button
                                type="button"
                                className="mini danger"
                                style={{ fontSize: '10px', padding: '2px 6px' }}
                                onClick={clearNodeMass}
                                title="Wyczyść masę skupioną z zaznaczonych węzłów"
                              >
                                Wyczyść
                              </button>
                            )}
                          </div>
                          <div className="row-triple">
                            <div className="third">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                                mx
                              </label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="10"
                                  value={curMxMass}
                                  placeholder={selectedNodes.length > 1 && curMxMass === undefined ? 'różne' : undefined}
                                  onChange={(v) => updateNodeMass('mx', v)}
                                />
                                <span className="unit">kg</span>
                              </div>
                            </div>
                            <div className="third">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
                                my
                              </label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="10"
                                  value={curMyMass}
                                  placeholder={selectedNodes.length > 1 && curMyMass === undefined ? 'różne' : undefined}
                                  onChange={(v) => updateNodeMass('my', v)}
                                />
                                <span className="unit">kg</span>
                              </div>
                            </div>
                            <div className="third">
                              <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                                mz
                              </label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="10"
                                  value={curMzMass}
                                  placeholder={selectedNodes.length > 1 && curMzMass === undefined ? 'różne' : undefined}
                                  onChange={(v) => updateNodeMass('mz', v)}
                                />
                                <span className="unit">kg</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* GRUPA PRĘTY (gdy zaznaczony przynajmniej jeden pręt) */}
            {selectedElemIds.length > 0 && (
              <div className="sidebar-group">
                <div className="group-header" onClick={() => setElementsGroupCollapsed(!elementsGroupCollapsed)}>
                  <div className="group-title">
                    <span>Pręty</span>
                    <span className="group-tag">
                      {selectedElemIds.length > 1 ? `${selectedElemIds.length} zaznaczone` : `P${selectedElemIds[0]}`}
                    </span>
                  </div>
                  <span className="subtle-icon">{elementsGroupCollapsed ? '▸' : '▾'}</span>
                </div>
                {!elementsGroupCollapsed && (
                  <div className="group-body">
                    <div className="panel">
                      {singleElem ? (
                        <>
                          <h3>
                            Pręt P{singleElem.id}{' '}
                            <span className="tag">
                              W{singleElem.n1}→W{singleElem.n2}
                            </span>
                          </h3>
                          {(() => {
                            const n1 = getNode(singleElem.n1);
                            const n2 = getNode(singleElem.n2);
                            const L = n1 && n2 ? Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z) : 0;
                            return (
                              <div className="muted" style={{ marginBottom: '8px' }}>
                                Długość L = {fmtSmart(L, 3)} m &nbsp;·&nbsp; Obrót profilu β = {singleElem.rollAngle || 0}°
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <h3>Pręty ({selectedElemIds.length}): {selectedElemIds.map((id) => 'P' + id).join(', ')}</h3>
                      )}

                      {/* (Akcje prętów: Usuń, Przenieś, Podziel znajdują się teraz w sekcji Właściwości) */}
                    </div>

                    {/* PRZEKRÓJ I MATERIAŁ */}
                    {(() => {
                      const commonSecId = commonVal(selectedElements, (e) => e.sectionId);
                      const commonMatId = commonVal(selectedElements, (e) => e.materialId);
                      const commonGrpId = commonVal(selectedElements, (e) => e.groupId || '');
                      const commonRollAngle = commonVal(selectedElements, (e) => e.rollAngle ?? 0);

                      const isSectionLocked = selectedElements.some((el) => {
                        if (!el.groupId) return false;
                        const g = groups.find((grp) => grp.id === el.groupId);
                        return g && g.sectionId !== undefined;
                      });
                      const isMaterialLocked = selectedElements.some((el) => {
                        if (!el.groupId) return false;
                        const g = groups.find((grp) => grp.id === el.groupId);
                        return g && g.materialId !== undefined;
                      });

                      return (
                        <div className="panel">
                          <h3>Przekrój i materiał</h3>
                          <div className="row">
                            <label>Przekrój</label>
                            <select
                              value={commonSecId ?? ''}
                              disabled={isSectionLocked}
                              title={isSectionLocked ? "Przekrój jest narzucony przez grupę pręta" : "Przekrój"}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setElements((prev) =>
                                  prev.map((el) => (selectedElemIds.includes(el.id) ? { ...el, sectionId: val } : el))
                                );
                                onInvalidateResults();
                              }}
                            >
                              {commonSecId === undefined && (
                                <option value="" disabled hidden>
                                  — różne —
                                </option>
                              )}
                              {sections.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="row">
                            <label>Materiał</label>
                            <select
                              value={commonMatId ?? ''}
                              disabled={isMaterialLocked}
                              title={isMaterialLocked ? "Materiał jest narzucony przez grupę pręta" : "Materiał"}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setElements((prev) =>
                                  prev.map((el) => (selectedElemIds.includes(el.id) ? { ...el, materialId: val } : el))
                                );
                                onInvalidateResults();
                              }}
                            >
                              {commonMatId === undefined && (
                                <option value="" disabled hidden>
                                  — różne —
                                </option>
                              )}
                              {materials.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="row">
                            <label>Grupa</label>
                            <select
                              value={commonGrpId === undefined ? 'mixed' : (commonGrpId ?? '')}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'mixed') return;
                                const targetGrp = groups.find((grp) => grp.id === val);
                                setElements((prev) =>
                                  prev.map((el) => {
                                    if (!selectedElemIds.includes(el.id)) return el;
                                    const nextSecId = targetGrp?.sectionId !== undefined ? targetGrp.sectionId : el.sectionId;
                                    const nextMatId = targetGrp?.materialId !== undefined ? targetGrp.materialId : el.materialId;
                                    return {
                                      ...el,
                                      groupId: val || undefined,
                                      sectionId: nextSecId,
                                      materialId: nextMatId,
                                    };
                                  })
                                );
                                onInvalidateResults();
                              }}
                            >
                              <option value="">(brak grupy)</option>
                              {commonGrpId === undefined && (
                                <option value="mixed" disabled hidden>
                                  — różne —
                                </option>
                              )}
                              {groups.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="row">
                            <label style={{ flexShrink: 0 }}>Obrót osi</label>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1, minWidth: 0, flexWrap: 'nowrap' }}>
                              <div className="inp-unit" style={{ flex: '1 1 0px', minWidth: 0, width: 0, overflow: 'hidden' }}>
                                <SmartNumberInput
                                  step="15"
                                  value={commonRollAngle}
                                  placeholder={selectedElements.length > 1 && commonRollAngle === undefined ? 'różne' : undefined}
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => {
                                    setElements((prev) =>
                                      prev.map((el) => (selectedElemIds.includes(el.id) ? { ...el, rollAngle: v } : el))
                                    );
                                    onInvalidateResults();
                                  }}
                                />
                                <span className="unit">°</span>
                              </div>
                              <button
                                type="button"
                                className="mini"
                                style={{ padding: '0 4px', fontSize: '10.5px', height: '24px', minWidth: '34px' }}
                                onClick={() => {
                                  setElements((prev) =>
                                    prev.map((el) => (selectedElemIds.includes(el.id) ? { ...el, rollAngle: (el.rollAngle ?? 0) - 90 } : el))
                                  );
                                  onInvalidateResults();
                                }}
                              >
                                -90°
                              </button>
                              <button
                                type="button"
                                className="mini"
                                style={{ padding: '0 4px', fontSize: '10.5px', height: '24px', minWidth: '34px' }}
                                onClick={() => {
                                  setElements((prev) =>
                                    prev.map((el) => (selectedElemIds.includes(el.id) ? { ...el, rollAngle: (el.rollAngle ?? 0) + 90 } : el))
                                  );
                                  onInvalidateResults();
                                }}
                              >
                                +90°
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* OBCIĄŻENIE CIĄGŁE PRĘTA */}
                    <div className="panel">
                      {(() => {
                        const definedCoords = selectedElements
                          .map((e) => e.q?.coordinateSystem)
                          .filter((c): c is 'global' | 'local' => Boolean(c));
                        const activeCoord: 'global' | 'local' =
                          definedCoords.length > 0 && definedCoords.every((c) => c === definedCoords[0])
                            ? definedCoords[0]
                            : memberLoadCoordSys;
                        const isLoc = activeCoord === 'local';
                        const curQx = commonVal(selectedElements, (e) => e.q?.qxStart ?? 0);
                        const curQy = commonVal(selectedElements, (e) => e.q?.qyStart ?? 0);
                        const curQz = commonVal(selectedElements, (e) => e.q?.qzStart ?? 0);

                        const updateQ = (axis: 'x' | 'y' | 'z', val: number) => {
                          const roundedVal = round4(val);
                          setElements((prev) =>
                            prev.map((el) => {
                              if (!selectedElemIds.includes(el.id)) return el;
                              const coord = el.q?.coordinateSystem || activeCoord;
                              const nQx = axis === 'x' ? roundedVal : (el.q?.qxStart ?? 0);
                              const nQy = axis === 'y' ? roundedVal : (el.q?.qyStart ?? 0);
                              const nQz = axis === 'z' ? roundedVal : (el.q?.qzStart ?? 0);

                              return {
                                ...el,
                                q: {
                                  coordinateSystem: coord,
                                  qxStart: round4(nQx),
                                  qxEnd: round4(nQx),
                                  qyStart: round4(nQy),
                                  qyEnd: round4(nQy),
                                  qzStart: round4(nQz),
                                  qzEnd: round4(nQz),
                                },
                              };
                            })
                          );
                          onInvalidateResults();
                        };

                        const hasContinuousLoad = selectedElements.some(
                          (e) =>
                            e.q &&
                            (Math.abs(e.q.qxStart || 0) > 1e-6 ||
                              Math.abs(e.q.qxEnd || 0) > 1e-6 ||
                              Math.abs(e.q.qyStart || 0) > 1e-6 ||
                              Math.abs(e.q.qyEnd || 0) > 1e-6 ||
                              Math.abs(e.q.qzStart || 0) > 1e-6 ||
                              Math.abs(e.q.qzEnd || 0) > 1e-6)
                        );

                        const clearContinuousLoad = () => {
                          setElements((prev) =>
                            prev.map((el) => (selectedElemIds.includes(el.id) ? { ...el, q: null } : el))
                          );
                          onInvalidateResults();
                        };

                        return (
                          <>
                            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
                              <h3 style={{ margin: 0 }}>Obciążenie ciągłe</h3>
                              <div className="btnrow" style={{ gap: '4px', alignItems: 'center' }}>
                                {hasContinuousLoad && (
                                  <button
                                    type="button"
                                    className="mini danger"
                                    style={{ fontSize: '10px', padding: '2px 6px' }}
                                    onClick={clearContinuousLoad}
                                    title="Wyczyść obciążenie ciągłe z zaznaczonych prętów"
                                  >
                                    Wyczyść
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className={`mini ${activeCoord === 'global' ? 'on' : ''}`}
                                  style={{ fontSize: '10px', padding: '2px 6px' }}
                                  onClick={() => {
                                    setMemberLoadCoordSys('global');
                                    setElements((prev) =>
                                      prev.map((el) =>
                                        selectedElemIds.includes(el.id)
                                          ? {
                                              ...el,
                                              q: {
                                                coordinateSystem: 'global',
                                                qxStart: el.q?.qxStart ?? 0,
                                                qxEnd: el.q?.qxEnd ?? 0,
                                                qyStart: el.q?.qyStart ?? 0,
                                                qyEnd: el.q?.qyEnd ?? 0,
                                                qzStart: el.q?.qzStart ?? 0,
                                                qzEnd: el.q?.qzEnd ?? 0,
                                              },
                                            }
                                          : el
                                      )
                                    );
                                    onInvalidateResults();
                                  }}
                                >
                                  Globalny
                                </button>
                                <button
                                  type="button"
                                  className={`mini ${activeCoord === 'local' ? 'on' : ''}`}
                                  style={{ fontSize: '10px', padding: '2px 6px' }}
                                  onClick={() => {
                                    setMemberLoadCoordSys('local');
                                    setElements((prev) =>
                                      prev.map((el) =>
                                        selectedElemIds.includes(el.id)
                                          ? {
                                              ...el,
                                              q: {
                                                coordinateSystem: 'local',
                                                qxStart: el.q?.qxStart ?? 0,
                                                qxEnd: el.q?.qxEnd ?? 0,
                                                qyStart: el.q?.qyStart ?? 0,
                                                qyEnd: el.q?.qyEnd ?? 0,
                                                qzStart: el.q?.qzStart ?? 0,
                                                qzEnd: el.q?.qzEnd ?? 0,
                                              },
                                            }
                                          : el
                                      )
                                    );
                                    onInvalidateResults();
                                  }}
                                >
                                  Lokalny
                                </button>
                              </div>
                            </div>

                            <div className="row-triple">
                              <div className="third">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                                  {isLoc ? 'qx (oś)' : 'qX'}
                                </label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="1"
                                    value={curQx}
                                    placeholder={selectedElements.length > 1 && curQx === undefined ? 'różne' : undefined}
                                    onFocus={onInvalidateResults}
                                    onChange={(v) => updateQ('x', v)}
                                  />
                                  <span className="unit">kN/m</span>
                                </div>
                              </div>
                              <div className="third">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
                                  {isLoc ? 'qy (y)' : 'qY'}
                                </label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="1"
                                    value={curQy}
                                    placeholder={selectedElements.length > 1 && curQy === undefined ? 'różne' : undefined}
                                    onFocus={onInvalidateResults}
                                    onChange={(v) => updateQ('y', v)}
                                  />
                                  <span className="unit">kN/m</span>
                                </div>
                              </div>
                              <div className="third">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                                  {isLoc ? 'qz (z)' : 'qZ'}
                                </label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="1"
                                    value={curQz}
                                    placeholder={selectedElements.length > 1 && curQz === undefined ? 'różne' : undefined}
                                    onFocus={onInvalidateResults}
                                    onChange={(v) => updateQ('z', v)}
                                  />
                                  <span className="unit">kN/m</span>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* OBCIĄŻENIE TERMICZNE PRĘTA */}
                    <div className="panel">
                      {(() => {
                        const curDTx = commonVal(selectedElements, (e) => e.thermal?.deltaTx ?? 0);
                        const curDTy = commonVal(selectedElements, (e) => e.thermal?.deltaTy ?? 0);
                        const curDTz = commonVal(selectedElements, (e) => e.thermal?.deltaTz ?? 0);

                        const updateThermal = (axis: 'x' | 'y' | 'z', val: number) => {
                          const roundedVal = round4(val);
                          setElements((prev) =>
                            prev.map((el) => {
                              if (!selectedElemIds.includes(el.id)) return el;
                              const nDTx = axis === 'x' ? roundedVal : (el.thermal?.deltaTx ?? 0);
                              const nDTy = axis === 'y' ? roundedVal : (el.thermal?.deltaTy ?? 0);
                              const nDTz = axis === 'z' ? roundedVal : (el.thermal?.deltaTz ?? 0);

                              const hasAny = Math.abs(nDTx) > 1e-6 || Math.abs(nDTy) > 1e-6 || Math.abs(nDTz) > 1e-6;

                              return {
                                ...el,
                                thermal: hasAny
                                  ? {
                                      deltaTx: round4(nDTx),
                                      deltaTy: round4(nDTy),
                                      deltaTz: round4(nDTz),
                                    }
                                  : null,
                              };
                            })
                          );
                          onInvalidateResults();
                        };

                        const hasThermal = selectedElements.some(
                          (e) =>
                            e.thermal &&
                            (Math.abs(e.thermal.deltaTx || 0) > 1e-6 ||
                              Math.abs(e.thermal.deltaTy || 0) > 1e-6 ||
                              Math.abs(e.thermal.deltaTz || 0) > 1e-6)
                        );

                        const clearThermal = () => {
                          setElements((prev) =>
                            prev.map((el) => (selectedElemIds.includes(el.id) ? { ...el, thermal: null } : el))
                          );
                          onInvalidateResults();
                        };

                        return (
                          <>
                            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
                              <h3>Temperatura pręta (ΔT)</h3>
                              {hasThermal && (
                                <button
                                  type="button"
                                  className="mini danger"
                                  style={{ fontSize: '10px', padding: '2px 6px'}}
                                  onClick={clearThermal}
                                  title="Wyczyść obciążenie termiczne z zaznaczonych prętów"
                                >
                                  Wyczyść
                                </button>
                              )}
                            </div>

                            <div className="row-triple">
                              <div className="third">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="Równomierny przyrost temperatury osiowej (rozciąganie/ściskanie)">
                                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                                  ΔTx (oś)
                                </label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="5"
                                    value={curDTx}
                                    placeholder={selectedElements.length > 1 && curDTx === undefined ? 'różne' : undefined}
                                    onFocus={onInvalidateResults}
                                    onChange={(v) => updateThermal('x', v)}
                                  />
                                  <span className="unit">°C</span>
                                </div>
                              </div>
                              <div className="third">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="Różnica temperatur po obu stronach pręta w osi y (zginanie wokół osi z)">
                                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
                                  ΔTy (y)
                                </label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="5"
                                    value={curDTy}
                                    placeholder={selectedElements.length > 1 && curDTy === undefined ? 'różne' : undefined}
                                    onFocus={onInvalidateResults}
                                    onChange={(v) => updateThermal('y', v)}
                                  />
                                  <span className="unit">°C</span>
                                </div>
                              </div>
                              <div className="third">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '3px' }} title="Różnica temperatur po obu stronach pręta w osi z (zginanie wokół osi y)">
                                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                                  ΔTz (z)
                                </label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="5"
                                    value={curDTz}
                                    placeholder={selectedElements.length > 1 && curDTz === undefined ? 'różne' : undefined}
                                    onFocus={onInvalidateResults}
                                    onChange={(v) => updateThermal('z', v)}
                                  />
                                  <span className="unit">°C</span>
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* PRZEGUBY / ZWOLNIENIA NA KOŃCACH PRĘTA (6 SWOBÓD / DOFs) */}
                    {(() => {
                      const transDofList: Array<{ keyStart: keyof MemberHinges3D; keyEnd: keyof MemberHinges3D; label: string; color: string; desc: string }> = [
                        { keyStart: 'start_ux', keyEnd: 'end_ux', label: 'Ux', color: '#ef4444', desc: 'Przesuw podłużny (x)' },
                        { keyStart: 'start_uy', keyEnd: 'end_uy', label: 'Uy', color: '#22c55e', desc: 'Przesuw poprzeczny (y)' },
                        { keyStart: 'start_uz', keyEnd: 'end_uz', label: 'Uz', color: '#3b82f6', desc: 'Przesuw poprzeczny (z)' },
                      ];

                      const rotDofList: Array<{ keyStart: keyof MemberHinges3D; keyEnd: keyof MemberHinges3D; label: string; color: string; desc: string }> = [
                        { keyStart: 'start_rx', keyEnd: 'end_rx', label: 'Rx', color: '#ef4444', desc: 'Skręcanie (Mx)' },
                        { keyStart: 'start_ry', keyEnd: 'end_ry', label: 'Ry', color: '#22c55e', desc: 'Zginanie (My)' },
                        { keyStart: 'start_rz', keyEnd: 'end_rz', label: 'Rz', color: '#3b82f6', desc: 'Zginanie (Mz)' },
                      ];

                      const updateHingeKey = (key: keyof MemberHinges3D, active: boolean) => {
                        setElements((prev) =>
                          prev.map((el) =>
                            selectedElemIds.includes(el.id)
                              ? {
                                  ...el,
                                  hinges: {
                                    ...el.hinges,
                                    [key]: active,
                                  },
                                }
                              : el
                          )
                        );
                        onInvalidateResults();
                      };

                      const applyPreset = (type: 'none' | 'bending_both' | 'bending_start' | 'bending_end' | 'spherical_both') => {
                        setElements((prev) =>
                          prev.map((el) => {
                            if (!selectedElemIds.includes(el.id)) return el;
                            let newH: MemberHinges3D = {};
                            if (type === 'bending_both') {
                              newH = { start_ry: true, start_rz: true, end_ry: true, end_rz: true };
                            } else if (type === 'bending_start') {
                              newH = { start_ry: true, start_rz: true };
                            } else if (type === 'bending_end') {
                              newH = { end_ry: true, end_rz: true };
                            } else if (type === 'spherical_both') {
                              newH = { start_rx: true, start_ry: true, start_rz: true, end_rx: true, end_ry: true, end_rz: true };
                            }
                            return { ...el, hinges: newH };
                          })
                        );
                        onInvalidateResults();
                      };

                      return (
                        <div className="panel">
                          <h3>Zwolnienia na końcach pręta (Przeguby)</h3>
                          
                          {/* Szybkie szablony / presets */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                            <button
                              type="button"
                              className="mini"
                              style={{ fontSize: '10px', padding: '3px 6px', flex: '1 1 auto', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                              onClick={() => applyPreset('none')}
                              title="Usuń wszystkie zwolnienia"
                            >
                              Brak
                            </button>
                            <button
                              type="button"
                              className="mini"
                              style={{ fontSize: '10px', padding: '3px 6px', flex: '1 1 auto', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                              onClick={() => applyPreset('bending_both')}
                              title="Zwolnienie Ry i Rz na obu końcach"
                            >
                              My, Mz
                            </button>
                            <button
                              type="button"
                              className="mini"
                              style={{ fontSize: '10px', padding: '3px 6px', flex: '1 1 auto', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                              onClick={() => applyPreset('spherical_both')}
                              title="Zwolnienie Rx, Ry i Rz na obu końcach"
                            >
                              Kulisty
                            </button>
                            <button
                              type="button"
                              className="mini"
                              style={{ fontSize: '10px', padding: '3px 6px', flex: '1 1 auto', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                              onClick={() => applyPreset('bending_start')}
                              title="Zginanie tylko na początku"
                            >
                              Początek
                            </button>
                            <button
                              type="button"
                              className="mini"
                              style={{ fontSize: '10px', padding: '3px 6px', flex: '1 1 auto', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}
                              onClick={() => applyPreset('bending_end')}
                              title="Zginanie tylko na końcu"
                            >
                              Koniec
                            </button>
                          </div>

                          {/* Tabela / Grid 6 swobód dla węzła W1 i W2 */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {/* POCZĄTEK W1 */}
                            <div style={{ background: 'var(--panel)', padding: '6px', borderRadius: '6px', border: '1px solid var(--surface-border)' }}>
                              <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '6px', color: 'var(--text)' }}>
                                Początek {singleElem ? `(W${singleElem.n1})` : ''}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {transDofList.map((dof) => {
                                    const val = commonVal(selectedElements, (e) => !!e.hinges?.[dof.keyStart]);
                                    return (
                                      <label
                                        key={dof.keyStart}
                                        title={dof.desc}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '11px',
                                          cursor: 'pointer',
                                          userSelect: 'none',
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          ref={(el) => {
                                            if (el) el.indeterminate = val === undefined;
                                          }}
                                          checked={val === true}
                                          onChange={(e) => updateHingeKey(dof.keyStart, e.target.checked)}
                                        />
                                        <span
                                          style={{
                                            display: 'inline-block',
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            backgroundColor: dof.color,
                                            flexShrink: 0,
                                          }}
                                        />
                                        <span style={{ fontWeight: 500 }}>{dof.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {rotDofList.map((dof) => {
                                    const val = commonVal(selectedElements, (e) => !!e.hinges?.[dof.keyStart]);
                                    return (
                                      <label
                                        key={dof.keyStart}
                                        title={dof.desc}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '11px',
                                          cursor: 'pointer',
                                          userSelect: 'none',
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          ref={(el) => {
                                            if (el) el.indeterminate = val === undefined;
                                          }}
                                          checked={val === true}
                                          onChange={(e) => updateHingeKey(dof.keyStart, e.target.checked)}
                                        />
                                        <span
                                          style={{
                                            display: 'inline-block',
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            backgroundColor: dof.color,
                                            flexShrink: 0,
                                          }}
                                        />
                                        <span style={{ fontWeight: 500 }}>{dof.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* KONIEC W2 */}
                            <div style={{ background: 'var(--panel)', padding: '6px', borderRadius: '6px', border: '1px solid var(--surface-border)' }}>
                              <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '6px', color: 'var(--text)' }}>
                                Koniec {singleElem ? `(W${singleElem.n2})` : ''}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {transDofList.map((dof) => {
                                    const val = commonVal(selectedElements, (e) => !!e.hinges?.[dof.keyEnd]);
                                    return (
                                      <label
                                        key={dof.keyEnd}
                                        title={dof.desc}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '11px',
                                          cursor: 'pointer',
                                          userSelect: 'none',
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          ref={(el) => {
                                            if (el) el.indeterminate = val === undefined;
                                          }}
                                          checked={val === true}
                                          onChange={(e) => updateHingeKey(dof.keyEnd, e.target.checked)}
                                        />
                                        <span
                                          style={{
                                            display: 'inline-block',
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            backgroundColor: dof.color,
                                            flexShrink: 0,
                                          }}
                                        />
                                        <span style={{ fontWeight: 500 }}>{dof.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {rotDofList.map((dof) => {
                                    const val = commonVal(selectedElements, (e) => !!e.hinges?.[dof.keyEnd]);
                                    return (
                                      <label
                                        key={dof.keyEnd}
                                        title={dof.desc}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          fontSize: '11px',
                                          cursor: 'pointer',
                                          userSelect: 'none',
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          ref={(el) => {
                                            if (el) el.indeterminate = val === undefined;
                                          }}
                                          checked={val === true}
                                          onChange={(e) => updateHingeKey(dof.keyEnd, e.target.checked)}
                                        />
                                        <span
                                          style={{
                                            display: 'inline-block',
                                            width: '6px',
                                            height: '6px',
                                            borderRadius: '50%',
                                            backgroundColor: dof.color,
                                            flexShrink: 0,
                                          }}
                                        />
                                        <span style={{ fontWeight: 500 }}>{dof.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* GRUPA OKŁADZINY (gdy zaznaczona przynajmniej jedna okładzina) */}
            {selectedPanelIds.length > 0 && (
              <div className="sidebar-group">
                <div className="group-header" onClick={() => setPanelsGroupCollapsed(!panelsGroupCollapsed)}>
                  <div className="group-title">
                    <span>Okładziny</span>
                    <span className="group-tag">
                      {selectedPanelIds.length > 1 ? `${selectedPanelIds.length} zaznaczone` : `O${selectedPanelIds[0]}`}
                    </span>
                  </div>
                  <span className="subtle-icon">{panelsGroupCollapsed ? '▸' : '▾'}</span>
                </div>
                {!panelsGroupCollapsed && (
                  <div className="group-body">
                    <div className="panel">
                      {selectedPanelIds.length === 1 ? (
                        <>
                          <h3>Okładzina O{selectedPanelIds[0]}</h3>
                          <div className="muted" style={{ marginBottom: '6px' }}>
                            O{selectedPanels[0].id} — kształt: <strong>{selectedPanels[0].shape === 'triangle' ? 'Trójkąt' : 'Prostokąt'}</strong>
                            <div>Węzły konturu: {selectedPanels[0].nodeIds.map((id) => 'W' + id).join(', ')}</div>
                          </div>
                        </>
                      ) : (
                        <h3>Okładziny ({selectedPanelIds.length}): {selectedPanelIds.map((id) => 'O' + id).join(', ')}</h3>
                      )}
                    </div>

                    {/* KIERUNEK ROZKŁADU OBCIĄŻEŃ */}
                    {selectedPanels.every((p) => p.shape !== 'triangle') && (
                      <div className="panel">
                        <h3>Rozkład obciążeń</h3>
                        <div className="row" style={{ marginTop: '4px' }}>
                          <label style={{ minWidth: '70px' }}>Kierunek</label>
                          {(() => {
                            const firstDir = selectedPanels[0]?.loadTransferDir || 'two_way';
                            const allSame = selectedPanels.every((p) => (p.loadTransferDir || 'two_way') === firstDir);
                            const curDir = allSame ? firstDir : undefined;

                            const setDir = (dir: PanelLoadTransferDir) => {
                              if (setPanels) {
                                setPanels((prev) =>
                                  prev.map((p) => (selectedPanelIds.includes(p.id) ? { ...p, loadTransferDir: dir } : p))
                                );
                              }
                              onInvalidateResults();
                            };

                            return (
                              <div className="btnrow" style={{ flex: 1, gap: '4px', marginTop: 0 }}>
                                <button
                                  type="button"
                                  className={`mini ${curDir === 'two_way' ? 'on' : ''}`}
                                  style={{ flex: 1, padding: '5px 2px', fontSize: '11px', textAlign: 'center' }}
                                  onClick={() => setDir('two_way')}
                                  title="Przekazywanie obciążeń w obu osiach"
                                >
                                  Dwukierunkowy
                                </button>
                                <button
                                  type="button"
                                  className={`mini ${curDir === 'one_way_x' ? 'on' : ''}`}
                                  style={{ flex: 1, padding: '5px 2px', fontSize: '11px', textAlign: 'center' }}
                                  onClick={() => setDir('one_way_x')}
                                  title="Przekazywanie wzdłuż osi X okładziny"
                                >
                                  Wzdłuż X
                                </button>
                                <button
                                  type="button"
                                  className={`mini ${curDir === 'one_way_y' ? 'on' : ''}`}
                                  style={{ flex: 1, padding: '5px 2px', fontSize: '11px', textAlign: 'center' }}
                                  onClick={() => setDir('one_way_y')}
                                  title="Przekazywanie wzdłuż osi Y okładziny"
                                >
                                  Wzdłuż Y
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* OBCIĄŻENIE CIŚNIENIEM */}
                    <div className="panel">
                      {(() => {
                        const firstP = selectedPanels[0]?.pressure;
                        const allSameDir = selectedPanels.every((p) => (p.pressure?.dir || 'normal') === (firstP?.dir || 'normal'));
                        const curDir = allSameDir ? (firstP?.dir || 'normal') : undefined;
                        
                        const firstVal = firstP?.value ?? 0;
                        const allSameVal = selectedPanels.every((p) => (p.pressure?.value ?? 0) === firstVal);
                        const curVal = allSameVal ? firstVal : undefined;

                        const hasPressure = selectedPanels.some(
                          (p) => p.pressure && Math.abs(p.pressure.value || 0) > 1e-6
                        );

                        const clearPressure = () => {
                          if (setPanels) {
                            setPanels((prev) =>
                              prev.map((p) => (selectedPanelIds.includes(p.id) ? { ...p, pressure: null } : p))
                            );
                          }
                          onInvalidateResults();
                        };

                        const updatePressureDir = (dir: 'X' | 'Y' | 'Z' | 'normal') => {
                          if (setPanels) {
                            setPanels((prev) =>
                              prev.map((p) => {
                                if (!selectedPanelIds.includes(p.id)) return p;
                                return {
                                  ...p,
                                  pressure: { dir, value: p.pressure?.value ?? 0 },
                                };
                              })
                            );
                          }
                          onInvalidateResults();
                        };

                        const updatePressureVal = (value: number) => {
                          const roundedVal = round4(value);
                          if (setPanels) {
                            setPanels((prev) =>
                              prev.map((p) => {
                                if (!selectedPanelIds.includes(p.id)) return p;
                                return {
                                  ...p,
                                  pressure: { dir: p.pressure?.dir || 'normal', value: roundedVal },
                                };
                              })
                            );
                          }
                          onInvalidateResults();
                        };

                        return (
                          <>
                            <div className="row" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
                              <h3 style={{ margin: 0 }}>Obciążenie ciśnieniem</h3>
                              {hasPressure && (
                                <button
                                  type="button"
                                  className="mini danger"
                                  style={{ fontSize: '10px', padding: '2px 6px' }}
                                  onClick={clearPressure}
                                  title="Wyczyść obciążenie powierzchniowe z zaznaczonych okładzin"
                                >
                                  Wyczyść
                                </button>
                              )}
                            </div>
                            <div className="row" style={{ marginBottom: '8px' }}>
                              <label style={{ minWidth: '70px' }}>Kierunek</label>
                              <div className="btnrow" style={{ flex: 1, gap: '4px', marginTop: 0 }}>
                                <button
                                  type="button"
                                  className={`mini ${curDir === 'normal' ? 'on' : ''}`}
                                  style={{ flex: 1.5, padding: '5px 2px', fontSize: '11px', textAlign: 'center' }}
                                  onClick={() => updatePressureDir('normal')}
                                  title="Prostopadle do płaszczyzny okładziny"
                                >
                                  Prostopadle
                                </button>
                                <button
                                  type="button"
                                  className={`mini ${curDir === 'X' ? 'on' : ''}`}
                                  style={{ flex: 1, padding: '5px 2px', fontSize: '11px', textAlign: 'center' }}
                                  onClick={() => updatePressureDir('X')}
                                  title="Globalna oś X"
                                >
                                  X
                                </button>
                                <button
                                  type="button"
                                  className={`mini ${curDir === 'Y' ? 'on' : ''}`}
                                  style={{ flex: 1, padding: '5px 2px', fontSize: '11px', textAlign: 'center' }}
                                  onClick={() => updatePressureDir('Y')}
                                  title="Globalna oś Y"
                                >
                                  Y
                                </button>
                                <button
                                  type="button"
                                  className={`mini ${curDir === 'Z' ? 'on' : ''}`}
                                  style={{ flex: 1, padding: '5px 2px', fontSize: '11px', textAlign: 'center' }}
                                  onClick={() => updatePressureDir('Z')}
                                  title="Globalna oś Z"
                                >
                                  Z
                                </button>
                              </div>
                            </div>

                            <div className="row" style={{ marginBottom: 0 }}>
                              <label style={{ minWidth: '70px' }}>Wartość</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  value={curVal}
                                  placeholder={selectedPanelIds.length > 1 && curVal === undefined ? 'różne' : '0.0'}
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => updatePressureVal(v)}
                                />
                                <span className="unit">kN/m²</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* GROUP 2: OBLICZENIA (zawsze dostępna: Wyniki na górze, Rodzaj analizy na dole) */}
        <div className="sidebar-group">
          <div className="group-header" onClick={() => setCalcGroupCollapsed(!calcGroupCollapsed)}>
            <div className="group-title">
              <span>Obliczenia</span>
              {solved ? (
                <span
                  className="group-tag"
                  style={{
                    background: 'var(--ok-bg)',
                    color: 'var(--ok-fg)',
                    borderColor: 'var(--ok-border)',
                  }}
                >
                  Rozwiązano
                </span>
              ) : (
                <span className="group-tag">
                  {analysisSettings.type === 'stability'
                    ? 'Stateczność'
                    : analysisSettings.type === 'modal'
                    ? 'Drgania własne'
                    : 'Statyka liniowa'}
                </span>
              )}
            </div>
            <span className="subtle-icon">{calcGroupCollapsed ? '▸' : '▾'}</span>
          </div>

          {!calcGroupCollapsed && (
            <div className="group-body">
              {/* WYNIKI */}
              {solveWarning && !solved ? (
                <div className="panel">
                  <h3>Wyniki</h3>
                  <div className="warn">{solveWarning}</div>
                </div>
              ) : !solved ? (
                <div className="panel">
                  <h3>Wyniki</h3>
                  <div className="empty-state">
                    Zbuduj model i kliknij <b>OBLICZ</b> w górnym pasku,<br />
                    aby zobaczyć ugięcia, siły wewnętrzne My, Mz, Mx, Vy, Vz, N i reakcje.
                  </div>
                </div>
              ) : (
                <>
                  {/* WYBÓR WIDOKU WYNIKÓW (PRZYPADEK / KOMBINACJA / OBWIEDNIA) */}
                  {multiSolved && (solved.type === 'linear_static' || solved.type === 'stability') && (() => {
                    const resultKeysList: string[] = [];
                    if (multiSolved) {
                      resultKeysList.push(...Object.keys(multiSolved.envelopes || {}));
                      resultKeysList.push(...Object.keys(multiSolved.cases || {}).map((idStr) => `case_${idStr}`));
                      resultKeysList.push(
                        ...Object.values(multiSolved.combinations || {})
                          .filter((c: any) => c.comb.type === 'SGN')
                          .map((c: any) => c.comb.id)
                      );
                      resultKeysList.push(
                        ...Object.values(multiSolved.combinations || {})
                          .filter((c: any) => c.comb.type !== 'SGN')
                          .map((c: any) => c.comb.id)
                      );
                    }
                    if (resultKeysList.length <= 1) {
                      return null;
                    }
                    const currResIndex = resultKeysList.indexOf(activeResultKey || '');

                    return (
                      <div className="panel" style={{ borderLeft: '3px solid var(--accent, #2563eb)' }}>

                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                          <select
                            value={activeResultKey || ''}
                            onChange={(e) => onSelectResultKey?.(e.target.value)}
                            style={{ flex: 1, fontWeight: 600 }}
                          >
                            {/* Envelopes */}
                            {Object.keys(multiSolved.envelopes).length > 0 && (
                              <optgroup label={solved.type === 'stability' ? 'Obwiednia SGN (Najbardziej krytyczna stateczność)' : 'Obwiednie (Wartości ekstremalne)'}>
                                {Object.entries(multiSolved.envelopes).map(([key, env]: [string, any]) => (
                                  <option key={key} value={key}>
                                    {solved.type === 'stability' ? 'Najbardziej krytyczna kombinacja SGN (min α)' : env.name}
                                  </option>
                                ))}
                              </optgroup>
                            )}

                            {/* Base Cases */}
                            <optgroup label="Przypadki obciążeń podstawowe">
                              {Object.entries(multiSolved.cases).map(([idStr, c]: [string, any]) => (
                                <option key={`case_${idStr}`} value={`case_${idStr}`}>
                                  Przypadek {idStr}: {c.loadCase.name}
                                </option>
                              ))}
                            </optgroup>

                            {/* SGN Combinations */}
                            {Object.values(multiSolved.combinations).filter((c: any) => c.comb.type === 'SGN').length > 0 && (
                              <optgroup label="Kombinacje SGN (Nośność)">
                                {Object.values(multiSolved.combinations)
                                  .filter((c: any) => c.comb.type === 'SGN')
                                  .map((c: any) => (
                                    <option key={c.comb.id} value={c.comb.id}>
                                      {c.comb.name}
                                    </option>
                                  ))}
                              </optgroup>
                            )}

                            {/* SGU Combinations */}
                            {Object.values(multiSolved.combinations).filter((c: any) => c.comb.type !== 'SGN').length > 0 && (
                              <optgroup label="Kombinacje SGU (Użytkowalność)">
                                {Object.values(multiSolved.combinations)
                                  .filter((c: any) => c.comb.type !== 'SGN')
                                  .map((c: any) => (
                                    <option key={c.comb.id} value={c.comb.id}>
                                      {c.comb.name}
                                    </option>
                                  ))}
                              </optgroup>
                            )}
                          </select>
                          <button
                            className="mini"
                            disabled={currResIndex <= 0}
                            onClick={() => {
                              if (currResIndex > 0) {
                                onSelectResultKey?.(resultKeysList[currResIndex - 1]);
                              }
                            }}
                            title="Poprzedni widok wyników"
                            style={{
                              minWidth: '36px',
                              height: '30px',
                              padding: '0 10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '13px',
                              flex: '0 0 auto',
                            }}
                          >
                            ◄
                          </button>
                          <button
                            className="mini"
                            disabled={currResIndex < 0 || currResIndex >= resultKeysList.length - 1}
                            onClick={() => {
                              if (currResIndex >= 0 && currResIndex < resultKeysList.length - 1) {
                                onSelectResultKey?.(resultKeysList[currResIndex + 1]);
                              }
                            }}
                            title="Następny widok wyników"
                            style={{
                              minWidth: '36px',
                              height: '30px',
                              padding: '0 10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '13px',
                              flex: '0 0 auto',
                            }}
                          >
                            ►
                          </button>
                        </div>

                        {/* Brief description */}
                        <div className="muted" style={{ fontSize: '11px', lineHeight: 1.3, marginTop: '4px' }}>
                          {activeResultKey && multiSolved.envelopes[activeResultKey] && (
                            <>
                              {solved.type === 'stability' ? (
                                <>Wyświetla krytyczną formę utraty stateczności (najniższy mnożnik α<sub>cr</sub>) wyznaczoną z kombinacji SGN.</>
                              ) : (
                                'Wyświetla wartości ekstremalne (obwiednię) wyznaczone z kombinacji normowych Eurokodu.'
                              )}
                            </>
                          )}
                          {activeResultKey && multiSolved.combinations[activeResultKey] && (
                            <>
                              {multiSolved.combinations[activeResultKey].comb.description}
                              {solved.type === 'stability' && ' (Analiza stateczności dla tej kombinacji)'}
                            </>
                          )}
                          {activeResultKey && activeResultKey.startsWith('case_') && (
                            <>
                              {solved.type === 'stability' ? (
                                <>Wyniki analizy stateczności (α<sub>cr</sub> i formy wyboczenia) dla wybranego przypadku obciążenia.</>
                              ) : (
                                'Wyniki obliczeń dla pojedynczego przypadku obciążenia.'
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* REAKCJE PODPOROWE */}
                  {solved.type === 'linear_static' && (
                    <div className="panel">
                      <h3
                        className="collapsible-head"
                        onClick={() => setReactionsCollapsed(!reactionsCollapsed)}
                        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span>Reakcje podporowe</span>
                        <span className="subtle-icon">{reactionsCollapsed ? '▸' : '▾'}</span>
                      </h3>
                      {!reactionsCollapsed && (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="rtab">
                            <thead>
                              <tr>
                                <th>Węzeł</th>
                                <th>Rx [kN]</th>
                                <th>Ry [kN]</th>
                                <th>Rz [kN]</th>
                                <th>Mx [kNm]</th>
                                <th>My [kNm]</th>
                                <th>Mz [kNm]</th>
                              </tr>
                            </thead>
                            <tbody>
                              {nodes
                                .filter((n) => n.support)
                                .map((n) => {
                                  const r = solved.reactions?.[n.id] || { Rx: 0, Ry: 0, Rz: 0, Mx: 0, My: 0, Mz: 0 };
                                  return (
                                    <tr key={n.id}>
                                      <td>W{n.id}</td>
                                      <td>{fmtSmart(r.Rx)}</td>
                                      <td>{fmtSmart(r.Ry)}</td>
                                      <td>{fmtSmart(r.Rz)}</td>
                                      <td>{fmtSmart(r.Mx)}</td>
                                      <td>{fmtSmart(r.My)}</td>
                                      <td>{fmtSmart(r.Mz)}</td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* WYNIKI STATECZNOŚCI 3D */}
                  {solved.type === 'stability' && (
                    <div className="panel">
                      <h3
                        className="collapsible-head"
                        onClick={() => setStabilityCollapsed(!stabilityCollapsed)}
                        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span>Stateczność</span>
                        <span className="subtle-icon">{stabilityCollapsed ? '▸' : '▾'}</span>
                      </h3>
                      {!stabilityCollapsed && (
                        solved.modes.length === 0 ? (
                          <div className="warn">
                            {solved.noCompression ? (
                              <>Brak ściskanych elementów w konstrukcji (α<sub>cr</sub> = ∞).</>
                            ) : (
                              'Nie wyznaczono form wyboczenia (osobliwość układu).'
                            )}
                          </div>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table className="rtab">
                              <thead>
                                <tr>
                                  <th>Forma</th>
                                  <th>α<sub>cr</sub></th>
                                  <th>N<sub>cr</sub> [kN]</th>
                                </tr>
                              </thead>
                              <tbody>
                                {solved.modes.map((m, idx) => (
                                  <tr
                                    key={idx}
                                    style={{
                                      cursor: 'pointer',
                                      fontWeight: (solved.currentMode || 0) === idx ? 'bold' : 'normal',
                                      background: (solved.currentMode || 0) === idx ? 'var(--accent-soft)' : 'transparent',
                                    }}
                                    onClick={() => {
                                      setSolved?.({ ...solved, currentMode: idx });
                                    }}
                                  >
                                    <td>Forma {idx + 1}</td>
                                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtSmart(m.alphaCr, 3)}</td>
                                    <td>{fmtSmart(m.maxNcr, 1)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* WYNIKI DRGAŃ WŁASNYCH 3D */}
                  {solved.type === 'modal' && (
                    <div className="panel">
                      <h3
                        className="collapsible-head"
                        onClick={() => setModalCollapsed(!modalCollapsed)}
                        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span>Drgania własne</span>
                        <span className="subtle-icon">{modalCollapsed ? '▸' : '▾'}</span>
                      </h3>
                      {!modalCollapsed && (
                        solved.modes.length === 0 ? (
                          <div className="warn">
                            {solved.noMass
                              ? 'Brak zdefiniowanej masy w konstrukcji (M = 0).'
                              : 'Nie wyznaczono częstości drgań (osobliwość).'}
                          </div>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table className="rtab">
                              <thead>
                                <tr>
                                  <th>Forma</th>
                                  <th>f [Hz]</th>
                                  <th>T [s]</th>
                                  <th>ω [rad/s]</th>
                                </tr>
                              </thead>
                              <tbody>
                                {solved.modes.map((m, idx) => (
                                  <tr
                                    key={idx}
                                    style={{
                                      cursor: 'pointer',
                                      fontWeight: (solved.currentMode || 0) === idx ? 'bold' : 'normal',
                                      background: (solved.currentMode || 0) === idx ? 'var(--accent-soft)' : 'transparent',
                                    }}
                                    onClick={() => {
                                      setSolved?.({ ...solved, currentMode: idx });
                                    }}
                                  >
                                    <td>Forma {idx + 1}</td>
                                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{fmtSmart(m.f, 2)}</td>
                                    <td>{fmtSmart(m.T, 3)}</td>
                                    <td>{fmtSmart(m.omega, 2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* WIDOK WYNIKÓW / TOGGLES */}
                  <div className="panel">
                    <h3
                      className="collapsible-head"
                      onClick={() => setResultsViewCollapsed(!resultsViewCollapsed)}
                      style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <span>Widok wyników</span>
                      <span className="subtle-icon">{resultsViewCollapsed ? '▸' : '▾'}</span>
                    </h3>
                    {!resultsViewCollapsed && (
                      <>
                        <div className={`diagToggle ${showReactions ? 'active' : ''}`}>
                          <span className="lbl">
                            <span className="swatch" style={{ background: 'var(--react-color)' }}></span>
                            Reakcje podporowe
                          </span>
                          <input
                            type="checkbox"
                            checked={showReactions}
                            onChange={(e) => setShowReactions(e.target.checked)}
                          />
                        </div>

                        <div className={`diagToggle ${showDeform ? 'active' : ''}`}>
                          <span className="lbl">
                            <span className="swatch" style={{ background: 'var(--def-color)' }}></span>
                            Forma odkształcenia (ugięcie)
                          </span>
                          <input
                            type="checkbox"
                            checked={showDeform}
                            onChange={(e) => setShowDeform(e.target.checked)}
                          />
                        </div>
                        {showDeform && (
                          <div className="row">
                            <label style={{ minWidth: '96px' }}>Skala odkszt.</label>
                            <input
                              type="range"
                              min="0.1"
                              max="5"
                              step="0.1"
                              value={deformScaleMult}
                              onChange={(e) => setDeformScaleMult(parseFloat(e.target.value))}
                            />
                            <span className="unit" style={{ width: '34px' }}>
                              {deformScaleMult.toFixed(1)}×
                            </span>
                          </div>
                        )}

                        <div className={`diagToggle ${showMy ? 'active' : ''}`}>
                          <span className="lbl">
                            <span className="swatch" style={{ background: '#dc2626' }}></span>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', marginRight: '6px', marginLeft: '1px', flexShrink: 0 }} title="Oś lokalna y" />
                            Moment zginający My
                          </span>
                          <input type="checkbox" checked={showMy} onChange={(e) => setShowMy(e.target.checked)} />
                        </div>

                        <div className={`diagToggle ${showMz ? 'active' : ''}`}>
                          <span className="lbl">
                            <span className="swatch" style={{ background: '#ea580c' }}></span>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', marginRight: '6px', marginLeft: '1px', flexShrink: 0 }} title="Oś lokalna z" />
                            Moment zginający Mz
                          </span>
                          <input type="checkbox" checked={showMz} onChange={(e) => setShowMz(e.target.checked)} />
                        </div>

                        <div className={`diagToggle ${showMx ? 'active' : ''}`}>
                          <span className="lbl">
                            <span className="swatch" style={{ background: '#9333ea' }}></span>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', marginRight: '6px', marginLeft: '1px', flexShrink: 0 }} title="Oś lokalna x" />
                            Moment skręcający Mx
                          </span>
                          <input type="checkbox" checked={showMx} onChange={(e) => setShowMx(e.target.checked)} />
                        </div>

                        <div className={`diagToggle ${showVy ? 'active' : ''}`}>
                          <span className="lbl">
                            <span className="swatch" style={{ background: '#0284c7' }}></span>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', marginRight: '6px', marginLeft: '1px', flexShrink: 0 }} title="Oś lokalna y" />
                            Siła tnąca Vy
                          </span>
                          <input type="checkbox" checked={showVy} onChange={(e) => setShowVy(e.target.checked)} />
                        </div>

                        <div className={`diagToggle ${showVz ? 'active' : ''}`}>
                          <span className="lbl">
                            <span className="swatch" style={{ background: '#0d9488' }}></span>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', marginRight: '6px', marginLeft: '1px', flexShrink: 0 }} title="Oś lokalna z" />
                            Siła tnąca Vz
                          </span>
                          <input type="checkbox" checked={showVz} onChange={(e) => setShowVz(e.target.checked)} />
                        </div>

                        <div className={`diagToggle ${showN ? 'active' : ''}`}>
                          <span className="lbl">
                            <span className="swatch" style={{ background: '#16a34a' }}></span>
                            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', marginRight: '6px', marginLeft: '1px', flexShrink: 0 }} title="Oś lokalna x" />
                            Siła osiowa N
                          </span>
                          <input type="checkbox" checked={showN} onChange={(e) => setShowN(e.target.checked)} />
                        </div>

                        <div className={`diagToggle ${showStress ? 'active' : ''}`}>
                          <span className="lbl">
                            <span className="swatch" style={{ background: '#d97706' }}></span>
                            Naprężenia zredukowane σ
                          </span>
                          <input
                            type="checkbox"
                            checked={showStress}
                            onChange={(e) => setShowStress(e.target.checked)}
                          />
                        </div>

                        {(showMy || showMz || showMx || showVy || showVz || showN || showStress) && (
                          <div className="row" style={{ marginTop: '6px' }}>
                            <label style={{ minWidth: '96px' }}>Skala wykresów</label>
                            <input
                              type="range"
                              min="0.1"
                              max="5"
                              step="0.1"
                              value={diagramScaleMult}
                              onChange={(e) => setDiagramScaleMult(parseFloat(e.target.value))}
                            />
                            <span className="unit" style={{ width: '34px' }}>
                              {diagramScaleMult.toFixed(1)}×
                            </span>
                          </div>
                        )}

                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--surface-border-soft)' }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Wartości na wykresach
                          </div>
                          <div style={{ display: 'flex', width: '100%', gap: '4px', background: 'var(--input-bg)', padding: '3px', borderRadius: '7px', border: '1px solid var(--input-border)' }}>
                            <button
                              type="button"
                              title="Ukryj etykiety wartości na wykresach sił i ugięciach"
                              style={{
                                flex: 1,
                                padding: '5px 0',
                                fontSize: '11.5px',
                                fontWeight: diagramLabelMode === 'none' ? 600 : 400,
                                textAlign: 'center',
                                borderRadius: '5px',
                                border: diagramLabelMode === 'none' ? '1px solid var(--accent)' : '1px solid transparent',
                                background: diagramLabelMode === 'none' ? 'var(--surface)' : 'transparent',
                                color: diagramLabelMode === 'none' ? 'var(--accent)' : 'var(--text-dim)',
                                cursor: 'pointer',
                                boxShadow: diagramLabelMode === 'none' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s ease',
                              }}
                              onClick={() => setDiagramLabelMode?.('none')}
                            >
                              brak
                            </button>
                            <button
                              type="button"
                              title="Pokaż tylko wartości minimalne i maksymalne (ekstrema globalne / wypadkowe)"
                              style={{
                                flex: 1,
                                padding: '5px 0',
                                fontSize: '11.5px',
                                fontWeight: diagramLabelMode === 'minmax' ? 600 : 400,
                                textAlign: 'center',
                                borderRadius: '5px',
                                border: diagramLabelMode === 'minmax' ? '1px solid var(--accent)' : '1px solid transparent',
                                background: diagramLabelMode === 'minmax' ? 'var(--surface)' : 'transparent',
                                color: diagramLabelMode === 'minmax' ? 'var(--accent)' : 'var(--text-dim)',
                                cursor: 'pointer',
                                boxShadow: diagramLabelMode === 'minmax' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s ease',
                              }}
                              onClick={() => setDiagramLabelMode?.('minmax')}
                            >
                              min/max
                            </button>
                            <button
                              type="button"
                              title="Pokaż wszystkie etykiety wartości na końcach prętów i w punktach szczytowych"
                              style={{
                                flex: 1,
                                padding: '5px 0',
                                fontSize: '11.5px',
                                fontWeight: diagramLabelMode === 'all' ? 600 : 400,
                                textAlign: 'center',
                                borderRadius: '5px',
                                border: diagramLabelMode === 'all' ? '1px solid var(--accent)' : '1px solid transparent',
                                background: diagramLabelMode === 'all' ? 'var(--surface)' : 'transparent',
                                color: diagramLabelMode === 'all' ? 'var(--accent)' : 'var(--text-dim)',
                                cursor: 'pointer',
                                boxShadow: diagramLabelMode === 'all' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s ease',
                              }}
                              onClick={() => setDiagramLabelMode?.('all')}
                            >
                              wszystkie
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* SONDA WYNIKÓW 3D */}
                  <div className="panel">
                    <h3
                      className="collapsible-head"
                      onClick={() => setProbeCollapsed(!probeCollapsed)}
                      style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <span>Sonda wyników</span>
                      <span className="subtle-icon">{probeCollapsed ? '▸' : '▾'}</span>
                    </h3>
                    {!probeCollapsed && (
                      <>
                        <div className="row">
                          <label>Pręt</label>
                          <select
                            value={probe.elId ?? ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? null : parseInt(e.target.value);
                              setProbe({ elId: isNaN(val as number) ? null : val, t: probe.t });
                            }}
                          >
                            <option value="">— wybierz pręt lub kliknij na modelu —</option>
                            {elements.map((e) => (
                              <option key={e.id} value={e.id}>
                                P{e.id} (W{e.n1}→W{e.n2})
                              </option>
                            ))}
                          </select>
                        </div>
                        {probe.elId != null ? (
                          <div className="row">
                            <label>Pozycja x</label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="1"
                              value={probe.t * 100}
                              onChange={(e) => setProbe({ elId: probe.elId, t: parseFloat(e.target.value) / 100 })}
                            />
                            <span className="unit" style={{ width: '56px' }}>
                              {(probe.t * 100).toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)', padding: '6px 2px', lineHeight: '1.4' }}>
                            Kliknij pręt na modelu lub wybierz z listy powyżej, aby odczytać siły i ugięcia.
                          </div>
                        )}

                        {probe.elId != null && (solved.elements?.[probe.elId] || (solved.type === 'linear_static' && solved.results[elements.findIndex((e) => e.id === probe.elId)])) && (
                          <div style={{ marginTop: '8px' }}>
                            {(() => {
                              const resPts = solved.elements?.[probe.elId]?.points || (solved.type === 'linear_static' ? solved.results[elements.findIndex((e) => e.id === probe.elId)]?.pts : []);
                              if (!resPts || resPts.length === 0) return null;
                              const ptIdx = Math.min(
                                resPts.length - 1,
                                Math.max(0, Math.round(probe.t * (resPts.length - 1)))
                              );
                              const pt = resPts[ptIdx];
                              if (!pt) return null;
                              return (
                                <table className="probetable">
                                  <thead>
                                    <tr>
                                      <th>Wielkość</th>
                                      <th style={{ color: 'var(--text)', textAlign: 'right' }}>Wartość</th>
                                      <th style={{ color: 'var(--text-dim)', textAlign: 'right', width: '45px' }}>
                                        Jedn.
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td>
                                        <span className="swatch" style={{ background: 'var(--def-color)' }}></span>
                                        <strong>|u|</strong> <span className="muted">u wypadkowe</span>
                                      </td>
                                      <td style={{ color: 'var(--def-color)', fontWeight: 600 }}>
                                        {fmtSmart(Math.hypot(pt.Ux_global || 0, pt.Uy_global || 0, pt.Uz_global || 0) * 1000, 3)}
                                      </td>
                                      <td className="muted">mm</td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <span className="swatch" style={{ background: 'var(--def-color)' }}></span>
                                        <strong>ux</strong> <span className="muted">lokalne u_x</span>
                                      </td>
                                      <td>{fmtSmart((pt.ux_local || 0) * 1000, 3)}</td>
                                      <td className="muted">mm</td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <span className="swatch" style={{ background: 'var(--def-color)' }}></span>
                                        <strong>uy</strong> <span className="muted">lokalne u_y</span>
                                      </td>
                                      <td style={{ color: 'var(--def-color)', fontWeight: 600 }}>
                                        {fmtSmart((pt.uy_local || 0) * 1000, 3)}
                                      </td>
                                      <td className="muted">mm</td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <span className="swatch" style={{ background: 'var(--def-color)' }}></span>
                                        <strong>uz</strong> <span className="muted">lokalne u_z</span>
                                      </td>
                                      <td style={{ color: 'var(--def-color)', fontWeight: 600 }}>
                                        {fmtSmart((pt.uz_local || 0) * 1000, 3)}
                                      </td>
                                      <td className="muted">mm</td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <span className="swatch" style={{ background: 'var(--def-color)' }}></span>
                                        <strong>Ux, Uy, Uz</strong> <span className="muted">globalne</span>
                                      </td>
                                      <td>
                                        {fmtSmart((pt.Ux_global || 0) * 1000, 2)}, {fmtSmart((pt.Uy_global || 0) * 1000, 2)}, {fmtSmart((pt.Uz_global || 0) * 1000, 2)}
                                      </td>
                                      <td className="muted">mm</td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <span className="swatch" style={{ background: 'var(--def-color)' }}></span>
                                        <strong>θx, θy, θz</strong> <span className="muted">obrót</span>
                                      </td>
                                      <td>
                                        {fmtSmart((pt.rotx_local || 0) * 1000, 2)}, {fmtSmart((pt.roty_local || 0) * 1000, 2)}, {fmtSmart((pt.rotz_local || 0) * 1000, 2)}
                                      </td>
                                      <td className="muted">mrad</td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <span className="swatch" style={{ background: 'var(--m-color)' }}></span>
                                        <strong>My</strong> <span className="muted">zginający y</span>
                                      </td>
                                      <td style={{ color: 'var(--m-color)', fontWeight: 600 }}>
                                        {fmtSmart(pt.My, 3)}
                                      </td>
                                      <td className="muted">kNm</td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <span className="swatch" style={{ background: 'var(--m-color)' }}></span>
                                        <strong>Mz</strong> <span className="muted">zginający z</span>
                                      </td>
                                      <td style={{ color: 'var(--m-color)', fontWeight: 600 }}>
                                        {fmtSmart(pt.Mz, 3)}
                                      </td>
                                      <td className="muted">kNm</td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <span className="swatch" style={{ background: 'var(--m-color)' }}></span>
                                        <strong>Mx</strong> <span className="muted">skręcający</span>
                                      </td>
                                      <td>{fmtSmart(pt.Mx, 3)}</td>
                                      <td className="muted">kNm</td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <span className="swatch" style={{ background: 'var(--t-color)' }}></span>
                                        <strong>Vy</strong> <span className="muted">tnąca y</span>
                                      </td>
                                      <td style={{ color: 'var(--t-color)', fontWeight: 600 }}>
                                        {fmtSmart(pt.Vy, 3)}
                                      </td>
                                      <td className="muted">kN</td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <span className="swatch" style={{ background: 'var(--t-color)' }}></span>
                                        <strong>Vz</strong> <span className="muted">tnąca z</span>
                                      </td>
                                      <td style={{ color: 'var(--t-color)', fontWeight: 600 }}>
                                        {fmtSmart(pt.Vz, 3)}
                                      </td>
                                      <td className="muted">kN</td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <span className="swatch" style={{ background: 'var(--n-color)' }}></span>
                                        <strong>N</strong> <span className="muted">osiowa</span>
                                      </td>
                                      <td style={{ color: 'var(--n-color)', fontWeight: 600 }}>
                                        {fmtSmart(pt.N, 3)}
                                      </td>
                                      <td className="muted">kN</td>
                                    </tr>
                                    <tr>
                                      <td>
                                        <span className="swatch" style={{ background: 'var(--s-color)' }}></span>
                                        <strong>σ<sub>max</sub></strong> <span className="muted">naprężenie</span>
                                      </td>
                                      <td>{fmtSmart((pt.sigMax || 0) / 1000, 2)}</td>
                                      <td className="muted">MPa</td>
                                    </tr>
                                  </tbody>
                                </table>
                              );
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* WYKORZYSTANIE PRZEKROJÓW */}
                  {(() => {
                    const staticResult = solved.type === 'linear_static'
                      ? solved
                      : solved.type === 'stability'
                      ? solved.staticSolved
                      : null;

                    if (!staticResult) return null;

                    const utilizationData = (() => {
                      const rows: {
                        id: string;
                        name: string;
                        color: string;
                        maxStress: number;
                        fd: number;
                        ratio: number;
                        criticalElemId: number | null;
                      }[] = [];

                      // 1. Defined groups
                      groups.forEach((g) => {
                        const groupElems = elements.filter((el) => el.groupId === g.id);
                        if (groupElems.length === 0) return;

                        let maxStressGroup = 0;
                        let criticalFd = 235;
                        let maxRatio = 0;
                        let criticalElemId: number | null = null;

                        groupElems.forEach((el) => {
                          const resPts = staticResult.elements?.[el.id]?.points || 
                            (staticResult.type === 'linear_static' ? staticResult.results[elements.findIndex((e) => e.id === el.id)]?.pts : []);
                          
                          let maxStressEl = 0;
                          if (resPts && resPts.length > 0) {
                            resPts.forEach((pt) => {
                              const stress = Math.max(Math.abs(pt.sigMax || 0), Math.abs(pt.sigMin || 0)) / 1000.0; // convert kPa to MPa
                              if (stress > maxStressEl) {
                                maxStressEl = stress;
                              }
                            });
                          }

                          const matId = g.materialId !== undefined ? g.materialId : el.materialId;
                          const mat = materials.find((m) => m.id === matId);
                          const fd = mat?.fd || 235;

                          const ratio = fd > 0 ? (maxStressEl / fd) * 100 : 0;
                          if (ratio > maxRatio || criticalElemId === null) {
                            maxRatio = ratio;
                            maxStressGroup = maxStressEl;
                            criticalFd = fd;
                            criticalElemId = el.id;
                          }
                        });

                        rows.push({
                          id: g.id,
                          name: g.name,
                          color: g.color,
                          maxStress: maxStressGroup,
                          fd: criticalFd,
                          ratio: maxRatio,
                          criticalElemId,
                        });
                      });

                      // 2. Elements with no group
                      const noGroupElems = elements.filter((el) => !el.groupId);
                      if (noGroupElems.length > 0) {
                        let maxStressGroup = 0;
                        let criticalFd = 235;
                        let maxRatio = 0;
                        let criticalElemId: number | null = null;

                        noGroupElems.forEach((el) => {
                          const resPts = staticResult.elements?.[el.id]?.points || 
                            (staticResult.type === 'linear_static' ? staticResult.results[elements.findIndex((e) => e.id === el.id)]?.pts : []);
                          
                          let maxStressEl = 0;
                          if (resPts && resPts.length > 0) {
                            resPts.forEach((pt) => {
                              const stress = Math.max(Math.abs(pt.sigMax || 0), Math.abs(pt.sigMin || 0)) / 1000.0;
                              if (stress > maxStressEl) {
                                maxStressEl = stress;
                              }
                            });
                          }

                          const mat = materials.find((m) => m.id === el.materialId);
                          const fd = mat?.fd || 235;

                          const ratio = fd > 0 ? (maxStressEl / fd) * 100 : 0;
                          if (ratio > maxRatio || criticalElemId === null) {
                            maxRatio = ratio;
                            maxStressGroup = maxStressEl;
                            criticalFd = fd;
                            criticalElemId = el.id;
                          }
                        });

                        rows.push({
                          id: 'no-group',
                          name: 'Brak grupy',
                          color: '#94a3b8',
                          maxStress: maxStressGroup,
                          fd: criticalFd,
                          ratio: maxRatio,
                          criticalElemId,
                        });
                      }

                      return rows;
                    })();

                    if (utilizationData.length === 0) return null;

                    return (
                      <div className="panel">
                        <h3
                          className="collapsible-head"
                          onClick={() => setUtilizationCollapsed(!utilizationCollapsed)}
                          style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <span>Wykorzystanie przekrojów</span>
                          <span className="subtle-icon">{utilizationCollapsed ? '▸' : '▾'}</span>
                        </h3>
                        {!utilizationCollapsed && (
                          <div style={{ overflowX: 'auto' }}>
                            <table className="rtab">
                              <thead>
                                <tr>
                                  <th>Grupa</th>
                                  <th>Pręt kryt.</th>
                                  <th>σ<sub>max</sub> [MPa]</th>
                                  <th>f<sub>d</sub> [MPa]</th>
                                  <th>Wykorzystanie</th>
                                </tr>
                              </thead>
                              <tbody>
                                {utilizationData.map((row) => {
                                  const isOver = row.ratio > 100;
                                  const barColor = isOver ? '#ef4444' : 'var(--accent)';
                                  const barWidth = Math.min(100, row.ratio);

                                  return (
                                    <tr key={row.id}>
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span
                                            style={{
                                              display: 'inline-block',
                                              width: '10px',
                                              height: '10px',
                                              borderRadius: '50%',
                                              backgroundColor: row.color,
                                              flexShrink: 0
                                            }}
                                          ></span>
                                          <span style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>{row.name}</span>
                                        </div>
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        {row.criticalElemId !== null ? `P${row.criticalElemId}` : '-'}
                                      </td>
                                      <td style={{ textAlign: 'right' }}>{row.maxStress.toFixed(1)}</td>
                                      <td style={{ textAlign: 'right' }}>{row.fd.toFixed(1)}</td>
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '100px' }}>
                                          <div
                                            style={{
                                              flex: 1,
                                              height: '6px',
                                              backgroundColor: 'rgba(0,0,0,0.1)',
                                              borderRadius: '3px',
                                              overflow: 'hidden',
                                              position: 'relative',
                                            }}
                                          >
                                            <div
                                              style={{
                                                width: `${barWidth}%`,
                                                height: '100%',
                                                backgroundColor: barColor,
                                                borderRadius: '3px',
                                              }}
                                            ></div>
                                          </div>
                                          <span
                                            style={{
                                              fontSize: '11px',
                                              fontWeight: isOver ? 'bold' : 'normal',
                                              color: isOver ? '#ef4444' : 'inherit',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {row.ratio.toFixed(1)}%
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* PRZYPADKI OBCIĄŻEŃ I KOMBINACJE (EUROKOD) */}
              {loadCases && onSelectLoadCase && onAddLoadCase && onUpdateLoadCase && onDeleteLoadCase && (
                <LoadCasesPanel
                  loadCases={loadCases}
                  activeLoadCaseId={activeLoadCaseId}
                  onSelectLoadCase={onSelectLoadCase}
                  onAddLoadCase={onAddLoadCase}
                  onUpdateLoadCase={onUpdateLoadCase}
                  onDeleteLoadCase={onDeleteLoadCase}
                  autoCombinations={autoCombinations}
                  setAutoCombinations={setAutoCombinations || (() => {})}
                  customCombinations={customCombinations}
                  onInvalidateResults={onInvalidateResults}
                />
              )}

              {/* RODZAJ ANALIZY */}
              <div className="panel">
                <h3
                  className="collapsible-head"
                  onClick={() => setAnalysisCollapsed(!analysisCollapsed)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <span>Rodzaj analizy</span>
                  <span className="subtle-icon">{analysisCollapsed ? '▸' : '▾'}</span>
                </h3>
                {!analysisCollapsed && (
                  <div>
                    <div className="row">
                      <label style={{ minWidth: '70px' }}>Analiza</label>
                      <select
                        value={analysisSettings.type}
                        onChange={(e) => {
                          setAnalysisSettings({
                            ...analysisSettings,
                            type: e.target.value as AnalysisType,
                          });
                          onInvalidateResults();
                        }}
                      >
                        <option value="linear_static">Statyka liniowa</option>
                        <option value="stability">Stateczność (wyboczenie)</option>
                        <option value="modal">Drgania własne (modalna)</option>
                      </select>
                    </div>

                    {analysisSettings.type === 'linear_static' && (
                      <div className="muted" style={{ marginTop: '6px', lineHeight: 1.4 }}>
                        Analiza statyczna: wyznacza 6 sił przekrojowych (N, Vy, Vz, Mx, My, Mz),
                        przemieszczenia w węzłach oraz reakcje podporowe.
                      </div>
                    )}

                    {analysisSettings.type === 'stability' && (
                      <div style={{ marginTop: '8px' }}>
                        <div className="row">
                          <label style={{ minWidth: '110px' }}>Liczba form</label>
                          <SmartNumberInput
                            min={1}
                            max={20}
                            step="1"
                            value={analysisSettings.params.bucklingModes || 4}
                            onChange={(v) =>
                              setAnalysisSettings({
                                ...analysisSettings,
                                params: {
                                  ...analysisSettings.params,
                                  bucklingModes: Math.max(1, Math.round(v)),
                                },
                              })
                            }
                            style={{ maxWidth: '70px' }}
                          />
                        </div>
                        <div className="muted" style={{ marginTop: '6px', lineHeight: 1.4 }}>
                          Analiza stateczności: wyznacza mnożniki obciążenia krytycznego α<sub>cr</sub> i formy wyboczenia.
                        </div>
                      </div>
                    )}

                    {analysisSettings.type === 'modal' && (
                      <div style={{ marginTop: '8px' }}>
                        <div className="row">
                          <label style={{ minWidth: '110px' }}>Liczba form</label>
                          <SmartNumberInput
                            min={1}
                            max={20}
                            step="1"
                            value={analysisSettings.params.modalModes || 4}
                            onChange={(v) =>
                              setAnalysisSettings({
                                ...analysisSettings,
                                params: {
                                  ...analysisSettings.params,
                                  modalModes: Math.round(v),
                                },
                              })
                            }
                            style={{ maxWidth: '70px' }}
                          />
                        </div>
                        <div className="checkline" style={{ marginTop: '8px' }}>
                          <input
                            type="checkbox"
                            checked={analysisSettings.params.includeElementMass !== false}
                            onChange={(e) =>
                              setAnalysisSettings({
                                ...analysisSettings,
                                params: {
                                  ...analysisSettings.params,
                                  includeElementMass: e.target.checked,
                                },
                              })
                            }
                          />{' '}
                          Uwzględnij masę prętów
                        </div>
                          <div className="muted" style={{ marginTop: '6px', lineHeight: 1.4 }}>
                          Analiza dynamiczna: wyznacza częstości drgań własnych i formy drgań własnych.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* GROUP 3: BIBLIOTEKA (Materiały & Przekroje & Grupy) */}
        <div className="sidebar-group">
          <div className="group-header" onClick={() => setLibraryCollapsed(!libraryCollapsed)}>
            <div className="group-title">
              <span>Biblioteka</span>
              <span className="group-tag">
                {materials.length} mat. / {sections.length} przekr. / {groups.length} gr.
              </span>
            </div>
            <span className="subtle-icon">{libraryCollapsed ? '▸' : '▾'}</span>
          </div>

          {!libraryCollapsed && (
            <div className="group-body">
              {/* MATERIAŁY */}
              <div className="panel">
                <h3>
                  Materiały <span className="tag">{materials.length}</span>
                </h3>
                {materials.map((m) => (
                  <div key={m.id} className="listitem" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                      <strong style={{ color: 'var(--text)' }}>{m.name}</strong>
                      <br />
                      <span className="muted">
                        E={m.E} GPa, ν={m.nu ?? 0.3}, ρ={m.density || 0} kg/m³, f<sub>d</sub>={m.fd !== undefined ? m.fd : 235} MPa
                      </span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span
                        className="del"
                        style={{ color: 'var(--text-dim)', cursor: 'pointer' }}
                        onClick={() => {
                          backupMaterialRef.current = { ...m };
                          setEditingMatId(m.id);
                          setNewMatName(m.name);
                          setNewMatE(m.E);
                          setNewMatNu(m.nu ?? 0.3);
                          setNewMatAlpha(m.alpha ?? 1.2);
                          setNewMatDensity(m.density ?? 7850);
                          setNewMatFd(m.fd !== undefined ? m.fd : 235);
                          setAddMatFormOpen(true);
                        }}
                        title="Edytuj materiał"
                      >
                        ✎
                      </span>
                      {materials.length > 1 && (
                        <span
                          className="del"
                          onClick={() => {
                            const remaining = materials.filter((item) => item.id !== m.id);
                            setMaterials(remaining);
                            if (remaining.length > 0) {
                              setElements((prev) =>
                                prev.map((el) => (el.materialId === m.id ? { ...el, materialId: remaining[0].id } : el))
                              );
                            }
                            onInvalidateResults();
                          }}
                          title="Usuń materiał"
                        >
                          ✕
                        </span>
                      )}
                    </span>
                  </div>
                ))}

                {addMatFormOpen ? (
                  <div
                    className="card"
                    style={{
                      marginTop: '6px',
                      background: 'var(--surface)',
                      borderColor: 'var(--input-border)',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '8px', color: 'var(--text)' }}>
                      {editingMatId ? 'Edycja materiału' : 'Nowy materiał'}
                    </div>
                    <div className="row">
                      <label>Nazwa</label>
                      <input
                        type="text"
                        value={newMatName}
                        onChange={(e) => setNewMatName(e.target.value)}
                      />
                    </div>
                    <div className="row-pair">
                      <div className="half">
                        <label>E</label>
                        <div className="inp-unit">
                           <SmartNumberInput
                            step="5"
                            value={newMatE}
                            onChange={(v) => setNewMatE(v)}
                          />
                          <span className="unit">GPa</span>
                        </div>
                      </div>
                      <div className="half">
                        <label>ν (Poisson)</label>
                        <div className="inp-unit">
                          <SmartNumberInput
                            step="0.05"
                            value={newMatNu}
                            onChange={(v) => setNewMatNu(v)}
                          />
                          <span className="unit">—</span>
                        </div>
                      </div>
                    </div>
                    <div className="row">
                      <label>Wytrzymałość f<sub>d</sub></label>
                      <SmartNumberInput
                        step="10"
                        value={newMatFd}
                        onChange={(v) => setNewMatFd(v)}
                      />
                      <span className="unit">MPa</span>
                    </div>
                    <div className="row">
                      <label>Gęstość</label>
                      <SmartNumberInput
                        step="100"
                        value={newMatDensity}
                        onChange={(v) => setNewMatDensity(v)}
                      />
                      <span className="unit">kg/m³</span>
                    </div>
                    <div className="btnrow" style={{ marginTop: '8px' }}>
                      <button className="mini on" onClick={handleAddMaterial}>
                        {editingMatId ? 'Zapisz' : 'Dodaj'}
                      </button>
                      <button
                        className="mini"
                        onClick={() => {
                          if (editingMatId !== null && backupMaterialRef.current) {
                            const orig = backupMaterialRef.current;
                            setMaterials((prev) => prev.map((mat) => (mat.id === orig.id ? orig : mat)));
                          }
                          setAddMatFormOpen(false);
                          setEditingMatId(null);
                          backupMaterialRef.current = null;
                        }}
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="btnrow">
                    <button
                      className="mini"
                      onClick={() => {
                        setNewMatName(`Materiał ${materials.length + 1}`);
                        setNewMatE(210);
                        setNewMatNu(0.3);
                        setNewMatAlpha(1.2);
                        setNewMatDensity(7850);
                        setNewMatFd(235);
                        setEditingMatId(null);
                        setAddMatFormOpen(true);
                      }}
                    >
                      + Dodaj materiał
                    </button>
                  </div>
                )}
              </div>

              {/* PRZEKROJE */}
              <div className="panel">
                <h3>
                  Przekroje <span className="tag">{sections.length}</span>
                </h3>
                {sections.map((s) => (
                  <div key={s.id} className="listitem" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                      <strong style={{ color: 'var(--text)' }}>{s.name}</strong>
                      <br />
                      <span className="muted">
                        A={fmtSmart(s.A)} cm², Iy={fmtSmart(s.Iy)} cm⁴, Iz={fmtSmart(s.Iz)} cm⁴
                      </span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span
                        className="del"
                        style={{ color: 'var(--text-dim)', cursor: 'pointer' }}
                        onClick={() => {
                          backupSectionRef.current = { ...s };
                          setEditingSecId(s.id);
                          setNewSecName(s.name);
                          if (s.category === 'katalog' || (s.shape && s.shape.startsWith('cat'))) {
                            setNewSecCategory('katalog');
                            let catKey = s.shape ? s.shape.replace('cat', '') : '';
                            if (!CATALOG_DEFS[catKey]) {
                              for (const k of CATALOG_ORDER) {
                                if (s.name && (s.name.startsWith(k + ' ') || s.name === k)) {
                                  catKey = k;
                                  break;
                                }
                              }
                            }
                            if (!CATALOG_DEFS[catKey]) {
                              catKey = 'IPE';
                            }
                            setNewSecCatType(catKey);
                            let idx = -1;
                            const def = CATALOG_DEFS[catKey];
                            if (def) {
                              // Prioritize finding by actual physical dimensions & area
                              if (s.h != null && s.b != null) {
                                idx = def.data.findIndex(
                                  (item) => Math.abs(item.h - s.h) < 0.05 && Math.abs(item.b - s.b) < 0.05 && (s.A == null || Math.abs(item.A - s.A) < 0.5)
                                );
                                if (idx < 0) {
                                  idx = def.data.findIndex(
                                    (item) => Math.abs(item.h - s.h) < 0.1 && Math.abs(item.b - s.b) < 0.1
                                  );
                                }
                              }
                              // Fallback to matching by profile name if dimensions didn't match
                              if (idx < 0) {
                                idx = def.data.findIndex((item) => item.name === s.name);
                              }
                              setNewSecCatSizeIdx(idx >= 0 ? idx : 0);
                            } else {
                              setNewSecCatSizeIdx(0);
                            }
                          } else if (s.category === 'ksztalt' || ['rect', 'circ', 'pipe', 'box', 'ibeam', 'tee', 'angle'].includes(s.shape)) {
                            setNewSecCategory('ksztalt');
                            setNewSecShape((s.shape as any) || 'rect');
                            setNewSecB(s.b || 20);
                            setNewSecH(s.h || 40);
                            setNewSecD(s.h || 30);
                            setNewSecT(s.t || 1);
                            setNewSecTf(s.tf || 1.2);
                            setNewSecTw(s.tw || 0.8);
                          } else {
                            setNewSecCategory('wlasny');
                            setNewSecA(s.A);
                            setNewSecIy(s.Iy);
                            setNewSecIz(s.Iz);
                            setNewSecIt(s.It || 500);
                            setNewSecCTopY(s.cTopY ?? (s.h != null ? s.h / 2 : 10));
                            setNewSecCBotY(s.cBotY ?? (s.h != null ? s.h / 2 : 10));
                            setNewSecCTopZ(s.cTopZ ?? (s.b != null ? s.b / 2 : 10));
                            setNewSecCBotZ(s.cBotZ ?? (s.b != null ? s.b / 2 : 10));
                          }
                          setAddSecFormOpen(true);
                        }}
                        title="Edytuj przekrój"
                      >
                        ✎
                      </span>
                      {sections.length > 1 && (
                        <span
                          className="del"
                          onClick={() => {
                            const remaining = sections.filter((item) => item.id !== s.id);
                            setSections(remaining);
                            if (remaining.length > 0) {
                              setElements((prev) =>
                                prev.map((el) => (el.sectionId === s.id ? { ...el, sectionId: remaining[0].id } : el))
                              );
                            }
                            onInvalidateResults();
                          }}
                          title="Usuń przekrój"
                        >
                          ✕
                        </span>
                      )}
                    </span>
                  </div>
                ))}

                {addSecFormOpen ? (
                  <div
                    className="card"
                    style={{
                      marginTop: '6px',
                      background: 'var(--surface)',
                      borderColor: 'var(--input-border)',
                      padding: '12px',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '8px', color: 'var(--text)' }}>
                      {editingSecId ? 'Edycja przekroju' : 'Nowy przekrój'}
                    </div>
                    <div className="row">
                      <label>Nazwa (opcjonalnie)</label>
                      <input
                        type="text"
                        placeholder="Automatyczna lub własna"
                        value={newSecName === 'Nowy przekrój' ? '' : newSecName}
                        onChange={(e) => setNewSecName(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '4px', margin: '8px 0' }}>
                      <button
                        type="button"
                        className="mini"
                        style={{
                          flex: 1,
                          background: newSecCategory === 'katalog' ? 'var(--accent)' : 'var(--input-bg)',
                          color: newSecCategory === 'katalog' ? '#fff' : 'var(--text)',
                          border: '1px solid var(--input-border)',
                          fontWeight: newSecCategory === 'katalog' ? '600' : 'normal',
                        }}
                        onClick={() => {
                          setNewSecCategory('katalog');
                          const def = CATALOG_DEFS[newSecCatType];
                          const item = def?.data[newSecCatSizeIdx] || def?.data[0];
                          if (item) setNewSecName(item.name);
                        }}
                      >
                        Katalog
                      </button>
                      <button
                        type="button"
                        className="mini"
                        style={{
                          flex: 1,
                          background: newSecCategory === 'ksztalt' ? 'var(--accent)' : 'var(--input-bg)',
                          color: newSecCategory === 'ksztalt' ? '#fff' : 'var(--text)',
                          border: '1px solid var(--input-border)',
                          fontWeight: newSecCategory === 'ksztalt' ? '600' : 'normal',
                        }}
                        onClick={() => {
                          setNewSecCategory('ksztalt');
                          const labels: Record<string, string> = {
                            rect: `Prostokąt ${newSecB}×${newSecH}`,
                            circ: `Okrągły Ø${newSecD}`,
                            pipe: `Rura okrągła Ø${newSecD}×${newSecT}`,
                            box: `Profil skrzynkowy ${newSecB}×${newSecH}×${newSecT}`,
                            ibeam: `Dwuteownik ${newSecB}×${newSecH}`,
                            tee: `Teownik ${newSecB}×${newSecH}`,
                            angle: `Kątownik L ${newSecH}×${newSecH}×${newSecT}`,
                          };
                          if (labels[newSecShape]) setNewSecName(labels[newSecShape]);
                        }}
                      >
                        Kształt
                      </button>
                      <button
                        type="button"
                        className="mini"
                        style={{
                          flex: 1,
                          background: newSecCategory === 'wlasny' ? 'var(--accent)' : 'var(--input-bg)',
                          color: newSecCategory === 'wlasny' ? '#fff' : 'var(--text)',
                          border: '1px solid var(--input-border)',
                          fontWeight: newSecCategory === 'wlasny' ? '600' : 'normal',
                        }}
                        onClick={() => {
                          setNewSecCategory('wlasny');
                          if (!newSecName || newSecName === 'Nowy przekrój' || newSecName.startsWith('IPE') || newSecName.startsWith('HEA') || newSecName.startsWith('HEB')) {
                            setNewSecName('Przekrój własny');
                          }
                        }}
                      >
                        Własny
                      </button>
                    </div>

                    {newSecCategory === 'katalog' && (
                      <>
                        <div className="row">
                          <label>Profil</label>
                          <select
                            value={newSecCatType}
                            onChange={(e) => {
                              const newType = e.target.value;
                              setNewSecCatType(newType);
                              setNewSecCatSizeIdx(0);
                              const def = CATALOG_DEFS[newType];
                              const item = def?.data[0];
                              if (item) {
                                setNewSecName(item.name);
                              }
                            }}
                          >
                            {CATALOG_ORDER.map((k) => (
                              <option key={k} value={k}>
                                {CATALOG_DEFS[k].label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="row">
                          <label>Rozmiar</label>
                          <select
                            value={newSecCatSizeIdx}
                            onChange={(e) => {
                              const idx = parseInt(e.target.value) || 0;
                              setNewSecCatSizeIdx(idx);
                              const def = CATALOG_DEFS[newSecCatType];
                              const item = def?.data[idx];
                              if (item) {
                                setNewSecName(item.name);
                              }
                            }}
                          >
                            {CATALOG_DEFS[newSecCatType]?.data.map((item, idx) => (
                              <option key={idx} value={idx}>
                                {item.name} (h={item.h}×b={item.b} cm)
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {newSecCategory === 'ksztalt' && (
                      <>
                        <div className="row">
                          <label>Typ kształtu</label>
                          <select
                            value={newSecShape}
                            onChange={(e) => {
                              const shape = e.target.value as any;
                              setNewSecShape(shape);
                              const labels: Record<string, string> = {
                                rect: `Prostokąt ${newSecB}×${newSecH}`,
                                circ: `Okrągły Ø${newSecD}`,
                                pipe: `Rura okrągła Ø${newSecD}×${newSecT}`,
                                box: `Profil skrzynkowy ${newSecB}×${newSecH}×${newSecT}`,
                                ibeam: `Dwuteownik ${newSecB}×${newSecH}`,
                                tee: `Teownik ${newSecB}×${newSecH}`,
                                angle: `Kątownik L ${newSecH}×${newSecH}×${newSecT}`,
                              };
                              if (labels[shape]) {
                                setNewSecName(labels[shape]);
                              }
                            }}
                          >
                            <option value="rect">Prostokątny</option>
                            <option value="circ">Okrągły pełny</option>
                            <option value="pipe">Rura okrągła (RO)</option>
                            <option value="box">Rura prostokątna (RP) / Skrzynka</option>
                            <option value="ibeam">Dwuteownik symetryczny</option>
                            <option value="tee">Teownik (T)</option>
                            <option value="angle">Kątownik równoramienny (L)</option>
                          </select>
                        </div>

                        {newSecShape === 'rect' && (
                          <div className="row-pair">
                            <div className="half">
                              <label>Szerokość b</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={newSecB}
                                  onChange={(v) => setNewSecB(v)}
                                />
                                <span className="unit">cm</span>
                              </div>
                            </div>
                            <div className="half">
                              <label>Wysokość h</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={newSecH}
                                  onChange={(v) => setNewSecH(v)}
                                />
                                <span className="unit">cm</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {newSecShape === 'circ' && (
                          <div className="row">
                            <label>Średnica d</label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="1"
                                value={newSecD}
                                  onChange={(v) => setNewSecD(v)}
                              />
                              <span className="unit">cm</span>
                            </div>
                          </div>
                        )}

                        {newSecShape === 'pipe' && (
                          <div className="row-pair">
                            <div className="half">
                              <label>Średnica D</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={newSecD}
                                  onChange={(v) => setNewSecD(v)}
                                />
                                <span className="unit">cm</span>
                              </div>
                            </div>
                            <div className="half">
                              <label>Grubość t</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="0.1"
                                  value={newSecT}
                                  onChange={(v) => setNewSecT(v)}
                                />
                                <span className="unit">cm</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {newSecShape === 'box' && (
                          <>
                            <div className="row-pair">
                              <div className="half">
                                <label>Szerokość b</label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="1"
                                    value={newSecB}
                                    onChange={(v) => setNewSecB(v)}
                                  />
                                  <span className="unit">cm</span>
                                </div>
                              </div>
                              <div className="half">
                                <label>Wysokość h</label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="1"
                                    value={newSecH}
                                    onChange={(v) => setNewSecH(v)}
                                  />
                                  <span className="unit">cm</span>
                                </div>
                              </div>
                            </div>
                            <div className="row">
                              <label>Grubość ścianki t</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="0.1"
                                  value={newSecT}
                                  onChange={(v) => setNewSecT(v)}
                                />
                                <span className="unit">cm</span>
                              </div>
                            </div>
                          </>
                        )}

                        {newSecShape === 'ibeam' && (
                          <>
                            <div className="row-pair">
                              <div className="half">
                                <label>Szerokość b</label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="1"
                                    value={newSecB}
                                    onChange={(v) => setNewSecB(v)}
                                  />
                                  <span className="unit">cm</span>
                                </div>
                              </div>
                              <div className="half">
                                <label>Wysokość h</label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="1"
                                    value={newSecH}
                                    onChange={(v) => setNewSecH(v)}
                                  />
                                  <span className="unit">cm</span>
                                </div>
                              </div>
                            </div>
                            <div className="row-pair">
                              <div className="half">
                                <label>Gr. stopki tf</label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="0.1"
                                    value={newSecTf}
                                    onChange={(v) => setNewSecTf(v)}
                                  />
                                  <span className="unit">cm</span>
                                </div>
                              </div>
                              <div className="half">
                                <label>Gr. środnika tw</label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="0.1"
                                    value={newSecTw}
                                    onChange={(v) => setNewSecTw(v)}
                                  />
                                  <span className="unit">cm</span>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {newSecShape === 'tee' && (
                          <>
                            <div className="row-pair">
                              <div className="half">
                                <label>Szerokość b</label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="1"
                                    value={newSecB}
                                    onChange={(v) => setNewSecB(v)}
                                  />
                                  <span className="unit">cm</span>
                                </div>
                              </div>
                              <div className="half">
                                <label>Wysokość h</label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="1"
                                    value={newSecH}
                                    onChange={(v) => setNewSecH(v)}
                                  />
                                  <span className="unit">cm</span>
                                </div>
                              </div>
                            </div>
                            <div className="row-pair">
                              <div className="half">
                                <label>Gr. półki tf</label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="0.1"
                                    value={newSecTf}
                                    onChange={(v) => setNewSecTf(v)}
                                  />
                                  <span className="unit">cm</span>
                                </div>
                              </div>
                              <div className="half">
                                <label>Gr. środnika tw</label>
                                <div className="inp-unit">
                                  <SmartNumberInput
                                    step="0.1"
                                    value={newSecTw}
                                    onChange={(v) => setNewSecTw(v)}
                                  />
                                  <span className="unit">cm</span>
                                </div>
                              </div>
                            </div>
                          </>
                        )}

                        {newSecShape === 'angle' && (
                          <div className="row-pair">
                            <div className="half">
                              <label>Ramię a (h=b)</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={newSecH}
                                  onChange={(v) => { setNewSecH(v); setNewSecB(v); }}
                                />
                                <span className="unit">cm</span>
                              </div>
                            </div>
                            <div className="half">
                              <label>Grubość t</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="0.1"
                                  value={newSecT}
                                  onChange={(v) => setNewSecT(v)}
                                />
                                <span className="unit">cm</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {newSecCategory === 'wlasny' && (
                      <>
                        <div className="row-pair">
                          <div className="half">
                            <label>Pole A</label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="1"
                                value={newSecA}
                                onChange={(v) => setNewSecA(v)}
                              />
                              <span className="unit">cm²</span>
                            </div>
                          </div>
                          <div className="half">
                            <label>Skręcanie I<sub>t</sub></label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="5"
                                value={newSecIt}
                                onChange={(v) => setNewSecIt(v)}
                              />
                              <span className="unit">cm⁴</span>
                            </div>
                          </div>
                        </div>
                        <div className="row-pair">
                          <div className="half">
                            <label>Moment I<sub>y</sub></label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="10"
                                value={newSecIy}
                                onChange={(v) => setNewSecIy(v)}
                              />
                              <span className="unit">cm⁴</span>
                            </div>
                          </div>
                          <div className="half">
                            <label>Moment I<sub>z</sub></label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="10"
                                value={newSecIz}
                                onChange={(v) => setNewSecIz(v)}
                              />
                              <span className="unit">cm⁴</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: '8px', marginBottom: '4px', fontWeight: 'bold', fontSize: '11px', color: 'var(--text-dim)' }}>
                          Środek ciężkości (odległości od skrajnych włókien):
                        </div>
                        <div className="row-pair">
                          <div className="half">
                            <label>Góra cTopY</label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="0.5"
                                value={newSecCTopY}
                                onChange={(v) => setNewSecCTopY(v)}
                              />
                              <span className="unit">cm</span>
                            </div>
                          </div>
                          <div className="half">
                            <label>Dół cBotY</label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="0.5"
                                value={newSecCBotY}
                                onChange={(v) => setNewSecCBotY(v)}
                              />
                              <span className="unit">cm</span>
                            </div>
                          </div>
                        </div>
                        <div className="row-pair">
                          <div className="half">
                            <label>Lewo cBotZ</label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="0.5"
                                value={newSecCBotZ}
                                onChange={(v) => setNewSecCBotZ(v)}
                              />
                              <span className="unit">cm</span>
                            </div>
                          </div>
                          <div className="half">
                            <label>Prawo cTopZ</label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="0.5"
                                value={newSecCTopZ}
                                onChange={(v) => setNewSecCTopZ(v)}
                              />
                              <span className="unit">cm</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Dynamic Cross Section Preview with interactive calculations */}
                    {(() => {
                      const props = getTempSectionProps();
                      const h = props.h;
                      const b = props.b;
                      const cTopY = props.cTopY ?? h / 2;
                      const cBotY = props.cBotY ?? h / 2;
                      const cTopZ = props.cTopZ ?? b / 2;
                      const cBotZ = props.cBotZ ?? b / 2;
                      
                      const maxDim = Math.max(b, h);
                      const s = maxDim > 0 ? 80 / maxDim : 1;
                      
                      let pathD = '';
                      
                      if (props.shape.startsWith('cat')) {
                        const catType = props.shape.replace('cat', '');
                        const tf = (props as any).tf ?? 0;
                        const tw = (props as any).tw ?? 0;
                        const t = (props as any).t ?? 0;
                        
                        if (catType === 'L') {
                          const x1 = 60 - cBotZ * s;
                          const x2 = 60 + cTopZ * s;
                          const y1 = 60 - cTopY * s;
                          const y2 = 60 + cBotY * s;
                          const xv = x1 + t * s;
                          const yh = y2 - t * s;
                          pathD = `M ${x1},${y1} L ${xv},${y1} L ${xv},${yh} L ${x2},${yh} L ${x2},${y2} L ${x1},${y2} Z`;
                        } else if (catType === 'UPN' || catType === 'UPE') {
                          const x1 = 60 - cBotZ * s;
                          const x2 = 60 + cTopZ * s;
                          const y1 = 60 - (h / 2) * s;
                          const y2 = 60 + (h / 2) * s;
                          const xw = x1 + tw * s;
                          const yf1 = y1 + tf * s;
                          const yf2 = y2 - tf * s;
                          pathD = `M ${x1},${y1} L ${x2},${y1} L ${x2},${yf1} L ${xw},${yf1} L ${xw},${yf2} L ${x2},${yf2} L ${x2},${y2} L ${x1},${y2} Z`;
                        } else if (catType === 'T') {
                          const x1 = 60 - (b / 2) * s;
                          const x2 = 60 + (b / 2) * s;
                          const y1 = 60 - cTopY * s;
                          const y2 = 60 + cBotY * s;
                          const yf = y1 + tf * s;
                          const xw1 = 60 - (tw / 2) * s;
                          const xw2 = 60 + (tw / 2) * s;
                          pathD = `M ${x1},${y1} L ${x2},${y1} L ${x2},${yf} L ${xw2},${yf} L ${xw2},${y2} L ${xw1},${y2} L ${xw1},${yf} L ${x1},${yf} Z`;
                        } else if (catType === 'SHS' || catType === 'RHS' || catType === 'CHS') {
                          if (catType === 'CHS') {
                            const ro = (b / 2) * s;
                            const ri = (b / 2 - t) * s;
                            pathD = `M60,${60-ro} A${ro},${ro} 0 1,0 60,${60+ro} A${ro},${ro} 0 1,0 60,${60-ro} M60,${60-ri} A${ri},${ri} 0 1,0 60,${60+ri} A${ri},${ri} 0 1,0 60,${60-ri}`;
                          } else { // SHS, RHS
                            const xo1 = 60 - (b / 2) * s;
                            const xo2 = 60 + (b / 2) * s;
                            const yo1 = 60 - (h / 2) * s;
                            const yo2 = 60 + (h / 2) * s;
                            const xi1 = 60 - (b / 2 - t) * s;
                            const xi2 = 60 + (b / 2 - t) * s;
                            const yi1 = 60 - (h / 2 - t) * s;
                            const yi2 = 60 + (h / 2 - t) * s;
                            pathD = `M${xo1},${yo1} L${xo2},${yo1} L${xo2},${yo2} L${xo1},${yo2} Z M${xi1},${yi1} L${xi1},${yi2} L${xi2},${yi2} L${xi2},${yi1} Z`;
                          }
                        } else { // IPE, HEA, HEB, IPN (I-beams)
                          const x1 = 60 - (b / 2) * s;
                          const x2 = 60 + (b / 2) * s;
                          const y1 = 60 - (h / 2) * s;
                          const y2 = 60 + (h / 2) * s;
                          const xw1 = 60 - (tw / 2) * s;
                          const xw2 = 60 + (tw / 2) * s;
                          const yf1 = y1 + tf * s;
                          const yf2 = y2 - tf * s;
                          pathD = `M ${x1},${y1} L ${x2},${y1} L ${x2},${yf1} L ${xw2},${yf1} L ${xw2},${yf2} L ${x2},${yf2} L ${x2},${y2} L ${x1},${y2} L ${x1},${yf2} L ${xw1},${yf2} L ${xw1},${yf1} L ${x1},${yf1} Z`;
                        }
                      } else if (props.shape === 'rect') {
                        const x1 = 60 - (b / 2) * s;
                        const x2 = 60 + (b / 2) * s;
                        const y1 = 60 - (h / 2) * s;
                        const y2 = 60 + (h / 2) * s;
                        pathD = `M ${x1},${y1} L ${x2},${y1} L ${x2},${y2} L ${x1},${y2} Z`;
                      } else if (props.shape === 'circ') {
                        const ro = (b / 2) * s;
                        pathD = `M60,${60-ro} A${ro},${ro} 0 1,0 60,${60+ro} A${ro},${ro} 0 1,0 60,${60-ro}`;
                      } else if (props.shape === 'pipe') {
                        const ro = (b / 2) * s;
                        const t = (props as any).t ?? 0.5;
                        const ri = (b / 2 - t) * s;
                        pathD = `M60,${60-ro} A${ro},${ro} 0 1,0 60,${60+ro} A${ro},${ro} 0 1,0 60,${60-ro} M60,${60-ri} A${ri},${ri} 0 1,0 60,${60+ri} A${ri},${ri} 0 1,0 60,${60-ri}`;
                      } else if (props.shape === 'box') {
                        const t = (props as any).t ?? 0.5;
                        const xo1 = 60 - (b / 2) * s;
                        const xo2 = 60 + (b / 2) * s;
                        const yo1 = 60 - (h / 2) * s;
                        const yo2 = 60 + (h / 2) * s;
                        const xi1 = 60 - (b / 2 - t) * s;
                        const xi2 = 60 + (b / 2 - t) * s;
                        const yi1 = 60 - (h / 2 - t) * s;
                        const yi2 = 60 + (h / 2 - t) * s;
                        pathD = `M${xo1},${yo1} L${xo2},${yo1} L${xo2},${yo2} L${xo1},${yo2} Z M${xi1},${yi1} L${xi1},${yi2} L${xi2},${yi2} L${xi2},${yi1} Z`;
                      } else if (props.shape === 'ibeam') {
                        const tf = (props as any).tf ?? 1;
                        const tw = (props as any).tw ?? 0.5;
                        const x1 = 60 - (b / 2) * s;
                        const x2 = 60 + (b / 2) * s;
                        const y1 = 60 - (h / 2) * s;
                        const y2 = 60 + (h / 2) * s;
                        const xw1 = 60 - (tw / 2) * s;
                        const xw2 = 60 + (tw / 2) * s;
                        const yf1 = y1 + tf * s;
                        const yf2 = y2 - tf * s;
                        pathD = `M ${x1},${y1} L ${x2},${y1} L ${x2},${yf1} L ${xw2},${yf1} L ${xw2},${yf2} L ${x2},${yf2} L ${x2},${y2} L ${x1},${y2} L ${x1},${yf2} L ${xw1},${yf2} L ${xw1},${yf1} L ${x1},${yf1} Z`;
                      } else if (props.shape === 'tee') {
                        const tf = (props as any).tf ?? 1;
                        const tw = (props as any).tw ?? 0.5;
                        const x1 = 60 - (b / 2) * s;
                        const x2 = 60 + (b / 2) * s;
                        const y1 = 60 - cTopY * s;
                        const y2 = 60 + cBotY * s;
                        const yf = y1 + tf * s;
                        const xw1 = 60 - (tw / 2) * s;
                        const xw2 = 60 + (tw / 2) * s;
                        pathD = `M ${x1},${y1} L ${x2},${y1} L ${x2},${yf} L ${xw2},${yf} L ${xw2},${y2} L ${xw1},${y2} L ${xw1},${yf} L ${x1},${yf} Z`;
                      } else if (props.shape === 'angle') {
                        const t = (props as any).t ?? 0.5;
                        const x1 = 60 - cBotZ * s;
                        const x2 = 60 + cTopZ * s;
                        const y1 = 60 - cTopY * s;
                        const y2 = 60 + cBotY * s;
                        const xv = x1 + t * s;
                        const yh = y2 - t * s;
                        pathD = `M ${x1},${y1} L ${xv},${y1} L ${xv},${yh} L ${x2},${yh} L ${x2},${y2} L ${x1},${y2} Z`;
                      }

                      const drawDimY = h > 0;
                      const drawDimZ = b > 0;

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '8px 0', background: 'var(--surface-2)', padding: '10px', borderRadius: '6px', border: '1px solid var(--surface-border)' }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <svg width="100" height="100" style={{ background: 'var(--bg-canvas)', borderRadius: '4px', border: '1px solid var(--input-border)', flexShrink: 0 }}>
                              {/* Grid / Principal axes */}
                              <line x1="10" y1="50" x2="90" y2="50" stroke="var(--text-dim)" strokeWidth="0.75" strokeDasharray="3,3" opacity="0.6" />
                              <line x1="50" y1="10" x2="50" y2="90" stroke="var(--text-dim)" strokeWidth="0.75" strokeDasharray="3,3" opacity="0.6" />
                              
                              {/* Axis Labels */}
                              <text x="92" y="53" fontSize="8" fill="var(--text-dim)" fontWeight="600" opacity="0.8">y</text>
                              <text x="47" y="8" fontSize="8" fill="var(--text-dim)" fontWeight="600" opacity="0.8">z</text>
                              
                              {/* Drawn cross section (scaled down 50/60 ratio to fit inside 100x100) */}
                              {(() => {
                                const sRatio = 50 / 60;
                                const scaleAdjusted = s * sRatio;
                                const centerAdjusted = 50;
                                
                                let pathDAdjusted = '';
                                if (props.shape.startsWith('cat')) {
                                  const catType = props.shape.replace('cat', '');
                                  const tf = (props as any).tf ?? 0;
                                  const tw = (props as any).tw ?? 0;
                                  const t = (props as any).t ?? 0;
                                  
                                  if (catType === 'L') {
                                    const x1 = centerAdjusted - cBotZ * scaleAdjusted;
                                    const x2 = centerAdjusted + cTopZ * scaleAdjusted;
                                    const y1 = centerAdjusted - cTopY * scaleAdjusted;
                                    const y2 = centerAdjusted + cBotY * scaleAdjusted;
                                    const xv = x1 + t * scaleAdjusted;
                                    const yh = y2 - t * scaleAdjusted;
                                    pathDAdjusted = `M ${x1},${y1} L ${xv},${y1} L ${xv},${yh} L ${x2},${yh} L ${x2},${y2} L ${x1},${y2} Z`;
                                  } else if (catType === 'UPN' || catType === 'UPE') {
                                    const x1 = centerAdjusted - cBotZ * scaleAdjusted;
                                    const x2 = centerAdjusted + cTopZ * scaleAdjusted;
                                    const y1 = centerAdjusted - (h / 2) * scaleAdjusted;
                                    const y2 = centerAdjusted + (h / 2) * scaleAdjusted;
                                    const xw = x1 + tw * scaleAdjusted;
                                    const yf1 = y1 + tf * scaleAdjusted;
                                    const yf2 = y2 - tf * scaleAdjusted;
                                    pathDAdjusted = `M ${x1},${y1} L ${x2},${y1} L ${x2},${yf1} L ${xw},${yf1} L ${xw},${yf2} L ${x2},${yf2} L ${x2},${y2} L ${x1},${y2} Z`;
                                  } else if (catType === 'T') {
                                    const x1 = centerAdjusted - (b / 2) * scaleAdjusted;
                                    const x2 = centerAdjusted + (b / 2) * scaleAdjusted;
                                    const y1 = centerAdjusted - cTopY * scaleAdjusted;
                                    const y2 = centerAdjusted + cBotY * scaleAdjusted;
                                    const yf = y1 + tf * scaleAdjusted;
                                    const xw1 = centerAdjusted - (tw / 2) * scaleAdjusted;
                                    const xw2 = centerAdjusted + (tw / 2) * scaleAdjusted;
                                    pathDAdjusted = `M ${x1},${y1} L ${x2},${y1} L ${x2},${yf} L ${xw2},${yf} L ${xw2},${y2} L ${xw1},${y2} L ${xw1},${yf} L ${x1},${yf} Z`;
                                  } else if (catType === 'SHS' || catType === 'RHS' || catType === 'CHS') {
                                    if (catType === 'CHS') {
                                      const ro = (b / 2) * scaleAdjusted;
                                      const ri = (b / 2 - t) * scaleAdjusted;
                                      pathDAdjusted = `M50,${50-ro} A${ro},${ro} 0 1,0 50,${50+ro} A${ro},${ro} 0 1,0 50,${50-ro} M50,${50-ri} A${ri},${ri} 0 1,0 50,${50+ri} A${ri},${ri} 0 1,0 50,${50-ri}`;
                                    } else {
                                      const xo1 = centerAdjusted - (b / 2) * scaleAdjusted;
                                      const xo2 = centerAdjusted + (b / 2) * scaleAdjusted;
                                      const yo1 = centerAdjusted - (h / 2) * scaleAdjusted;
                                      const yo2 = centerAdjusted + (h / 2) * scaleAdjusted;
                                      const xi1 = centerAdjusted - (b / 2 - t) * scaleAdjusted;
                                      const xi2 = centerAdjusted + (b / 2 - t) * scaleAdjusted;
                                      const yi1 = centerAdjusted - (h / 2 - t) * scaleAdjusted;
                                      const yi2 = centerAdjusted + (h / 2 - t) * scaleAdjusted;
                                      pathDAdjusted = `M${xo1},${yo1} L${xo2},${yo1} L${xo2},${yo2} L${xo1},${yo2} Z M${xi1},${yi1} L${xi1},${yi2} L${xi2},${yi2} L${xi2},${yi1} Z`;
                                    }
                                  } else {
                                    const x1 = centerAdjusted - (b / 2) * scaleAdjusted;
                                    const x2 = centerAdjusted + (b / 2) * scaleAdjusted;
                                    const y1 = centerAdjusted - (h / 2) * scaleAdjusted;
                                    const y2 = centerAdjusted + (h / 2) * scaleAdjusted;
                                    const xw1 = centerAdjusted - (tw / 2) * scaleAdjusted;
                                    const xw2 = centerAdjusted + (tw / 2) * scaleAdjusted;
                                    const yf1 = y1 + tf * scaleAdjusted;
                                    const yf2 = y2 - tf * scaleAdjusted;
                                    pathDAdjusted = `M ${x1},${y1} L ${x2},${y1} L ${x2},${yf1} L ${xw2},${yf1} L ${xw2},${yf2} L ${x2},${yf2} L ${x2},${y2} L ${x1},${y2} L ${x1},${yf2} L ${xw1},${yf2} L ${xw1},${yf1} L ${x1},${yf1} Z`;
                                  }
                                } else if (props.shape === 'rect') {
                                  const x1 = centerAdjusted - (b / 2) * scaleAdjusted;
                                  const x2 = centerAdjusted + (b / 2) * scaleAdjusted;
                                  const y1 = centerAdjusted - (h / 2) * scaleAdjusted;
                                  const y2 = centerAdjusted + (h / 2) * scaleAdjusted;
                                  pathDAdjusted = `M ${x1},${y1} L ${x2},${y1} L ${x2},${y2} L ${x1},${y2} Z`;
                                } else if (props.shape === 'circ') {
                                  const ro = (b / 2) * scaleAdjusted;
                                  pathDAdjusted = `M50,${50-ro} A${ro},${ro} 0 1,0 50,${50+ro} A${ro},${ro} 0 1,0 50,${50-ro}`;
                                } else if (props.shape === 'pipe') {
                                  const ro = (b / 2) * scaleAdjusted;
                                  const t = (props as any).t ?? 0.5;
                                  const ri = (b / 2 - t) * scaleAdjusted;
                                  pathDAdjusted = `M50,${50-ro} A${ro},${ro} 0 1,0 50,${50+ro} A${ro},${ro} 0 1,0 50,${50-ro} M50,${50-ri} A${ri},${ri} 0 1,0 50,${50+ri} A${ri},${ri} 0 1,0 50,${50-ri}`;
                                } else if (props.shape === 'box') {
                                  const t = (props as any).t ?? 0.5;
                                  const xo1 = centerAdjusted - (b / 2) * scaleAdjusted;
                                  const xo2 = centerAdjusted + (b / 2) * scaleAdjusted;
                                  const yo1 = centerAdjusted - (h / 2) * scaleAdjusted;
                                  const yo2 = centerAdjusted + (h / 2) * scaleAdjusted;
                                  const xi1 = centerAdjusted - (b / 2 - t) * scaleAdjusted;
                                  const xi2 = centerAdjusted + (b / 2 - t) * scaleAdjusted;
                                  const yi1 = centerAdjusted - (h / 2 - t) * scaleAdjusted;
                                  const yi2 = centerAdjusted + (h / 2 - t) * scaleAdjusted;
                                  pathDAdjusted = `M${xo1},${yo1} L${xo2},${yo1} L${xo2},${yo2} L${xo1},${yo2} Z M${xi1},${yi1} L${xi1},${yi2} L${xi2},${yi2} L${xi2},${yi1} Z`;
                                } else if (props.shape === 'ibeam') {
                                  const tf = (props as any).tf ?? 1;
                                  const tw = (props as any).tw ?? 0.5;
                                  const x1 = centerAdjusted - (b / 2) * scaleAdjusted;
                                  const x2 = centerAdjusted + (b / 2) * scaleAdjusted;
                                  const y1 = centerAdjusted - (h / 2) * scaleAdjusted;
                                  const y2 = centerAdjusted + (h / 2) * scaleAdjusted;
                                  const xw1 = centerAdjusted - (tw / 2) * scaleAdjusted;
                                  const xw2 = centerAdjusted + (tw / 2) * scaleAdjusted;
                                  const yf1 = y1 + tf * scaleAdjusted;
                                  const yf2 = y2 - tf * scaleAdjusted;
                                  pathDAdjusted = `M ${x1},${y1} L ${x2},${y1} L ${x2},${yf1} L ${xw2},${yf1} L ${xw2},${yf2} L ${x2},${yf2} L ${x2},${y2} L ${x1},${y2} L ${x1},${yf2} L ${xw1},${yf2} L ${xw1},${yf1} L ${x1},${yf1} Z`;
                                } else if (props.shape === 'tee') {
                                  const tf = (props as any).tf ?? 1;
                                  const tw = (props as any).tw ?? 0.5;
                                  const x1 = centerAdjusted - (b / 2) * scaleAdjusted;
                                  const x2 = centerAdjusted + (b / 2) * scaleAdjusted;
                                  const y1 = centerAdjusted - cTopY * scaleAdjusted;
                                  const y2 = centerAdjusted + cBotY * scaleAdjusted;
                                  const yf = y1 + tf * scaleAdjusted;
                                  const xw1 = centerAdjusted - (tw / 2) * scaleAdjusted;
                                  const xw2 = centerAdjusted + (tw / 2) * scaleAdjusted;
                                  pathDAdjusted = `M ${x1},${y1} L ${x2},${y1} L ${x2},${yf} L ${xw2},${yf} L ${xw2},${y2} L ${xw1},${y2} L ${xw1},${yf} L ${x1},${yf} Z`;
                                } else if (props.shape === 'angle') {
                                  const t = (props as any).t ?? 0.5;
                                  const x1 = centerAdjusted - cBotZ * scaleAdjusted;
                                  const x2 = centerAdjusted + cTopZ * scaleAdjusted;
                                  const y1 = centerAdjusted - cTopY * scaleAdjusted;
                                  const y2 = centerAdjusted + cBotY * scaleAdjusted;
                                  const xv = x1 + t * scaleAdjusted;
                                  const yh = y2 - t * scaleAdjusted;
                                  pathDAdjusted = `M ${x1},${y1} L ${xv},${y1} L ${xv},${yh} L ${x2},${yh} L ${x2},${y2} L ${x1},${y2} Z`;
                                }
                                
                                return pathDAdjusted ? (
                                  <path d={pathDAdjusted} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.25" fillRule="evenodd" />
                                ) : (
                                  <rect 
                                    x={centerAdjusted - cBotZ * scaleAdjusted} 
                                    y={centerAdjusted - cTopY * scaleAdjusted} 
                                    width={(cBotZ + cTopZ) * scaleAdjusted} 
                                    height={(cTopY + cBotY) * scaleAdjusted} 
                                    fill="var(--surface-2)" 
                                    stroke="var(--text-dim)" 
                                    strokeWidth="0.75" 
                                    strokeDasharray="3,3" 
                                  />
                                );
                              })()}

                              {/* Centroid Red Dot */}
                              <circle cx="50" cy="50" r="2.5" fill="#ef4444" stroke="var(--bg-canvas)" strokeWidth="0.75" />
                            </svg>

                            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10.5px', color: 'var(--text-dim)' }}>
                              <div style={{ borderBottom: '1px solid var(--surface-border-soft)', paddingBottom: '2px', fontWeight: 'bold', color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Gabaryty:</span>
                                <span>{b.toFixed(1)}×{h.toFixed(1)} cm</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Pole A:</span>
                                <span style={{ color: 'var(--text)' }}>{fmtSmart(props.A)} cm²</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Moment I<sub>y</sub>:</span>
                                <span style={{ color: 'var(--text)' }}>{fmtSmart(props.Iy)} cm⁴</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Moment I<sub>z</sub>:</span>
                                <span style={{ color: 'var(--text)' }}>{fmtSmart(props.Iz)} cm⁴</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Skręcanie I<sub>t</sub>:</span>
                                <span style={{ color: 'var(--text)' }}>{fmtSmart(props.It)} cm⁴</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', opacity: 0.75, marginTop: '1px' }}>
                                <span>Śr. ciężk. y:</span>
                                <span>góra {cTopY.toFixed(1)} / dół {cBotY.toFixed(1)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', opacity: 0.75 }}>
                                <span>Śr. ciężk. z:</span>
                                <span>lewa {cBotZ.toFixed(1)} / prawa {cTopZ.toFixed(1)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="btnrow" style={{ marginTop: '10px' }}>
                      <button className="mini on" onClick={handleAddSection}>
                        {editingSecId ? 'Zapisz' : 'Dodaj'}
                      </button>
                      <button
                        className="mini"
                        onClick={() => {
                          if (editingSecId !== null && backupSectionRef.current) {
                            const orig = backupSectionRef.current;
                            setSections((prev) => prev.map((sec) => (sec.id === orig.id ? orig : sec)));
                          }
                          setAddSecFormOpen(false);
                          setEditingSecId(null);
                          backupSectionRef.current = null;
                        }}
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="btnrow">
                    <button
                      className="mini"
                      onClick={() => {
                        setNewSecName('Nowy przekrój');
                        setNewSecCategory('katalog');
                        setNewSecCatType('IPE');
                        setNewSecCatSizeIdx(0);
                        setNewSecShape('rect');
                        setNewSecB(20);
                        setNewSecH(40);
                        setNewSecD(30);
                        setNewSecT(1);
                        setNewSecTf(1.2);
                        setNewSecTw(0.8);
                        setNewSecA(80);
                        setNewSecIy(1000);
                        setNewSecIz(1000);
                        setNewSecIt(500);
                        setEditingSecId(null);
                        setAddSecFormOpen(true);
                      }}
                    >
                      + Dodaj przekrój
                    </button>
                  </div>
                )}
              </div>

              {/* GRUPY */}
              <div className="panel">
                <h3>
                  Grupy <span className="tag">{groups.length}</span>
                </h3>
                {groups.map((g) => (
                  <div key={g.id} className="listitem" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '3px',
                          backgroundColor: g.color,
                          display: 'inline-block',
                          border: '1px solid rgba(0,0,0,0.2)',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.name}>
                        {g.name}
                      </span>
                      {g.sectionId !== undefined && (
                        <span className="tag" style={{ fontSize: '9px', padding: '1px 3px', whiteSpace: 'nowrap' }} title="Narzucony przekrój">
                          {sections.find((s) => s.id === g.sectionId)?.name || 'Profil'}
                        </span>
                      )}
                      {g.materialId !== undefined && (
                        <span className="tag" style={{ fontSize: '9px', padding: '1px 3px', whiteSpace: 'nowrap' }} title="Narzucony materiał">
                          {materials.find((m) => m.id === g.materialId)?.name || 'Mat'}
                        </span>
                      )}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span
                        className="del"
                        style={{ color: 'var(--text-dim)', cursor: 'pointer' }}
                        onClick={() => {
                          setEditingGroupId(g.id);
                          setNewGroupName(g.name);
                          setNewGroupColor(g.color);
                          setNewGroupSectionId(g.sectionId);
                          setNewGroupMaterialId(g.materialId);
                          setAddGroupFormOpen(true);
                        }}
                        title="Edytuj grupę"
                      >
                        ✎
                      </span>
                      <span
                        className="del"
                        onClick={() => {
                          const remaining = groups.filter((item) => item.id !== g.id);
                          setGroups(remaining);
                          setElements((prev) =>
                            prev.map((el) => (el.groupId === g.id ? { ...el, groupId: undefined } : el))
                          );
                          onInvalidateResults();
                        }}
                        title="Usuń grupę"
                      >
                        ✕
                      </span>
                    </span>
                  </div>
                ))}

                {addGroupFormOpen ? (
                  <div
                    className="card"
                    style={{
                      marginTop: '6px',
                      background: 'var(--surface)',
                      borderColor: 'var(--input-border)',
                      padding: '10px',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '8px', color: 'var(--text)' }}>
                      {editingGroupId ? 'Edycja grupy' : 'Nowa grupa'}
                    </div>
                    <div className="row">
                      <label>Nazwa</label>
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="Nazwa grupy"
                      />
                    </div>
                    <div className="row">
                      <label>Profil</label>
                      <select
                        value={newGroupSectionId ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewGroupSectionId(val ? parseInt(val) : undefined);
                        }}
                      >
                        <option value="">(brak - dowolny)</option>
                        {sections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="row">
                      <label>Materiał</label>
                      <select
                        value={newGroupMaterialId ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewGroupMaterialId(val ? parseInt(val) : undefined);
                        }}
                      >
                        <option value="">(brak - dowolny)</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '6px' }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Wybierz kolor</label>
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(9, 1fr)',
                          gap: '4px',
                          width: '100%',
                        }}
                      >
                        {GROUP_PALETTE_COLORS.map((col) => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setNewGroupColor(col)}
                            style={{
                              width: '100%',
                              height: '18px',
                              borderRadius: '3px',
                              backgroundColor: col,
                              border: newGroupColor === col ? '2px solid var(--text)' : '1px solid rgba(0,0,0,0.15)',
                              cursor: 'pointer',
                              padding: 0,
                              outline: 'none',
                              transform: newGroupColor === col ? 'scale(1.15)' : 'none',
                              zIndex: newGroupColor === col ? 1 : 0,
                              transition: 'transform 0.1s',
                            }}
                            title={col}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', width: '100%' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Własny kolor:</span>
                        <input
                          type="color"
                          value={newGroupColor}
                          onChange={(e) => setNewGroupColor(e.target.value)}
                          style={{
                            width: '28px',
                            height: '22px',
                            border: 'none',
                            padding: 0,
                            background: 'none',
                            cursor: 'pointer',
                          }}
                        />
                      </div>
                    </div>
                    <div className="btnrow" style={{ marginTop: '10px' }}>
                      <button
                        className="mini on"
                        onClick={() => {
                          const name = newGroupName.trim() || `Grupa ${groups.length + 1}`;
                          if (editingGroupId) {
                            setGroups((prev) =>
                              prev.map((g) =>
                                g.id === editingGroupId
                                  ? {
                                      ...g,
                                      name,
                                      color: newGroupColor,
                                      sectionId: newGroupSectionId,
                                      materialId: newGroupMaterialId,
                                    }
                                  : g
                              )
                            );
                            setElements((prev) =>
                              prev.map((el) => {
                                if (el.groupId === editingGroupId) {
                                  return {
                                    ...el,
                                    sectionId: newGroupSectionId !== undefined ? newGroupSectionId : el.sectionId,
                                    materialId: newGroupMaterialId !== undefined ? newGroupMaterialId : el.materialId,
                                  };
                                }
                                return el;
                              })
                            );
                          } else {
                            const newGrp: ElementGroupDef = {
                              id: 'group-' + Date.now(),
                              name,
                              color: newGroupColor || '#3b82f6',
                              sectionId: newGroupSectionId,
                              materialId: newGroupMaterialId,
                            };
                            setGroups((prev) => [...prev, newGrp]);
                          }
                          setAddGroupFormOpen(false);
                          setEditingGroupId(null);
                          onInvalidateResults();
                        }}
                      >
                        {editingGroupId ? 'Zapisz' : 'Dodaj'}
                      </button>
                      <button
                        className="mini"
                        onClick={() => {
                          setAddGroupFormOpen(false);
                          setEditingGroupId(null);
                        }}
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="btnrow">
                    <button
                      className="mini"
                      onClick={() => {
                        setNewGroupName(`Grupa ${groups.length + 1}`);
                        setNewGroupColor(GROUP_PALETTE_COLORS[(groups.length * 3) % GROUP_PALETTE_COLORS.length]);
                        setNewGroupSectionId(undefined);
                        setNewGroupMaterialId(undefined);
                        setEditingGroupId(null);
                        setAddGroupFormOpen(true);
                      }}
                    >
                      + Dodaj grupę
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
