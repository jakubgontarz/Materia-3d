import { Node3D, Element3D, Panel3D } from './types';
import { matVec } from './matrix';
import { computeLocalAxes } from './solver3d';

/**
 * Computes the 3D coordinates of the corners of a panel.
 * For triangle: returns 3 points [C1, C2, C3].
 * For rectangle: returns 4 points [C1, C2, C3, C4] defined by N1 (C1), N2 (C2), and N3 (defining direction & width).
 */
export function getPanelCorners(panel: Panel3D, nodes: Node3D[]): [number, number, number][] {
  const pNodes = panel.nodeIds.map((id) => nodes.find((n) => n.id === id)).filter(Boolean) as Node3D[];

  if (panel.shape === 'triangle') {
    if (pNodes.length < 3) return [];
    return [
      [pNodes[0].x, pNodes[0].y, pNodes[0].z],
      [pNodes[1].x, pNodes[1].y, pNodes[1].z],
      [pNodes[2].x, pNodes[2].y, pNodes[2].z],
    ];
  }

  if (panel.shape === 'rectangle') {
    if (pNodes.length < 3) return [];
    const n1 = pNodes[0];
    const n2 = pNodes[1];
    const n3 = pNodes[2];

    const ux = n2.x - n1.x;
    const uy = n2.y - n1.y;
    const uz = n2.z - n1.z;
    const uLenSq = ux * ux + uy * uy + uz * uz;

    if (uLenSq < 1e-12) {
      return [
        [n1.x, n1.y, n1.z],
        [n2.x, n2.y, n2.z],
        [n3.x, n3.y, n3.z],
        [n3.x, n3.y, n3.z],
      ];
    }

    const vx = n3.x - n1.x;
    const vy = n3.y - n1.y;
    const vz = n3.z - n1.z;

    const dot = (vx * ux + vy * uy + vz * uz) / uLenSq;

    const wx = vx - dot * ux;
    const wy = vy - dot * uy;
    const wz = vz - dot * uz;

    const c1: [number, number, number] = [n1.x, n1.y, n1.z];
    const c2: [number, number, number] = [n2.x, n2.y, n2.z];
    const c3: [number, number, number] = [n2.x + wx, n2.y + wy, n2.z + wz];
    const c4: [number, number, number] = [n1.x + wx, n1.y + wy, n1.z + wz];

    return [c1, c2, c3, c4];
  }

  return [];
}

/**
 * Computes centroid and local orthonormal axes (vx, vy, vz) for a panel.
 * vx is along Edge C1 -> C2 (local x).
 * vz is normal to the panel surface.
 * vy = vz x vx (local y).
 */
export function computePanelLocalAxes(panel: Panel3D, nodes: Node3D[]): {
  centroid: [number, number, number];
  vx: [number, number, number];
  vy: [number, number, number];
  vz: [number, number, number];
} | null {
  const corners = getPanelCorners(panel, nodes);
  if (corners.length < 3) return null;

  const N = corners.length;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < N; i++) {
    cx += corners[i][0];
    cy += corners[i][1];
    cz += corners[i][2];
  }
  cx /= N; cy /= N; cz /= N;

  const [c1, c2, c3] = corners;

  // Local x = direction C1 -> C2
  let dx1 = c2[0] - c1[0];
  let dy1 = c2[1] - c1[1];
  let dz1 = c2[2] - c1[2];
  let len1 = Math.hypot(dx1, dy1, dz1);
  if (len1 < 1e-8) { dx1 = 1; dy1 = 0; dz1 = 0; len1 = 1; }
  const vx: [number, number, number] = [dx1 / len1, dy1 / len1, dz1 / len1];

  // Vector v = C1 -> C3
  const dx2 = c3[0] - c1[0];
  const dy2 = c3[1] - c1[1];
  const dz2 = c3[2] - c1[2];

  // vz = normal = vx x v
  let nx = vx[1] * dz2 - vx[2] * dy2;
  let ny = vx[2] * dx2 - vx[0] * dz2;
  let nz = vx[0] * dy2 - vx[1] * dx2;
  let nLen = Math.hypot(nx, ny, nz);
  if (nLen < 1e-8) { nx = 0; ny = 0; nz = 1; nLen = 1; }
  const vz: [number, number, number] = [nx / nLen, ny / nLen, nz / nLen];

  // vy = vz x vx
  const vyx = vz[1] * vx[2] - vz[2] * vx[1];
  const vyy = vz[2] * vx[0] - vz[0] * vx[2];
  const vyz = vz[0] * vx[1] - vz[1] * vx[0];
  const vy: [number, number, number] = [vyx, vyy, vyz];

  return { centroid: [cx, cy, cz], vx, vy, vz };
}

