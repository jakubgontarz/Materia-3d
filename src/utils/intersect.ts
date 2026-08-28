import { Node3D, Element3D, MemberHinges3D, MemberDistributedLoad3D } from '../fem/types';

export interface IntersectResult {
  newNodes: Node3D[];
  newElements: Element3D[];
  removedElementIds: number[];
  createdNodeCount: number;
  splitElementCount: number;
  newSegmentCount: number;
  intersectionPointCount: number;
}

/**
 * Finds all intersection points between selected elements (or all elements if specified)
 * and splits them into connected sub-elements at the intersection points.
 * Preserves cross-section, material, rollAngle, hinges at external ends, and distributed loads.
 */
export function findAndSplitIntersections(
  allNodes: Node3D[],
  allElements: Element3D[],
  selectedElementIds: number[],
  tolerance = 1e-4 // 0.1 mm tolerance in meters
): IntersectResult | null {
  const selectedElements = allElements.filter((e) => selectedElementIds.includes(e.id));
  if (selectedElements.length < 2) {
    return null;
  }

  const nodeMap = new Map<number, Node3D>();
  allNodes.forEach((n) => nodeMap.set(n.id, n));

  let nextNodeId = allNodes.length > 0 ? Math.max(...allNodes.map((n) => n.id)) + 1 : 1;
  let nextElemId = allElements.length > 0 ? Math.max(...allElements.map((e) => e.id)) + 1 : 1;

  // Track newly created nodes during this operation
  const newlyCreatedNodes: Node3D[] = [];

  // Helper to find existing or newly created node near point (x, y, z)
  const getOrCreateNodeAt = (x: number, y: number, z: number): number => {
    // 1. Check existing model nodes
    for (const n of allNodes) {
      const dist = Math.hypot(n.x - x, n.y - y, n.z - z);
      if (dist <= tolerance) {
        return n.id;
      }
    }
    // 2. Check nodes created in this pass
    for (const n of newlyCreatedNodes) {
      const dist = Math.hypot(n.x - x, n.y - y, n.z - z);
      if (dist <= tolerance) {
        return n.id;
      }
    }
    // 3. Create a new node
    const newNode: Node3D = {
      id: nextNodeId++,
      x: Math.round(x * 1e6) / 1e6,
      y: Math.round(y * 1e6) / 1e6,
      z: Math.round(z * 1e6) / 1e6,
      support: null,
      force: null,
      moment: null,
      mass: null,
    };
    newlyCreatedNodes.push(newNode);
    nodeMap.set(newNode.id, newNode);
    return newNode.id;
  };

  // Cuts map: elementId -> array of { t: number; nodeId: number }
  const cutsByElement = new Map<number, { t: number; nodeId: number }[]>();
  const addCut = (elemId: number, t: number, nodeId: number) => {
    if (t <= 1e-5 || t >= 1 - 1e-5) return; // ignore endpoints
    if (!cutsByElement.has(elemId)) {
      cutsByElement.set(elemId, []);
    }
    const list = cutsByElement.get(elemId)!;
    // Check if duplicate cut already recorded
    const exists = list.some((c) => Math.abs(c.t - t) < 1e-4 || c.nodeId === nodeId);
    if (!exists) {
      list.push({ t, nodeId });
    }
  };

  const intersectionPoints: { x: number; y: number; z: number }[] = [];

  // Compare every pair of selected elements
  for (let i = 0; i < selectedElements.length; i++) {
    const elA = selectedElements[i];
    const nA1 = nodeMap.get(elA.n1);
    const nA2 = nodeMap.get(elA.n2);
    if (!nA1 || !nA2) continue;

    const A1: [number, number, number] = [nA1.x, nA1.y, nA1.z];
    const A2: [number, number, number] = [nA2.x, nA2.y, nA2.z];
    const u: [number, number, number] = [A2[0] - A1[0], A2[1] - A1[1], A2[2] - A1[2]];
    const lenA = Math.hypot(u[0], u[1], u[2]);
    if (lenA < 1e-5) continue;

    for (let j = i + 1; j < selectedElements.length; j++) {
      const elB = selectedElements[j];
      const nB1 = nodeMap.get(elB.n1);
      const nB2 = nodeMap.get(elB.n2);
      if (!nB1 || !nB2) continue;

      const B1: [number, number, number] = [nB1.x, nB1.y, nB1.z];
      const B2: [number, number, number] = [nB2.x, nB2.y, nB2.z];
      const v: [number, number, number] = [B2[0] - B1[0], B2[1] - B1[1], B2[2] - B1[2]];
      const lenB = Math.hypot(v[0], v[1], v[2]);
      if (lenB < 1e-5) continue;

      const w0: [number, number, number] = [A1[0] - B1[0], A1[1] - B1[1], A1[2] - B1[2]];

      const a = u[0] * u[0] + u[1] * u[1] + u[2] * u[2]; // lenA^2
      const b = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      const c = v[0] * v[0] + v[1] * v[1] + v[2] * v[2]; // lenB^2
      const d = u[0] * w0[0] + u[1] * w0[1] + u[2] * w0[2];
      const e = v[0] * w0[0] + v[1] * w0[1] + v[2] * w0[2];

      const D = a * c - b * b;

      // 1. Check if segments are non-parallel
      if (D > 1e-12) {
        const s0 = (b * e - c * d) / D;
        const t0 = (a * e - b * d) / D;

        const sc = Math.max(0, Math.min(1, s0));
        const tc = Math.max(0, Math.min(1, t0));

        const pA: [number, number, number] = [
          A1[0] + sc * u[0],
          A1[1] + sc * u[1],
          A1[2] + sc * u[2],
        ];
        const pB: [number, number, number] = [
          B1[0] + tc * v[0],
          B1[1] + tc * v[1],
          B1[2] + tc * v[2],
        ];

        const dist = Math.hypot(pA[0] - pB[0], pA[1] - pB[1], pA[2] - pB[2]);

        if (dist <= tolerance) {
          const midPoint: [number, number, number] = [
            (pA[0] + pB[0]) / 2,
            (pA[1] + pB[1]) / 2,
            (pA[2] + pB[2]) / 2,
          ];

          const epsA = Math.max(1e-5, tolerance / lenA);
          const epsB = Math.max(1e-5, tolerance / lenB);

          const isInternalA = sc > epsA && sc < 1 - epsA;
          const isInternalB = tc > epsB && tc < 1 - epsB;

          // If at least one segment needs splitting at this point
          if (isInternalA || isInternalB) {
            const nodeId = getOrCreateNodeAt(midPoint[0], midPoint[1], midPoint[2]);

            if (isInternalA) {
              addCut(elA.id, sc, nodeId);
            }
            if (isInternalB) {
              addCut(elB.id, tc, nodeId);
            }

            const ptExists = intersectionPoints.some(
              (p) => Math.hypot(p.x - midPoint[0], p.y - midPoint[1], p.z - midPoint[2]) <= tolerance
            );
            if (!ptExists) {
              intersectionPoints.push({ x: midPoint[0], y: midPoint[1], z: midPoint[2] });
            }
          }
        }
      } else {
        // 2. Segments are parallel - check for collinearity and overlapping
        const w1: [number, number, number] = [B1[0] - A1[0], B1[1] - A1[1], B1[2] - A1[2]];
        const sB1 = (w1[0] * u[0] + w1[1] * u[1] + w1[2] * u[2]) / a;
        const projB1: [number, number, number] = [
          A1[0] + sB1 * u[0],
          A1[1] + sB1 * u[1],
          A1[2] + sB1 * u[2],
        ];
        const distB1 = Math.hypot(B1[0] - projB1[0], B1[1] - projB1[1], B1[2] - projB1[2]);

        if (distB1 <= tolerance) {
          // Collinear! Check projection of all 4 points
          const w2: [number, number, number] = [B2[0] - A1[0], B2[1] - A1[1], B2[2] - A1[2]];
          const sB2 = (w2[0] * u[0] + w2[1] * u[1] + w2[2] * u[2]) / a;

          const epsA = Math.max(1e-5, tolerance / lenA);
          if (sB1 > epsA && sB1 < 1 - epsA) {
            const nodeId = getOrCreateNodeAt(B1[0], B1[1], B1[2]);
            addCut(elA.id, sB1, nodeId);
            intersectionPoints.push({ x: B1[0], y: B1[1], z: B1[2] });
          }
          if (sB2 > epsA && sB2 < 1 - epsA) {
            const nodeId = getOrCreateNodeAt(B2[0], B2[1], B2[2]);
            addCut(elA.id, sB2, nodeId);
            intersectionPoints.push({ x: B2[0], y: B2[1], z: B2[2] });
          }

          const epsB = Math.max(1e-5, tolerance / lenB);
          const vA1: [number, number, number] = [A1[0] - B1[0], A1[1] - B1[1], A1[2] - B1[2]];
          const tA1 = (vA1[0] * v[0] + vA1[1] * v[1] + vA1[2] * v[2]) / c;
          if (tA1 > epsB && tA1 < 1 - epsB) {
            const nodeId = getOrCreateNodeAt(A1[0], A1[1], A1[2]);
            addCut(elB.id, tA1, nodeId);
            intersectionPoints.push({ x: A1[0], y: A1[1], z: A1[2] });
          }

          const vA2: [number, number, number] = [A2[0] - B1[0], A2[1] - B1[1], A2[2] - B1[2]];
          const tA2 = (vA2[0] * v[0] + vA2[1] * v[1] + vA2[2] * v[2]) / c;
          if (tA2 > epsB && tA2 < 1 - epsB) {
            const nodeId = getOrCreateNodeAt(A2[0], A2[1], A2[2]);
            addCut(elB.id, tA2, nodeId);
            intersectionPoints.push({ x: A2[0], y: A2[1], z: A2[2] });
          }
        }
      }
    }
  }

  // If no elements need cutting, return result with 0 modifications
  if (cutsByElement.size === 0) {
    return {
      newNodes: [],
      newElements: [],
      removedElementIds: [],
      createdNodeCount: 0,
      splitElementCount: 0,
      newSegmentCount: 0,
      intersectionPointCount: 0,
    };
  }

  const removedElementIds: number[] = [];
  const addedElements: Element3D[] = [];

  // Helper for linear interpolation of distributed load
  const lerp = (v0: number, v1: number, t: number) => v0 + (v1 - v0) * t;

  cutsByElement.forEach((cuts, elemId) => {
    const el = selectedElements.find((e) => e.id === elemId);
    if (!el) return;

    removedElementIds.push(elemId);

    // Sort cuts along the bar
    cuts.sort((a, b) => a.t - b.t);

    // Build the ordered chain of nodes and parameter intervals
    const chain: { t: number; nodeId: number }[] = [
      { t: 0, nodeId: el.n1 },
      ...cuts,
      { t: 1, nodeId: el.n2 },
    ];

    const numSubsegs = chain.length - 1;

    for (let k = 0; k < numSubsegs; k++) {
      const na = chain[k].nodeId;
      const nb = chain[k + 1].nodeId;
      const ta = chain[k].t;
      const tb = chain[k + 1].t;

      if (na === nb) continue;

      const isFirst = k === 0;
      const isLast = k === numSubsegs - 1;

      // 1. Hinges: Start of member inherits original start hinges, end of member inherits original end hinges
      // Intermediate split joints are continuous / rigid (all false)
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

      // 2. Distributed line load interpolation
      let segQ: MemberDistributedLoad3D | null = null;
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

      // 3. New segment element
      const seg: Element3D = {
        id: nextElemId++,
        n1: na,
        n2: nb,
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

  return {
    newNodes: newlyCreatedNodes,
    newElements: addedElements,
    removedElementIds,
    createdNodeCount: newlyCreatedNodes.length,
    splitElementCount: cutsByElement.size,
    newSegmentCount: addedElements.length,
    intersectionPointCount: intersectionPoints.length,
  };
}
