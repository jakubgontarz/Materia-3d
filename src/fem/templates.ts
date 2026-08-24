import { Node3D, Element3D, Support3D } from './types';

const fixedSupport3D: Support3D = {
  ux: { type: 'fixed' },
  uy: { type: 'fixed' },
  uz: { type: 'fixed' },
  rx: { type: 'fixed' },
  ry: { type: 'fixed' },
  rz: { type: 'fixed' },
};

const pinnedSupport3D: Support3D = {
  ux: { type: 'fixed' },
  uy: { type: 'fixed' },
  uz: { type: 'fixed' },
  rx: { type: 'free' },
  ry: { type: 'free' },
  rz: { type: 'free' },
};

export function generate3DPortalFrame(
  bayX = 6.0,
  bayY = 6.0,
  height = 4.0,
  numBaysX = 2,
  numBaysY = 2,
  defaultSectionId = 1,
  defaultMaterialId = 1
): { nodes: Node3D[]; elements: Element3D[] } {
  const nodes: Node3D[] = [];
  const elements: Element3D[] = [];
  let nextNodeId = 1;
  let nextElemId = 1;

  const nodeGrid: number[][][] = []; // [ix][iy][iz] (iz = 0: foundation, iz = 1: roof)

  for (let ix = 0; ix <= numBaysX; ix++) {
    nodeGrid[ix] = [];
    for (let iy = 0; iy <= numBaysY; iy++) {
      nodeGrid[ix][iy] = [];
      const x = ix * bayX;
      const y = iy * bayY;

      // Base node (z=0)
      const baseId = nextNodeId++;
      nodes.push({
        id: baseId,
        x,
        y,
        z: 0,
        support: JSON.parse(JSON.stringify(fixedSupport3D)),
        force: null,
        moment: null,
        mass: null,
      });
      nodeGrid[ix][iy][0] = baseId;

      // Top node (z=height)
      const topId = nextNodeId++;
      nodes.push({
        id: topId,
        x,
        y,
        z: height,
        support: null,
        force: { Fx: 0, Fy: 0, Fz: -25.0 }, // vertical downward load
        moment: null,
        mass: { mx: 2500, my: 2500, mz: 2500 },
      });
      nodeGrid[ix][iy][1] = topId;

      // Vertical Column Element
      elements.push({
        id: nextElemId++,
        n1: baseId,
        n2: topId,
        sectionId: defaultSectionId,
        materialId: defaultMaterialId,
        rollAngle: 0,
        hinges: {},
        q: null,
        thermal: null,
      });
    }
  }

  // Beams along X at roof level
  for (let iy = 0; iy <= numBaysY; iy++) {
    for (let ix = 0; ix < numBaysX; ix++) {
      const n1 = nodeGrid[ix][iy][1];
      const n2 = nodeGrid[ix + 1][iy][1];
      elements.push({
        id: nextElemId++,
        n1,
        n2,
        sectionId: defaultSectionId,
        materialId: defaultMaterialId,
        rollAngle: 0,
        hinges: {},
        q: { coordinateSystem: 'global', qxStart: 0, qxEnd: 0, qyStart: 0, qyEnd: 0, qzStart: -12.0, qzEnd: -12.0 },
        thermal: null,
      });
    }
  }

  // Beams along Y at roof level
  for (let ix = 0; ix <= numBaysX; ix++) {
    for (let iy = 0; iy < numBaysY; iy++) {
      const n1 = nodeGrid[ix][iy][1];
      const n2 = nodeGrid[ix][iy + 1][1];
      elements.push({
        id: nextElemId++,
        n1,
        n2,
        sectionId: defaultSectionId,
        materialId: defaultMaterialId,
        rollAngle: 90,
        hinges: {},
        q: { coordinateSystem: 'global', qxStart: 0, qxEnd: 0, qyStart: 0, qyEnd: 0, qzStart: -8.0, qzEnd: -8.0 },
        thermal: null,
      });
    }
  }

  return { nodes, elements };
}

