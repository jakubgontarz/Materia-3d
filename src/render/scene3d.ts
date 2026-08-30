import * as THREE from 'three';
import { RenderEngine3D, ScreenPoint3D } from './engine3d';
import { Vec3 } from '../fem/matrix';
import { Node3D, Element3D, SolverResult3D, Section, Material, MemberHinges3D, Panel3D, ConstructionLine3D, DimensionLine3D } from '../fem/types';
import { computeLocalAxes } from '../fem/solver3d';

export interface SceneRenderOptions {
  showGrid: boolean;
  gridPlane?: 'XY' | 'XZ' | 'YZ';
  gridOffset?: number;
  showAxes: boolean;
  showLocalAxes: boolean;
  showNodeNumbers: boolean;
  showElementNumbers: boolean;
  showSectionNames: boolean;
  showMaterialNames: boolean;
  showSupports: boolean;
  showProfileSketches: boolean;
  showPanels?: boolean;
  showLoads: boolean;
  showLoadValues: boolean;
  showMasses?: boolean;
  showHingeLabels: boolean;
  showDimensions: boolean;
  showDeform: boolean;
  showMy: boolean;
  showMz: boolean;
  showMx: boolean;
  showVy: boolean;
  showVz: boolean;
  showN: boolean;
  showStress: boolean;
  showReactions: boolean;
  hideLoadsInResults: boolean;
  hideSupportsInResults: boolean;
  deformScaleMult: number;
  diagramScaleMult: number;
  selectedNodeIds: number[];
  selectedElemIds: number[];
  selectedPanelIds?: number[];
  selectedConstructionLineIds?: number[];
  selectedDimensionLineIds?: number[];
  hoverNodeId: number | null;
  hoverElemId: number | null;
  hoverPanelId?: number | null;
  hoverConstructionLineId?: number | null;
  hoverDimensionLineId?: number | null;
  constructionLines?: ConstructionLine3D[];
  constructionPoints?: [number, number, number][];
  dimensionLines?: DimensionLine3D[];
  mode?: 'select' | 'addBar' | 'addPanel' | 'grid' | 'lines';
  probe: { elId: number | null; t: number };
  theme: 'light' | 'dark';
  accentColor: string;
}

function fmtLoadVal(v: number): string {
  if (Math.abs(v) < 1e-6) return '0';
  const rounded = Math.round(v * 1e4) / 1e4;
  return String(rounded);
}

// Track previous scene state key to avoid rebuilding 3D GPU geometries on camera orbit / pan / zoom
let lastGeometryKey = '';

function computeGeometryKey(
  nodes: Node3D[],
  elements: Element3D[],
  sections: Section[],
  materials: Material[],
  solved: SolverResult3D | null,
  options: SceneRenderOptions,
  panels: Panel3D[] = []
): string {
  // Fast signature generation
  let nSig = `${nodes.length}_`;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    let supKey = '0';
    if (n.support) {
      const s = n.support;
      supKey = `${s.ux.type}:${s.ux.k ?? ''}:${s.ux.delta ?? ''};${s.uy.type}:${s.uy.k ?? ''}:${s.uy.delta ?? ''};${s.uz.type}:${s.uz.k ?? ''}:${s.uz.delta ?? ''};${s.rx.type}:${s.rx.k ?? ''}:${s.rx.delta ?? ''};${s.ry.type}:${s.ry.k ?? ''}:${s.ry.delta ?? ''};${s.rz.type}:${s.rz.k ?? ''}:${s.rz.delta ?? ''};rotX:${s.rotX || 0}:rotY:${s.rotY || 0}:rotZ:${s.rotZ || 0}`;
    }
    const forceKey = n.force ? `${n.force.Fx},${n.force.Fy},${n.force.Fz}` : '0';
    const momentKey = n.moment ? `${n.moment.Mx},${n.moment.My},${n.moment.Mz}` : '0';
    const massKey = n.mass ? `${n.mass.mx},${n.mass.my},${n.mass.mz}` : '0';
    nSig += `${n.id}:${n.x},${n.y},${n.z}:${supKey}:${forceKey}:${momentKey}:${massKey};`;
  }

  let eSig = `${elements.length}_`;
  for (let i = 0; i < elements.length; i++) {
    const e = elements[i];
    const qKey = e.q
      ? `${e.q.coordinateSystem}:${e.q.qxStart}:${e.q.qxEnd}:${e.q.qyStart}:${e.q.qyEnd}:${e.q.qzStart}:${e.q.qzEnd}`
      : '0';
    eSig += `${e.id}:${e.n1}-${e.n2}:${e.sectionId}:${e.rollAngle || 0}:${qKey}:${JSON.stringify(e.hinges || {})};`;
  }

  let pSig = `${panels.length}_`;
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    pSig += `${p.id}:${p.shape}:${p.nodeIds.join('-')}:${p.loadTransferDir || 'two_way'}:${JSON.stringify(p.pressure || {})};`;
  }

  let clSig = `${(options.constructionLines || []).length}_`;
  (options.constructionLines || []).forEach((cl) => {
    clSig += `${cl.id}:${cl.p1.join(',')}-${cl.p2.join(',')};`;
  });

  const optSig = `g:${options.showGrid ? 1 : 0}_gp:${options.gridPlane || 'XY'}_go:${options.gridOffset || 0}_a:${options.showAxes ? 1 : 0}_la:${options.showLocalAxes ? 1 : 0}_pan:${options.showPanels !== false ? 1 : 0}_supp:${options.showSupports ? 1 : 0}_prof:${options.showProfileSketches ? 1 : 0}_loads:${options.showLoads ? 1 : 0}_def:${options.showDeform ? 1 : 0}_my:${options.showMy ? 1 : 0}_mz:${options.showMz ? 1 : 0}_mx:${options.showMx ? 1 : 0}_vy:${options.showVy ? 1 : 0}_vz:${options.showVz ? 1 : 0}_n:${options.showN ? 1 : 0}_str:${options.showStress ? 1 : 0}_r:${options.showReactions ? 1 : 0}_hl:${options.hideLoadsInResults ? 1 : 0}_hs:${options.hideSupportsInResults ? 1 : 0}_ds:${options.deformScaleMult}_dgs:${options.diagramScaleMult}_t:${options.theme}_ac:${options.accentColor}`;

  const solvedSig = solved ? `${solved.type}_${(solved as any).currentMode || 0}` : 'none';

  return `${nSig}|${eSig}|${pSig}|${clSig}|${optSig}|${solvedSig}`;
}

// Ultra-fast in-place Three.js material & scale updates for selection & hover (0.01ms, never discards geometries)
function updateVisualStates(engine: RenderEngine3D, options: SceneRenderOptions, isDark: boolean) {
  const selectedNodeSet = new Set(options.selectedNodeIds);
  const selectedElemSet = new Set(options.selectedElemIds);
  const selectedPanelSet = new Set(options.selectedPanelIds || []);
  const selectedCLSet = new Set(options.selectedConstructionLineIds || []);
  const accentColorObj = new THREE.Color(options.accentColor);
  const hoverColorObj = new THREE.Color('#38bdf8');
  const nodeDefaultColorObj = new THREE.Color(isDark ? '#cbd5e1' : '#0f172a');
  const elemDefaultColorObj = new THREE.Color(isDark ? '#94a3b8' : '#334155');
  const edgeDefaultColorObj = new THREE.Color(isDark ? 0x64748b : 0x475569);

  engine.modelGroup.traverse((obj) => {
    if (!obj.userData) return;
    if (obj.userData.type === 'node') {
      const isSel = selectedNodeSet.has(obj.userData.id);
      const isHov = options.hoverNodeId === obj.userData.id;
      const mesh = obj as THREE.Mesh;
      if (mesh.material && (mesh.material as any).color) {
        if (isSel) {
          (mesh.material as any).color.copy(accentColorObj);
        } else if (isHov) {
          (mesh.material as any).color.copy(hoverColorObj);
        } else {
          (mesh.material as any).color.copy(nodeDefaultColorObj);
        }
      }
      const s = isSel ? 1.45 : isHov ? 1.25 : 1.0;
      mesh.scale.set(s, s, s);
    } else if (obj.userData.type === 'element') {
      const isSel = selectedElemSet.has(obj.userData.id);
      const isHov = options.hoverElemId === obj.userData.id;
      if (obj.userData.isEdge) {
        const line = obj as THREE.LineSegments;
        if (line.material && (line.material as any).color) {
          (line.material as any).color.copy(isSel ? accentColorObj : (isHov ? hoverColorObj : edgeDefaultColorObj));
        }
      } else {
        const mesh = obj as THREE.Mesh;
        if (mesh.material && (mesh.material as any).color) {
          if (isSel) {
            (mesh.material as any).color.copy(accentColorObj);
          } else if (isHov) {
            (mesh.material as any).color.copy(hoverColorObj);
          } else {
            (mesh.material as any).color.copy(elemDefaultColorObj);
          }
        }
      }
    } else if (obj.userData.type === 'panel') {
      const isSel = selectedPanelSet.has(obj.userData.id);
      const isHov = options.hoverPanelId === obj.userData.id;
      const mesh = obj as THREE.Mesh;
      if (mesh.material) {
        const mat = mesh.material as THREE.MeshBasicMaterial;
        if (isSel) {
          mat.color.copy(accentColorObj);
          mat.opacity = isDark ? 0.65 : 0.55;
        } else if (isHov) {
          mat.color.copy(hoverColorObj);
          mat.opacity = isDark ? 0.55 : 0.45;
        } else {
          const origHex = obj.userData.defaultColorHex ?? (isDark ? 0x0284c7 : 0x0ea5e9);
          mat.color.setHex(origHex);
          mat.opacity = isDark ? 0.35 : 0.25;
        }
      }
    } else if (obj.userData.type === 'panel_edge') {
      const isSel = selectedPanelSet.has(obj.userData.id);
      const isHov = options.hoverPanelId === obj.userData.id;
      const line = obj as THREE.Line;
      if (line.material) {
        const mat = line.material as THREE.LineBasicMaterial;
        if (isSel) {
          mat.color.copy(accentColorObj);
        } else if (isHov) {
          mat.color.copy(hoverColorObj);
        } else {
          mat.color.setHex(isDark ? 0x38bdf8 : 0x0284c7);
        }
      }
    } else if (obj.userData.type === 'construction_line') {
      const isSel = selectedCLSet.has(obj.userData.id);
      const isHov = options.hoverConstructionLineId === obj.userData.id;
      const line = obj as THREE.Line;
      if (line.material && (line.material as any).color) {
        if (isSel) {
          (line.material as any).color.copy(accentColorObj);
        } else if (isHov) {
          (line.material as any).color.copy(hoverColorObj);
        } else {
          (line.material as any).color.setHex(isDark ? 0xf97316 : 0xea580c);
        }
      }
    }
  });
}