interface EdgeMatchingResult {
  matchingElements: { elIndex: number; t1: number; t2: number }[];
  coveredFraction: number;
}

/**
 * Finds all elements that lie along the line segment from pA to pB.
 */
function findMatchingElementsOnEdge(
  pA: [number, number, number],
  pB: [number, number, number],
  elements: Element3D[],
  nodes: Node3D[],
  tol = 0.005
): EdgeMatchingResult {
  const ux = pB[0] - pA[0];
  const uy = pB[1] - pA[1];
  const uz = pB[2] - pA[2];
  const edgeLenSq = ux * ux + uy * uy + uz * uz;
  const edgeLen = Math.sqrt(edgeLenSq);
  if (edgeLen < 1e-6) {
    return { matchingElements: [], coveredFraction: 0 };
  }

  const matching: { elIndex: number; t1: number; t2: number }[] = [];
  let totalCovered = 0;

  for (let eIdx = 0; eIdx < elements.length; eIdx++) {
    const el = elements[eIdx];
    const n1 = nodes.find((n) => n.id === el.n1);
    const n2 = nodes.find((n) => n.id === el.n2);
    if (!n1 || !n2) continue;

    // Project n1 and n2 onto segment pA -> pB
    const v1x = n1.x - pA[0];
    const v1y = n1.y - pA[1];
    const v1z = n1.z - pA[2];
    const t1 = (v1x * ux + v1y * uy + v1z * uz) / edgeLenSq;
    const proj1x = pA[0] + t1 * ux;
    const proj1y = pA[1] + t1 * uy;
    const proj1z = pA[2] + t1 * uz;
    const dist1 = Math.hypot(n1.x - proj1x, n1.y - proj1y, n1.z - proj1z);

    const v2x = n2.x - pA[0];
    const v2y = n2.y - pA[1];
    const v2z = n2.z - pA[2];
    const t2 = (v2x * ux + v2y * uy + v2z * uz) / edgeLenSq;
    const proj2x = pA[0] + t2 * ux;
    const proj2y = pA[1] + t2 * uy;
    const proj2z = pA[2] + t2 * uz;
    const dist2 = Math.hypot(n2.x - proj2x, n2.y - proj2y, n2.z - proj2z);

    const epsT = tol / edgeLen;
    if (dist1 <= tol && dist2 <= tol && t1 >= -epsT && t1 <= 1 + epsT && t2 >= -epsT && t2 <= 1 + epsT) {
      const segT1 = Math.max(0, Math.min(1, t1));
      const segT2 = Math.max(0, Math.min(1, t2));
      const span = Math.abs(segT2 - segT1);
      if (span > 1e-4) {
        matching.push({ elIndex: eIdx, t1: segT1, t2: segT2 });
        totalCovered += span;
      }
    }
  }

  return { matchingElements: matching, coveredFraction: Math.min(1, totalCovered) };
}

/**
 * Superimposes a global distributed load qGlobal [qx, qy, qz] (kN/m) onto an element's existing load.
 */
function addDistributedLoadToElement(
  el: Element3D,
  qGlobal: [number, number, number],
  nodes: Node3D[]
) {
  if (!el.q) {
    el.q = {
      coordinateSystem: 'global',
      qxStart: qGlobal[0],
      qxEnd: qGlobal[0],
      qyStart: qGlobal[1],
      qyEnd: qGlobal[1],
      qzStart: qGlobal[2],
      qzEnd: qGlobal[2],
    };
  } else if (el.q.coordinateSystem === 'global') {
    el.q.qxStart += qGlobal[0];
    el.q.qxEnd += qGlobal[0];
    el.q.qyStart += qGlobal[1];
    el.q.qyEnd += qGlobal[1];
    el.q.qzStart += qGlobal[2];
    el.q.qzEnd += qGlobal[2];
  } else {
    // Local coordinate system: transform qGlobal to local element axes
    const n1 = nodes.find((n) => n.id === el.n1);
    const n2 = nodes.find((n) => n.id === el.n2);
    if (n1 && n2) {
      const axes = computeLocalAxes(n1, n2, el.rollAngle || 0);
      const qLoc = matVec(axes.R, qGlobal);
      el.q.qxStart += qLoc[0];
      el.q.qxEnd += qLoc[0];
      el.q.qyStart += qLoc[1];
      el.q.qyEnd += qLoc[1];
      el.q.qzStart += qLoc[2];
      el.q.qzEnd += qLoc[2];
    }
  }
}