export function generate3DTrussTower(
  baseWidth = 4.0,
  topWidth = 2.0,
  totalHeight = 12.0,
  stories = 4,
  defaultSectionId = 1,
  defaultMaterialId = 1
): { nodes: Node3D[]; elements: Element3D[] } {
  const nodes: Node3D[] = [];
  const elements: Element3D[] = [];
  let nextNodeId = 1;
  let nextElemId = 1;

  const storyNodes: number[][] = []; // [story][0..3 corners]

  for (let s = 0; s <= stories; s++) {
    const t = s / stories;
    const z = t * totalHeight;
    const w = baseWidth + (topWidth - baseWidth) * t;
    const hw = w / 2;

    const corners = [
      [-hw, -hw],
      [hw, -hw],
      [hw, hw],
      [-hw, hw],
    ];

    const currentCorners: number[] = [];
    corners.forEach(([x, y]) => {
      const id = nextNodeId++;
      nodes.push({
        id,
        x,
        y,
        z,
        support: s === 0 ? JSON.parse(JSON.stringify(pinnedSupport3D)) : null,
        force: s === stories ? { Fx: 15.0, Fy: 10.0, Fz: -30.0 } : null,
        moment: null,
        mass: { mx: 1000, my: 1000, mz: 1000 },
      });
      currentCorners.push(id);
    });
    storyNodes.push(currentCorners);
  }

  // Horizontal perimeter rings
  for (let s = 0; s <= stories; s++) {
    for (let i = 0; i < 4; i++) {
      const n1 = storyNodes[s][i];
      const n2 = storyNodes[s][(i + 1) % 4];
      elements.push({
        id: nextElemId++,
        n1,
        n2,
        sectionId: defaultSectionId,
        materialId: defaultMaterialId,
        rollAngle: 0,
        hinges: { start_rx: true, start_ry: true, start_rz: true, end_rx: true, end_ry: true, end_rz: true },
        q: null,
        thermal: null,
      });
    }
  }

  // Vertical legs & X-bracings
  for (let s = 0; s < stories; s++) {
    for (let i = 0; i < 4; i++) {
      const b1 = storyNodes[s][i];
      const b2 = storyNodes[s][(i + 1) % 4];
      const t1 = storyNodes[s + 1][i];
      const t2 = storyNodes[s + 1][(i + 1) % 4];

      // Vertical leg
      elements.push({
        id: nextElemId++,
        n1: b1,
        n2: t1,
        sectionId: defaultSectionId,
        materialId: defaultMaterialId,
        rollAngle: 0,
        hinges: {},
        q: null,
        thermal: null,
      });

      // Diagonal X1
      elements.push({
        id: nextElemId++,
        n1: b1,
        n2: t2,
        sectionId: defaultSectionId,
        materialId: defaultMaterialId,
        rollAngle: 0,
        hinges: { start_rx: true, start_ry: true, start_rz: true, end_rx: true, end_ry: true, end_rz: true },
        q: null,
        thermal: null,
      });

      // Diagonal X2
      elements.push({
        id: nextElemId++,
        n1: b2,
        n2: t1,
        sectionId: defaultSectionId,
        materialId: defaultMaterialId,
        rollAngle: 0,
        hinges: { start_rx: true, start_ry: true, start_rz: true, end_rx: true, end_ry: true, end_rz: true },
        q: null,
        thermal: null,
      });
    }
  }

  return { nodes, elements };
}