export interface DepthLabel2D {
  depth: number;
  priority?: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

export function drawScene3D(
  overlayCtx: CanvasRenderingContext2D,
  engine: RenderEngine3D,
  nodes: Node3D[],
  elements: Element3D[],
  sections: Section[],
  materials: Material[],
  solved: SolverResult3D | null,
  options: SceneRenderOptions,
  panels: Panel3D[] = []
) {
  const isDark = options.theme === 'dark';

  // 1. Check if 3D structural geometry needs rebuild (only when model structure, sections, materials, loads, panels, or results change)
  const currentKey = computeGeometryKey(nodes, elements, sections, materials, solved, options, panels);
  if (currentKey !== lastGeometryKey) {
    lastGeometryKey = currentKey;
    rebuild3DModelGroup(engine, nodes, elements, sections, materials, solved, options, isDark, panels);
  }

  // 2. Fast sub-millisecond in-place Three.js highlight and selection update (< 0.05ms)
  updateVisualStates(engine, options, isDark);

  // 3. Fast WebGL GPU Render (Hardware accelerated, < 0.3ms)
  engine.renderWebGL(isDark);

  // 4. Crisp 2D Overlay (Geometry lines first, then unified Depth-Sorted 2D Labels Stack)
  overlayCtx.clearRect(0, 0, engine.width, engine.height);

  const labelQueue: DepthLabel2D[] = [];

  // Instant 2D Hover & Focus highlight overlay (geometry drawn immediately, floating tags queued by depth)
  drawHoverAndSelection2DOverlay(overlayCtx, engine, nodes, elements, sections, options, isDark, panels, labelQueue);

  // Construction Lines Points (Flat pluses facing the viewer)
  if (options.constructionLines && options.constructionLines.length > 0) {
    const selCL = new Set(options.selectedConstructionLineIds || []);
    options.constructionLines.forEach((cl) => {
      const isSel = selCL.has(cl.id);
      const isHov = options.hoverConstructionLineId === cl.id;
      const color = isSel ? (isDark ? '#60a5fa' : '#2563eb') : isHov ? '#38bdf8' : (isDark ? '#fb923c' : '#ea580c');

      [cl.p1, cl.p2].forEach((pt) => {
        const sp = engine.project(pt);
        if (sp.visible) {
          labelQueue.push({
            depth: sp.depth,
            priority: 0,
            draw: (ctx) => {
              ctx.save();
              ctx.strokeStyle = color;
              ctx.lineWidth = isSel ? 2.5 : 2.0;
              ctx.beginPath();
              ctx.moveTo(sp.x - 7, sp.y);
              ctx.lineTo(sp.x + 7, sp.y);
              ctx.moveTo(sp.x, sp.y - 7);
              ctx.lineTo(sp.x, sp.y + 7);
              ctx.stroke();
              ctx.restore();
            },
          });
        }
      });
    });
  }

  // Construction Intersection Points
  if (options.constructionPoints && options.constructionPoints.length > 0) {
    const strokeStyle = isDark ? 'rgba(251, 146, 60, 0.65)' : 'rgba(234, 88, 12, 0.65)';
    options.constructionPoints.forEach((cp) => {
      const sp = engine.project(cp);
      if (sp.visible) {
        labelQueue.push({
          depth: sp.depth,
          priority: 0,
          draw: (ctx) => {
            ctx.save();
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.moveTo(sp.x - 4, sp.y);
            ctx.lineTo(sp.x + 4, sp.y);
            ctx.moveTo(sp.x, sp.y - 4);
            ctx.lineTo(sp.x, sp.y + 4);
            ctx.stroke();
            ctx.restore();
          },
        });
      }
    });
  }

  // Dimension Lines
  if (options.dimensionLines && options.dimensionLines.length > 0) {
    const selDL = new Set(options.selectedDimensionLineIds || []);
    options.dimensionLines.forEach((dl) => {
      const isSel = selDL.has(dl.id);
      const color = isSel ? (isDark ? '#60a5fa' : '#2563eb') : (isDark ? '#a78bfa' : '#7c3aed');
      const sp1 = engine.project(dl.p1);
      const sp2 = engine.project(dl.p2);
      if (sp1.visible && sp2.visible) {
        const dist3D = Math.hypot(
          dl.p2[0] - dl.p1[0],
          dl.p2[1] - dl.p1[1],
          dl.p2[2] - dl.p1[2]
        );
        drawSegmentDimensionPoints(overlayCtx, sp1, sp2, dist3D, color, labelQueue);
      }
    });
  }

  if (
    options.showNodeNumbers ||
    options.showElementNumbers ||
    options.showSectionNames ||
    options.showMaterialNames
  ) {
    collectLabels2DOverlay(labelQueue, engine, nodes, elements, sections, materials, options, isDark);
  }

  // Draw member end hinge / release labels (Robot style)
  if (options.showHingeLabels) {
    collectHingeLabels2DOverlay(labelQueue, engine, nodes, elements, isDark);
  }

  // Load values & Reactions values
  const occluders = engine.modelGroup.children.filter(
    (obj) => obj.userData?.type === 'element' || obj.userData?.type === 'panel'
  );

  const hasResults = !!solved && (options.showDeform || options.showMy || options.showMz || options.showN || options.showReactions);
  if (options.showLoads && options.showLoadValues && (!options.hideLoadsInResults || !hasResults)) {
    // Continuous load values
    collectContinuousLoads2DOverlay(labelQueue, engine, nodes, elements, options, isDark, occluders);

    // Thermal load values
    collectThermalLoads2DOverlay(labelQueue, engine, nodes, elements, options, isDark, occluders);

    // Panel pressure load values
    if (options.showPanels !== false) {
      panels.forEach((p) => {
        if (p.pressure && Math.abs(p.pressure.value) > 1e-4) {
          const axes = computePanelLocalAxes(p, nodes);
          if (axes) {
            const val = p.pressure.value;
            const pDir = p.pressure.dir || 'normal';
            const sign = Math.sign(val) || 1;

            let loadDir: [number, number, number] = [0, 0, 0];
            if (pDir === 'normal') {
              // Positive normal pressure acts inward (-vz)
              loadDir = [-axes.vz[0] * sign, -axes.vz[1] * sign, -axes.vz[2] * sign];
            } else if (pDir === 'X') {
              loadDir = [sign, 0, 0];
            } else if (pDir === 'Y') {
              loadDir = [0, sign, 0];
            } else if (pDir === 'Z') {
              loadDir = [0, 0, sign];
            }

            const labelOffset = 0.6;
            const pos3D: [number, number, number] = [
              axes.centroid[0] - loadDir[0] * labelOffset,
              axes.centroid[1] - loadDir[1] * labelOffset,
              axes.centroid[2] - loadDir[2] * labelOffset,
            ];
            const pLabelPos = engine.project(pos3D);
            if (pLabelPos.visible) {
              const dirStr = pDir === 'normal' ? 'prostopadle' : `globalne ${pDir}`;
              labelQueue.push({
                depth: pLabelPos.depth,
                priority: 2,
                draw: (ctx) =>
                  drawPillTag(
                    ctx,
                    pLabelPos.x,
                    pLabelPos.y,
                    `p=${val > 0 ? '+' : ''}${fmtLoadVal(val)} kN/m² (${dirStr})`,
                    '#f97316',
                    '#ea580c',
                    isDark,
                    12
                  ),
              });
            }
          }
        }
      });
    }

    const fColor = isDark ? '#f87171' : '#b91c1c';
    const mColor = isDark ? '#c084fc' : '#7e22ce';

    const lenF = 0.75;
    const gapF = 0.25;
    const lenM = 0.70;
    const baseGapM = 0.25;

    nodes.forEach((n) => {
      // Nodal forces text tags
      if (n.force) {
        const { Fx = 0, Fy = 0, Fz = 0 } = n.force;
        if (Math.abs(Fx) > 1e-4) {
          const sign = Math.sign(Fx);
          const pos3D: [number, number, number] = [n.x - sign * (gapF + lenF), n.y, n.z];
          const pTail = engine.project(pos3D);
          if (pTail.visible) {
            labelQueue.push({
              depth: pTail.depth,
              priority: 3,
              draw: (ctx) =>
                drawPillTag(ctx, pTail.x, pTail.y - 12, `Fx=${Fx > 0 ? '+' : ''}${fmtLoadVal(Fx)}kN`, fColor, fColor, isDark, 12),
            });
          }
        }
        if (Math.abs(Fy) > 1e-4) {
          const sign = Math.sign(Fy);
          const pos3D: [number, number, number] = [n.x, n.y - sign * (gapF + lenF), n.z];
          const pTail = engine.project(pos3D);
          if (pTail.visible) {
            labelQueue.push({
              depth: pTail.depth,
              priority: 3,
              draw: (ctx) =>
                drawPillTag(ctx, pTail.x, pTail.y - 12, `Fy=${Fy > 0 ? '+' : ''}${fmtLoadVal(Fy)}kN`, fColor, fColor, isDark, 12),
            });
          }
        }
        if (Math.abs(Fz) > 1e-4) {
          const sign = Math.sign(Fz);
          const pos3D: [number, number, number] = [n.x, n.y, n.z - sign * (gapF + lenF)];
          const pTail = engine.project(pos3D);
          if (pTail.visible) {
            labelQueue.push({
              depth: pTail.depth,
              priority: 3,
              draw: (ctx) =>
                drawPillTag(ctx, pTail.x, pTail.y - 12, `Fz=${Fz > 0 ? '+' : ''}${fmtLoadVal(Fz)}kN`, fColor, fColor, isDark, 12),
            });
          }
        }
      }

      // Nodal moments text tags
      if (n.moment) {
        const { Mx = 0, My = 0, Mz = 0 } = n.moment;
        const gapMx = (n.force && Math.abs(n.force.Fx || 0) > 1e-4) ? (gapF + lenF + 0.15) : baseGapM;
        const gapMy = (n.force && Math.abs(n.force.Fy || 0) > 1e-4) ? (gapF + lenF + 0.15) : baseGapM;
        const gapMz = (n.force && Math.abs(n.force.Fz || 0) > 1e-4) ? (gapF + lenF + 0.15) : baseGapM;

        if (Math.abs(Mx) > 1e-4) {
          const sign = Math.sign(Mx);
          const pos3D: [number, number, number] = [n.x - sign * (gapMx + lenM), n.y, n.z];
          const pTail = engine.project(pos3D);
          if (pTail.visible) {
            labelQueue.push({
              depth: pTail.depth,
              priority: 3,
              draw: (ctx) =>
                drawPillTag(ctx, pTail.x, pTail.y - 12, `Mx=${Mx > 0 ? '+' : ''}${fmtLoadVal(Mx)}kNm`, mColor, mColor, isDark, 12),
            });
          }
        }
        if (Math.abs(My) > 1e-4) {
          const sign = Math.sign(My);
          const pos3D: [number, number, number] = [n.x, n.y - sign * (gapMy + lenM), n.z];
          const pTail = engine.project(pos3D);
          if (pTail.visible) {
            labelQueue.push({
              depth: pTail.depth,
              priority: 3,
              draw: (ctx) =>
                drawPillTag(ctx, pTail.x, pTail.y - 12, `My=${My > 0 ? '+' : ''}${fmtLoadVal(My)}kNm`, mColor, mColor, isDark, 12),
            });
          }
        }
        if (Math.abs(Mz) > 1e-4) {
          const sign = Math.sign(Mz);
          const pos3D: [number, number, number] = [n.x, n.y, n.z - sign * (gapMz + lenM)];
          const pTail = engine.project(pos3D);
          if (pTail.visible) {
            labelQueue.push({
              depth: pTail.depth,
              priority: 3,
              draw: (ctx) =>
                drawPillTag(ctx, pTail.x, pTail.y - 12, `Mz=${Mz > 0 ? '+' : ''}${fmtLoadVal(Mz)}kNm`, mColor, mColor, isDark, 12),
            });
          }
        }
      }
    });
  }

  // Nodal masses text tags (visibility depends on "pokaż wartości obciążeń" / showLoadValues)
  if (options.showLoads && options.showLoadValues) {
    nodes.forEach((n) => {
      if (!n.mass) return;
      const m = n.mass;
      const mx = m.mx || 0;
      const my = m.my || 0;
      const mz = m.mz || 0;
      const Jx = m.Jx || (m as any).Imx || 0;
      const Jy = m.Jy || (m as any).Imy || 0;
      const Jz = m.Jz || (m as any).Imz || 0;

      const hasMass = Math.abs(mx) > 1e-6 || Math.abs(my) > 1e-6 || Math.abs(mz) > 1e-6 || Math.abs(Jx) > 1e-6 || Math.abs(Jy) > 1e-6 || Math.abs(Jz) > 1e-6;
      if (!hasMass) return;

      let text = '';
      if (Math.abs(mx - my) < 1e-4 && Math.abs(my - mz) < 1e-4 && Math.abs(mx) > 1e-6) {
        text = `m=${mx >= 1000 ? `${fmtLoadVal(mx / 1000)}t` : `${fmtLoadVal(mx)}kg`}`;
      } else {
        const parts: string[] = [];
        if (Math.abs(mx) > 1e-6) parts.push(`mx=${fmtLoadVal(mx)}`);
        if (Math.abs(my) > 1e-6) parts.push(`my=${fmtLoadVal(my)}`);
        if (Math.abs(mz) > 1e-6) parts.push(`mz=${fmtLoadVal(mz)}`);
        text = `m=(${parts.join(',')})kg`;
      }

      if (Math.abs(Jx) > 1e-6 || Math.abs(Jy) > 1e-6 || Math.abs(Jz) > 1e-6) {
        const jParts: string[] = [];
        if (Math.abs(Jx) > 1e-6) jParts.push(`Jx=${fmtLoadVal(Jx)}`);
        if (Math.abs(Jy) > 1e-6) jParts.push(`Jy=${fmtLoadVal(Jy)}`);
        if (Math.abs(Jz) > 1e-6) jParts.push(`Jz=${fmtLoadVal(Jz)}`);
        text += ` J=(${jParts.join(',')})kg·m²`;
      }

      const mColor = isDark ? '#a5b4fc' : '#4338ca';
      const pMass = engine.project([n.x, n.y + 0.25, n.z]);
      if (pMass.visible) {
        labelQueue.push({
          depth: pMass.depth,
          priority: 3,
          draw: (ctx) => drawPillTag(ctx, pMass.x, pMass.y, text, mColor, mColor, isDark, 12),
        });
      }
    });
  }

  // Reactions text tags (separate components)
  if (options.showReactions && solved && solved.type === 'linear_static' && solved.Rglobal) {
    const Rglobal = solved.Rglobal;
    const rfColor = isDark ? '#fbbf24' : '#b45309';
    const rmColor = isDark ? '#c084fc' : '#7e22ce';

    nodes.forEach((n, idx) => {
      if (!n.support) return;
      const Rx = Rglobal[6 * idx + 0] || 0;
      const Ry = Rglobal[6 * idx + 1] || 0;
      const Rz = Rglobal[6 * idx + 2] || 0;
      const Mx = Rglobal[6 * idx + 3] || 0;
      const My = Rglobal[6 * idx + 4] || 0;
      const Mz = Rglobal[6 * idx + 5] || 0;

      const gapF = 0.30;
      const lenF = 0.70;
      const gapM = gapF + lenF + 0.12;
      const lenM = 0.65;

      let rotMatrix: THREE.Matrix4 | null = null;
      if (n.support && (n.support.rotX || n.support.rotY || n.support.rotZ)) {
        rotMatrix = new THREE.Matrix4();
        const rx = (n.support.rotX || 0) * Math.PI / 180;
        const ry = (n.support.rotY || 0) * Math.PI / 180;
        const rz = (n.support.rotZ || 0) * Math.PI / 180;
        rotMatrix.makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
      }

      const getRotatedPosition = (localOffset: THREE.Vector3): [number, number, number] => {
        if (rotMatrix) {
          localOffset.applyMatrix4(rotMatrix);
        }
        return [n.x + localOffset.x, n.y + localOffset.y, n.z + localOffset.z];
      };

      if (Math.abs(Rx) > 1e-4) {
        const sign = Math.sign(Rx);
        const pos3D = getRotatedPosition(new THREE.Vector3(-sign * (gapF + lenF), 0, 0));
        const pTail = engine.project(pos3D);
        if (pTail.visible) {
          labelQueue.push({
            depth: pTail.depth,
            priority: 4,
            draw: (ctx) => drawPillTag(ctx, pTail.x, pTail.y + 12, `Rx=${Rx.toFixed(1)}kN`, rfColor, rfColor, isDark, 12),
          });
        }
      }
      if (Math.abs(Ry) > 1e-4) {
        const sign = Math.sign(Ry);
        const pos3D = getRotatedPosition(new THREE.Vector3(0, -sign * (gapF + lenF), 0));
        const pTail = engine.project(pos3D);
        if (pTail.visible) {
          labelQueue.push({
            depth: pTail.depth,
            priority: 4,
            draw: (ctx) => drawPillTag(ctx, pTail.x, pTail.y + 12, `Ry=${Ry.toFixed(1)}kN`, rfColor, rfColor, isDark, 12),
          });
        }
      }
      if (Math.abs(Rz) > 1e-4) {
        const sign = Math.sign(Rz);
        const pos3D = getRotatedPosition(new THREE.Vector3(0, 0, -sign * (gapF + lenF)));
        const pTail = engine.project(pos3D);
        if (pTail.visible) {
          labelQueue.push({
            depth: pTail.depth,
            priority: 4,
            draw: (ctx) => drawPillTag(ctx, pTail.x, pTail.y + 12, `Rz=${Rz.toFixed(1)}kN`, rfColor, rfColor, isDark, 12),
          });
        }
      }

      if (Math.abs(Mx) > 1e-4) {
        const sign = Math.sign(Mx);
        const pos3D = getRotatedPosition(new THREE.Vector3(-sign * (gapM + lenM), 0, 0));
        const pTail = engine.project(pos3D);
        if (pTail.visible) {
          labelQueue.push({
            depth: pTail.depth,
            priority: 4,
            draw: (ctx) => drawPillTag(ctx, pTail.x, pTail.y - 12, `Mx=${Mx.toFixed(1)}kNm`, rmColor, rmColor, isDark, 12),
          });
        }
      }
      if (Math.abs(My) > 1e-4) {
        const sign = Math.sign(My);
        const pos3D = getRotatedPosition(new THREE.Vector3(0, -sign * (gapM + lenM), 0));
        const pTail = engine.project(pos3D);
        if (pTail.visible) {
          labelQueue.push({
            depth: pTail.depth,
            priority: 4,
            draw: (ctx) => drawPillTag(ctx, pTail.x, pTail.y - 12, `My=${My.toFixed(1)}kNm`, rmColor, rmColor, isDark, 12),
          });
        }
      }
      if (Math.abs(Mz) > 1e-4) {
        const sign = Math.sign(Mz);
        const pos3D = getRotatedPosition(new THREE.Vector3(0, 0, -sign * (gapM + lenM)));
        const pTail = engine.project(pos3D);
        if (pTail.visible) {
          labelQueue.push({
            depth: pTail.depth,
            priority: 4,
            draw: (ctx) => drawPillTag(ctx, pTail.x, pTail.y - 12, `Mz=${Mz.toFixed(1)}kNm`, rmColor, rmColor, isDark, 12),
          });
        }
      }
    });
  }

  // Diagram numerical values overlay
  if (
    solved &&
    (options.showMy || options.showMz || options.showMx || options.showVy || options.showVz || options.showN || options.showStress)
  ) {
    collectDiagramValues2DOverlay(labelQueue, engine, solved, options, isDark);
  }

  // Fast Probe marker overlay (100% smooth slider, active ONLY when results exist)
  if (solved) {
    collectProbe2DOverlay(labelQueue, engine, nodes, elements, options, isDark);
  }

  // 5. Unified Depth-Sorted 2D Label Stack (Painter's Algorithm)
  // Sort from largest depth (furthest from camera / background) to smallest depth (closest to camera / foreground)
  labelQueue.sort((a, b) => {
    if (Math.abs(b.depth - a.depth) < 1e-4) {
      return (a.priority || 0) - (b.priority || 0);
    }
    return b.depth - a.depth;
  });

  // Render all queued labels in depth order (furthest drawn first, closest drawn on top)
  for (let i = 0; i < labelQueue.length; i++) {
    labelQueue[i].draw(overlayCtx);
  }
}

function rebuild3DModelGroup(
  engine: RenderEngine3D,
  nodes: Node3D[],
  elements: Element3D[],
  sections: Section[],
  materials: Material[],
  solved: SolverResult3D | null,
  options: SceneRenderOptions,
  isDark: boolean,
  panels: Panel3D[] = []
) {
  // Clear previous Three.js 3D model geometry
  engine.clearModelGroup();

  // Grid
  build3DGrid(engine, nodes, isDark, options.showGrid, options.gridPlane || 'XY', options.gridOffset || 0);

  // Construction Lines
  build3DConstructionLines(engine, options.constructionLines || [], options, isDark);

  // Origin Axes
  if (options.showAxes) build3DOriginTriad(engine);

  // Panels / Claddings (Obrysy / Okładziny powierzchniowe)
  if (options.showPanels !== false) {
    panels.forEach((p) => {
      build3DSinglePanel(engine, p, nodes, options, isDark);
      build3DPanelLoadTransferDirections(engine, p, nodes, isDark);
    });
  }

  // Deformed Shape
  if (options.showDeform && solved) {
    build3DDeformedShape(engine, solved, options);
  }

  // Internal Force Diagrams
  if (
    solved &&
    (options.showMy || options.showMz || options.showMx || options.showVy || options.showVz || options.showN || options.showStress)
  ) {
    build3DDiagrams(engine, solved, options);
  }

  // Elements (Bars)
  elements.forEach((el) => {
    const n1 = nodes.find((n) => n.id === el.n1);
    const n2 = nodes.find((n) => n.id === el.n2);
    if (!n1 || !n2) return;
    const sec = sections.find((s) => s.id === el.sectionId);
    build3DSingleElement(engine, el, n1, n2, sec, options, solved);
  });

  // Supports
  const hasResults = !!solved && (options.showDeform || options.showMy || options.showMz || options.showN || options.showReactions);
  if (options.showSupports && (!options.hideSupportsInResults || !hasResults)) {
    nodes.forEach((n) => {
      if (n.support) {
        build3DSingleSupport(engine, n, isDark);
      }
    });
  }

  // Loads
  if (options.showLoads && (!options.hideLoadsInResults || !hasResults)) {
    // Nodal Forces & Nodal Moments
    nodes.forEach((n) => {
      if (n.force) {
        const { Fx = 0, Fy = 0, Fz = 0 } = n.force;
        const len = 0.75;
        const gapF = 0.25;
        const color = 0xdc2626;

        if (Math.abs(Fx) > 1e-4) {
          const sign = Math.sign(Fx);
          const dir = new THREE.Vector3(sign, 0, 0);
          const origin = new THREE.Vector3(n.x - sign * (gapF + len), n.y, n.z);
          buildSingleArrow(engine, origin, dir, len, color);
        }
        if (Math.abs(Fy) > 1e-4) {
          const sign = Math.sign(Fy);
          const dir = new THREE.Vector3(0, sign, 0);
          const origin = new THREE.Vector3(n.x, n.y - sign * (gapF + len), n.z);
          buildSingleArrow(engine, origin, dir, len, color);
        }
        if (Math.abs(Fz) > 1e-4) {
          const sign = Math.sign(Fz);
          const dir = new THREE.Vector3(0, 0, sign);
          const origin = new THREE.Vector3(n.x, n.y, n.z - sign * (gapF + len));
          buildSingleArrow(engine, origin, dir, len, color);
        }
      }

      if (n.moment) {
        const { Mx = 0, My = 0, Mz = 0 } = n.moment;
        const lenF = 0.75;
        const gapF = 0.25;
        const lenM = 0.70;
        const baseGapM = 0.25;
        const color = 0xa855f7; // purple-500

        const gapMx = (n.force && Math.abs(n.force.Fx || 0) > 1e-4) ? (gapF + lenF + 0.15) : baseGapM;
        const gapMy = (n.force && Math.abs(n.force.Fy || 0) > 1e-4) ? (gapF + lenF + 0.15) : baseGapM;
        const gapMz = (n.force && Math.abs(n.force.Fz || 0) > 1e-4) ? (gapF + lenF + 0.15) : baseGapM;

        if (Math.abs(Mx) > 1e-4) {
          const sign = Math.sign(Mx);
          const dir = new THREE.Vector3(sign, 0, 0);
          const origin = new THREE.Vector3(n.x - sign * (gapMx + lenM), n.y, n.z);
          buildDoubleHeadedArrow(engine, origin, dir, lenM, color);
        }
        if (Math.abs(My) > 1e-4) {
          const sign = Math.sign(My);
          const dir = new THREE.Vector3(0, sign, 0);
          const origin = new THREE.Vector3(n.x, n.y - sign * (gapMy + lenM), n.z);
          buildDoubleHeadedArrow(engine, origin, dir, lenM, color);
        }
        if (Math.abs(Mz) > 1e-4) {
          const sign = Math.sign(Mz);
          const dir = new THREE.Vector3(0, 0, sign);
          const origin = new THREE.Vector3(n.x, n.y, n.z - sign * (gapMz + lenM));
          buildDoubleHeadedArrow(engine, origin, dir, lenM, color);
        }
      }
    });

    // Distributed loads
    elements.forEach((el) => {
      if (el.q) {
        const n1 = nodes.find((n) => n.id === el.n1);
        const n2 = nodes.find((n) => n.id === el.n2);
        if (n1 && n2) {
          build3DDistributedLoad(engine, el, n1, n2);
        }
      }
    });

    // Thermal loads
    elements.forEach((el) => {
      if (el.thermal) {
        const n1 = nodes.find((n) => n.id === el.n1);
        const n2 = nodes.find((n) => n.id === el.n2);
        if (n1 && n2) {
          build3DThermalLoad(engine, el, n1, n2, isDark);
        }
      }
    });

    // Panel pressure loads
    if (options.showPanels !== false) {
      panels.forEach((p) => {
        build3DPanelPressureLoad(engine, p, nodes, isDark);
      });
    }

    // Nodal masses 3D indicators
    nodes.forEach((n) => {
      build3DNodalMass(engine, n, isDark);
    });
  }

  // Nodes
  nodes.forEach((n) => {
    build3DSingleNode(engine, n, options);
  });

  // Reactions (separate directional components, offset from node, with double-headed moment reactions behind)
  if (options.showReactions && solved && solved.type === 'linear_static' && solved.Rglobal) {
    const Rglobal = solved.Rglobal;
    nodes.forEach((n, idx) => {
      if (!n.support) return;
      const Rx = Rglobal[6 * idx + 0] || 0;
      const Ry = Rglobal[6 * idx + 1] || 0;
      const Rz = Rglobal[6 * idx + 2] || 0;
      const Mx = Rglobal[6 * idx + 3] || 0;
      const My = Rglobal[6 * idx + 4] || 0;
      const Mz = Rglobal[6 * idx + 5] || 0;

      const gapF = 0.30;
      const lenF = 0.70;
      const colorF = 0xd97706; // amber-600

      const gapM = gapF + lenF + 0.12;
      const lenM = 0.65;
      const colorM = 0x9333ea; // purple-600

      let rotMatrix: THREE.Matrix4 | null = null;
      if (n.support && (n.support.rotX || n.support.rotY || n.support.rotZ)) {
        rotMatrix = new THREE.Matrix4();
        const rx = (n.support.rotX || 0) * Math.PI / 180;
        const ry = (n.support.rotY || 0) * Math.PI / 180;
        const rz = (n.support.rotZ || 0) * Math.PI / 180;
        rotMatrix.makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
      }

      const transformVectorAndOrigin = (
        dirLocal: THREE.Vector3,
        offsetLocal: THREE.Vector3
      ) => {
        const dir = dirLocal.clone();
        const origin = new THREE.Vector3(n.x, n.y, n.z).add(offsetLocal);
        if (rotMatrix) {
          dir.applyMatrix4(rotMatrix);
          const offsetRotated = offsetLocal.clone().applyMatrix4(rotMatrix);
          origin.copy(new THREE.Vector3(n.x, n.y, n.z).add(offsetRotated));
        }
        return { dir, origin };
      };

      // Force reactions (offset from node)
      if (Math.abs(Rx) > 1e-4) {
        const sign = Math.sign(Rx);
        const { dir, origin } = transformVectorAndOrigin(
          new THREE.Vector3(sign, 0, 0),
          new THREE.Vector3(-sign * (gapF + lenF), 0, 0)
        );
        buildSingleArrow(engine, origin, dir, lenF, colorF, 0.22, 0.11);
      }
      if (Math.abs(Ry) > 1e-4) {
        const sign = Math.sign(Ry);
        const { dir, origin } = transformVectorAndOrigin(
          new THREE.Vector3(0, sign, 0),
          new THREE.Vector3(0, -sign * (gapF + lenF), 0)
        );
        buildSingleArrow(engine, origin, dir, lenF, colorF, 0.22, 0.11);
      }
      if (Math.abs(Rz) > 1e-4) {
        const sign = Math.sign(Rz);
        const { dir, origin } = transformVectorAndOrigin(
          new THREE.Vector3(0, 0, sign),
          new THREE.Vector3(0, 0, -sign * (gapF + lenF))
        );
        buildSingleArrow(engine, origin, dir, lenF, colorF, 0.22, 0.11);
      }

      // Moment reactions (behind force reactions, double-headed)
      if (Math.abs(Mx) > 1e-4) {
        const sign = Math.sign(Mx);
        const { dir, origin } = transformVectorAndOrigin(
          new THREE.Vector3(sign, 0, 0),
          new THREE.Vector3(-sign * (gapM + lenM), 0, 0)
        );
        buildDoubleHeadedArrow(engine, origin, dir, lenM, colorM, 0.18, 0.09);
      }
      if (Math.abs(My) > 1e-4) {
        const sign = Math.sign(My);
        const { dir, origin } = transformVectorAndOrigin(
          new THREE.Vector3(0, sign, 0),
          new THREE.Vector3(0, -sign * (gapM + lenM), 0)
        );
        buildDoubleHeadedArrow(engine, origin, dir, lenM, colorM, 0.18, 0.09);
      }
      if (Math.abs(Mz) > 1e-4) {
        const sign = Math.sign(Mz);
        const { dir, origin } = transformVectorAndOrigin(
          new THREE.Vector3(0, 0, sign),
          new THREE.Vector3(0, 0, -sign * (gapM + lenM))
        );
        buildDoubleHeadedArrow(engine, origin, dir, lenM, colorM, 0.18, 0.09);
      }
    });
  }

  // Local Axes Triads
  if (options.showLocalAxes) {
    elements.forEach((el) => {
      const n1 = nodes.find((n) => n.id === el.n1);
      const n2 = nodes.find((n) => n.id === el.n2);
      if (n1 && n2) {
        const sec = sections.find((s) => s.id === el.sectionId);
        build3DLocalAxes(engine, el, n1, n2, sec);
      }
    });
    if (options.showPanels !== false) {
      panels.forEach((p) => {
        build3DPanelLocalAxes(engine, p, nodes);
      });
    }
  }
}

// === THREE.JS BUILDERS ===

function build3DConstructionLines(
  engine: RenderEngine3D,
  constructionLines: ConstructionLine3D[],
  options: SceneRenderOptions,
  isDark: boolean
) {
  if (!constructionLines || constructionLines.length === 0) return;
  const selCL = new Set(options.selectedConstructionLineIds || []);

  constructionLines.forEach((cl) => {
    const p1 = new THREE.Vector3(...cl.p1);
    const p2 = new THREE.Vector3(...cl.p2);
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    if (len < 1e-6) return;
    dir.normalize();

    // Use bounded endpoints directly (from min to max coordinates)
    const pA = p1;
    const pB = p2;

    const isSel = selCL.has(cl.id);
    const isHov = options.hoverConstructionLineId === cl.id;
    const colorHex = isSel ? 0x2563eb : isHov ? 0x38bdf8 : (isDark ? 0xf97316 : 0xea580c);

    const geom = new THREE.BufferGeometry().setFromPoints([pA, pB]);
    const mat = new THREE.LineDashedMaterial({
      color: colorHex,
      dashSize: 0.35,
      gapSize: 0.2,
      scale: 1,
    });
    const line = new THREE.Line(geom, mat);
    line.computeLineDistances();
    line.userData = { type: 'construction_line', id: cl.id };
    makeOnTop(line, 4);
    engine.modelGroup.add(line);
  });
}

import { getPanelCorners, computePanelLocalAxes } from '../fem/panels';
export { getPanelCorners, computePanelLocalAxes };

function build3DPanelLocalAxes(engine: RenderEngine3D, panel: Panel3D, nodes: Node3D[]) {
  const axes = computePanelLocalAxes(panel, nodes);
  if (!axes) return;

  const origin = new THREE.Vector3(...axes.centroid);
  const aLen = 0.6;
  const arrowX = new THREE.ArrowHelper(new THREE.Vector3(...axes.vx), origin, aLen, 0xef4444, 0.14, 0.07);
  const arrowY = new THREE.ArrowHelper(new THREE.Vector3(...axes.vy), origin, aLen, 0x22c55e, 0.14, 0.07);
  const arrowZ = new THREE.ArrowHelper(new THREE.Vector3(...axes.vz), origin, aLen, 0x3b82f6, 0.14, 0.07);

  makeLocalAxisOnTop(arrowX);
  makeLocalAxisOnTop(arrowY);
  makeLocalAxisOnTop(arrowZ);

  engine.overlayGroup.add(arrowX);
  engine.overlayGroup.add(arrowY);
  engine.overlayGroup.add(arrowZ);
}

function build3DPanelLoadTransferDirections(
  engine: RenderEngine3D,
  panel: Panel3D,
  nodes: Node3D[],
  isDark: boolean
) {
  if (panel.shape === 'triangle') return;

  const axes = computePanelLocalAxes(panel, nodes);
  if (!axes) return;

  const corners = getPanelCorners(panel, nodes);
  if (corners.length < 3) return;

  const dir = panel.loadTransferDir || 'two_way';

  const [c1, c2] = corners;
  const Lx = Math.hypot(c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]) || 1;
  const Ly = (corners.length === 4)
    ? Math.hypot(corners[3][0] - c1[0], corners[3][1] - c1[1], corners[3][2] - c1[2]) || 1
    : Lx;