interface CornerForceAccumulator {
  corner: [number, number, number];
  force: [number, number, number];
  adjacentCorners: [number, number, number][];
}

/**
 * Transfers a concentrated point force accumulated at a panel corner onto physical nodes.
 * If a physical node exists at the corner, applies force directly.
 * Otherwise, transfers along the adjacent edge lines to the nearest physical nodes proportionally.
 */
function transferCornerForceToNodes(
  cf: CornerForceAccumulator,
  nodes: Node3D[],
  tol = 0.005
) {
  const fx = cf.force[0];
  const fy = cf.force[1];
  const fz = cf.force[2];
  if (Math.abs(fx) < 1e-10 && Math.abs(fy) < 1e-10 && Math.abs(fz) < 1e-10) return;

  const [cx, cy, cz] = cf.corner;

  // 1. Exact physical node match at this corner
  const exactNode = nodes.find((n) => Math.hypot(n.x - cx, n.y - cy, n.z - cz) <= tol);
  if (exactNode) {
    if (!exactNode.force) {
      exactNode.force = { Fx: fx, Fy: fy, Fz: fz };
    } else {
      exactNode.force.Fx = (exactNode.force.Fx || 0) + fx;
      exactNode.force.Fy = (exactNode.force.Fy || 0) + fy;
      exactNode.force.Fz = (exactNode.force.Fz || 0) + fz;
    }
    return;
  }

  // 2. No physical node at this corner -> Search along adjacent edge rays for nearest physical nodes
  const rayHits: { node: Node3D; dist: number }[] = [];

  for (const adj of cf.adjacentCorners) {
    const rUx = adj[0] - cx;
    const rUy = adj[1] - cy;
    const rUz = adj[2] - cz;
    const rayLenSq = rUx * rUx + rUy * rUy + rUz * rUz;
    const rayLen = Math.sqrt(rayLenSq);
    if (rayLen < 1e-6) continue;

    let closestNode: Node3D | null = null;
    let closestDist = Infinity;

    for (const n of nodes) {
      const vNx = n.x - cx;
      const vNy = n.y - cy;
      const vNz = n.z - cz;
      const t = (vNx * rUx + vNy * rUy + vNz * rUz) / rayLenSq;
      if (t > 1e-4) {
        const projX = cx + t * rUx;
        const projY = cy + t * rUy;
        const projZ = cz + t * rUz;
        const dLine = Math.hypot(n.x - projX, n.y - projY, n.z - projZ);
        if (dLine <= tol) {
          const dDist = t * rayLen;
          if (dDist < closestDist) {
            closestDist = dDist;
            closestNode = n;
          }
        }
      }
    }

    if (closestNode) {
      rayHits.push({ node: closestNode, dist: closestDist });
    }
  }

  if (rayHits.length >= 2) {
    // Distribute inversely proportional to distance between the two adjacent directions
    const d1 = rayHits[0].dist;
    const d2 = rayHits[1].dist;
    const sumD = d1 + d2;
    const w1 = sumD > 1e-6 ? d2 / sumD : 0.5;
    const w2 = sumD > 1e-6 ? d1 / sumD : 0.5;

    const n1 = rayHits[0].node;
    const n2 = rayHits[1].node;

    if (!n1.force) n1.force = { Fx: 0, Fy: 0, Fz: 0 };
    n1.force.Fx = (n1.force.Fx || 0) + w1 * fx;
    n1.force.Fy = (n1.force.Fy || 0) + w1 * fy;
    n1.force.Fz = (n1.force.Fz || 0) + w1 * fz;

    if (!n2.force) n2.force = { Fx: 0, Fy: 0, Fz: 0 };
    n2.force.Fx = (n2.force.Fx || 0) + w2 * fx;
    n2.force.Fy = (n2.force.Fy || 0) + w2 * fy;
    n2.force.Fz = (n2.force.Fz || 0) + w2 * fz;
  } else if (rayHits.length === 1) {
    const n = rayHits[0].node;
    if (!n.force) n.force = { Fx: 0, Fy: 0, Fz: 0 };
    n.force.Fx = (n.force.Fx || 0) + fx;
    n.force.Fy = (n.force.Fy || 0) + fy;
    n.force.Fz = (n.force.Fz || 0) + fz;
  } else {
    // Fallback: assign to the closest node in the entire model
    let bestNode = nodes[0];
    let bestDist = Infinity;
    for (const n of nodes) {
      const d = Math.hypot(n.x - cx, n.y - cy, n.z - cz);
      if (d < bestDist) {
        bestDist = d;
        bestNode = n;
      }
    }
    if (bestNode) {
      if (!bestNode.force) bestNode.force = { Fx: 0, Fy: 0, Fz: 0 };
      bestNode.force.Fx = (bestNode.force.Fx || 0) + fx;
      bestNode.force.Fy = (bestNode.force.Fy || 0) + fy;
      bestNode.force.Fz = (bestNode.force.Fz || 0) + fz;
    }
  }
}

