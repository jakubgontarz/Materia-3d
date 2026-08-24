import React, { useState } from 'react';
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
} from '../fem/types';
import { ICONS } from './Toolbar';
import { CATALOG_DEFS, CATALOG_ORDER } from '../fem/catalogs';
import { SmartNumberInput } from './SmartNumberInput';

interface SidebarProps {
  nodes: Node3D[];
  setNodes: React.Dispatch<React.SetStateAction<Node3D[]>>;
  elements: Element3D[];
  setElements: React.Dispatch<React.SetStateAction<Element3D[]>>;
  sections: Section[];
  setSections: React.Dispatch<React.SetStateAction<Section[]>>;
  materials: Material[];
  setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
  selectedNodeIds: number[];
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<number[]>>;
  selectedElemIds: number[];
  setSelectedElemIds: React.Dispatch<React.SetStateAction<number[]>>;
  mode: 'select' | 'addBar';
  setMode: (m: 'select' | 'addBar') => void;
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
  probe: { elId: number | null; t: number };
  setProbe: React.Dispatch<React.SetStateAction<{ elId: number | null; t: number }>>;
  onInvalidateResults: () => void;
  defaultSectionId: number;
  defaultMaterialId: number;
  isVertical?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  nodes,
  setNodes,
  elements,
  setElements,
  sections,
  setSections,
  materials,
  setMaterials,
  selectedNodeIds,
  setSelectedNodeIds,
  selectedElemIds,
  setSelectedElemIds,
  mode,
  setMode,
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
  probe,
  setProbe,
  onInvalidateResults,
  defaultSectionId,
  defaultMaterialId,
}) => {
  // Panel height resize for vertical / mobile mode
  const [panelHeight, setPanelHeight] = useState<number | null>(null);

  const handlePanelHandleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const sidebarEl = document.getElementById('sidebar');
    const startH = sidebarEl ? sidebarEl.getBoundingClientRect().height : window.innerHeight * 0.44;

    const handleMove = (ev: MouseEvent | TouchEvent) => {
      const currentY = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      const dy = startY - currentY;
      const newH = Math.max(80, Math.min(window.innerHeight * 0.85, startH + dy));
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
  const [addBarCoordsCollapsed, setAddBarCoordsCollapsed] = useState(false);
  const [nodesGroupCollapsed, setNodesGroupCollapsed] = useState(false);
  const [elementsGroupCollapsed, setElementsGroupCollapsed] = useState(false);
  const [calcGroupCollapsed, setCalcGroupCollapsed] = useState(false);
  const [analysisCollapsed, setAnalysisCollapsed] = useState(false);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);

  // Form states for inline operations (Move, Rotate, Mirror, Split, Copy)
  const [moveFormOpen, setMoveFormOpen] = useState(false);
  const [moveDx, setMoveDx] = useState(0);
  const [moveDy, setMoveDy] = useState(0);
  const [moveDz, setMoveDz] = useState(0);

  const [copyFormOpen, setCopyFormOpen] = useState(false);
  const [copyDx, setCopyDx] = useState(2);
  const [copyDy, setCopyDy] = useState(0);
  const [copyDz, setCopyDz] = useState(0);

  const [splitFormElId, setSplitFormElId] = useState<number | '__bulk__' | null>(null);
  const [splitMode, setSplitMode] = useState<'single' | 'multi'>('single');
  const [splitT, setSplitT] = useState(0.5);
  const [splitN, setSplitN] = useState(2);

  // Add Bar coordinate inputs state
  const [addBarRel, setAddBarRel] = useState(false);
  const [addBarValX, setAddBarValX] = useState<number>(0);
  const [addBarValY, setAddBarValY] = useState<number>(0);
  const [addBarValZ, setAddBarValZ] = useState<number>(0);

  // Add Material / Section form state
  const [addMatFormOpen, setAddMatFormOpen] = useState(false);
  const [newMatName, setNewMatName] = useState('Nowy materiał');
  const [newMatE, setNewMatE] = useState(210);
  const [newMatNu, setNewMatNu] = useState(0.3);
  const [newMatAlpha, setNewMatAlpha] = useState(1.2);
  const [newMatDensity, setNewMatDensity] = useState(7850);

  const [addSecFormOpen, setAddSecFormOpen] = useState(false);
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
  const getNode = (id: number) => nodes.find((n) => n.id === id);
  const getElement = (id: number) => elements.find((e) => e.id === id);
  const getSection = (id: number) => sections.find((s) => s.id === id);
  const getMaterial = (id: number) => materials.find((m) => m.id === id);

  const fmtSmart = (v: number | null | undefined, d = 2) => {
    if (v == null || isNaN(v)) return '—';
    const a = Math.abs(v);
    if (a === 0) return '0';
    if (a < 0.001) return v.toExponential(2);
    if (a < 10) return v.toFixed(3);
    if (a < 1000) return v.toFixed(d);
    return v.toFixed(1);
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
  const updateNodeCoord = (axis: 'x' | 'y' | 'z', v: number) => {
    setNodes((prev) =>
      prev.map((n) => (selectedNodeIds.includes(n.id) ? { ...n, [axis]: v } : n))
    );
    onInvalidateResults();
  };

  const deleteSelectedNodes = () => {
    setElements((prev) =>
      prev.filter((e) => !selectedNodeIds.includes(e.n1) && !selectedNodeIds.includes(e.n2))
    );
    setNodes((prev) => prev.filter((n) => !selectedNodeIds.includes(n.id)));
    setSelectedNodeIds([]);
    setSelectedElemIds([]);
    onInvalidateResults();
  };

  const deleteSelectedElements = () => {
    setElements((prev) => prev.filter((e) => !selectedElemIds.includes(e.id)));
    setSelectedElemIds([]);
    onInvalidateResults();
  };

  // Move action
  const confirmMove = () => {
    if (!selectedNodeIds.length) {
      setMoveFormOpen(false);
      return;
    }
    setNodes((prev) =>
      prev.map((n) =>
        selectedNodeIds.includes(n.id)
          ? {
              ...n,
              x: Math.round((n.x + moveDx) * 1e6) / 1e6,
              y: Math.round((n.y + moveDy) * 1e6) / 1e6,
              z: Math.round((n.z + moveDz) * 1e6) / 1e6,
            }
          : n
      )
    );
    setMoveFormOpen(false);
    onInvalidateResults();
  };

  // Copy elements action
  const confirmCopy = () => {
    if (!selectedElements.length) {
      setCopyFormOpen(false);
      return;
    }
    const nodeMap = new Map<number, number>();
    const newNodes: Node3D[] = [];
    let nextNId = nodes.length > 0 ? Math.max(...nodes.map((n) => n.id)) + 1 : 1;

    selectedElements.forEach((el) => {
      [el.n1, el.n2].forEach((nid) => {
        if (!nodeMap.has(nid)) {
          const oldN = getNode(nid);
          if (oldN) {
            const newN: Node3D = {
              ...JSON.parse(JSON.stringify(oldN)),
              id: nextNId,
              x: oldN.x + copyDx,
              y: oldN.y + copyDy,
              z: oldN.z + copyDz,
            };
            nodeMap.set(nid, nextNId);
            newNodes.push(newN);
            nextNId++;
          }
        }
      });
    });

    let nextEId = elements.length > 0 ? Math.max(...elements.map((e) => e.id)) + 1 : 1;
    const newElements: Element3D[] = selectedElements.map((el) => {
      const e: Element3D = {
        ...JSON.parse(JSON.stringify(el)),
        id: nextEId++,
        n1: nodeMap.get(el.n1)!,
        n2: nodeMap.get(el.n2)!,
      };
      return e;
    });

    setNodes((prev) => [...prev, ...newNodes]);
    setElements((prev) => [...prev, ...newElements]);
    setSelectedElemIds(newElements.map((e) => e.id));
    setSelectedNodeIds([]);
    setCopyFormOpen(false);
    onInvalidateResults();
  };

  // Split element action
  const confirmSplit = (elId: number | '__bulk__') => {
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
      const intermediateNodeIds: number[] = [el.n1];

      for (let i = 1; i < numParts; i++) {
        const t = splitMode === 'single' ? splitT : i / numParts;
        const midN: Node3D = {
          id: nextNId++,
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          z: a.z + (b.z - a.z) * t,
          support: null,
          force: null,
          moment: null,
          mass: null,
        };
        addedNodes.push(midN);
        intermediateNodeIds.push(midN.id);
      }
      intermediateNodeIds.push(el.n2);

      for (let i = 0; i < intermediateNodeIds.length - 1; i++) {
        const seg: Element3D = {
          ...JSON.parse(JSON.stringify(el)),
          id: nextEId++,
          n1: intermediateNodeIds[i],
          n2: intermediateNodeIds[i + 1],
        };
        addedElements.push(seg);
      }
    });

    setNodes((prev) => [...prev, ...addedNodes]);
    setElements((prev) => [
      ...prev.filter((e) => !removedElemIds.has(e.id)),
      ...addedElements,
    ]);
    setSplitFormElId(null);
    setSelectedElemIds(addedElements.map((e) => e.id));
    onInvalidateResults();
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
    setNodes((prev) =>
      prev.map((n) => {
        if (!selectedNodeIds.includes(n.id)) return n;
        const f = n.force ? { ...n.force } : { Fx: 0, Fy: 0, Fz: 0 };
        f[field] = v;
        const isAllZero = (f.Fx === 0 || !f.Fx) && (f.Fy === 0 || !f.Fy) && (f.Fz === 0 || !f.Fz);
        return { ...n, force: isAllZero ? null : f };
      })
    );
    onInvalidateResults();
  };

  // Node moments (Mx, My, Mz)
  const updateNodeMoment = (field: 'Mx' | 'My' | 'Mz', v: number) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (!selectedNodeIds.includes(n.id)) return n;
        const m = n.moment ? { ...n.moment } : { Mx: 0, My: 0, Mz: 0 };
        m[field] = v;
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

    if (barStartNodeId == null) {
      setBarStartNodeId(targetNodeId);
      setAddBarValX(0);
      setAddBarValY(0);
      setAddBarValZ(0);
    } else if (barStartNodeId !== targetNodeId) {
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
      setAddBarValX(0);
      setAddBarValY(0);
      setAddBarValZ(0);
      onInvalidateResults();
    }
  };

  // Add Material
  const handleAddMaterial = () => {
    const nextId = materials.length > 0 ? Math.max(...materials.map((m) => m.id)) + 1 : 1;
    const G = newMatE / (2 * (1 + (newMatNu || 0.3)));
    const mat: Material = {
      id: nextId,
      name: newMatName || 'Materiał',
      E: newMatE,
      nu: newMatNu,
      G: G,
      alpha: newMatAlpha,
      density: newMatDensity,
    };
    setMaterials((prev) => [...prev, mat]);
    setAddMatFormOpen(false);
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

  // Add Section
  const handleAddSection = () => {
    const nextId = sections.length > 0 ? Math.max(...sections.map((s) => s.id)) + 1 : 1;
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

    const sec: Section = {
      id: nextId,
      name: finalName,
      ...props,
    };

    setSections((prev) => [...prev, sec]);
    setAddSecFormOpen(false);
  };

  const singleNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const singleElem = selectedElements.length === 1 ? selectedElements[0] : null;

  return (
    <div id="sidebar" style={panelHeight ? { height: `${panelHeight}px` } : undefined}>
      {/* Draggable handle for mobile layout */}
      <div
        id="panelHandle"
        aria-hidden="true"
        onMouseDown={handlePanelHandleStart}
        onTouchStart={handlePanelHandleStart}
      >
        <div className="panel-grip"></div>
      </div>

      <div id="sidebarScroll">
        {/* GROUP 1: WSPÓŁRZĘDNE (w trybie Rysuj) LUB WŁAŚCIWOŚCI (w trybie Zaznacz) */}
        {mode === 'addBar' ? (
          <div className="sidebar-group">
            <div className="group-header" onClick={() => setAddBarCoordsCollapsed(!addBarCoordsCollapsed)}>
              <div className="group-title">
                <span>Współrzędne</span>
                <span className="group-tag">
                  {barStartNodeId != null ? `Start: W${barStartNodeId}` : 'Nowy pręt 3D'}
                </span>
              </div>
              <span className="subtle-icon">{addBarCoordsCollapsed ? '▸' : '▾'}</span>
            </div>
            {!addBarCoordsCollapsed && (
              <div className="group-body">
                <div className="panel">
                  <h3>Współrzędne 3D</h3>
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
                      Wpisz współrzędne pierwszego węzła 3D:
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
                      <label>{addBarRel ? 'ΔX' : 'X'}</label>
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
                      <label>{addBarRel ? 'ΔY' : 'Y'}</label>
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
                      <label>{addBarRel ? 'ΔZ' : 'Z'}</label>
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
        ) : (
          <>
            {/* WŁAŚCIWOŚCI GÓRNY KOMUNIKAT */}
            {selectedNodeIds.length === 0 && selectedElemIds.length === 0 ? (
              <div className="panel">
                <h3>Właściwości</h3>
                <div className="empty-state">
                  Zaznacz węzeł lub pręt na rysunku 3D (tryb „Zaznacz”),<br />
                  aby edytować jego właściwości: podpory, obciążenia, przekrój i materiał.
                </div>
              </div>
            ) : selectedNodeIds.length + selectedElemIds.length > 1 ? (
              <div className="panel">
                <h3>Właściwości</h3>
                <div className="muted">
                  Zaznaczono:{' '}
                  <b>
                    {[
                      selectedNodeIds.length ? pluralUnit(selectedNodeIds.length, 'węzeł', 'węzły', 'węzłów') : null,
                      selectedElemIds.length ? pluralUnit(selectedElemIds.length, 'pręt', 'pręty', 'prętów') : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </b>
                  .
                </div>
              </div>
            ) : null}

            {/* GRUPA WĘZŁY (gdy zaznaczony przynajmniej jeden węzeł) */}
            {selectedNodeIds.length > 0 && (
              <div className="sidebar-group">
                <div className="group-header" onClick={() => setNodesGroupCollapsed(!nodesGroupCollapsed)}>
                  <div className="group-title">
                    <span>Węzły 3D</span>
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
                            <label>X</label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="0.1"
                                value={singleNode.x}
                                onFocus={onInvalidateResults}
                                onChange={(v) => updateNodeCoord('x', v)}
                              />
                              <span className="unit">m</span>
                            </div>
                          </div>
                          <div className="third">
                            <label>Y</label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="0.1"
                                value={singleNode.y}
                                onFocus={onInvalidateResults}
                                onChange={(v) => updateNodeCoord('y', v)}
                              />
                              <span className="unit">m</span>
                            </div>
                          </div>
                          <div className="third">
                            <label>Z</label>
                            <div className="inp-unit">
                              <SmartNumberInput
                                step="0.1"
                                value={singleNode.z}
                                onFocus={onInvalidateResults}
                                onChange={(v) => updateNodeCoord('z', v)}
                              />
                              <span className="unit">m</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="muted">Aby edytować współrzędne X/Y/Z, zaznacz pojedynczy węzeł.</div>
                      )}

                      <div className="btnrow">
                        <button
                          className="mini mini-icon danger"
                          onClick={deleteSelectedNodes}
                          title="Usuń zaznaczone węzły"
                        >
                          {ICONS.del}
                        </button>
                        <button
                          className={`mini mini-icon ${moveFormOpen ? 'on' : ''}`}
                          onClick={() => setMoveFormOpen(!moveFormOpen)}
                          title="Przenieś węzły o wektor ΔX, ΔY, ΔZ"
                        >
                          {ICONS.moveNode}
                        </button>
                      </div>

                      {moveFormOpen && (
                        <div
                          className="card"
                          style={{
                            marginTop: '8px',
                            background: 'var(--surface)',
                            borderColor: 'var(--input-border)',
                          }}
                        >
                          <div className="muted" style={{ marginBottom: '6px' }}>
                            Wektor przeniesienia 3D:
                          </div>
                          <div className="row-triple">
                            <div className="third">
                              <label>Δx</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="0.1"
                                  value={moveDx}
                                  onChange={(v) => setMoveDx(v)}
                                />
                                <span className="unit">m</span>
                              </div>
                            </div>
                            <div className="third">
                              <label>Δy</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="0.1"
                                  value={moveDy}
                                  onChange={(v) => setMoveDy(v)}
                                />
                                <span className="unit">m</span>
                              </div>
                            </div>
                            <div className="third">
                              <label>Δz</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="0.1"
                                  value={moveDz}
                                  onChange={(v) => setMoveDz(v)}
                                />
                                <span className="unit">m</span>
                              </div>
                            </div>
                          </div>
                          <div className="btnrow" style={{ marginTop: '8px' }}>
                            <button className="mini on" onClick={confirmMove}>
                              Przenieś
                            </button>
                            <button className="mini" onClick={() => setMoveFormOpen(false)}>
                              Anuluj
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* PODPORA 3D */}
                    <div className="panel">
                      <h3>Podpora 3D</h3>
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
                          title="Utwierdzenie 3D (Ux, Uy, Uz, Rx, Ry, Rz)"
                        >
                          {ICONS.supFixed}
                        </button>
                        <button
                          className={`mini mini-icon ${selectedNodes.length > 0 && selectedNodes.every((n) => presetMatches(n, 'pin')) ? 'on' : ''}`}
                          onClick={() => applySupportPreset('pin')}
                          title="Podpora przegubowo-stała 3D (Ux, Uy, Uz)"
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
                          { trans: 'ux', rot: 'rx', transLabel: 'Ux (X)', rotLabel: 'Rx (X)', transUnit: 'mm', rotUnit: '°', transSpringUnit: 'kN/m', rotSpringUnit: 'kNm/rad' },
                          { trans: 'uy', rot: 'ry', transLabel: 'Uy (Y)', rotLabel: 'Ry (Y)', transUnit: 'mm', rotUnit: '°', transSpringUnit: 'kN/m', rotSpringUnit: 'kNm/rad' },
                          { trans: 'uz', rot: 'rz', transLabel: 'Uz (Z)', rotLabel: 'Rz (Z)', transUnit: 'mm', rotUnit: '°', transSpringUnit: 'kN/m', rotSpringUnit: 'kNm/rad' }
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
                                  <label style={{ fontSize: '11.5px', fontWeight: 600, display: 'flex', alignItems: 'center', color: 'var(--text)', gap: '4px', margin: 0 }}>
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
                                  <label style={{ fontSize: '11.5px', fontWeight: 600, display: 'flex', alignItems: 'center', color: 'var(--text)', gap: '4px', margin: 0 }}>
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
                                        <span style={{ fontSize: '9px', color: 'var(--text-dim)', whiteSpace: 'nowrap', width: '22px' }}>Wym:</span>
                                        <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: '1px solid var(--input-border)', borderRadius: '5px', background: 'var(--input-bg)', padding: '0 4px', height: '26px' }}>
                                          <SmartNumberInput
                                            step="1"
                                            value={transDelta}
                                            placeholder="0"
                                            onChange={(v) => updateSupportDir(trans, 'delta', v)}
                                            style={{ width: '100%', border: 'none', background: 'transparent', height: '100%', outline: 'none', padding: 0, fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text)' }}
                                          />
                                          <span style={{ fontSize: '9px', color: '#8b98a7', marginLeft: '2px', flexShrink: 0 }}>{transUnit}</span>
                                        </div>
                                      </div>
                                    )}
                                    {transType === 'spring' && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: '1px solid var(--input-border)', borderRadius: '5px', background: 'var(--input-bg)', padding: '0 4px', height: '26px' }} title={`Sztywność sprężyny (${transSpringUnit})`}>
                                          <SmartNumberInput
                                            step="50"
                                            value={transK}
                                            placeholder="k"
                                            onChange={(v) => updateSupportDir(trans, 'k', v)}
                                            style={{ width: '100%', border: 'none', background: 'transparent', height: '100%', outline: 'none', padding: 0, fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text)' }}
                                          />
                                          <span style={{ fontSize: '9px', color: '#8b98a7', marginLeft: '2px', flexShrink: 0 }}>k</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: '1px solid var(--input-border)', borderRadius: '5px', background: 'var(--input-bg)', padding: '0 4px', height: '26px' }} title="Wymuszenie / osiadanie">
                                          <SmartNumberInput
                                            step="1"
                                            value={transDelta}
                                            placeholder="Δ"
                                            onChange={(v) => updateSupportDir(trans, 'delta', v)}
                                            style={{ width: '100%', border: 'none', background: 'transparent', height: '100%', outline: 'none', padding: 0, fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text)' }}
                                          />
                                          <span style={{ fontSize: '9px', color: '#8b98a7', marginLeft: '2px', flexShrink: 0 }}>{transUnit}</span>
                                        </div>
                                      </div>
                                    )}
                                    {transType !== 'fixed' && transType !== 'spring' && (
                                      <div style={{ height: '26px' }} />
                                    )}
                                  </div>

                                  <div className="half">
                                    {rotType === 'fixed' && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', width: '100%' }}>
                                        <span style={{ fontSize: '9px', color: 'var(--text-dim)', whiteSpace: 'nowrap', width: '22px' }}>Wym:</span>
                                        <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: '1px solid var(--input-border)', borderRadius: '5px', background: 'var(--input-bg)', padding: '0 4px', height: '26px' }}>
                                          <SmartNumberInput
                                            step="0.5"
                                            value={rotDelta}
                                            placeholder="0"
                                            onChange={(v) => updateSupportDir(rot, 'delta', v)}
                                            style={{ width: '100%', border: 'none', background: 'transparent', height: '100%', outline: 'none', padding: 0, fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text)' }}
                                          />
                                          <span style={{ fontSize: '9px', color: '#8b98a7', marginLeft: '2px', flexShrink: 0 }}>{rotUnit}</span>
                                        </div>
                                      </div>
                                    )}
                                    {rotType === 'spring' && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: '1px solid var(--input-border)', borderRadius: '5px', background: 'var(--input-bg)', padding: '0 4px', height: '26px' }} title={`Sztywność sprężyny obrotowej (${rotSpringUnit})`}>
                                          <SmartNumberInput
                                            step="50"
                                            value={rotK}
                                            placeholder="k"
                                            onChange={(v) => updateSupportDir(rot, 'k', v)}
                                            style={{ width: '100%', border: 'none', background: 'transparent', height: '100%', outline: 'none', padding: 0, fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text)' }}
                                          />
                                          <span style={{ fontSize: '9px', color: '#8b98a7', marginLeft: '2px', flexShrink: 0 }}>k</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: '1px solid var(--input-border)', borderRadius: '5px', background: 'var(--input-bg)', padding: '0 4px', height: '26px' }} title="Wymuszenie obrotu">
                                          <SmartNumberInput
                                            step="0.5"
                                            value={rotDelta}
                                            placeholder="Δ"
                                            onChange={(v) => updateSupportDir(rot, 'delta', v)}
                                            style={{ width: '100%', border: 'none', background: 'transparent', height: '100%', outline: 'none', padding: 0, fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--text)' }}
                                          />
                                          <span style={{ fontSize: '9px', color: '#8b98a7', marginLeft: '2px', flexShrink: 0 }}>{rotUnit}</span>
                                        </div>
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
                    </div>

                    {/* SIŁY SKUPIONE 3D */}
                    {(() => {
                      const curFx = commonVal(selectedNodes, (n) => n.force?.Fx ?? 0);
                      const curFy = commonVal(selectedNodes, (n) => n.force?.Fy ?? 0);
                      const curFz = commonVal(selectedNodes, (n) => n.force?.Fz ?? 0);
                      return (
                        <div className="panel">
                          <h3>Siły skupione 3D</h3>
                          <div className="row-triple">
                            <div className="third">
                              <label>Fx</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curFx}
                                  placeholder="różne"
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => updateNodeForce('Fx', v)}
                                />
                                <span className="unit">kN</span>
                              </div>
                            </div>
                            <div className="third">
                              <label>Fy</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curFy}
                                  placeholder="różne"
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => updateNodeForce('Fy', v)}
                                />
                                <span className="unit">kN</span>
                              </div>
                            </div>
                            <div className="third">
                              <label>Fz</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curFz}
                                  placeholder="różne"
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
                      return (
                        <div className="panel">
                          <h3>Momenty skupione 3D</h3>
                          <div className="row-triple">
                            <div className="third">
                              <label>Mx</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curMx}
                                  placeholder="różne"
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => updateNodeMoment('Mx', v)}
                                />
                                <span className="unit">kNm</span>
                              </div>
                            </div>
                            <div className="third">
                              <label>My</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curMy}
                                  placeholder="różne"
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => updateNodeMoment('My', v)}
                                />
                                <span className="unit">kNm</span>
                              </div>
                            </div>
                            <div className="third">
                              <label>Mz</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curMz}
                                  placeholder="różne"
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
                      return (
                        <div className="panel">
                          <h3>Masa skupiona w węźle</h3>
                          <div className="row-triple">
                            <div className="third">
                              <label>mx</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="10"
                                  value={curMxMass}
                                  placeholder="różne"
                                  onChange={(v) => updateNodeMass('mx', v)}
                                />
                                <span className="unit">kg</span>
                              </div>
                            </div>
                            <div className="third">
                              <label>my</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="10"
                                  value={curMyMass}
                                  placeholder="różne"
                                  onChange={(v) => updateNodeMass('my', v)}
                                />
                                <span className="unit">kg</span>
                              </div>
                            </div>
                            <div className="third">
                              <label>mz</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="10"
                                  value={curMzMass}
                                  placeholder="różne"
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
                    <span>Pręty 3D</span>
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

                      <div className="btnrow">
                        <button
                          className="mini mini-icon danger"
                          onClick={deleteSelectedElements}
                          title="Usuń pręt"
                        >
                          {ICONS.del}
                        </button>
                        <button
                          className={`mini mini-icon ${splitFormElId != null ? 'on' : ''}`}
                          onClick={() =>
                            setSplitFormElId(
                              splitFormElId != null ? null : singleElem ? singleElem.id : '__bulk__'
                            )
                          }
                          title="Podziel pręt"
                        >
                          {ICONS.splitBar}
                        </button>
                        <button
                          className={`mini mini-icon ${copyFormOpen ? 'on' : ''}`}
                          onClick={() => setCopyFormOpen(!copyFormOpen)}
                          title="Kopiuj pręt"
                        >
                          {ICONS.copyVec}
                        </button>
                      </div>

                      {splitFormElId != null && (
                        <div
                          className="card"
                          style={{
                            marginTop: '8px',
                            background: 'var(--surface)',
                            borderColor: 'var(--input-border)',
                          }}
                        >
                          <div className="btnrow" style={{ marginBottom: '8px' }}>
                            <button
                              className={`mini ${splitMode === 'single' ? 'on' : ''}`}
                              onClick={() => setSplitMode('single')}
                            >
                              Pojedynczy podział
                            </button>
                            <button
                              className={`mini ${splitMode === 'multi' ? 'on' : ''}`}
                              onClick={() => setSplitMode('multi')}
                            >
                              Podział na N części
                            </button>
                          </div>
                          {splitMode === 'single' ? (
                            <div className="row">
                              <label>Punkt t (0–1)</label>
                              <SmartNumberInput
                                min={0.05}
                                max={0.95}
                                step="0.05"
                                value={splitT}
                                onChange={(v) => setSplitT(v)}
                              />
                            </div>
                          ) : (
                            <div className="row">
                              <label>Liczba części</label>
                              <SmartNumberInput
                                min={2}
                                max={20}
                                step="1"
                                value={splitN}
                                onChange={(v) => setSplitN(Math.round(v))}
                              />
                            </div>
                          )}
                          <div className="btnrow" style={{ marginTop: '8px' }}>
                            <button className="mini on" onClick={() => confirmSplit(splitFormElId)}>
                              Podziel
                            </button>
                            <button className="mini" onClick={() => setSplitFormElId(null)}>
                              Anuluj
                            </button>
                          </div>
                        </div>
                      )}

                      {copyFormOpen && (
                        <div
                          className="card"
                          style={{
                            marginTop: '8px',
                            background: 'var(--surface)',
                            borderColor: 'var(--input-border)',
                          }}
                        >
                          <div className="muted" style={{ marginBottom: '6px' }}>
                            Kopiuje zaznaczone pręty o wektor ΔX, ΔY, ΔZ:
                          </div>
                          <div className="row-triple">
                            <div className="third">
                              <label>Δx</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="0.5"
                                  value={copyDx}
                                  onChange={(v) => setCopyDx(v)}
                                />
                                <span className="unit">m</span>
                              </div>
                            </div>
                            <div className="third">
                              <label>Δy</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="0.5"
                                  value={copyDy}
                                  onChange={(v) => setCopyDy(v)}
                                />
                                <span className="unit">m</span>
                              </div>
                            </div>
                            <div className="third">
                              <label>Δz</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="0.5"
                                  value={copyDz}
                                  onChange={(v) => setCopyDz(v)}
                                />
                                <span className="unit">m</span>
                              </div>
                            </div>
                          </div>
                          <div className="btnrow" style={{ marginTop: '8px' }}>
                            <button className="mini on" onClick={confirmCopy}>
                              Kopiuj
                            </button>
                            <button className="mini" onClick={() => setCopyFormOpen(false)}>
                              Anuluj
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* PRZEKRÓJ I MATERIAŁ */}
                    {(() => {
                      const commonSecId = commonVal(selectedElements, (e) => e.sectionId);
                      const commonMatId = commonVal(selectedElements, (e) => e.materialId);
                      const commonRollAngle = commonVal(selectedElements, (e) => e.rollAngle ?? 0);

                      return (
                        <div className="panel">
                          <h3>Przekrój i materiał</h3>
                          <div className="row">
                            <label>Przekrój</label>
                            <select
                              value={commonSecId ?? ''}
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
                            <label>Obrót osi β</label>
                            <SmartNumberInput
                              step="15"
                              value={commonRollAngle}
                              placeholder="różne"
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
                        </div>
                      );
                    })()}

                    {/* OBCIĄŻENIE CIĄGŁE PRĘTA */}
                    <div className="panel">
                      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
                        <h3>Obciążenie ciągłe 3D</h3>
                        <div className="btnrow" style={{ gap: '2px' }}>
                          <button
                            type="button"
                            className={`mini ${commonVal(selectedElements, (e) => e.q?.coordinateSystem || 'global') === 'global' ? 'on' : ''}`}
                            style={{ fontSize: '10px', padding: '2px 6px' }}
                            onClick={() => {
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
                            Globalny (XYZ)
                          </button>
                          <button
                            type="button"
                            className={`mini ${commonVal(selectedElements, (e) => e.q?.coordinateSystem || 'global') === 'local' ? 'on' : ''}`}
                            style={{ fontSize: '10px', padding: '2px 6px' }}
                            onClick={() => {
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
                            Lokalny (xyz)
                          </button>
                        </div>
                      </div>

                      {(() => {
                        const commonCoord = commonVal(selectedElements, (e) => e.q?.coordinateSystem || 'global');
                        const isLoc = commonCoord === 'local';
                        const curQx = commonVal(selectedElements, (e) => e.q?.qxStart ?? 0);
                        const curQy = commonVal(selectedElements, (e) => e.q?.qyStart ?? 0);
                        const curQz = commonVal(selectedElements, (e) => e.q?.qzStart ?? 0);

                        const updateQ = (axis: 'x' | 'y' | 'z', val: number) => {
                          setElements((prev) =>
                            prev.map((el) => {
                              if (!selectedElemIds.includes(el.id)) return el;
                              const coord = el.q?.coordinateSystem || (isLoc ? 'local' : 'global');
                              const nQx = axis === 'x' ? val : (el.q?.qxStart ?? 0);
                              const nQy = axis === 'y' ? val : (el.q?.qyStart ?? 0);
                              const nQz = axis === 'z' ? val : (el.q?.qzStart ?? 0);
                              const isAllZero = nQx === 0 && nQy === 0 && nQz === 0;

                              return {
                                ...el,
                                q: isAllZero
                                  ? null
                                  : {
                                      coordinateSystem: coord,
                                      qxStart: nQx,
                                      qxEnd: nQx,
                                      qyStart: nQy,
                                      qyEnd: nQy,
                                      qzStart: nQz,
                                      qzEnd: nQz,
                                    },
                              };
                            })
                          );
                          onInvalidateResults();
                        };

                        return (
                          <div className="row-triple">
                            <div className="third">
                              <label>{isLoc ? 'qx (oś)' : 'qX'}</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curQx}
                                  placeholder="różne"
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => updateQ('x', v)}
                                />
                                <span className="unit">kN/m</span>
                              </div>
                            </div>
                            <div className="third">
                              <label>{isLoc ? 'qy (y)' : 'qY'}</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curQy}
                                  placeholder="różne"
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => updateQ('y', v)}
                                />
                                <span className="unit">kN/m</span>
                              </div>
                            </div>
                            <div className="third">
                              <label>{isLoc ? 'qz (z)' : 'qZ'}</label>
                              <div className="inp-unit">
                                <SmartNumberInput
                                  step="1"
                                  value={curQz}
                                  placeholder="różne"
                                  onFocus={onInvalidateResults}
                                  onChange={(v) => updateQ('z', v)}
                                />
                                <span className="unit">kN/m</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* PRZEGUBY / ZWOLNIENIA NA KOŃCACH PRĘTA (6 SWOBÓD / DOFs) */}
                    {(() => {
                      const dofList: Array<{ keyStart: keyof MemberHinges3D; keyEnd: keyof MemberHinges3D; label: string; desc: string }> = [
                        { keyStart: 'start_ux', keyEnd: 'end_ux', label: 'Ux', desc: 'Przesuw podłużny (x)' },
                        { keyStart: 'start_uy', keyEnd: 'end_uy', label: 'Uy', desc: 'Przesuw poprzeczny (y)' },
                        { keyStart: 'start_uz', keyEnd: 'end_uz', label: 'Uz', desc: 'Przesuw poprzeczny (z)' },
                        { keyStart: 'start_rx', keyEnd: 'end_rx', label: 'Rx', desc: 'Skręcanie (Mx)' },
                        { keyStart: 'start_ry', keyEnd: 'end_ry', label: 'Ry', desc: 'Zginanie (My)' },
                        { keyStart: 'start_rz', keyEnd: 'end_rz', label: 'Rz', desc: 'Zginanie (Mz)' },
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
                            <div style={{ background: 'var(--panel-gutter)', padding: '6px', borderRadius: '6px', border: '1px solid var(--surface-border)' }}>
                              <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '6px', color: 'var(--text)' }}>
                                Początek {singleElem ? `(W${singleElem.n1})` : ''}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                {dofList.map((dof) => {
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
                                      <span style={{ fontWeight: 500 }}>{dof.label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            {/* KONIEC W2 */}
                            <div style={{ background: 'var(--panel-gutter)', padding: '6px', borderRadius: '6px', border: '1px solid var(--surface-border)' }}>
                              <div style={{ fontWeight: 600, fontSize: '11px', marginBottom: '6px', color: 'var(--text)' }}>
                                Koniec {singleElem ? `(W${singleElem.n2})` : ''}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                {dofList.map((dof) => {
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
                                      <span style={{ fontWeight: 500 }}>{dof.label}</span>
                                    </label>
                                  );
                                })}
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
                    ? 'Stateczność 3D'
                    : analysisSettings.type === 'modal'
                    ? 'Drgania własne 3D'
                    : 'Statyka liniowa 3D'}
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
                    aby zobaczyć ugięcia 3D, siły wewnętrzne My, Mz, Mx, Vy, Vz, N i reakcje.
                  </div>
                </div>
              ) : (
                <>
                  {/* REAKCJE PODPOROWE */}
                  {solved.type === 'linear_static' && (
                    <div className="panel">
                      <h3>
                        Reakcje podporowe <span className="tag">rozwiązano</span>
                      </h3>
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
                    </div>
                  )}

                  {/* WYNIKI STATECZNOŚCI 3D */}
                  {solved.type === 'stability' && (
                    <div className="panel">
                      <h3>
                        Stateczność 3D <span className="tag">α_cr</span>
                      </h3>
                      {solved.modes.length === 0 ? (
                        <div className="warn">
                          {solved.noCompression
                            ? 'Brak ściskanych elementów w konstrukcji (α_cr = ∞).'
                            : 'Nie wyznaczono form wyboczenia (osobliwość układu).'}
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto' }}>
                          <table className="rtab">
                            <thead>
                              <tr>
                                <th>Forma</th>
                                <th>α_cr</th>
                                <th>N_cr [kN]</th>
                              </tr>
                            </thead>
                            <tbody>
                              {solved.modes.map((m, idx) => (
                                <tr
                                  key={idx}
                                  style={{
                                    cursor: 'pointer',
                                    fontWeight: (solved.currentMode || 0) === idx ? 'bold' : 'normal',
                                    background: (solved.currentMode || 0) === idx ? 'rgba(79, 70, 229, 0.15)' : 'transparent',
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
                      )}
                    </div>
                  )}

                  {/* WYNIKI DRGAŃ WŁASNYCH 3D */}
                  {solved.type === 'modal' && (
                    <div className="panel">
                      <h3>
                        Drgania własne 3D <span className="tag">modalna</span>
                      </h3>
                      {solved.modes.length === 0 ? (
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
                                    background: (solved.currentMode || 0) === idx ? 'rgba(79, 70, 229, 0.15)' : 'transparent',
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
                      )}
                    </div>
                  )}

                  {/* WIDOK WYNIKÓW / TOGGLES */}
                  <div className="panel">
                    <h3>Widok wyników</h3>
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
                        Forma odkształcenia (ugięcie 3D)
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
                        <span className="swatch" style={{ background: 'var(--m-color)' }}></span>
                        Moment zginający My
                      </span>
                      <input type="checkbox" checked={showMy} onChange={(e) => setShowMy(e.target.checked)} />
                    </div>

                    <div className={`diagToggle ${showMz ? 'active' : ''}`}>
                      <span className="lbl">
                        <span className="swatch" style={{ background: 'var(--m-color)' }}></span>
                        Moment zginający Mz
                      </span>
                      <input type="checkbox" checked={showMz} onChange={(e) => setShowMz(e.target.checked)} />
                    </div>

                    <div className={`diagToggle ${showMx ? 'active' : ''}`}>
                      <span className="lbl">
                        <span className="swatch" style={{ background: 'var(--m-color)' }}></span>
                        Moment skręcający Mx
                      </span>
                      <input type="checkbox" checked={showMx} onChange={(e) => setShowMx(e.target.checked)} />
                    </div>

                    <div className={`diagToggle ${showVy ? 'active' : ''}`}>
                      <span className="lbl">
                        <span className="swatch" style={{ background: 'var(--t-color)' }}></span>
                        Siła tnąca Vy
                      </span>
                      <input type="checkbox" checked={showVy} onChange={(e) => setShowVy(e.target.checked)} />
                    </div>

                    <div className={`diagToggle ${showVz ? 'active' : ''}`}>
                      <span className="lbl">
                        <span className="swatch" style={{ background: 'var(--t-color)' }}></span>
                        Siła tnąca Vz
                      </span>
                      <input type="checkbox" checked={showVz} onChange={(e) => setShowVz(e.target.checked)} />
                    </div>

                    <div className={`diagToggle ${showN ? 'active' : ''}`}>
                      <span className="lbl">
                        <span className="swatch" style={{ background: 'var(--n-color)' }}></span>
                        Siła osiowa N
                      </span>
                      <input type="checkbox" checked={showN} onChange={(e) => setShowN(e.target.checked)} />
                    </div>

                    <div className={`diagToggle ${showStress ? 'active' : ''}`}>
                      <span className="lbl">
                        <span className="swatch" style={{ background: 'var(--s-color)' }}></span>
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
                  </div>

                  {/* SONDA WYNIKÓW 3D */}
                  <div className="panel">
                    <h3>
                      Sonda wyników <span className="tag">dokładny odczyt</span>
                    </h3>
                    <div className="row">
                      <label>Pręt</label>
                      <select
                        value={probe.elId ?? (elements[0]?.id || '')}
                        onChange={(e) => setProbe({ elId: parseInt(e.target.value), t: probe.t })}
                      >
                        {elements.map((e) => (
                          <option key={e.id} value={e.id}>
                            P{e.id} (W{e.n1}→W{e.n2})
                          </option>
                        ))}
                      </select>
                    </div>
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
                                    <strong>σ_max</strong> <span className="muted">naprężenie</span>
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
                  </div>
                </>
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
                        <option value="linear_static">Statyka liniowa 3D</option>
                        <option value="stability">Stateczność (wyboczenie) 3D</option>
                        <option value="modal">Drgania własne (modalna) 3D</option>
                      </select>
                    </div>

                    {analysisSettings.type === 'linear_static' && (
                      <div className="muted" style={{ marginTop: '6px', lineHeight: 1.4 }}>
                        Analiza statyczna przestrzenna 3D: wyznacza 6 sił przekrojowych (N, Vy, Vz, Mx, My, Mz),
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
                          Analiza stateczności 3D: wyznacza mnożniki obciążenia krytycznego α_cr i przestrzenne formy
                          wyboczenia.
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
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* GROUP 3: BIBLIOTEKA (Materiały & Przekroje) */}
        <div className="sidebar-group">
          <div className="group-header" onClick={() => setLibraryCollapsed(!libraryCollapsed)}>
            <div className="group-title">
              <span>Biblioteka</span>
              <span className="group-tag">
                {materials.length} mat. / {sections.length} przekr.
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
                  <div key={m.id} className="listitem">
                    <span>
                      {m.name}
                      <br />
                      <span className="muted">
                        E={m.E} GPa, ν={m.nu ?? 0.3}, ρ={m.density || 0} kg/m³
                      </span>
                    </span>
                    {materials.length > 1 && (
                      <span
                        className="del"
                        onClick={() => setMaterials((prev) => prev.filter((item) => item.id !== m.id))}
                        title="Usuń materiał"
                      >
                        ✕
                      </span>
                    )}
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
                        Dodaj
                      </button>
                      <button className="mini" onClick={() => setAddMatFormOpen(false)}>
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="btnrow">
                    <button className="mini" onClick={() => setAddMatFormOpen(true)}>
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
                  <div key={s.id} className="listitem">
                    <span>
                      {s.name}
                      <br />
                      <span className="muted">
                        A={fmtSmart(s.A)} cm², Iy={fmtSmart(s.Iy)} cm⁴, Iz={fmtSmart(s.Iz)} cm⁴
                      </span>
                    </span>
                    {sections.length > 1 && (
                      <span
                        className="del"
                        onClick={() => setSections((prev) => prev.filter((item) => item.id !== s.id))}
                        title="Usuń przekrój"
                      >
                        ✕
                      </span>
                    )}
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
                        onClick={() => setNewSecCategory('katalog')}
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
                        onClick={() => setNewSecCategory('ksztalt')}
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
                        onClick={() => setNewSecCategory('wlasny')}
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
                              setNewSecCatType(e.target.value);
                              setNewSecCatSizeIdx(0);
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
                            onChange={(e) => setNewSecCatSizeIdx(parseInt(e.target.value) || 0)}
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
                            onChange={(e) => setNewSecShape(e.target.value as any)}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '8px 0', background: 'rgba(255, 255, 255, 0.02)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <svg width="100" height="100" style={{ background: 'var(--canvas-bg)', borderRadius: '4px', border: '1px solid var(--input-border)', flexShrink: 0 }}>
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
                                  <path d={pathDAdjusted} fill="rgba(99, 102, 241, 0.18)" stroke="var(--accent)" strokeWidth="1.25" fillRule="evenodd" />
                                ) : (
                                  <rect 
                                    x={centerAdjusted - cBotZ * scaleAdjusted} 
                                    y={centerAdjusted - cTopY * scaleAdjusted} 
                                    width={(cBotZ + cTopZ) * scaleAdjusted} 
                                    height={(cTopY + cBotY) * scaleAdjusted} 
                                    fill="rgba(255,255,255,0.02)" 
                                    stroke="var(--text-dim)" 
                                    strokeWidth="0.75" 
                                    strokeDasharray="3,3" 
                                  />
                                );
                              })()}

                              {/* Centroid Red Dot */}
                              <circle cx="50" cy="50" r="2.5" fill="#ef4444" stroke="var(--canvas-bg)" strokeWidth="0.75" />
                            </svg>

                            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10.5px', color: 'var(--text-dim)' }}>
                              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '2px', fontWeight: 'bold', color: 'var(--text)', display: 'flex', justifyContent: 'space-between' }}>
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
                        Dodaj
                      </button>
                      <button className="mini" onClick={() => setAddSecFormOpen(false)}>
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="btnrow">
                    <button className="mini" onClick={() => setAddSecFormOpen(true)}>
                      + Dodaj przekrój
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