  const origin = new THREE.Vector3(
    axes.centroid[0] + axes.vz[0] * 0.008,
    axes.centroid[1] + axes.vz[1] * 0.008,
    axes.centroid[2] + axes.vz[2] * 0.008
  );

  const colorHex = isDark ? 0xf59e0b : 0xd97706;
  const lineMat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2, depthTest: true, depthWrite: true });

  const symbolLen = Math.max(0.3, Math.min(0.55, Math.min(Lx, Ly) * 0.25));

  const drawSmallBiArrow = (vDir: [number, number, number]) => {
    const half = symbolLen * 0.5;
    const p1 = new THREE.Vector3(
      origin.x - vDir[0] * half,
      origin.y - vDir[1] * half,
      origin.z - vDir[2] * half
    );
    const p2 = new THREE.Vector3(
      origin.x + vDir[0] * half,
      origin.y + vDir[1] * half,
      origin.z + vDir[2] * half
    );

    const lineGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const line = new THREE.Line(lineGeom, lineMat);
    makeOnTop(line, 1);
    engine.overlayGroup.add(line);

    const arrHead1 = new THREE.ArrowHelper(
      new THREE.Vector3(...vDir),
      new THREE.Vector3(p2.x - vDir[0] * 0.1, p2.y - vDir[1] * 0.1, p2.z - vDir[2] * 0.1),
      0.1,
      colorHex,
      0.08,
      0.04
    );
    const arrHead2 = new THREE.ArrowHelper(
      new THREE.Vector3(-vDir[0], -vDir[1], -vDir[2]),
      new THREE.Vector3(p1.x + vDir[0] * 0.1, p1.y + vDir[1] * 0.1, p1.z + vDir[2] * 0.1),
      0.1,
      colorHex,
      0.08,
      0.04
    );
    makeOnTop(arrHead1, 1);
    makeOnTop(arrHead2, 1);
    engine.overlayGroup.add(arrHead1);
    engine.overlayGroup.add(arrHead2);
  };

  if (dir === 'one_way_x' || dir === 'two_way') {
    drawSmallBiArrow(axes.vx);
  }
  if (dir === 'one_way_y' || dir === 'two_way') {
    drawSmallBiArrow(axes.vy);
  }
}

function build3DPanelPressureLoad(
  engine: RenderEngine3D,
  panel: Panel3D,
  nodes: Node3D[],
  isDark: boolean
) {
  if (!panel.pressure || Math.abs(panel.pressure.value) < 1e-4) return;

  const axes = computePanelLocalAxes(panel, nodes);
  if (!axes) return;

  const corners = getPanelCorners(panel, nodes);
  if (corners.length < 3) return;

  const val = panel.pressure.value;
  const pDir = panel.pressure.dir;

  let loadVec: [number, number, number] = [0, 0, 0];
  if (pDir === 'normal') {
    const sign = Math.sign(val);
    loadVec = [-axes.vz[0] * sign, -axes.vz[1] * sign, -axes.vz[2] * sign];
  } else if (pDir === 'X') {
    const sign = Math.sign(val);
    loadVec = [sign, 0, 0];
  } else if (pDir === 'Y') {
    const sign = Math.sign(val);
    loadVec = [0, sign, 0];
  } else if (pDir === 'Z') {
    const sign = Math.sign(val);
    loadVec = [0, 0, sign];
  }

  const colorHex = 0xf97316;
  const arrowLength = 0.55;

  // Central arrow at the center of gravity of the load (axes.centroid)
  const centerTail = new THREE.Vector3(
    axes.centroid[0] - loadVec[0] * arrowLength,
    axes.centroid[1] - loadVec[1] * arrowLength,
    axes.centroid[2] - loadVec[2] * arrowLength
  );
  const centerArrow = new THREE.ArrowHelper(
    new THREE.Vector3(...loadVec),
    centerTail,
    arrowLength,
    colorHex,
    0.16,
    0.08
  );
  makeOnTop(centerArrow, 1);
  engine.overlayGroup.add(centerArrow);

  const N = corners.length;
  for (let i = 0; i < N; i++) {
    const cA = corners[i];
    const cB = corners[(i + 1) % N];

    const numArrows = 4;
    const tailPoints: THREE.Vector3[] = [];

    for (let k = 0; k <= numArrows; k++) {
      const t = k / numArrows;
      const px = cA[0] + (cB[0] - cA[0]) * t;
      const py = cA[1] + (cB[1] - cA[1]) * t;
      const pz = cA[2] + (cB[2] - cA[2]) * t;

      const pTip = new THREE.Vector3(px, py, pz);
      const pTail = new THREE.Vector3(
        px - loadVec[0] * arrowLength,
        py - loadVec[1] * arrowLength,
        pz - loadVec[2] * arrowLength
      );
      tailPoints.push(pTail);

      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(...loadVec),
        pTail,
        arrowLength,
        colorHex,
        0.12,
        0.06
      );
      makeOnTop(arrow, 1);
      engine.overlayGroup.add(arrow);
    }

    const lineGeom = new THREE.BufferGeometry().setFromPoints(tailPoints);
    const lineMat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2, depthTest: true, depthWrite: true });
    const line = new THREE.Line(lineGeom, lineMat);
    makeOnTop(line, 1);
    engine.overlayGroup.add(line);
  }
}