/**
 * Pre-processes panel pressure loads and transfers them onto the structural model
 * (as continuous member loads on coinciding bars, or as concentrated forces on physical nodes).
 *
 * Rules:
 * - Triangular Panels: Tributary Area method (incenter bisector partition).
 *   - Edges with coinciding bars receive continuous load q = F_edge / L.
 *   - Edges without bars distribute their load equally as point forces to the corner nodes.
 * - Rectangular Panels: Defined by 3 nodes (base edge + width/direction).
 *   - Tributary Area method with distribution mode ('two_way', 'one_way_x', 'one_way_y').
 *   - Edges with coinciding bars receive continuous load q = F_edge / L.
 *   - Edges without bars distribute their load equally to corner vertices.
 *   - Vertices without physical nodes transfer accumulated point forces to nearest physical nodes along edge trace lines.
 *
 * Total transferred load is strictly equivalent to the original pressure load (100% force equilibrium).
 */
export function distributePanelLoads(
  inputNodes: Node3D[],
  inputElements: Element3D[],
  panels: Panel3D[] = []
): { nodes: Node3D[]; elements: Element3D[] } {
  // Deep clone nodes and elements so the original UI/state is 100% untouched
  const nodes: Node3D[] = inputNodes.map((n) => ({
    ...n,
    support: n.support ? { ...n.support } : null,
    force: n.force ? { ...n.force } : null,
    moment: n.moment ? { ...n.moment } : null,
    mass: n.mass ? { ...n.mass } : null,
  }));

  const elements: Element3D[] = inputElements.map((e) => ({
    ...e,
    q: e.q ? { ...e.q } : null,
    hinges: e.hinges ? { ...e.hinges } : undefined,
  }));

  if (!panels || panels.length === 0) {
    return { nodes, elements };
  }

  for (const panel of panels) {
    if (!panel.pressure || Math.abs(panel.pressure.value) < 1e-6) {
      continue;
    }

    const axes = computePanelLocalAxes(panel, nodes);
    if (!axes) continue;

    const corners = getPanelCorners(panel, nodes);
    if (corners.length < 3) continue;

    const val = panel.pressure.value;
    const pDir = panel.pressure.dir;

    let dirVec: [number, number, number] = [0, 0, 0];
    if (pDir === 'normal') {
      // Inward normal to panel surface
      dirVec = [-axes.vz[0], -axes.vz[1], -axes.vz[2]];
    } else if (pDir === 'X') {
      dirVec = [1, 0, 0];
    } else if (pDir === 'Y') {
      dirVec = [0, 1, 0];
    } else if (pDir === 'Z') {
      dirVec = [0, 0, 1];
    }

    // Pressure vector: kN/m² in global space
    const pVec: [number, number, number] = [
      val * dirVec[0],
      val * dirVec[1],
      val * dirVec[2],
    ];

    if (panel.shape === 'triangle' && corners.length === 3) {
      const [v1, v2, v3] = corners;

      // Triangle Area
      const e1x = v2[0] - v1[0], e1y = v2[1] - v1[1], e1z = v2[2] - v1[2];
      const e2x = v3[0] - v1[0], e2y = v3[1] - v1[1], e2z = v3[2] - v1[2];
      const cx = e1y * e2z - e1z * e2y;
      const cy = e1z * e2x - e1x * e2z;
      const cz = e1x * e2y - e1y * e2x;
      const area = 0.5 * Math.hypot(cx, cy, cz);
      if (area < 1e-6) continue;

      const L1 = Math.hypot(v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]);
      const L2 = Math.hypot(v3[0] - v2[0], v3[1] - v2[1], v3[2] - v2[2]);
      const L3 = Math.hypot(v1[0] - v3[0], v1[1] - v3[1], v1[2] - v3[2]);
      const Lsum = L1 + L2 + L3;
      if (Lsum < 1e-6) continue;

      // Tributary areas per edge (incenter method: A_i = L_i / L_sum * area)
      const edgeDefs = [
        { pA: v1, pB: v2, len: L1, A: (L1 / Lsum) * area, cAIdx: 0, cBIdx: 1 },
        { pA: v2, pB: v3, len: L2, A: (L2 / Lsum) * area, cAIdx: 1, cBIdx: 2 },
        { pA: v3, pB: v1, len: L3, A: (L3 / Lsum) * area, cAIdx: 2, cBIdx: 0 },
      ];

      const cornerForces: [number, number, number][] = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];

      for (const edge of edgeDefs) {
        const edgeForce: [number, number, number] = [
          edge.A * pVec[0],
          edge.A * pVec[1],
          edge.A * pVec[2],
        ];

        const match = findMatchingElementsOnEdge(edge.pA, edge.pB, elements, nodes);
        if (match.matchingElements.length > 0) {
          const qEdge: [number, number, number] = [
            edgeForce[0] / edge.len,
            edgeForce[1] / edge.len,
            edgeForce[2] / edge.len,
          ];
          for (const m of match.matchingElements) {
            addDistributedLoadToElement(elements[m.elIndex], qEdge, nodes);
          }
        }

        // Remaining uncovered fraction goes to corner points
        const uncovered = 1.0 - match.coveredFraction;
        if (uncovered > 1e-4) {
          const halfF: [number, number, number] = [
            0.5 * uncovered * edgeForce[0],
            0.5 * uncovered * edgeForce[1],
            0.5 * uncovered * edgeForce[2],
          ];
          cornerForces[edge.cAIdx][0] += halfF[0];
          cornerForces[edge.cAIdx][1] += halfF[1];
          cornerForces[edge.cAIdx][2] += halfF[2];

          cornerForces[edge.cBIdx][0] += halfF[0];
          cornerForces[edge.cBIdx][1] += halfF[1];
          cornerForces[edge.cBIdx][2] += halfF[2];
        }
      }

      // Transfer corner forces to physical nodes
      for (let cIdx = 0; cIdx < 3; cIdx++) {
        const cPrev = (cIdx + 2) % 3;
        const cNext = (cIdx + 1) % 3;
        transferCornerForceToNodes(
          {
            corner: corners[cIdx],
            force: cornerForces[cIdx],
            adjacentCorners: [corners[cPrev], corners[cNext]],
          },
          nodes
        );
      }
    } else if (panel.shape === 'rectangle' && corners.length === 4) {
      const [c1, c2, c3, c4] = corners;
      const Lx = Math.hypot(c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]);
      const Ly = Math.hypot(c4[0] - c1[0], c4[1] - c1[1], c4[2] - c1[2]);
      const totalArea = Lx * Ly;
      if (totalArea < 1e-6) continue;

      const dirMode = panel.loadTransferDir || 'two_way';

      // Check which corners correspond to physical nodes in the structural model
      const tol = 0.005;
      const nodeAtC1 = nodes.find((n) => Math.hypot(n.x - c1[0], n.y - c1[1], n.z - c1[2]) <= tol);
      const nodeAtC2 = nodes.find((n) => Math.hypot(n.x - c2[0], n.y - c2[1], n.z - c2[2]) <= tol);
      const nodeAtC3 = nodes.find((n) => Math.hypot(n.x - c3[0], n.y - c3[1], n.z - c3[2]) <= tol);
      const nodeAtC4 = nodes.find((n) => Math.hypot(n.x - c4[0], n.y - c4[1], n.z - c4[2]) <= tol);

      const onlyC1C2Physical = nodeAtC1 && nodeAtC2 && !nodeAtC3 && !nodeAtC4;

      // Special case: Panel has only 2 physical nodes at vertices C1 and C2 (e.g. single supporting beam / cantilever panel)
      if (onlyC1C2Physical) {
        const totalF: [number, number, number] = [
          totalArea * pVec[0],
          totalArea * pVec[1],
          totalArea * pVec[2],
        ];

        if (dirMode === 'one_way_x') {
          // Span along X: load transfers to the two lateral supports (half to N1, half to N2)
          const halfF: [number, number, number] = [
            0.5 * totalF[0],
            0.5 * totalF[1],
            0.5 * totalF[2],
          ];
          if (!nodeAtC1.force) nodeAtC1.force = { Fx: 0, Fy: 0, Fz: 0 };
          nodeAtC1.force.Fx = (nodeAtC1.force.Fx || 0) + halfF[0];
          nodeAtC1.force.Fy = (nodeAtC1.force.Fy || 0) + halfF[1];
          nodeAtC1.force.Fz = (nodeAtC1.force.Fz || 0) + halfF[2];

          if (!nodeAtC2.force) nodeAtC2.force = { Fx: 0, Fy: 0, Fz: 0 };
          nodeAtC2.force.Fx = (nodeAtC2.force.Fx || 0) + halfF[0];
          nodeAtC2.force.Fy = (nodeAtC2.force.Fy || 0) + halfF[1];
          nodeAtC2.force.Fz = (nodeAtC2.force.Fz || 0) + halfF[2];
        } else {
          // 'one_way_y' or 'two_way': load spans to Edge 1 (C1->C2).
          // 100% of panel load goes onto the member along Edge 1 as continuous load q = F_total / Lx = Ly * p
          const match1 = findMatchingElementsOnEdge(c1, c2, elements, nodes, tol);
          if (match1.matchingElements.length > 0) {
            const qEdge: [number, number, number] = [
              totalF[0] / Lx,
              totalF[1] / Lx,
              totalF[2] / Lx,
            ];
            for (const m of match1.matchingElements) {
              addDistributedLoadToElement(elements[m.elIndex], qEdge, nodes);
            }
            const uncovered = 1.0 - match1.coveredFraction;
            if (uncovered > 1e-4) {
              const uncHalf: [number, number, number] = [
                0.5 * uncovered * totalF[0],
                0.5 * uncovered * totalF[1],
                0.5 * uncovered * totalF[2],
              ];
              if (!nodeAtC1.force) nodeAtC1.force = { Fx: 0, Fy: 0, Fz: 0 };
              nodeAtC1.force.Fx = (nodeAtC1.force.Fx || 0) + uncHalf[0];
              nodeAtC1.force.Fy = (nodeAtC1.force.Fy || 0) + uncHalf[1];
              nodeAtC1.force.Fz = (nodeAtC1.force.Fz || 0) + uncHalf[2];

              if (!nodeAtC2.force) nodeAtC2.force = { Fx: 0, Fy: 0, Fz: 0 };
              nodeAtC2.force.Fx = (nodeAtC2.force.Fx || 0) + uncHalf[0];
              nodeAtC2.force.Fy = (nodeAtC2.force.Fy || 0) + uncHalf[1];
              nodeAtC2.force.Fz = (nodeAtC2.force.Fz || 0) + uncHalf[2];
            }
          } else {
            // No member on Edge 1: split 50/50 to N1 and N2
            const halfF: [number, number, number] = [
              0.5 * totalF[0],
              0.5 * totalF[1],
              0.5 * totalF[2],
            ];
            if (!nodeAtC1.force) nodeAtC1.force = { Fx: 0, Fy: 0, Fz: 0 };
            nodeAtC1.force.Fx = (nodeAtC1.force.Fx || 0) + halfF[0];
            nodeAtC1.force.Fy = (nodeAtC1.force.Fy || 0) + halfF[1];
            nodeAtC1.force.Fz = (nodeAtC1.force.Fz || 0) + halfF[2];

            if (!nodeAtC2.force) nodeAtC2.force = { Fx: 0, Fy: 0, Fz: 0 };
            nodeAtC2.force.Fx = (nodeAtC2.force.Fx || 0) + halfF[0];
            nodeAtC2.force.Fy = (nodeAtC2.force.Fy || 0) + halfF[1];
            nodeAtC2.force.Fz = (nodeAtC2.force.Fz || 0) + halfF[2];
          }
        }
        continue;
      }

      // General case: 3 or 4 physical nodes / general bounding frame
      let A1 = 0, A2 = 0, A3 = 0, A4 = 0;

      if (dirMode === 'one_way_x') {
        // Load spans in X direction -> supported at X ends (Edge 2 [C2->C3] and Edge 4 [C4->C1])
        A2 = 0.5 * totalArea;
        A4 = 0.5 * totalArea;
        A1 = 0;
        A3 = 0;
      } else if (dirMode === 'one_way_y') {
        // Load spans in Y direction -> supported at Y ends (Edge 1 [C1->C2] and Edge 3 [C3->C4])
        A1 = 0.5 * totalArea;
        A3 = 0.5 * totalArea;
        A2 = 0;
        A4 = 0;
      } else {
        // Two-way tributary area (45-degree bisectors)
        if (Lx >= Ly) {
          A2 = 0.25 * Ly * Ly;
          A4 = 0.25 * Ly * Ly;
          A1 = 0.5 * totalArea - A2;
          A3 = 0.5 * totalArea - A4;
        } else {
          A1 = 0.25 * Lx * Lx;
          A3 = 0.25 * Lx * Lx;
          A2 = 0.5 * totalArea - A1;
          A4 = 0.5 * totalArea - A3;
        }
      }

      const edgeDefs = [
        { pA: c1, pB: c2, len: Lx, A: A1, cAIdx: 0, cBIdx: 1 },
        { pA: c2, pB: c3, len: Ly, A: A2, cAIdx: 1, cBIdx: 2 },
        { pA: c3, pB: c4, len: Lx, A: A3, cAIdx: 2, cBIdx: 3 },
        { pA: c4, pB: c1, len: Ly, A: A4, cAIdx: 3, cBIdx: 0 },
      ];

      const cornerForces: [number, number, number][] = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ];

      for (const edge of edgeDefs) {
        if (edge.A <= 1e-8 || edge.len < 1e-6) continue;

        const edgeForce: [number, number, number] = [
          edge.A * pVec[0],
          edge.A * pVec[1],
          edge.A * pVec[2],
        ];

        const match = findMatchingElementsOnEdge(edge.pA, edge.pB, elements, nodes, tol);
        if (match.matchingElements.length > 0) {
          const qEdge: [number, number, number] = [
            edgeForce[0] / edge.len,
            edgeForce[1] / edge.len,
            edgeForce[2] / edge.len,
          ];
          for (const m of match.matchingElements) {
            addDistributedLoadToElement(elements[m.elIndex], qEdge, nodes);
          }
        }

        const uncovered = 1.0 - match.coveredFraction;
        if (uncovered > 1e-4) {
          const halfF: [number, number, number] = [
            0.5 * uncovered * edgeForce[0],
            0.5 * uncovered * edgeForce[1],
            0.5 * uncovered * edgeForce[2],
          ];
          cornerForces[edge.cAIdx][0] += halfF[0];
          cornerForces[edge.cAIdx][1] += halfF[1];
          cornerForces[edge.cAIdx][2] += halfF[2];

          cornerForces[edge.cBIdx][0] += halfF[0];
          cornerForces[edge.cBIdx][1] += halfF[1];
          cornerForces[edge.cBIdx][2] += halfF[2];
        }
      }

      // Transfer corner forces to physical nodes
      for (let cIdx = 0; cIdx < 4; cIdx++) {
        const cPrev = (cIdx + 3) % 4;
        const cNext = (cIdx + 1) % 4;
        transferCornerForceToNodes(
          {
            corner: corners[cIdx],
            force: cornerForces[cIdx],
            adjacentCorners: [corners[cPrev], corners[cNext]],
          },
          nodes,
          tol
        );
      }
    }
  }

  return { nodes, elements };
}