export function generate3DGrillage(
  widthX = 8.0,
  widthY = 8.0,
  divX = 4,
  divY = 4,
  defaultSectionId = 1,
  defaultMaterialId = 1
): { nodes: Node3D[]; elements: Element3D[] } {
  const nodes: Node3D[] = [];
  const elements: Element3D[] = [];
  let nextNodeId = 1;
  let nextElemId = 1;

  const grid: number[][] = [];
  const dx = widthX / divX;
  const dy = widthY / divY;

  for (let ix = 0; ix <= divX; ix++) {
    grid[ix] = [];
    for (let iy = 0; iy <= divY; iy++) {
      const x = ix * dx;
      const y = iy * dy;
      const id = nextNodeId++;

      // Support at corners
      const isCorner =
        (ix === 0 && iy === 0) ||
        (ix === divX && iy === 0) ||
        (ix === 0 && iy === divY) ||
        (ix === divX && iy === divY);

      nodes.push({
        id,
        x,
        y,
        z: 0,
        support: isCorner ? JSON.parse(JSON.stringify(pinnedSupport3D)) : null,
        force: !isCorner ? { Fx: 0, Fy: 0, Fz: -15.0 } : null,
        moment: null,
        mass: { mx: 1200, my: 1200, mz: 1200 },
      });
      grid[ix][iy] = id;
    }
  }

  // Beams along X
  for (let iy = 0; iy <= divY; iy++) {
    for (let ix = 0; ix < divX; ix++) {
      elements.push({
        id: nextElemId++,
        n1: grid[ix][iy],
        n2: grid[ix + 1][iy],
        sectionId: defaultSectionId,
        materialId: defaultMaterialId,
        rollAngle: 0,
        hinges: {},
        q: null,
        thermal: null,
      });
    }
  }

  // Beams along Y
  for (let ix = 0; ix <= divX; ix++) {
    for (let iy = 0; iy < divY; iy++) {
      elements.push({
        id: nextElemId++,
        n1: grid[ix][iy],
        n2: grid[ix][iy + 1],
        sectionId: defaultSectionId,
        materialId: defaultMaterialId,
        rollAngle: 0,
        hinges: {},
        q: null,
        thermal: null,
      });
    }
  }

  return { nodes, elements };
}

export function generate2DPortalFrame(
  span = 6.0,
  height = 4.0,
  defaultSectionId = 1,
  defaultMaterialId = 1
): { nodes: Node3D[]; elements: Element3D[] } {
  const nodes: Node3D[] = [
    {
      id: 1,
      x: 0,
      y: 0,
      z: 0,
      support: JSON.parse(JSON.stringify(fixedSupport3D)),
      force: null,
      moment: null,
      mass: null,
    },
    {
      id: 2,
      x: 0,
      y: 0,
      z: height,
      support: null,
      force: { Fx: 10.0, Fy: 0, Fz: 0 },
      moment: null,
      mass: { mx: 2000, my: 2000, mz: 2000 },
    },
    {
      id: 3,
      x: span,
      y: 0,
      z: height,
      support: null,
      force: null,
      moment: null,
      mass: { mx: 2000, my: 2000, mz: 2000 },
    },
    {
      id: 4,
      x: span,
      y: 0,
      z: 0,
      support: JSON.parse(JSON.stringify(fixedSupport3D)),
      force: null,
      moment: null,
      mass: null,
    },
  ];

  const elements: Element3D[] = [
    {
      id: 1,
      n1: 1,
      n2: 2,
      sectionId: defaultSectionId,
      materialId: defaultMaterialId,
      rollAngle: 0,
      hinges: {},
      q: null,
      thermal: null,
    },
    {
      id: 2,
      n1: 2,
      n2: 3,
      sectionId: defaultSectionId,
      materialId: defaultMaterialId,
      rollAngle: 0,
      hinges: {},
      q: { coordinateSystem: 'global', qxStart: 0, qxEnd: 0, qyStart: 0, qyEnd: 0, qzStart: -20.0, qzEnd: -20.0 },
      thermal: null,
    },
    {
      id: 3,
      n1: 4,
      n2: 3,
      sectionId: defaultSectionId,
      materialId: defaultMaterialId,
      rollAngle: 0,
      hinges: {},
      q: null,
      thermal: null,
    },
  ];

  return { nodes, elements };
}