function build3DSinglePanel(
  engine: RenderEngine3D,
  panel: Panel3D,
  nodes: Node3D[],
  options: SceneRenderOptions,
  isDark: boolean
) {
  const corners = getPanelCorners(panel, nodes);
  if (corners.length < 3) return;

  const colorHex = panel.color
    ? parseInt(panel.color.replace('#', '0x'))
    : (isDark ? 0x0284c7 : 0x0ea5e9);

  const fillMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: isDark ? 0.35 : 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const geom = new THREE.BufferGeometry();
  if (corners.length === 3) {
    const [c1, c2, c3] = corners;
    const positions = new Float32Array([
      c1[0], c1[1], c1[2],
      c2[0], c2[1], c2[2],
      c3[0], c3[1], c3[2],
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, fillMat);
    mesh.userData = { type: 'panel', id: panel.id, defaultColorHex: colorHex };
    engine.modelGroup.add(mesh);

    const borderPoints = [
      new THREE.Vector3(c1[0], c1[1], c1[2]),
      new THREE.Vector3(c2[0], c2[1], c2[2]),
      new THREE.Vector3(c3[0], c3[1], c3[2]),
      new THREE.Vector3(c1[0], c1[1], c1[2]),
    ];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const lineMat = new THREE.LineBasicMaterial({
      color: isDark ? 0x38bdf8 : 0x0284c7,
      linewidth: 1.5,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    line.userData = { type: 'panel_edge', id: panel.id };
    engine.modelGroup.add(line);
  } else if (corners.length === 4) {
    const [c1, c2, c3, c4] = corners;
    const positions = new Float32Array([
      c1[0], c1[1], c1[2],
      c2[0], c2[1], c2[2],
      c3[0], c3[1], c3[2],

      c1[0], c1[1], c1[2],
      c3[0], c3[1], c3[2],
      c4[0], c4[1], c4[2],
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, fillMat);
    mesh.userData = { type: 'panel', id: panel.id, defaultColorHex: colorHex };
    engine.modelGroup.add(mesh);

    const borderPoints = [
      new THREE.Vector3(c1[0], c1[1], c1[2]),
      new THREE.Vector3(c2[0], c2[1], c2[2]),
      new THREE.Vector3(c3[0], c3[1], c3[2]),
      new THREE.Vector3(c4[0], c4[1], c4[2]),
      new THREE.Vector3(c1[0], c1[1], c1[2]),
    ];
    const lineGeom = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const lineMat = new THREE.LineBasicMaterial({
      color: isDark ? 0x38bdf8 : 0x0284c7,
      linewidth: 1.5,
    });
    const line = new THREE.Line(lineGeom, lineMat);
    line.userData = { type: 'panel_edge', id: panel.id };
    engine.modelGroup.add(line);
  }
}

function build3DGrid(
  engine: RenderEngine3D,
  nodes: Node3D[],
  isDark: boolean,
  showGrid: boolean,
  gridPlane: 'XY' | 'XZ' | 'YZ' = 'XY',
  gridOffset: number = 0
) {
  if (!showGrid) return;

  const step = 1.0;
  const positions: number[] = [];
  const colors: number[] = [];

  const minorColor = isDark ? new THREE.Color(0x334155) : new THREE.Color(0xcbd5e1);
  const majorColor = isDark ? new THREE.Color(0x475569) : new THREE.Color(0x94a3b8);

  if (gridPlane === 'XY') {
    let minX = -5, maxX = 5, minY = -5, maxY = 5;
    if (nodes.length > 0) {
      nodes.forEach((n) => {
        minX = Math.min(minX, n.x - 2);
        maxX = Math.max(maxX, n.x + 2);
        minY = Math.min(minY, n.y - 2);
        maxY = Math.max(maxY, n.y + 2);
      });
    }
    const startX = Math.floor(minX / step) * step;
    const endX = Math.ceil(maxX / step) * step;
    const startY = Math.floor(minY / step) * step;
    const endY = Math.ceil(maxY / step) * step;

    for (let y = startY; y <= endY; y += step) {
      const isMajor = Math.abs(Math.round(y / 5) * 5 - y) < 1e-4;
      const c = isMajor ? majorColor : minorColor;
      positions.push(startX, y, gridOffset, endX, y, gridOffset);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let x = startX; x <= endX; x += step) {
      const isMajor = Math.abs(Math.round(x / 5) * 5 - x) < 1e-4;
      const c = isMajor ? majorColor : minorColor;
      positions.push(x, startY, gridOffset, x, endY, gridOffset);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  } else if (gridPlane === 'XZ') {
    let minX = -5, maxX = 5, minZ = -5, maxZ = 5;
    if (nodes.length > 0) {
      nodes.forEach((n) => {
        minX = Math.min(minX, n.x - 2);
        maxX = Math.max(maxX, n.x + 2);
        minZ = Math.min(minZ, n.z - 2);
        maxZ = Math.max(maxZ, n.z + 2);
      });
    }
    const startX = Math.floor(minX / step) * step;
    const endX = Math.ceil(maxX / step) * step;
    const startZ = Math.floor(minZ / step) * step;
    const endZ = Math.ceil(maxZ / step) * step;

    for (let z = startZ; z <= endZ; z += step) {
      const isMajor = Math.abs(Math.round(z / 5) * 5 - z) < 1e-4;
      const c = isMajor ? majorColor : minorColor;
      positions.push(startX, gridOffset, z, endX, gridOffset, z);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let x = startX; x <= endX; x += step) {
      const isMajor = Math.abs(Math.round(x / 5) * 5 - x) < 1e-4;
      const c = isMajor ? majorColor : minorColor;
      positions.push(x, gridOffset, startZ, x, gridOffset, endZ);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  } else if (gridPlane === 'YZ') {
    let minY = -5, maxY = 5, minZ = -5, maxZ = 5;
    if (nodes.length > 0) {
      nodes.forEach((n) => {
        minY = Math.min(minY, n.y - 2);
        maxY = Math.max(maxY, n.y + 2);
        minZ = Math.min(minZ, n.z - 2);
        maxZ = Math.max(maxZ, n.z + 2);
      });
    }
    const startY = Math.floor(minY / step) * step;
    const endY = Math.ceil(maxY / step) * step;
    const startZ = Math.floor(minZ / step) * step;
    const endZ = Math.ceil(maxZ / step) * step;

    for (let z = startZ; z <= endZ; z += step) {
      const isMajor = Math.abs(Math.round(z / 5) * 5 - z) < 1e-4;
      const c = isMajor ? majorColor : minorColor;
      positions.push(gridOffset, startY, z, gridOffset, endY, z);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    for (let y = startY; y <= endY; y += step) {
      const isMajor = Math.abs(Math.round(y / 5) * 5 - y) < 1e-4;
      const c = isMajor ? majorColor : minorColor;
      positions.push(gridOffset, y, startZ, gridOffset, y, endZ);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
  });

  const gridLines = new THREE.LineSegments(geom, mat);
  engine.modelGroup.add(gridLines);
}

function build3DOriginTriad(engine: RenderEngine3D) {
  const len = 1.5;

  // X axis (Red)
  const dirX = new THREE.Vector3(1, 0, 0);
  const arrowX = new THREE.ArrowHelper(dirX, new THREE.Vector3(0, 0, 0), len, 0xef4444, 0.25, 0.12);
  makeOnTop(arrowX, 1);
  engine.overlayGroup.add(arrowX);

  // Y axis (Green)
  const dirY = new THREE.Vector3(0, 1, 0);
  const arrowY = new THREE.ArrowHelper(dirY, new THREE.Vector3(0, 0, 0), len, 0x22c55e, 0.25, 0.12);
  makeOnTop(arrowY, 1);
  engine.overlayGroup.add(arrowY);

  // Z axis (Blue)
  const dirZ = new THREE.Vector3(0, 0, 1);
  const arrowZ = new THREE.ArrowHelper(dirZ, new THREE.Vector3(0, 0, 0), len, 0x3b82f6, 0.25, 0.12);
  makeOnTop(arrowZ, 1);
  engine.overlayGroup.add(arrowZ);
}

function createProfileShape2D(sec: Section): THREE.Shape {
  const shape = new THREE.Shape();
  const hM = Math.max(0.01, (sec.h || 10) * 0.01); // meters
  const bM = Math.max(0.01, (sec.b || sec.h || 10) * 0.01); // meters
  const tfM = (sec.tf ?? sec.h * 0.08 ?? 0.8) * 0.01;
  const twM = (sec.tw ?? sec.b * 0.06 ?? 0.5) * 0.01;
  const tM = (sec.t ?? 0.5) * 0.01;

  const shapeStr = (sec.shape || '').toLowerCase();

  // 1. I-Beam (catIPN, catIPE, catHEA, catHEB, catHEM, ibeam)
  if (
    shapeStr.includes('ipn') ||
    shapeStr.includes('ipe') ||
    shapeStr.includes('hea') ||
    shapeStr.includes('heb') ||
    shapeStr.includes('hem') ||
    shapeStr.includes('ibeam')
  ) {
    const hy = hM / 2;
    const bz = bM / 2;
    const twz = Math.min(twM / 2, bz * 0.8);
    const tfy = Math.min(tfM, hy * 0.45);

    shape.moveTo(-hy, -bz);
    shape.lineTo(-hy, bz);
    shape.lineTo(-hy + tfy, bz);
    shape.lineTo(-hy + tfy, twz);
    shape.lineTo(hy - tfy, twz);
    shape.lineTo(hy - tfy, bz);
    shape.lineTo(hy, bz);
    shape.lineTo(hy, -bz);
    shape.lineTo(hy - tfy, -bz);
    shape.lineTo(hy - tfy, -twz);
    shape.lineTo(-hy + tfy, -twz);
    shape.lineTo(-hy + tfy, -bz);
    shape.closePath();
    return shape;
  }

  // 2. C-Channel (catUPN, catUPE, channel)
  if (shapeStr.includes('upn') || shapeStr.includes('upe') || shapeStr.includes('channel')) {
    const hy = hM / 2;
    const bz = bM / 2;
    const twz = Math.min(twM, bM * 0.8);
    const tfy = Math.min(tfM, hy * 0.45);

    shape.moveTo(-hy, -bz);
    shape.lineTo(-hy, bz);
    shape.lineTo(-hy + tfy, bz);
    shape.lineTo(-hy + tfy, -bz + twz);
    shape.lineTo(hy - tfy, -bz + twz);
    shape.lineTo(hy - tfy, bz);
    shape.lineTo(hy, bz);
    shape.lineTo(hy, -bz);
    shape.closePath();
    return shape;
  }

  // 3. L-Angle (angle, catL)
  if (shapeStr.includes('angle') || shapeStr.includes('catl')) {
    const hy = hM / 2;
    const bz = bM / 2;
    const tm = Math.min(tM, Math.min(hy, bz) * 0.8);

    shape.moveTo(-hy, -bz);
    shape.lineTo(-hy, bz);
    shape.lineTo(-hy + tm, bz);
    shape.lineTo(-hy + tm, -bz + tm);
    shape.lineTo(hy, -bz + tm);
    shape.lineTo(hy, -bz);
    shape.closePath();
    return shape;
  }

  // 4. Tee (tee, catT)
  if (shapeStr.includes('tee') || shapeStr.includes('catt')) {
    const hy = hM / 2;
    const bz = bM / 2;
    const twz = Math.min(twM / 2, bz * 0.8);
    const tfy = Math.min(tfM, hy * 0.8);

    shape.moveTo(-hy, -twz);
    shape.lineTo(hy - tfy, -twz);
    shape.lineTo(hy - tfy, -bz);
    shape.lineTo(hy, -bz);
    shape.lineTo(hy, bz);
    shape.lineTo(hy - tfy, bz);
    shape.lineTo(hy - tfy, twz);
    shape.lineTo(-hy, twz);
    shape.closePath();
    return shape;
  }

  // 5. Box / RHS / SHS (box, rhs, shs)
  if (shapeStr.includes('box') || shapeStr.includes('rhs') || shapeStr.includes('shs')) {
    const hy = hM / 2;
    const bz = bM / 2;
    const tm = Math.min(tM, Math.min(hy, bz) * 0.45);

    shape.moveTo(-hy, -bz);
    shape.lineTo(-hy, bz);
    shape.lineTo(hy, bz);
    shape.lineTo(hy, -bz);
    shape.closePath();

    if (hy > tm && bz > tm) {
      const hole = new THREE.Path();
      hole.moveTo(-hy + tm, -bz + tm);
      hole.lineTo(hy - tm, -bz + tm);
      hole.lineTo(hy - tm, bz - tm);
      hole.lineTo(-hy + tm, bz - tm);
      hole.closePath();
      shape.holes.push(hole);
    }
    return shape;
  }

  // 6. Pipe / CHS (pipe, chs)
  if (shapeStr.includes('pipe') || shapeStr.includes('chs')) {
    const r = (hM > 0 ? hM : bM) / 2;
    shape.absarc(0, 0, r, 0, Math.PI * 2, false);

    const tm = Math.min(tM, r * 0.8);
    if (tm > 0 && r > tm) {
      const hole = new THREE.Path();
      hole.absarc(0, 0, r - tm, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    return shape;
  }

  // 7. Circle (circ)
  if (shapeStr.includes('circ')) {
    const r = (hM > 0 ? hM : bM) / 2;
    shape.absarc(0, 0, r, 0, Math.PI * 2, false);
    return shape;
  }

  // 8. Solid Rectangle (rect or fallback)
  const hy = hM / 2;
  const bz = bM / 2;
  shape.moveTo(-hy, -bz);
  shape.lineTo(-hy, bz);
  shape.lineTo(hy, bz);
  shape.lineTo(hy, -bz);
  shape.closePath();
  return shape;
}

function build3DSingleElement(
  engine: RenderEngine3D,
  el: Element3D,
  n1: Node3D,
  n2: Node3D,
  sec: Section | undefined,
  options: SceneRenderOptions,
  solved: SolverResult3D | null
) {
  const isDark = options.theme === 'dark';
  const isSelected = options.selectedElemIds.includes(el.id);
  const isHover = options.hoverElemId === el.id;

  const hexColor = isSelected
    ? options.accentColor
    : isHover
    ? '#38bdf8'
    : isDark
    ? '#94a3b8'
    : '#334155';

  const opacity = options.showDeform && solved ? 0.35 : 1.0;

  const start = new THREE.Vector3(n1.x, n1.y, n1.z);
  const end = new THREE.Vector3(n2.x, n2.y, n2.z);
  const vec = new THREE.Vector3().subVectors(end, start);
  const len = vec.length();

  if (len < 1e-6) return;

  const { L, vx, vy, vz } = computeLocalAxes(n1, n2, el.rollAngle || 0);
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  if (options.showProfileSketches && sec) {
    const profileShape = createProfileShape2D(sec);
    const geom = new THREE.ExtrudeGeometry(profileShape, { depth: L, bevelEnabled: false });

    // Map extruded coordinates (x_2d, y_2d, z_extrude) to local member coordinates (x_local, y_local, z_local)
    geom.applyMatrix4(
      new THREE.Matrix4().set(
        0, 0, 1, -L / 2,
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 0, 1
      )
    );

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hexColor),
      roughness: 0.4,
      metalness: 0.2,
      transparent: opacity < 1.0,
      opacity,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.set(
      vx[0], vy[0], vz[0], mid.x,
      vx[1], vy[1], vz[1], mid.y,
      vx[2], vy[2], vz[2], mid.z,
      0,     0,     0,     1
    );
    mesh.userData = { type: 'element', id: el.id, isEdge: false };

    engine.modelGroup.add(mesh);

    // Profile edge outlines
    const edgeGeom = new THREE.EdgesGeometry(geom);
    const edgeMat = new THREE.LineBasicMaterial({
      color: isSelected ? new THREE.Color(options.accentColor) : new THREE.Color(isDark ? 0x64748b : 0x475569),
      transparent: opacity < 1.0,
      opacity: opacity < 1.0 ? opacity * 0.7 : 0.8,
    });
    const edgeMesh = new THREE.LineSegments(edgeGeom, edgeMat);
    edgeMesh.matrixAutoUpdate = false;
    edgeMesh.matrix.copy(mesh.matrix);
    edgeMesh.userData = { type: 'element', id: el.id, isEdge: true };
    engine.modelGroup.add(edgeMesh);
  } else {
    // Render element as 3D Cylinder / Solid Bar fallback
    const radius = isSelected ? 0.08 : isHover ? 0.07 : 0.05;
    const geom = new THREE.CylinderGeometry(radius, radius, len, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hexColor),
      roughness: 0.4,
      metalness: 0.2,
      transparent: opacity < 1.0,
      opacity,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(mid);

    const orientation = new THREE.Matrix4();
    orientation.lookAt(start, end, new THREE.Vector3(0, 0, 1));
    const rotation = new THREE.Matrix4();
    rotation.makeRotationX(Math.PI / 2);
    orientation.multiply(rotation);
    mesh.setRotationFromMatrix(orientation);
    mesh.userData = { type: 'element', id: el.id, isEdge: false };

    engine.modelGroup.add(mesh);
  }

  // End hinges / releases
  const h = el.hinges || {};
  const hasStartHinge = h.start_rx || h.start_ry || h.start_rz || h.start_ux || h.start_uy || h.start_uz;
  const hasEndHinge = h.end_rx || h.end_ry || h.end_rz || h.end_ux || h.end_uy || h.end_uz;

  const hingeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const hingeGeom = new THREE.SphereGeometry(0.12, 12, 12);

  if (hasStartHinge) {
    const dir = vec.clone().normalize();
    const hPos = start.clone().add(dir.multiplyScalar(0.25));
    const hMesh = new THREE.Mesh(hingeGeom, hingeMat);
    hMesh.position.copy(hPos);
    engine.modelGroup.add(hMesh);
  }

  if (hasEndHinge) {
    const dir = vec.clone().normalize();
    const hPos = end.clone().sub(dir.multiplyScalar(0.25));
    const hMesh = new THREE.Mesh(hingeGeom, hingeMat);
    hMesh.position.copy(hPos);
    engine.modelGroup.add(hMesh);
  }
}

function build3DSingleNode(engine: RenderEngine3D, n: Node3D, options: SceneRenderOptions) {
  const isSelected = options.selectedNodeIds.includes(n.id);
  const isHover = options.hoverNodeId === n.id;
  const isDark = options.theme === 'dark';

  const hexColor = isSelected ? options.accentColor : isHover ? '#38bdf8' : (isDark ? '#cbd5e1' : '#0f172a');
  const radius = 0.12;

  const geom = new THREE.SphereGeometry(radius, 16, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(hexColor),
    roughness: 0.3,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(n.x, n.y, n.z);
  mesh.userData = { type: 'node', id: n.id };
  const s = isSelected ? 1.45 : isHover ? 1.25 : 1.0;
  mesh.scale.set(s, s, s);
  engine.modelGroup.add(mesh);
}

// Helper: Create a 3D circle line in a given plane (yz, xz, or xy)
function createCircleGeometry(
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  plane: 'yz' | 'xz' | 'xy',
  segments = 36
): THREE.BufferGeometry {
  const points: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const c = Math.cos(theta) * radius;
    const s = Math.sin(theta) * radius;
    if (plane === 'yz') {
      points.push(cx, cy + c, cz + s);
    } else if (plane === 'xz') {
      points.push(cx + c, cy, cz + s);
    } else {
      points.push(cx + c, cy + s, cz);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geom;
}

function buildFixedSupport(engine: RenderEngine3D, n: Node3D, isDark: boolean) {
  const edgeColor = isDark ? 0x94a3b8 : 0x1e293b;
  const hatchColor = isDark ? 0x64748b : 0x94a3b8;
  const faceColor = isDark ? 0x334155 : 0x94a3b8;

  const W = 0.44;
  const H = 0.10;
  const zTop = n.z;
  const zBot = n.z - H;

  // Foundation block lines
  const linePos: number[] = [
    // Top rectangle
    n.x - W / 2, n.y - W / 2, zTop,   n.x + W / 2, n.y - W / 2, zTop,
    n.x + W / 2, n.y - W / 2, zTop,   n.x + W / 2, n.y + W / 2, zTop,
    n.x + W / 2, n.y + W / 2, zTop,   n.x - W / 2, n.y + W / 2, zTop,
    n.x - W / 2, n.y + W / 2, zTop,   n.x - W / 2, n.y - W / 2, zTop,
    // Bottom rectangle
    n.x - W / 2, n.y - W / 2, zBot,   n.x + W / 2, n.y - W / 2, zBot,
    n.x + W / 2, n.y - W / 2, zBot,   n.x + W / 2, n.y + W / 2, zBot,
    n.x + W / 2, n.y + W / 2, zBot,   n.x - W / 2, n.y + W / 2, zBot,
    n.x - W / 2, n.y + W / 2, zBot,   n.x - W / 2, n.y - W / 2, zBot,
    // Vertical corner pillars
    n.x - W / 2, n.y - W / 2, zTop,   n.x - W / 2, n.y - W / 2, zBot,
    n.x + W / 2, n.y - W / 2, zTop,   n.x + W / 2, n.y - W / 2, zBot,
    n.x + W / 2, n.y + W / 2, zTop,   n.x + W / 2, n.y + W / 2, zBot,
    n.x - W / 2, n.y + W / 2, zTop,   n.x - W / 2, n.y + W / 2, zBot,
  ];

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  const mat = new THREE.LineBasicMaterial({ color: edgeColor });
  engine.modelGroup.add(new THREE.LineSegments(geom, mat));

  // Subtle semi-transparent foundation top plate
  const plateGeom = new THREE.PlaneGeometry(W, W);
  const plateMat = new THREE.MeshBasicMaterial({
    color: faceColor,
    transparent: true,
    opacity: isDark ? 0.25 : 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const plate = new THREE.Mesh(plateGeom, plateMat);
  plate.position.set(n.x, n.y, zTop - 0.001);
  engine.modelGroup.add(plate);
}

function buildPinnedPyramidSupport(engine: RenderEngine3D, n: Node3D, isDark: boolean) {
  const H = 0.36; // Height of pyramid
  const W = 0.22; // Half base width
  const edgeColor = isDark ? 0x94a3b8 : 0x1e293b;
  const faceColor = isDark ? 0x475569 : 0x94a3b8;
  const zBase = n.z - H;

  // 4 corners of base
  const c1 = [n.x - W, n.y - W, zBase];
  const c2 = [n.x + W, n.y - W, zBase];
  const c3 = [n.x + W, n.y + W, zBase];
  const c4 = [n.x - W, n.y + W, zBase];
  const apex = [n.x, n.y, n.z];

  // 1. Sharp line wireframe of triangular pyramid
  const linePos: number[] = [
    // 4 edges meeting at apex
    apex[0], apex[1], apex[2], c1[0], c1[1], c1[2],
    apex[0], apex[1], apex[2], c2[0], c2[1], c2[2],
    apex[0], apex[1], apex[2], c3[0], c3[1], c3[2],
    apex[0], apex[1], apex[2], c4[0], c4[1], c4[2],
    // 4 base perimeter edges
    c1[0], c1[1], c1[2], c2[0], c2[1], c2[2],
    c2[0], c2[1], c2[2], c3[0], c3[1], c3[2],
    c3[0], c3[1], c3[2], c4[0], c4[1], c4[2],
    c4[0], c4[1], c4[2], c1[0], c1[1], c1[2],
  ];

  const wireGeom = new THREE.BufferGeometry();
  wireGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  const wireMat = new THREE.LineBasicMaterial({ color: edgeColor });
  engine.modelGroup.add(new THREE.LineSegments(wireGeom, wireMat));

  // 2. Crisp flat triangular faces (semi-transparent fill)
  const facePos: number[] = [
    // Triangle 1
    apex[0], apex[1], apex[2], c1[0], c1[1], c1[2], c2[0], c2[1], c2[2],
    // Triangle 2
    apex[0], apex[1], apex[2], c2[0], c2[1], c2[2], c3[0], c3[1], c3[2],
    // Triangle 3
    apex[0], apex[1], apex[2], c3[0], c3[1], c3[2], c4[0], c4[1], c4[2],
    // Triangle 4
    apex[0], apex[1], apex[2], c4[0], c4[1], c4[2], c1[0], c1[1], c1[2],
  ];
  const triGeom = new THREE.BufferGeometry();
  triGeom.setAttribute('position', new THREE.Float32BufferAttribute(facePos, 3));
  triGeom.computeVertexNormals();
  const triMat = new THREE.MeshBasicMaterial({
    color: faceColor,
    transparent: true,
    opacity: isDark ? 0.22 : 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  engine.modelGroup.add(new THREE.Mesh(triGeom, triMat));

  // 3. Small hinge circle at apex in X-Z and Y-Z
  const circleGeom1 = createCircleGeometry(n.x, n.y, n.z, 0.04, 'xz', 24);
  const circleGeom2 = createCircleGeometry(n.x, n.y, n.z, 0.04, 'yz', 24);
  const circleMat = new THREE.LineBasicMaterial({ color: edgeColor });
  engine.modelGroup.add(new THREE.LineLoop(circleGeom1, circleMat));
  engine.modelGroup.add(new THREE.LineLoop(circleGeom2, circleMat));
}

function buildLinearStrutRestraint(
  engine: RenderEngine3D,
  n: Node3D,
  axis: 'x' | 'y' | 'z',
  isSpring: boolean,
  isDark: boolean,
  delta = 0
) {
  const L = 0.36; // Length of link strut
  const rCircle = 0.035; // Hinge circle radius
  const baseSpan = 0.22; // Ground base line span

  // Axis Color: X = Red (0xef4444), Y = Green (0x22c55e), Z = Blue (0x3b82f6)
  const axisColor =
    axis === 'x'
      ? (isSpring ? 0xf87171 : 0xef4444)
      : axis === 'y'
      ? (isSpring ? 0x4ade80 : 0x22c55e)
      : (isSpring ? 0x60a5fa : 0x3b82f6);

  const hatchColor = isDark ? 0x94a3b8 : 0x475569;
  const linePos: number[] = [];

  if (axis === 'z') {
    // Vertical restraint along Z-axis (below the node)
    const zBase = n.z - L;

    // Top hinge circle at (n.x, n.y, n.z)
    const c1 = createCircleGeometry(n.x, n.y, n.z, rCircle, 'xz', 24);
    engine.modelGroup.add(new THREE.LineLoop(c1, new THREE.LineBasicMaterial({ color: axisColor })));

    // Bottom hinge circle at (n.x, n.y, zBase + rCircle)
    const c2 = createCircleGeometry(n.x, n.y, zBase + rCircle, rCircle, 'xz', 24);
    engine.modelGroup.add(new THREE.LineLoop(c2, new THREE.LineBasicMaterial({ color: axisColor })));

    // Strut connecting line
    const zTop = n.z - rCircle;
    const zBot = zBase + 2 * rCircle;

    if (isSpring) {
      // Spring zig-zag along Z
      const numCoils = 4;
      const dz = (zTop - zBot) / (numCoils * 2);
      let curZ = zTop;
      let curX = n.x;
      for (let i = 0; i < numCoils * 2; i++) {
        const nextZ = curZ - dz;
        const nextX = n.x + (i % 2 === 0 ? 0.035 : -0.035);
        linePos.push(curX, n.y, curZ, nextX, n.y, nextZ);
        curZ = nextZ;
        curX = nextX;
      }
      linePos.push(curX, n.y, curZ, n.x, n.y, zBot);
    } else {
      // Double parallel strut line
      const off = 0.015;
      linePos.push(n.x - off, n.y, zTop, n.x - off, n.y, zBot);
      linePos.push(n.x + off, n.y, zTop, n.x + off, n.y, zBot);
    }

    // Ground base plate line (perpendicular to Z, in X direction)
    linePos.push(n.x - baseSpan / 2, n.y, zBase, n.x + baseSpan / 2, n.y, zBase);
  } else if (axis === 'x') {
    // Horizontal restraint along X-axis (from n.x to n.x - L)
    const xBase = n.x - L;

    // First hinge circle at (n.x, n.y, n.z)
    const c1 = createCircleGeometry(n.x, n.y, n.z, rCircle, 'xz', 24);
    engine.modelGroup.add(new THREE.LineLoop(c1, new THREE.LineBasicMaterial({ color: axisColor })));

    // Second hinge circle at (xBase + rCircle, n.y, n.z)
    const c2 = createCircleGeometry(xBase + rCircle, n.y, n.z, rCircle, 'xz', 24);
    engine.modelGroup.add(new THREE.LineLoop(c2, new THREE.LineBasicMaterial({ color: axisColor })));

    const xRight = n.x - rCircle;
    const xLeft = xBase + 2 * rCircle;

    if (isSpring) {
      // Spring zig-zag along X
      const numCoils = 4;
      const dx = (xRight - xLeft) / (numCoils * 2);
      let curX = xRight;
      let curZ = n.z;
      for (let i = 0; i < numCoils * 2; i++) {
        const nextX = curX - dx;
        const nextZ = n.z + (i % 2 === 0 ? 0.035 : -0.035);
        linePos.push(curX, n.y, curZ, nextX, n.y, nextZ);
        curX = nextX;
        curZ = nextZ;
      }
      linePos.push(curX, n.y, curZ, xLeft, n.y, n.z);
    } else {
      // Double parallel strut line
      const off = 0.015;
      linePos.push(xRight, n.y, n.z - off, xLeft, n.y, n.z - off);
      linePos.push(xRight, n.y, n.z + off, xLeft, n.y, n.z + off);
    }

    // Ground base plate line (perpendicular to X, in Z direction)
    linePos.push(xBase, n.y, n.z - baseSpan / 2, xBase, n.y, n.z + baseSpan / 2);
  } else {
    // Horizontal restraint along Y-axis (from n.y to n.y - L)
    const yBase = n.y - L;

    // First hinge circle at (n.x, n.y, n.z)
    const c1 = createCircleGeometry(n.x, n.y, n.z, rCircle, 'yz', 24);
    engine.modelGroup.add(new THREE.LineLoop(c1, new THREE.LineBasicMaterial({ color: axisColor })));

    // Second hinge circle at (n.x, yBase + rCircle, n.z)
    const c2 = createCircleGeometry(n.x, yBase + rCircle, n.z, rCircle, 'yz', 24);
    engine.modelGroup.add(new THREE.LineLoop(c2, new THREE.LineBasicMaterial({ color: axisColor })));

    const yNear = n.y - rCircle;
    const yFar = yBase + 2 * rCircle;

    if (isSpring) {
      // Spring zig-zag along Y
      const numCoils = 4;
      const dy = (yNear - yFar) / (numCoils * 2);
      let curY = yNear;
      let curZ = n.z;
      for (let i = 0; i < numCoils * 2; i++) {
        const nextY = curY - dy;
        const nextZ = n.z + (i % 2 === 0 ? 0.035 : -0.035);
        linePos.push(n.x, curY, curZ, n.x, nextY, nextZ);
        curY = nextY;
        curZ = nextZ;
      }
      linePos.push(n.x, curY, curZ, n.x, yFar, n.z);
    } else {
      // Double parallel strut line
      const off = 0.015;
      linePos.push(n.x, yNear, n.z - off, n.x, yFar, n.z - off);
      linePos.push(n.x, yNear, n.z + off, n.x, yFar, n.z + off);
    }

    // Ground base plate line (perpendicular to Y, in Z direction)
    linePos.push(n.x, yBase, n.z - baseSpan / 2, n.x, yBase, n.z + baseSpan / 2);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  const mat = new THREE.LineBasicMaterial({ color: axisColor });
  engine.modelGroup.add(new THREE.LineSegments(geom, mat));
}

function buildRotationalRingRestraint(
  engine: RenderEngine3D,
  n: Node3D,
  axis: 'x' | 'y' | 'z',
  isSpring: boolean,
  isDark: boolean,
  delta = 0
) {
  const radius = 0.22;

  // Axis Color: Rx = Red (0xef4444), Ry = Green (0x22c55e), Rz = Blue (0x3b82f6)
  const axisColor =
    axis === 'x'
      ? (isSpring ? 0xf87171 : 0xef4444)
      : axis === 'y'
      ? (isSpring ? 0x4ade80 : 0x22c55e)
      : (isSpring ? 0x60a5fa : 0x3b82f6);

  const plane = axis === 'x' ? 'yz' : axis === 'y' ? 'xz' : 'xy';
  const circleGeom = createCircleGeometry(n.x, n.y, n.z, radius, plane, 36);
  const circleMat = new THREE.LineBasicMaterial({ color: axisColor });
  engine.modelGroup.add(new THREE.LineLoop(circleGeom, circleMat));

  // Small anchor bracket / cross tick on the circle
  const tickPos: number[] = [];
  const tickLen = 0.06;
  if (axis === 'x') {
    // In Y-Z plane at bottom of circle
    const zBottom = n.z - radius;
    tickPos.push(
      n.x, n.y - tickLen, zBottom,
      n.x, n.y + tickLen, zBottom,
      n.x, n.y, zBottom,
      n.x, n.y, zBottom - 0.04
    );
  } else if (axis === 'y') {
    // In X-Z plane at bottom of circle
    const zBottom = n.z - radius;
    tickPos.push(
      n.x - tickLen, n.y, zBottom,
      n.x + tickLen, n.y, zBottom,
      n.x, n.y, zBottom,
      n.x, n.y, zBottom - 0.04
    );
  } else {
    // In X-Y plane at side of circle
    const xSide = n.x - radius;
    tickPos.push(
      xSide, n.y - tickLen, n.z,
      xSide, n.y + tickLen, n.z,
      xSide, n.y, n.z,
      xSide - 0.04, n.y, n.z
    );
  }

  const tickGeom = new THREE.BufferGeometry();
  tickGeom.setAttribute('position', new THREE.Float32BufferAttribute(tickPos, 3));
  engine.modelGroup.add(new THREE.LineSegments(tickGeom, circleMat));
}

function build3DSingleSupport(engine: RenderEngine3D, n: Node3D, isDark: boolean) {
  if (!n.support) return;
  const sp = n.support;

  const supportGroup = new THREE.Group();
  const mockEngine = {
    ...engine,
    modelGroup: supportGroup,
  } as any;

  const isFixed =
    sp.ux.type === 'fixed' &&
    sp.uy.type === 'fixed' &&
    sp.uz.type === 'fixed' &&
    sp.rx.type === 'fixed' &&
    sp.ry.type === 'fixed' &&
    sp.rz.type === 'fixed';

  const isPinned =
    sp.ux.type === 'fixed' &&
    sp.uy.type === 'fixed' &&
    sp.uz.type === 'fixed' &&
    sp.rx.type === 'free' &&
    sp.ry.type === 'free' &&
    sp.rz.type === 'free';

  if (isFixed) {
    buildFixedSupport(mockEngine, n, isDark);
  } else if (isPinned) {
    buildPinnedPyramidSupport(mockEngine, n, isDark);
  } else {
    // Component-based support rendering:
    // 1. Translations: Ux (Red), Uy (Green), Uz (Blue)
    if (sp.uz.type !== 'free') {
      buildLinearStrutRestraint(mockEngine, n, 'z', sp.uz.type === 'spring', isDark, sp.uz.delta || 0);
    }
    if (sp.ux.type !== 'free') {
      buildLinearStrutRestraint(mockEngine, n, 'x', sp.ux.type === 'spring', isDark, sp.ux.delta || 0);
    }
    if (sp.uy.type !== 'free') {
      buildLinearStrutRestraint(mockEngine, n, 'y', sp.uy.type === 'spring', isDark, sp.uy.delta || 0);
    }

    // 2. Rotations: Rx (Red), Ry (Green), Rz (Blue)
    if (sp.rx.type !== 'free') {
      buildRotationalRingRestraint(mockEngine, n, 'x', sp.rx.type === 'spring', isDark, sp.rx.delta || 0);
    }
    if (sp.ry.type !== 'free') {
      buildRotationalRingRestraint(mockEngine, n, 'y', sp.ry.type === 'spring', isDark, sp.ry.delta || 0);
    }
    if (sp.rz.type !== 'free') {
      buildRotationalRingRestraint(mockEngine, n, 'z', sp.rz.type === 'spring', isDark, sp.rz.delta || 0);
    }
  }

  // Adjust all geometries to be relative to (0, 0, 0) instead of node position, or shift positions
  supportGroup.traverse((child: any) => {
    if (child.isMesh || child.isLine || child.isLineSegments || child.isLineLoop) {
      if (child.position && (Math.abs(child.position.x) > 1e-5 || Math.abs(child.position.y) > 1e-5 || Math.abs(child.position.z) > 1e-5)) {
        child.position.x -= n.x;
        child.position.y -= n.y;
        child.position.z -= n.z;
      } else if (child.geometry) {
        child.geometry.translate(-n.x, -n.y, -n.z);
      }
    }
  });

  // Position and rotate the group
  supportGroup.position.set(n.x, n.y, n.z);

  const rotX = sp.rotX || 0;
  const rotY = sp.rotY || 0;
  const rotZ = sp.rotZ || 0;
  if (rotX || rotY || rotZ) {
    const rx = rotX * (Math.PI / 180);
    const ry = rotY * (Math.PI / 180);
    const rz = rotZ * (Math.PI / 180);
    supportGroup.rotation.set(rx, ry, rz, 'XYZ');
  }

  engine.modelGroup.add(supportGroup);
}

const tempVec = new THREE.Vector3();
const occludeRaycaster = new THREE.Raycaster();

function isPointOccluded(
  _engine: RenderEngine3D,
  _point: [number, number, number],
  _occluderMeshes: THREE.Object3D[],
  _epsilon = 0.25
): boolean {
  return false;
}

function makeOnTop(obj: THREE.Object3D, renderOrder = 1) {
  obj.renderOrder = renderOrder;
  obj.traverse((child) => {
    child.renderOrder = renderOrder;
  });
}

function makeLocalAxisOnTop(obj: THREE.Object3D) {
  makeOnTop(obj, 1);
}

function buildSingleArrow(
  engine: RenderEngine3D,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  color: number,
  headLength = 0.22,
  headWidth = 0.11
) {
  const arrow = new THREE.ArrowHelper(dir.clone().normalize(), origin, length, color, headLength, headWidth);
  makeOnTop(arrow, 1);
  engine.overlayGroup.add(arrow);
}

function buildDoubleHeadedArrow(
  engine: RenderEngine3D,
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  length: number,
  color: number,
  headLength = 0.16,
  headWidth = 0.08
) {
  const normDir = dir.clone().normalize();
  const endPoint = origin.clone().addScaledVector(normDir, length);

  // Shaft line
  const lineGeom = new THREE.BufferGeometry().setFromPoints([origin, endPoint]);
  const lineMat = new THREE.LineBasicMaterial({ color, depthTest: true, depthWrite: true });
  const line = new THREE.Line(lineGeom, lineMat);
  line.renderOrder = 1;
  engine.overlayGroup.add(line);

  // Two Cones along direction
  const coneGeom = new THREE.ConeGeometry(headWidth / 2, headLength, 12);
  coneGeom.translate(0, -headLength / 2, 0); // shift apex to origin
  const coneMat = new THREE.MeshBasicMaterial({ color, depthTest: true, depthWrite: true });

  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normDir);

  // Head 1 (tip)
  const head1 = new THREE.Mesh(coneGeom, coneMat);
  head1.position.copy(endPoint);
  head1.quaternion.copy(quaternion);
  head1.renderOrder = 1;
  engine.overlayGroup.add(head1);

  // Head 2 (behind head 1)
  const head2 = new THREE.Mesh(coneGeom, coneMat);
  head2.position.copy(endPoint.clone().addScaledVector(normDir, -headLength * 0.85));
  head2.quaternion.copy(quaternion);
  head2.renderOrder = 1;
  engine.overlayGroup.add(head2);
}

function build3DNodalMass(_engine: RenderEngine3D, _n: Node3D, _isDark: boolean) {
  // 3D nodal mass cube mesh disabled per request
  return;
}

function build3DDistributedLoad(engine: RenderEngine3D, el: Element3D, n1: Node3D, n2: Node3D) {
  if (!el.q) return;

  const { vx, vy, vz } = computeLocalAxes(n1, n2, el.rollAngle || 0);
  const nArrows = 5;
  const isLocal = el.q.coordinateSystem === 'local';

  // We support 3 directional components: X (or local x), Y (or local y), Z (or local z)
  const components: {
    name: string;
    dir: THREE.Vector3;
    qStart: number;
    qEnd: number;
    color: number;
  }[] = isLocal
    ? [
        { name: 'qx', dir: new THREE.Vector3(...vx), qStart: el.q.qxStart ?? 0, qEnd: el.q.qxEnd ?? 0, color: 0x0891b2 },
        { name: 'qy', dir: new THREE.Vector3(...vy), qStart: el.q.qyStart ?? 0, qEnd: el.q.qyEnd ?? 0, color: 0x0891b2 },
        { name: 'qz', dir: new THREE.Vector3(...vz), qStart: el.q.qzStart ?? 0, qEnd: el.q.qzEnd ?? 0, color: 0x0891b2 },
      ]
    : [
        { name: 'qX', dir: new THREE.Vector3(1, 0, 0), qStart: el.q.qxStart ?? 0, qEnd: el.q.qxEnd ?? 0, color: 0x0891b2 },
        { name: 'qY', dir: new THREE.Vector3(0, 1, 0), qStart: el.q.qyStart ?? 0, qEnd: el.q.qyEnd ?? 0, color: 0x0891b2 },
        { name: 'qZ', dir: new THREE.Vector3(0, 0, 1), qStart: el.q.qzStart ?? 0, qEnd: el.q.qzEnd ?? 0, color: 0x0891b2 },
      ];

  components.forEach((comp) => {
    const hasLoad = Math.abs(comp.qStart) > 1e-4 || Math.abs(comp.qEnd) > 1e-4;
    if (!hasLoad) return;

    const topPts: THREE.Vector3[] = [];
    const maxVal = Math.max(Math.abs(comp.qStart), Math.abs(comp.qEnd));
    const baseLen = 0.55;

    for (let i = 0; i <= nArrows; i++) {
      const t = i / nArrows;
      const qVal = comp.qStart + (comp.qEnd - comp.qStart) * t;
      if (Math.abs(qVal) < 1e-4) continue;

      const sign = Math.sign(qVal);
      const actualDir = comp.dir.clone().multiplyScalar(sign);
      const scale = maxVal > 0 ? 0.35 + 0.35 * (Math.abs(qVal) / maxVal) : baseLen;
      const arrowLen = Math.min(Math.max(scale, 0.3), 0.8);

      const mx = n1.x + (n2.x - n1.x) * t;
      const my = n1.y + (n2.y - n1.y) * t;
      const mz = n1.z + (n2.z - n1.z) * t;
      const memberPt = new THREE.Vector3(mx, my, mz);

      const origin = memberPt.clone().addScaledVector(actualDir, -arrowLen);
      const arrow = new THREE.ArrowHelper(actualDir, origin, arrowLen, comp.color, 0.18, 0.09);
      makeOnTop(arrow, 1);
      engine.overlayGroup.add(arrow);
      topPts.push(origin);
    }

    if (topPts.length > 1) {
      const geom = new THREE.BufferGeometry().setFromPoints(topPts);
      const mat = new THREE.LineDashedMaterial({ color: comp.color, dashSize: 0.1, gapSize: 0.05, depthTest: true, depthWrite: true });
      const line = new THREE.Line(geom, mat);
      line.renderOrder = 1;
      line.computeLineDistances();
      engine.overlayGroup.add(line);
    }
  });
}

function build3DThermalLoad(engine: RenderEngine3D, el: Element3D, n1: Node3D, n2: Node3D, _isDark: boolean) {
  if (!el.thermal) return;

  const dTx = el.thermal.deltaTx ?? el.thermal.dT_axial ?? 0;
  const dTy = el.thermal.deltaTy ?? ((el.thermal.dTy_top ?? 0) - (el.thermal.dTy_bot ?? 0));
  const dTz = el.thermal.deltaTz ?? ((el.thermal.dTz_top ?? 0) - (el.thermal.dTz_bot ?? 0));

  const hasTx = Math.abs(dTx) > 1e-4;
  const hasTy = Math.abs(dTy) > 1e-4;
  const hasTz = Math.abs(dTz) > 1e-4;
  if (!hasTx && !hasTy && !hasTz) return;

  const { vx, vy, vz } = computeLocalAxes(n1, n2, el.rollAngle || 0);
  const dirX = new THREE.Vector3(...vx);
  const dirY = new THREE.Vector3(...vy);
  const dirZ = new THREE.Vector3(...vz);

  const warmColor = 0xf97316; // amber / orange
  const coolColor = 0x06b6d4; // cyan / ice blue
  const arrowHeadLen = 0.14;
  const arrowHeadWidth = 0.07;

  // 1. Axial uniform temperature (deltaTx):
  if (hasTx) {
    const isHeating = dTx > 0;
    const color = isHeating ? warmColor : coolColor;
    const arrowLen = 0.35;

    const tPositions = [0.25, 0.75];
    tPositions.forEach((t) => {
      const px = n1.x + (n2.x - n1.x) * t;
      const py = n1.y + (n2.y - n1.y) * t;
      const pz = n1.z + (n2.z - n1.z) * t;
      const pt = new THREE.Vector3(px, py, pz);

      const arrowDir = t < 0.5
        ? (isHeating ? dirX.clone().negate() : dirX.clone())
        : (isHeating ? dirX.clone() : dirX.clone().negate());

      const origin = pt.clone().addScaledVector(arrowDir, -arrowLen * 0.5);
      const arrow = new THREE.ArrowHelper(arrowDir, origin, arrowLen, color, arrowHeadLen, arrowHeadWidth);
      makeOnTop(arrow, 1);
      engine.overlayGroup.add(arrow);
    });

    // Thermal indicator dashed line along member
    const mid1 = new THREE.Vector3(n1.x + (n2.x - n1.x) * 0.15, n1.y + (n2.y - n1.y) * 0.15, n1.z + (n2.z - n1.z) * 0.15);
    const mid2 = new THREE.Vector3(n1.x + (n2.x - n1.x) * 0.85, n1.y + (n2.y - n1.y) * 0.85, n1.z + (n2.z - n1.z) * 0.85);
    const geom = new THREE.BufferGeometry().setFromPoints([mid1, mid2]);
    const lineMat = new THREE.LineDashedMaterial({
      color,
      dashSize: 0.12,
      gapSize: 0.06,
      depthTest: true,
      depthWrite: true,
    });
    const line = new THREE.Line(geom, lineMat);
    line.renderOrder = 1;
    line.computeLineDistances();
    engine.overlayGroup.add(line);
  }

  // 2. Transverse gradient in local y (deltaTy):
  if (hasTy) {
    const arrowLen = 0.35;
    const sign = Math.sign(dTy);
    const tSamples = [0.35, 0.5, 0.65];
    tSamples.forEach((t) => {
      const px = n1.x + (n2.x - n1.x) * t;
      const py = n1.y + (n2.y - n1.y) * t;
      const pz = n1.z + (n2.z - n1.z) * t;
      const pt = new THREE.Vector3(px, py, pz);

      // Warm side (+y if sign > 0)
      const warmOrigin = pt.clone().addScaledVector(dirY, sign * 0.04);
      const warmDir = dirY.clone().multiplyScalar(sign);
      const warmArrow = new THREE.ArrowHelper(warmDir, warmOrigin, arrowLen, warmColor, arrowHeadLen, arrowHeadWidth);
      makeOnTop(warmArrow, 1);
      engine.overlayGroup.add(warmArrow);

      // Cool side (-y if sign > 0)
      const coolOrigin = pt.clone().addScaledVector(dirY, -sign * 0.04);
      const coolDir = dirY.clone().multiplyScalar(-sign);
      const coolArrow = new THREE.ArrowHelper(coolDir, coolOrigin, arrowLen, coolColor, arrowHeadLen, arrowHeadWidth);
      makeOnTop(coolArrow, 1);
      engine.overlayGroup.add(coolArrow);
    });
  }

  // 3. Transverse gradient in local z (deltaTz):
  if (hasTz) {
    const arrowLen = 0.35;
    const sign = Math.sign(dTz);
    const tSamples = [0.35, 0.5, 0.65];
    tSamples.forEach((t) => {
      const px = n1.x + (n2.x - n1.x) * t;
      const py = n1.y + (n2.y - n1.y) * t;
      const pz = n1.z + (n2.z - n1.z) * t;
      const pt = new THREE.Vector3(px, py, pz);

      // Warm side (+z if sign > 0)
      const warmOrigin = pt.clone().addScaledVector(dirZ, sign * 0.04);
      const warmDir = dirZ.clone().multiplyScalar(sign);
      const warmArrow = new THREE.ArrowHelper(warmDir, warmOrigin, arrowLen, warmColor, arrowHeadLen, arrowHeadWidth);
      makeOnTop(warmArrow, 1);
      engine.overlayGroup.add(warmArrow);

      // Cool side (-z if sign > 0)
      const coolOrigin = pt.clone().addScaledVector(dirZ, -sign * 0.04);
      const coolDir = dirZ.clone().multiplyScalar(-sign);
      const coolArrow = new THREE.ArrowHelper(coolDir, coolOrigin, arrowLen, coolColor, arrowHeadLen, arrowHeadWidth);
      makeOnTop(coolArrow, 1);
      engine.overlayGroup.add(coolArrow);
    });
  }
}

function build3DLocalAxes(engine: RenderEngine3D, el: Element3D, n1: Node3D, n2: Node3D, _sec?: Section) {
  const mx = (n1.x + n2.x) / 2;
  const my = (n1.y + n2.y) / 2;
  const mz = (n1.z + n2.z) / 2;
  const origin = new THREE.Vector3(mx, my, mz);

  const { vx, vy, vz } = computeLocalAxes(n1, n2, el.rollAngle || 0);

  const aLen = 0.5;
  const arrowX = new THREE.ArrowHelper(new THREE.Vector3(...vx), origin, aLen, 0xef4444, 0.12, 0.06);
  const arrowY = new THREE.ArrowHelper(new THREE.Vector3(...vy), origin, aLen, 0x22c55e, 0.12, 0.06);
  const arrowZ = new THREE.ArrowHelper(new THREE.Vector3(...vz), origin, aLen, 0x3b82f6, 0.12, 0.06);
  makeLocalAxisOnTop(arrowX);
  makeLocalAxisOnTop(arrowY);
  makeLocalAxisOnTop(arrowZ);
  engine.overlayGroup.add(arrowX);
  engine.overlayGroup.add(arrowY);
  engine.overlayGroup.add(arrowZ);
}

function build3DProbeMarker(engine: RenderEngine3D, n1: Node3D, n2: Node3D, t: number) {
  const px = n1.x + (n2.x - n1.x) * t;
  const py = n1.y + (n2.y - n1.y) * t;
  const pz = n1.z + (n2.z - n1.z) * t;

  const geom = new THREE.SphereGeometry(0.18, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: true, depthWrite: true });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(px, py, pz);
  engine.overlayGroup.add(mesh);
}

function build3DDeformedShape(engine: RenderEngine3D, solved: SolverResult3D, options: SceneRenderOptions) {
  const resultsList = (solved.type === 'linear_static' ? solved.results : (solved as any).modes?.[(solved as any).currentMode || 0]?.results) as any[];
  if (!resultsList || resultsList.length === 0) return;

  let maxDispVal = 0;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  resultsList.forEach((sample) => {
    [sample.n1, sample.n2].forEach((n: any) => {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
      minZ = Math.min(minZ, n.z); maxZ = Math.max(maxZ, n.z);
    });
    sample.pts.forEach((pt: any) => {
      const mag = Math.hypot(pt.Ux_global, pt.Uy_global, pt.Uz_global);
      if (mag > maxDispVal) maxDispVal = mag;
    });
  });

  const bboxDiag = Math.hypot(
    isFinite(maxX - minX) ? maxX - minX : 0,
    isFinite(maxY - minY) ? maxY - minY : 0,
    isFinite(maxZ - minZ) ? maxZ - minZ : 0
  );
  const structSize = Math.max(bboxDiag, 3.0);
  const targetOffset = 0.12 * structSize;
  const autoScale = maxDispVal > 1e-12 ? targetOffset / maxDispVal : 1.0;
  const mult = options.deformScaleMult * autoScale;

  const mat = new THREE.LineBasicMaterial({ color: 0x7c3aed, linewidth: 2 });

  resultsList.forEach((sample) => {
    const pts: THREE.Vector3[] = [];
    sample.pts.forEach((pt: any) => {
      const basePos: Vec3 = [
        sample.n1.x + sample.vx[0] * pt.x,
        sample.n1.y + sample.vx[1] * pt.x,
        sample.n1.z + sample.vx[2] * pt.x,
      ];

      const defPos: Vec3 = [
        basePos[0] + pt.Ux_global * mult,
        basePos[1] + pt.Uy_global * mult,
        basePos[2] + pt.Uz_global * mult,
      ];

      pts.push(new THREE.Vector3(defPos[0], defPos[1], defPos[2]));
    });

    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geom, mat);
    engine.modelGroup.add(line);
  });
}

interface ActiveDiagramConfig {
  key: 'My' | 'Mz' | 'Mx' | 'Vy' | 'Vz' | 'N' | 'sigMax';
  label: string;
  unit: string;
  hexColor: number;
  cssColor: string;
  offsetVecIndex: 'vy' | 'vz';
  diagSignMult: number;
}

function getActiveDiagramConfigs(options: SceneRenderOptions): ActiveDiagramConfig[] {
  const isDark = options.theme === 'dark';
  const list: ActiveDiagramConfig[] = [];
  if (options.showMy) {
    list.push({ key: 'My', label: 'My', unit: 'kNm', hexColor: 0xdc2626, cssColor: isDark ? '#f87171' : '#b91c1c', offsetVecIndex: 'vz', diagSignMult: 1.0 });
  }
  if (options.showMz) {
    list.push({ key: 'Mz', label: 'Mz', unit: 'kNm', hexColor: 0xea580c, cssColor: isDark ? '#fb923c' : '#c2410c', offsetVecIndex: 'vy', diagSignMult: -1.0 });
  }
  if (options.showMx) {
    list.push({ key: 'Mx', label: 'Mx', unit: 'kNm', hexColor: 0x9333ea, cssColor: isDark ? '#c084fc' : '#7e22ce', offsetVecIndex: 'vy', diagSignMult: 1.0 });
  }
  if (options.showVy) {
    list.push({ key: 'Vy', label: 'Vy', unit: 'kN', hexColor: 0x0284c7, cssColor: isDark ? '#38bdf8' : '#0369a1', offsetVecIndex: 'vy', diagSignMult: 1.0 });
  }
  if (options.showVz) {
    list.push({ key: 'Vz', label: 'Vz', unit: 'kN', hexColor: 0x0d9488, cssColor: isDark ? '#2dd4bf' : '#0f766e', offsetVecIndex: 'vz', diagSignMult: 1.0 });
  }
  if (options.showN) {
    list.push({ key: 'N', label: 'N', unit: 'kN', hexColor: 0x16a34a, cssColor: isDark ? '#4ade80' : '#15803d', offsetVecIndex: 'vy', diagSignMult: 1.0 });
  }
  if (options.showStress) {
    list.push({ key: 'sigMax', label: 'σ', unit: 'MPa', hexColor: 0xd97706, cssColor: isDark ? '#fbbf24' : '#b45309', offsetVecIndex: 'vz', diagSignMult: 1.0 });
  }
  return list;
}

function computeStructureSize(resultsList: any[]): number {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  resultsList.forEach((sample) => {
    [sample.n1, sample.n2].forEach((n: any) => {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
      minZ = Math.min(minZ, n.z); maxZ = Math.max(maxZ, n.z);
    });
  });

  const bboxDiag = Math.hypot(
    isFinite(maxX - minX) ? maxX - minX : 0,
    isFinite(maxY - minY) ? maxY - minY : 0,
    isFinite(maxZ - minZ) ? maxZ - minZ : 0
  );
  return Math.max(bboxDiag, 3.0);
}

function computeDiagramScaleMult(resultsList: any[], cfg: ActiveDiagramConfig, structSize: number, userMult: number): number {
  let maxVal = 0;
  resultsList.forEach((sample) => {
    sample.pts.forEach((pt: any) => {
      const v = Math.abs(pt[cfg.key] as number);
      if (v > maxVal) maxVal = v;
    });
  });
  const targetOffset = 0.10 * structSize;
  const autoScale = maxVal > 1e-9 ? targetOffset / maxVal : 1.0;
  return userMult * autoScale;
}

function build3DDiagrams(engine: RenderEngine3D, solved: SolverResult3D, options: SceneRenderOptions) {
  const resultsList = (solved.type === 'linear_static' ? solved.results : (solved as any).modes?.[(solved as any).currentMode || 0]?.results) as any[];
  if (!resultsList || resultsList.length === 0) return;

  const activeConfigs = getActiveDiagramConfigs(options);
  if (activeConfigs.length === 0) return;

  const structSize = computeStructureSize(resultsList);

  activeConfigs.forEach((cfg) => {
    const mult = computeDiagramScaleMult(resultsList, cfg, structSize, options.diagramScaleMult);

    const fillMat = new THREE.MeshBasicMaterial({
      color: cfg.hexColor,
      transparent: true,
      opacity: activeConfigs.length > 1 ? 0.22 : 0.30,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const lineMat = new THREE.LineBasicMaterial({ color: cfg.hexColor });

    resultsList.forEach((sample) => {
      const offDir = sample[cfg.offsetVecIndex];
      const positions: number[] = [];
      const outlinePts: THREE.Vector3[] = [];

      sample.pts.forEach((pt: any, i: number) => {
        const val = pt[cfg.key] as number;
        const basePos: Vec3 = [
          sample.n1.x + sample.vx[0] * pt.x,
          sample.n1.y + sample.vx[1] * pt.x,
          sample.n1.z + sample.vx[2] * pt.x,
        ];

        const offPos: Vec3 = [
          basePos[0] + offDir[0] * val * mult * cfg.diagSignMult,
          basePos[1] + offDir[1] * val * mult * cfg.diagSignMult,
          basePos[2] + offDir[2] * val * mult * cfg.diagSignMult,
        ];

        outlinePts.push(new THREE.Vector3(offPos[0], offPos[1], offPos[2]));

        if (i < sample.pts.length - 1) {
          const nextPt = sample.pts[i + 1];
          const nextVal = nextPt[cfg.key] as number;

          const nextBase: Vec3 = [
            sample.n1.x + sample.vx[0] * nextPt.x,
            sample.n1.y + sample.vx[1] * nextPt.x,
            sample.n1.z + sample.vx[2] * nextPt.x,
          ];

          const nextOff: Vec3 = [
            nextBase[0] + offDir[0] * nextVal * mult * cfg.diagSignMult,
            nextBase[1] + offDir[1] * nextVal * mult * cfg.diagSignMult,
            nextBase[2] + offDir[2] * nextVal * mult * cfg.diagSignMult,
          ];

          // Triangle 1
          positions.push(...basePos, ...offPos, ...nextOff);
          // Triangle 2
          positions.push(...basePos, ...nextOff, ...nextBase);
        }
      });

      if (positions.length > 0) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const mesh = new THREE.Mesh(geom, fillMat);
        engine.modelGroup.add(mesh);
      }

      if (outlinePts.length > 0) {
        const lineGeom = new THREE.BufferGeometry().setFromPoints(outlinePts);
        const line = new THREE.Line(lineGeom, lineMat);
        engine.modelGroup.add(line);
      }
    });
  });
}

function drawPillTag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  textColor: string,
  borderColor: string,
  isDark: boolean,
  fontSize: number = 12
) {
  ctx.save();
  ctx.font = `bold ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textW = ctx.measureText(text).width;
  const padX = 5;
  const h = fontSize + 6;

  const rectX = Math.round(x - textW / 2 - padX);
  const rectY = Math.round(y - h / 2);
  const rectW = Math.round(textW + padX * 2);
  const radius = 4;

  ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.90)' : 'rgba(255, 255, 255, 0.95)';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(rectX, rectY, rectW, h, radius);
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else {
    ctx.fillRect(rectX, rectY, rectW, h);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(rectX, rectY, rectW, h);
  }

  ctx.fillStyle = textColor;
  ctx.fillText(text, x, y + 0.5);

  ctx.restore();
}

function collectContinuousLoads2DOverlay(
  labelQueue: DepthLabel2D[],
  engine: RenderEngine3D,
  nodes: Node3D[],
  elements: Element3D[],
  _options: SceneRenderOptions,
  isDark: boolean,
  occluders?: THREE.Object3D[]
) {
  elements.forEach((el) => {
    if (!el.q) return;
    const n1 = nodes.find((n) => n.id === el.n1);
    const n2 = nodes.find((n) => n.id === el.n2);
    if (!n1 || !n2) return;

    const q = el.q;
    const sys = q.coordinateSystem || 'global';
    const isLocalSys = sys === 'local';

    const { vx, vy, vz } = computeLocalAxes(n1, n2, el.rollAngle || 0);

    const comps = isLocalSys
      ? [
          { name: 'qx', dir: vx, qStart: q.qxStart || 0, qEnd: q.qxEnd || 0 },
          { name: 'qy', dir: vy, qStart: q.qyStart || 0, qEnd: q.qyEnd || 0 },
          { name: 'qz', dir: vz, qStart: q.qzStart || 0, qEnd: q.qzEnd || 0 },
        ]
      : [
          { name: 'qX', dir: [1, 0, 0] as [number, number, number], qStart: q.qxStart || 0, qEnd: q.qxEnd || 0 },
          { name: 'qY', dir: [0, 1, 0] as [number, number, number], qStart: q.qyStart || 0, qEnd: q.qyEnd || 0 },
          { name: 'qZ', dir: [0, 0, 1] as [number, number, number], qStart: q.qzStart || 0, qEnd: q.qzEnd || 0 },
        ];

    comps.forEach((comp) => {
      const qs = comp.qStart;
      const qe = comp.qEnd;
      if (Math.abs(qs) < 1e-4 && Math.abs(qe) < 1e-4) return;

      // Compute center of load distribution tCenter in [0, 1]
      let tCenter = 0.5;
      const sumAbs = Math.abs(qs) + Math.abs(qe);
      if (sumAbs > 1e-4) {
        if (qs * qe >= 0) {
          // Centroid for trapezoidal distribution of same sign
          tCenter = (Math.abs(qs) + 2 * Math.abs(qe)) / (3 * sumAbs);
        }
      }
      tCenter = Math.max(0.1, Math.min(0.9, tCenter));

      // Representative load value at centroid
      const qValCenter = qs + (qe - qs) * tCenter;
      const qValAvg = (qs + qe) / 2;
      const repVal = Math.abs(qValCenter) > 1e-4 ? qValCenter : qValAvg;
      const sign = Math.sign(repVal) || 1;

      // Format text label
      const sS = fmtLoadVal(qs);
      const sE = fmtLoadVal(qe);
      const valStr = sS === sE ? sS : `${sS}..${sE}`;
      const tagText = `${comp.name}=${valStr} kN/m`;

      // 3D position of the load centroid on the bar
      const px = n1.x + (n2.x - n1.x) * tCenter;
      const py = n1.y + (n2.y - n1.y) * tCenter;
      const pz = n1.z + (n2.z - n1.z) * tCenter;

      // Displacement along load vector to place tag outside the load arrows
      const maxVal = Math.max(Math.abs(qs), Math.abs(qe));
      const scale = maxVal > 0 ? 0.35 + 0.35 * (Math.abs(repVal) / maxVal) : 0.55;
      const arrowLen = Math.min(Math.max(scale, 0.3), 0.8);
      const labelOffset = arrowLen + 0.15;

      const loadDirX = comp.dir[0] * sign;
      const loadDirY = comp.dir[1] * sign;
      const loadDirZ = comp.dir[2] * sign;

      const label3DPos: [number, number, number] = [
        px - loadDirX * labelOffset,
        py - loadDirY * labelOffset,
        pz - loadDirZ * labelOffset,
      ];

      if (occluders && occluders.length > 0) {
        if (isPointOccluded(engine, label3DPos, occluders)) return;
      }

      const projected = engine.project(label3DPos);
      if (projected.visible) {
        const tagColor = isDark ? '#38bdf8' : '#0284c7';
        labelQueue.push({
          depth: projected.depth,
          priority: 2,
          draw: (ctx) => drawPillTag(ctx, projected.x, projected.y, tagText, tagColor, tagColor, isDark, 12),
        });
      }
    });
  });
}

function collectThermalLoads2DOverlay(
  labelQueue: DepthLabel2D[],
  engine: RenderEngine3D,
  nodes: Node3D[],
  elements: Element3D[],
  _options: SceneRenderOptions,
  isDark: boolean,
  occluders?: THREE.Object3D[]
) {
  elements.forEach((el) => {
    if (!el.thermal) return;

    const dTx = el.thermal.deltaTx ?? el.thermal.dT_axial ?? 0;
    const dTy = el.thermal.deltaTy ?? ((el.thermal.dTy_top ?? 0) - (el.thermal.dTy_bot ?? 0));
    const dTz = el.thermal.deltaTz ?? ((el.thermal.dTz_top ?? 0) - (el.thermal.dTz_bot ?? 0));

    const parts: string[] = [];
    if (Math.abs(dTx) > 1e-4) parts.push(`ΔTx=${dTx > 0 ? '+' : ''}${fmtLoadVal(dTx)}°C`);
    if (Math.abs(dTy) > 1e-4) parts.push(`ΔTy=${dTy > 0 ? '+' : ''}${fmtLoadVal(dTy)}°C`);
    if (Math.abs(dTz) > 1e-4) parts.push(`ΔTz=${dTz > 0 ? '+' : ''}${fmtLoadVal(dTz)}°C`);

    if (parts.length === 0) return;

    const n1 = nodes.find((n) => n.id === el.n1);
    const n2 = nodes.find((n) => n.id === el.n2);
    if (!n1 || !n2) return;

    const tagText = parts.join(' ');
    const mx = (n1.x + n2.x) / 2;
    const my = (n1.y + n2.y) / 2;
    const mz = (n1.z + n2.z) / 2;

    const label3DPos: [number, number, number] = [mx, my, mz];

    if (occluders && occluders.length > 0) {
      if (isPointOccluded(engine, label3DPos, occluders)) return;
    }

    const projected = engine.project(label3DPos);
    if (projected.visible) {
      const tagColor = isDark ? '#fb923c' : '#ea580c';
      labelQueue.push({
        depth: projected.depth,
        priority: 2,
        draw: (ctx) => drawPillTag(ctx, projected.x, projected.y - 14, tagText, tagColor, tagColor, isDark, 12),
      });
    }
  });
}

function collectProbe2DOverlay(
  labelQueue: DepthLabel2D[],
  engine: RenderEngine3D,
  nodes: Node3D[],
  elements: Element3D[],
  options: SceneRenderOptions,
  isDark: boolean
) {
  if (options.probe.elId == null) return;

  const el = elements.find((e) => e.id === options.probe.elId);
  if (!el) return;

  const n1 = nodes.find((n) => n.id === el.n1);
  const n2 = nodes.find((n) => n.id === el.n2);
  if (!n1 || !n2) return;

  const t = Math.max(0, Math.min(1, options.probe.t));
  const L = Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z);
  const xLoc = t * L;

  const px = n1.x + (n2.x - n1.x) * t;
  const py = n1.y + (n2.y - n1.y) * t;
  const pz = n1.z + (n2.z - n1.z) * t;

  const pt = engine.project([px, py, pz]);
  if (!pt.visible) return;

  const tagText = `Sonda P${el.id}: x=${xLoc.toFixed(2)}m (${(t * 100).toFixed(0)}%)`;

  labelQueue.push({
    depth: pt.depth,
    priority: 20,
    draw: (ctx) => {
      // Cyan target indicator
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#0284c7';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // Tag
      drawPillTag(ctx, pt.x, pt.y - 20, tagText, '#0284c7', '#38bdf8', isDark, 12);
    },
  });
}

function collectDiagramValues2DOverlay(
  labelQueue: DepthLabel2D[],
  engine: RenderEngine3D,
  solved: SolverResult3D,
  options: SceneRenderOptions,
  isDark: boolean
) {
  const resultsList = (solved.type === 'linear_static' ? solved.results : (solved as any).modes?.[(solved as any).currentMode || 0]?.results) as any[];
  if (!resultsList || resultsList.length === 0) return;

  const activeConfigs = getActiveDiagramConfigs(options);
  if (activeConfigs.length === 0) return;

  const structSize = computeStructureSize(resultsList);

  activeConfigs.forEach((cfg) => {
    const mult = computeDiagramScaleMult(resultsList, cfg, structSize, options.diagramScaleMult);

    resultsList.forEach((sample) => {
      const offDir = sample[cfg.offsetVecIndex];
      const pts = sample.pts;
      if (!pts || pts.length === 0) return;

      const indicesToDraw = new Set<number>();
      indicesToDraw.add(0);
      indicesToDraw.add(pts.length - 1);

      let maxPeakIdx = -1;
      let maxPeakVal = 0;
      for (let i = 1; i < pts.length - 1; i++) {
        const v = Math.abs(pts[i][cfg.key] as number);
        if (v > maxPeakVal) {
          maxPeakVal = v;
          maxPeakIdx = i;
        }
      }

      const vStart = Math.abs(pts[0][cfg.key] as number);
      const vEnd = Math.abs(pts[pts.length - 1][cfg.key] as number);
      if (maxPeakIdx > 0 && maxPeakVal > Math.max(vStart, vEnd) * 1.05 && maxPeakVal > 0.05) {
        indicesToDraw.add(maxPeakIdx);
      }

      indicesToDraw.forEach((idx) => {
        const pt = pts[idx];
        let val = pt[cfg.key] as number;
        if (cfg.key === 'sigMax') {
          val = val / 1000;
        }
        if (Math.abs(val) < 1e-4) return;

        const basePos: Vec3 = [
          sample.n1.x + sample.vx[0] * pt.x,
          sample.n1.y + sample.vx[1] * pt.x,
          sample.n1.z + sample.vx[2] * pt.x,
        ];

        const rawVal = pt[cfg.key] as number;
        const offPos: Vec3 = [
          basePos[0] + offDir[0] * rawVal * mult * cfg.diagSignMult,
          basePos[1] + offDir[1] * rawVal * mult * cfg.diagSignMult,
          basePos[2] + offDir[2] * rawVal * mult * cfg.diagSignMult,
        ];

        const screenPt = engine.project(offPos);
        if (screenPt.x < 10 || screenPt.x > engine.width - 10 || screenPt.y < 10 || screenPt.y > engine.height - 10) {
          return;
        }

        const formattedVal = Math.abs(val) >= 100 ? val.toFixed(1) : val.toFixed(2);
        const signStr = val > 0 ? '+' : '';
        const tagText = activeConfigs.length > 1 ? `${cfg.label}:${signStr}${formattedVal}` : `${signStr}${formattedVal}`;

        labelQueue.push({
          depth: screenPt.depth,
          priority: 5,
          draw: (ctx) => drawPillTag(ctx, screenPt.x, screenPt.y, tagText, cfg.cssColor, cfg.cssColor, isDark, 12),
        });
      });
    });
  });
}

// === 2D OVERLAY LABELS ===

function collectLabels2DOverlay(
  labelQueue: DepthLabel2D[],
  engine: RenderEngine3D,
  nodes: Node3D[],
  elements: Element3D[],
  sections: Section[],
  materials: Material[],
  options: SceneRenderOptions,
  isDark: boolean
) {
  const labelColor = isDark ? '#38bdf8' : '#0284c7';
  const nodeTextColor = isDark ? '#f8fafc' : '#0f172a';

  if (options.showElementNumbers || options.showSectionNames || options.showMaterialNames) {
    elements.forEach((el) => {
      const n1 = nodes.find((n) => n.id === el.n1);
      const n2 = nodes.find((n) => n.id === el.n2);
      if (!n1 || !n2) return;

      const mx = (n1.x + n2.x) / 2;
      const my = (n1.y + n2.y) / 2;
      const mz = (n1.z + n2.z) / 2;
      const p = engine.project([mx, my, mz]);

      const parts: string[] = [];
      if (options.showElementNumbers) parts.push(`P${el.id}`);
      if (options.showSectionNames) {
        const sec = sections.find((s) => s.id === el.sectionId);
        if (sec) parts.push(sec.name);
      }
      if (options.showMaterialNames) {
        const mat = materials.find((m) => m.id === el.materialId);
        if (mat) parts.push(mat.name);
      }

      if (parts.length > 0 && p.visible) {
        const text = parts.join(' | ');
        labelQueue.push({
          depth: p.depth,
          priority: 0,
          draw: (ctx) => drawPillTag(ctx, p.x, p.y, text, labelColor, labelColor, isDark, 12),
        });
      }
    });
  }

  if (options.showNodeNumbers) {
    nodes.forEach((n) => {
      const p = engine.project([n.x, n.y, n.z]);
      if (p.visible) {
        const text = `W${n.id}`;
        labelQueue.push({
          depth: p.depth,
          priority: 0,
          draw: (ctx) => drawPillTag(ctx, p.x + 16, p.y - 10, text, nodeTextColor, isDark ? '#475569' : '#94a3b8', isDark, 12),
        });
      }
    });
  }
}

export function getHingeLabel(h: MemberHinges3D | undefined, end: 'start' | 'end'): string {
  if (!h) return '';
  const prefix = end === 'start' ? 'start_' : 'end_';
  const parts: string[] = [];
  if (h[`${prefix}ux` as keyof MemberHinges3D]) parts.push('Ux');
  if (h[`${prefix}uy` as keyof MemberHinges3D]) parts.push('Uy');
  if (h[`${prefix}uz` as keyof MemberHinges3D]) parts.push('Uz');
  if (h[`${prefix}rx` as keyof MemberHinges3D]) parts.push('Rx');
  if (h[`${prefix}ry` as keyof MemberHinges3D]) parts.push('Ry');
  if (h[`${prefix}rz` as keyof MemberHinges3D]) parts.push('Rz');
  return parts.join('');
}

function collectHingeLabels2DOverlay(
  labelQueue: DepthLabel2D[],
  engine: RenderEngine3D,
  nodes: Node3D[],
  elements: Element3D[],
  isDark: boolean
) {
  elements.forEach((el) => {
    const h = el.hinges;
    if (!h) return;
    const n1 = nodes.find((n) => n.id === el.n1);
    const n2 = nodes.find((n) => n.id === el.n2);
    if (!n1 || !n2) return;

    const start = new THREE.Vector3(n1.x, n1.y, n1.z);
    const end = new THREE.Vector3(n2.x, n2.y, n2.z);
    const vec = new THREE.Vector3().subVectors(end, start);
    const len = vec.length();
    if (len < 1e-6) return;
    const dir = vec.clone().normalize();

    const startLabel = getHingeLabel(h, 'start');
    if (startLabel) {
      const hPos = start.clone().add(dir.clone().multiplyScalar(0.25));
      const p = engine.project([hPos.x, hPos.y, hPos.z]);
      if (p.visible && p.x >= 0 && p.x <= engine.width && p.y >= 0 && p.y <= engine.height) {
        labelQueue.push({
          depth: p.depth,
          priority: 1,
          draw: (ctx) => drawHingePillTag(ctx, p.x, p.y - 14, startLabel, isDark),
        });
      }
    }

    const endLabel = getHingeLabel(h, 'end');
    if (endLabel) {
      const hPos = end.clone().sub(dir.clone().multiplyScalar(0.25));
      const p = engine.project([hPos.x, hPos.y, hPos.z]);
      if (p.visible && p.x >= 0 && p.x <= engine.width && p.y >= 0 && p.y <= engine.height) {
        labelQueue.push({
          depth: p.depth,
          priority: 1,
          draw: (ctx) => drawHingePillTag(ctx, p.x, p.y - 14, endLabel, isDark),
        });
      }
    }
  });
}

function drawHingePillTag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  isDark: boolean
) {
  ctx.save();
  ctx.font = 'bold 10px sans-serif';
  const textMetrics = ctx.measureText(text);
  const paddingX = 5;
  const paddingY = 2;
  const w = textMetrics.width + paddingX * 2;
  const h = 15;
  const rectX = x - w / 2;
  const rectY = y - h / 2;

  ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.92)';
  ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  ctx.roundRect(rectX, rectY, w, h, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isDark ? '#38bdf8' : '#0369a1';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawHoverAndSelection2DOverlay(
  ctx: CanvasRenderingContext2D,
  engine: RenderEngine3D,
  nodes: Node3D[],
  elements: Element3D[],
  sections: Section[],
  options: SceneRenderOptions,
  isDark: boolean,
  panels: Panel3D[] = [],
  labelQueue?: DepthLabel2D[]
) {
  // 1. Hovered Element (Bar) highlight beam & floating tag
  if (options.hoverElemId != null) {
    const el = elements.find((e) => e.id === options.hoverElemId);
    if (el) {
      const n1 = nodes.find((n) => n.id === el.n1);
      const n2 = nodes.find((n) => n.id === el.n2);
      if (n1 && n2) {
        const p1 = engine.project([n1.x, n1.y, n1.z]);
        const p2 = engine.project([n2.x, n2.y, n2.z]);
        if (p1.visible || p2.visible) {
          ctx.save();
          // Soft outer glowing beam
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineWidth = 7;
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.lineCap = 'round';
          ctx.stroke();

          // Crisp inner highlight line
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#38bdf8';
          ctx.stroke();
          ctx.restore();

          // Hover tag at member midpoint
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const sec = sections.find((s) => s.id === el.sectionId);
          const label = sec ? `P${el.id}: ${sec.name}` : `P${el.id}`;
          const midDepth = (p1.depth + p2.depth) / 2;

          if (labelQueue) {
            labelQueue.push({
              depth: midDepth,
              priority: 50,
              draw: (c) => drawPillTag(c, midX, midY - 14, label, isDark ? '#38bdf8' : '#0284c7', '#38bdf8', isDark, 11),
            });
          } else {
            drawPillTag(ctx, midX, midY - 14, label, isDark ? '#38bdf8' : '#0284c7', '#38bdf8', isDark, 11);
          }
        }
      }
    }
  }

  // 2. Hovered Node glowing halo ring & coordinate tag
  if (options.hoverNodeId != null) {
    const n = nodes.find((node) => node.id === options.hoverNodeId);
    if (n) {
      const p = engine.project([n.x, n.y, n.z]);
      if (p.visible) {
        ctx.save();
        // Inner crisp ring
        ctx.beginPath();
        ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Outer soft glow halo
        ctx.beginPath();
        ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Hover tag with coordinates (only in select mode; in drawing/grid modes the tip with pointer is displayed instead)
        if (options.mode !== 'addBar' && options.mode !== 'addPanel' && options.mode !== 'grid') {
          const tag = `W${n.id} (${n.x.toFixed(2)}, ${n.y.toFixed(2)}, ${n.z.toFixed(2)})`;
          if (labelQueue) {
            labelQueue.push({
              depth: p.depth,
              priority: 50,
              draw: (c) => drawPillTag(c, p.x, p.y - 18, tag, isDark ? '#38bdf8' : '#0284c7', '#38bdf8', isDark, 11),
            });
          } else {
            drawPillTag(ctx, p.x, p.y - 18, tag, isDark ? '#38bdf8' : '#0284c7', '#38bdf8', isDark, 11);
          }
        }
      }
    }
  }

  // 3. Hovered Panel highlight polygon & tag
  if (options.hoverPanelId != null && panels.length > 0) {
    const pan = panels.find((p) => p.id === options.hoverPanelId);
    if (pan) {
      const corners = getPanelCorners(pan, nodes);
      if (corners.length >= 3) {
        const pts = corners.map((c) => engine.project(c));
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#38bdf8';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        const cx = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
        const cy = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
        const avgDepth = pts.reduce((sum, p) => sum + p.depth, 0) / pts.length;
        const tag = `O${pan.id}` + (pan.name ? `: ${pan.name}` : '');

        if (labelQueue) {
          labelQueue.push({
            depth: avgDepth,
            priority: 50,
            draw: (c) => drawPillTag(c, cx, cy - 10, tag, isDark ? '#38bdf8' : '#0284c7', '#38bdf8', isDark, 11),
          });
        } else {
          drawPillTag(ctx, cx, cy - 10, tag, isDark ? '#38bdf8' : '#0284c7', '#38bdf8', isDark, 11);
        }
      }
    }
  }
}

export function drawSegmentDimensionPoints(
  ctx: CanvasRenderingContext2D,
  p1: ScreenPoint3D,
  p2: ScreenPoint3D,
  dist3D: number,
  color: string = '#7c3aed',
  labelQueue?: DepthLabel2D[]
) {
  const midDepth = (p1.depth + p2.depth) / 2;

  const drawLines = (c: CanvasRenderingContext2D) => {
    c.save();
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 1.5;

    // 1. Draw the main dimension line
    c.beginPath();
    c.moveTo(p1.x, p1.y);
    c.lineTo(p2.x, p2.y);
    c.stroke();

    // 2. Compute normal/direction for tick marks
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len > 1e-4) {
      const ux = dx / len;
      const uy = dy / len;
      const nx = -uy;
      const ny = ux;

      const tickLen = 6;
      c.beginPath();
      c.moveTo(p1.x - nx * tickLen, p1.y - ny * tickLen);
      c.lineTo(p1.x + nx * tickLen, p1.y + ny * tickLen);
      c.stroke();

      c.beginPath();
      c.moveTo(p2.x - nx * tickLen, p2.y - ny * tickLen);
      c.lineTo(p2.x + nx * tickLen, p2.y + ny * tickLen);
      c.stroke();
    }
    c.restore();
  };

  if (labelQueue) {
    labelQueue.push({
      depth: midDepth,
      priority: 0,
      draw: drawLines,
    });
  } else {
    drawLines(ctx);
  }

  // 3. Draw text label badge in the center
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const label = `${dist3D.toFixed(2)} m`;

  const drawBadge = (c: CanvasRenderingContext2D) => {
    c.save();
    c.font = 'bold 11px monospace, "SF Mono", Consolas';
    const textWidth = c.measureText(label).width;
    const padX = 5;
    const bh = 15;
    const bw = textWidth + padX * 2;

    // Background rect
    c.fillStyle = 'rgba(15, 23, 42, 0.9)'; // Dark neutral bg
    c.strokeStyle = color;
    c.lineWidth = 1.2;
    c.beginPath();
    if (typeof (c as any).roundRect === 'function') {
      (c as any).roundRect(mx - bw / 2, my - bh / 2, bw, bh, 3);
    } else {
      c.rect(mx - bw / 2, my - bh / 2, bw, bh);
    }
    c.fill();
    c.stroke();

    // Draw text
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(label, mx, my + 0.5);
    c.restore();
  };

  if (labelQueue) {
    labelQueue.push({
      depth: midDepth,
      priority: 1,
      draw: drawBadge,
    });
  } else {
    drawBadge(ctx);
  }
}

