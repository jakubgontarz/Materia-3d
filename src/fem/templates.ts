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

  // Horizontal perimeter rings (rigid frames / diaphragms ensuring square cross-section stability)
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
        hinges: {},
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

      // Vertical leg (continuous column)
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

      // Diagonal X1 (pin-connected truss member: bending released, no torsional spin release)
      elements.push({
        id: nextElemId++,
        n1: b1,
        n2: t2,
        sectionId: defaultSectionId,
        materialId: defaultMaterialId,
        rollAngle: 0,
        hinges: { start_ry: true, start_rz: true, end_ry: true, end_rz: true },
        q: null,
        thermal: null,
      });

      // Diagonal X2 (pin-connected truss member: bending released, no torsional spin release)
      elements.push({
        id: nextElemId++,
        n1: b2,
        n2: t1,
        sectionId: defaultSectionId,
        materialId: defaultMaterialId,
        rollAngle: 0,
        hinges: { start_ry: true, start_rz: true, end_ry: true, end_rz: true },
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

export interface IndustrialHallOptions {
  span?: number;
  baySpacing?: number;
  numBays?: number;
  eaveHeight?: number;
  roofType?: 'gable' | 'monopitch' | 'flat' | 'truss';
  ridgeHeight?: number;
  trussDivisions?: number;
  columnBaseType?: 'fixed' | 'pinned';
  eaveJointType?: 'rigid' | 'pinned';
  includePurlins?: boolean;
  purlinsPerRafter?: number;
  includeRoofBracing?: boolean;
  includeWallBracing?: boolean;
  includeGableWall?: boolean;
  gableColumnsCount?: number;
  includeDeadSnowLoad?: boolean;
  roofLoadValue?: number;
  includeWindLoad?: boolean;
  windLoadValue?: number;
  includeDynamicMasses?: boolean;
  columnSectionId?: number;
  rafterSectionId?: number;
  purlinSectionId?: number;
  bracingSectionId?: number;
  materialId?: number;
}

export function generate3DIndustrialHall(options: IndustrialHallOptions = {}): { nodes: Node3D[]; elements: Element3D[] } {
  const {
    span = 18.0,
    baySpacing = 6.0,
    numBays = 5,
    eaveHeight = 6.0,
    roofType = 'gable',
    ridgeHeight = 8.5,
    trussDivisions = 6,
    columnBaseType = 'fixed',
    eaveJointType = 'rigid',
    includePurlins = true,
    purlinsPerRafter = 3,
    includeRoofBracing = true,
    includeWallBracing = true,
    includeGableWall = true,
    gableColumnsCount = 1,
    includeDeadSnowLoad = true,
    roofLoadValue = -12.0,
    includeWindLoad = true,
    windLoadValue = 15.0,
    includeDynamicMasses = true,
    columnSectionId = 1,
    rafterSectionId = 1,
    purlinSectionId = 1,
    bracingSectionId = 1,
    materialId = 1,
  } = options;

  const nodes: Node3D[] = [];
  const elements: Element3D[] = [];
  let nextNodeId = 1;
  let nextElemId = 1;

  const supportTemplate = columnBaseType === 'fixed' ? fixedSupport3D : pinnedSupport3D;

  const getRoofZ = (x: number): number => {
    if (roofType === 'flat') return eaveHeight;
    if (roofType === 'monopitch') {
      const slope = (ridgeHeight - eaveHeight) / span;
      return eaveHeight + slope * x;
    }
    const mid = span / 2;
    const slope = (ridgeHeight - eaveHeight) / mid;
    return x <= mid ? eaveHeight + slope * x : ridgeHeight - slope * (x - mid);
  };

  interface FrameData {
    baseLeft: number;
    baseRight: number;
    eaveLeft: number;
    eaveRight: number;
    ridge?: number;
    roofNodes: number[];
    botNodes?: number[];
  }

  const frames: FrameData[] = [];

  for (let b = 0; b <= numBays; b++) {
    const y = b * baySpacing;
    const isGable = b === 0 || b === numBays;
    const loadMult = isGable ? 0.5 : 1.0;

    const baseLeftId = nextNodeId++;
    nodes.push({
      id: baseLeftId,
      x: 0,
      y,
      z: 0,
      support: JSON.parse(JSON.stringify(supportTemplate)),
      force: null,
      moment: null,
      mass: null,
    });

    const baseRightId = nextNodeId++;
    nodes.push({
      id: baseRightId,
      x: span,
      y,
      z: 0,
      support: JSON.parse(JSON.stringify(supportTemplate)),
      force: null,
      moment: null,
      mass: null,
    });

    const eaveLeftZ = eaveHeight;
    const eaveRightZ = roofType === 'monopitch' ? ridgeHeight : eaveHeight;

    const eaveLeftId = nextNodeId++;
    nodes.push({
      id: eaveLeftId,
      x: 0,
      y,
      z: eaveLeftZ,
      support: null,
      force: includeWindLoad ? { Fx: windLoadValue * loadMult, Fy: 0, Fz: 0 } : null,
      moment: null,
      mass: includeDynamicMasses ? { mx: 3000 * loadMult, my: 3000 * loadMult, mz: 3000 * loadMult } : null,
    });

    const eaveRightId = nextNodeId++;
    nodes.push({
      id: eaveRightId,
      x: span,
      y,
      z: eaveRightZ,
      support: null,
      force: null,
      moment: null,
      mass: includeDynamicMasses ? { mx: 3000 * loadMult, my: 3000 * loadMult, mz: 3000 * loadMult } : null,
    });

    // Left column
    elements.push({
      id: nextElemId++,
      n1: baseLeftId,
      n2: eaveLeftId,
      sectionId: columnSectionId,
      materialId,
      rollAngle: 0,
      hinges: eaveJointType === 'pinned' ? { end_ry: true, end_rz: true } : {},
      q: null,
      thermal: null,
    });

    // Right column
    elements.push({
      id: nextElemId++,
      n1: baseRightId,
      n2: eaveRightId,
      sectionId: columnSectionId,
      materialId,
      rollAngle: 0,
      hinges: eaveJointType === 'pinned' ? { end_ry: true, end_rz: true } : {},
      q: null,
      thermal: null,
    });

    const frame: FrameData = {
      baseLeft: baseLeftId,
      baseRight: baseRightId,
      eaveLeft: eaveLeftId,
      eaveRight: eaveRightId,
      roofNodes: [],
    };

    if (roofType === 'flat' || roofType === 'monopitch') {
      const pCount = includePurlins ? Math.max(1, purlinsPerRafter) : 1;
      const roofPts: number[] = [eaveLeftId];

      for (let p = 1; p < pCount; p++) {
        const t = p / pCount;
        const x = t * span;
        const z = eaveLeftZ + t * (eaveRightZ - eaveLeftZ);
        const pId = nextNodeId++;
        nodes.push({
          id: pId,
          x,
          y,
          z,
          support: null,
          force: null,
          moment: null,
          mass: includeDynamicMasses ? { mx: 1000 * loadMult, my: 1000 * loadMult, mz: 1000 * loadMult } : null,
        });
        roofPts.push(pId);
      }
      roofPts.push(eaveRightId);
      frame.roofNodes = roofPts;

      for (let p = 0; p < roofPts.length - 1; p++) {
        elements.push({
          id: nextElemId++,
          n1: roofPts[p],
          n2: roofPts[p + 1],
          sectionId: rafterSectionId,
          materialId,
          rollAngle: 0,
          hinges: {},
          q: includeDeadSnowLoad
            ? {
                coordinateSystem: 'global',
                qxStart: 0,
                qxEnd: 0,
                qyStart: 0,
                qyEnd: 0,
                qzStart: roofLoadValue * loadMult,
                qzEnd: roofLoadValue * loadMult,
              }
            : null,
          thermal: null,
        });
      }
    } else if (roofType === 'gable') {
      const pCount = includePurlins ? Math.max(1, purlinsPerRafter) : 1;
      const leftPts: number[] = [eaveLeftId];

      for (let p = 1; p < pCount; p++) {
        const t = p / pCount;
        const x = t * (span / 2);
        const z = eaveHeight + t * (ridgeHeight - eaveHeight);
        const pId = nextNodeId++;
        nodes.push({
          id: pId,
          x,
          y,
          z,
          support: null,
          force: null,
          moment: null,
          mass: includeDynamicMasses ? { mx: 1000 * loadMult, my: 1000 * loadMult, mz: 1000 * loadMult } : null,
        });
        leftPts.push(pId);
      }

      const ridgeId = nextNodeId++;
      nodes.push({
        id: ridgeId,
        x: span / 2,
        y,
        z: ridgeHeight,
        support: null,
        force: null,
        moment: null,
        mass: includeDynamicMasses ? { mx: 2000 * loadMult, my: 2000 * loadMult, mz: 2000 * loadMult } : null,
      });
      leftPts.push(ridgeId);
      frame.ridge = ridgeId;

      const rightPts: number[] = [ridgeId];
      for (let p = 1; p < pCount; p++) {
        const t = p / pCount;
        const x = span / 2 + t * (span / 2);
        const z = ridgeHeight - t * (ridgeHeight - eaveHeight);
        const pId = nextNodeId++;
        nodes.push({
          id: pId,
          x,
          y,
          z,
          support: null,
          force: null,
          moment: null,
          mass: includeDynamicMasses ? { mx: 1000 * loadMult, my: 1000 * loadMult, mz: 1000 * loadMult } : null,
        });
        rightPts.push(pId);
      }
      rightPts.push(eaveRightId);

      frame.roofNodes = [...leftPts.slice(0, -1), ...rightPts];

      // Left rafter elements
      for (let p = 0; p < leftPts.length - 1; p++) {
        elements.push({
          id: nextElemId++,
          n1: leftPts[p],
          n2: leftPts[p + 1],
          sectionId: rafterSectionId,
          materialId,
          rollAngle: 0,
          hinges: {},
          q: includeDeadSnowLoad
            ? {
                coordinateSystem: 'global',
                qxStart: 0,
                qxEnd: 0,
                qyStart: 0,
                qyEnd: 0,
                qzStart: roofLoadValue * loadMult,
                qzEnd: roofLoadValue * loadMult,
              }
            : null,
          thermal: null,
        });
      }
      // Right rafter elements
      for (let p = 0; p < rightPts.length - 1; p++) {
        elements.push({
          id: nextElemId++,
          n1: rightPts[p],
          n2: rightPts[p + 1],
          sectionId: rafterSectionId,
          materialId,
          rollAngle: 0,
          hinges: {},
          q: includeDeadSnowLoad
            ? {
                coordinateSystem: 'global',
                qxStart: 0,
                qxEnd: 0,
                qyStart: 0,
                qyEnd: 0,
                qzStart: roofLoadValue * loadMult,
                qzEnd: roofLoadValue * loadMult,
              }
            : null,
          thermal: null,
        });
      }
    } else if (roofType === 'truss') {
      const nDiv = Math.max(4, trussDivisions % 2 === 0 ? trussDivisions : trussDivisions + 1);
      const botNodes: number[] = [eaveLeftId];
      for (let i = 1; i < nDiv; i++) {
        const x = (i / nDiv) * span;
        const bId = nextNodeId++;
        nodes.push({
          id: bId,
          x,
          y,
          z: eaveHeight,
          support: null,
          force: null,
          moment: null,
          mass: includeDynamicMasses ? { mx: 1000 * loadMult, my: 1000 * loadMult, mz: 1000 * loadMult } : null,
        });
        botNodes.push(bId);
      }
      botNodes.push(eaveRightId);

      const topNodes: number[] = [eaveLeftId];
      for (let i = 1; i < nDiv; i++) {
        const x = (i / nDiv) * span;
        const z = getRoofZ(x);
        const tId = nextNodeId++;
        nodes.push({
          id: tId,
          x,
          y,
          z,
          support: null,
          force: null,
          moment: null,
          mass: includeDynamicMasses ? { mx: 1000 * loadMult, my: 1000 * loadMult, mz: 1000 * loadMult } : null,
        });
        topNodes.push(tId);
      }
      topNodes.push(eaveRightId);

      frame.botNodes = botNodes;
      frame.roofNodes = topNodes;
      const midIdx = Math.floor(nDiv / 2);
      frame.ridge = topNodes[midIdx];

      // Bottom chord (continuous)
      for (let i = 0; i < botNodes.length - 1; i++) {
        elements.push({
          id: nextElemId++,
          n1: botNodes[i],
          n2: botNodes[i + 1],
          sectionId: rafterSectionId,
          materialId,
          rollAngle: 0,
          hinges: {},
          q: null,
          thermal: null,
        });
      }
      // Top chord (continuous)
      for (let i = 0; i < topNodes.length - 1; i++) {
        elements.push({
          id: nextElemId++,
          n1: topNodes[i],
          n2: topNodes[i + 1],
          sectionId: rafterSectionId,
          materialId,
          rollAngle: 0,
          hinges: {},
          q: includeDeadSnowLoad
            ? {
                coordinateSystem: 'global',
                qxStart: 0,
                qxEnd: 0,
                qyStart: 0,
                qyEnd: 0,
                qzStart: roofLoadValue * loadMult,
                qzEnd: roofLoadValue * loadMult,
              }
            : null,
          thermal: null,
        });
      }
      // Vertical posts (intermediate)
      for (let i = 1; i < nDiv; i++) {
        elements.push({
          id: nextElemId++,
          n1: botNodes[i],
          n2: topNodes[i],
          sectionId: bracingSectionId,
          materialId,
          rollAngle: 0,
          hinges: { start_ry: true, start_rz: true, end_ry: true, end_rz: true },
          q: null,
          thermal: null,
        });
      }
      // Diagonals (Pratt pattern)
      for (let i = 0; i < nDiv / 2; i++) {
        elements.push({
          id: nextElemId++,
          n1: botNodes[i],
          n2: topNodes[i + 1],
          sectionId: bracingSectionId,
          materialId,
          rollAngle: 0,
          hinges: { start_ry: true, start_rz: true, end_ry: true, end_rz: true },
          q: null,
          thermal: null,
        });
      }
      for (let i = nDiv / 2; i < nDiv; i++) {
        elements.push({
          id: nextElemId++,
          n1: botNodes[i + 1],
          n2: topNodes[i],
          sectionId: bracingSectionId,
          materialId,
          rollAngle: 0,
          hinges: { start_ry: true, start_rz: true, end_ry: true, end_rz: true },
          q: null,
          thermal: null,
        });
      }
    }

    frames.push(frame);
  }

  // Longitudinal elements (Purlins, Eave beams, Ridge purlin)
  for (let b = 0; b < numBays; b++) {
    const f1 = frames[b];
    const f2 = frames[b + 1];

    if (includePurlins || roofType === 'truss') {
      for (let i = 0; i < f1.roofNodes.length; i++) {
        elements.push({
          id: nextElemId++,
          n1: f1.roofNodes[i],
          n2: f2.roofNodes[i],
          sectionId: purlinSectionId,
          materialId,
          rollAngle: 0,
          hinges: {},
          q: null,
          thermal: null,
        });
      }
    } else {
      // Eave beams & ridge only
      elements.push({
        id: nextElemId++,
        n1: f1.eaveLeft,
        n2: f2.eaveLeft,
        sectionId: purlinSectionId,
        materialId,
        rollAngle: 0,
        hinges: {},
        q: null,
        thermal: null,
      });
      elements.push({
        id: nextElemId++,
        n1: f1.eaveRight,
        n2: f2.eaveRight,
        sectionId: purlinSectionId,
        materialId,
        rollAngle: 0,
        hinges: {},
        q: null,
        thermal: null,
      });
      if (f1.ridge && f2.ridge) {
        elements.push({
          id: nextElemId++,
          n1: f1.ridge,
          n2: f2.ridge,
          sectionId: purlinSectionId,
          materialId,
          rollAngle: 0,
          hinges: {},
          q: null,
          thermal: null,
        });
      }
    }
  }

  // Roof & Wall Bracings in end bays
  const bracingBays = [0];
  if (numBays > 1) bracingBays.push(numBays - 1);

  bracingBays.forEach((b) => {
    const f1 = frames[b];
    const f2 = frames[b + 1];

    if (includeWallBracing) {
      // Left wall
      elements.push({
        id: nextElemId++,
        n1: f1.baseLeft,
        n2: f2.eaveLeft,
        sectionId: bracingSectionId,
        materialId,
        rollAngle: 0,
        hinges: { start_ry: true, start_rz: true, end_ry: true, end_rz: true },
        q: null,
        thermal: null,
      });
      elements.push({
        id: nextElemId++,
        n1: f2.baseLeft,
        n2: f1.eaveLeft,
        sectionId: bracingSectionId,
        materialId,
        rollAngle: 0,
        hinges: { start_ry: true, start_rz: true, end_ry: true, end_rz: true },
        q: null,
        thermal: null,
      });

      // Right wall
      elements.push({
        id: nextElemId++,
        n1: f1.baseRight,
        n2: f2.eaveRight,
        sectionId: bracingSectionId,
        materialId,
        rollAngle: 0,
        hinges: { start_ry: true, start_rz: true, end_ry: true, end_rz: true },
        q: null,
        thermal: null,
      });
      elements.push({
        id: nextElemId++,
        n1: f2.baseRight,
        n2: f1.eaveRight,
        sectionId: bracingSectionId,
        materialId,
        rollAngle: 0,
        hinges: { start_ry: true, start_rz: true, end_ry: true, end_rz: true },
        q: null,
        thermal: null,
      });
    }

    if (includeRoofBracing) {
      const midIdx = Math.floor(f1.roofNodes.length / 2);
      const r1 = f1.ridge || f1.roofNodes[midIdx];
      const r2 = f2.ridge || f2.roofNodes[midIdx];

      // Left roof slope
      elements.push({
        id: nextElemId++,
        n1: f1.eaveLeft,
        n2: r2,
        sectionId: bracingSectionId,
        materialId,
        rollAngle: 0,
        hinges: { start_ry: true, start_rz: true, end_ry: true, end_rz: true },
        q: null,
        thermal: null,
      });
      elements.push({
        id: nextElemId++,
        n1: f2.eaveLeft,
        n2: r1,
        sectionId: bracingSectionId,
        materialId,
        rollAngle: 0,
        hinges: { start_ry: true, start_rz: true, end_ry: true, end_rz: true },
        q: null,
        thermal: null,
      });

      // Right roof slope
      elements.push({
        id: nextElemId++,
        n1: f1.eaveRight,
        n2: r2,
        sectionId: bracingSectionId,
        materialId,
        rollAngle: 0,
        hinges: { start_ry: true, start_rz: true, end_ry: true, end_rz: true },
        q: null,
        thermal: null,
      });
      elements.push({
        id: nextElemId++,
        n1: f2.eaveRight,
        n2: r1,
        sectionId: bracingSectionId,
        materialId,
        rollAngle: 0,
        hinges: { start_ry: true, start_rz: true, end_ry: true, end_rz: true },
        q: null,
        thermal: null,
      });
    }
  });

  // Gable wall posts
  if (includeGableWall && gableColumnsCount > 0) {
    const gableBays = [0, numBays];
    const nGable = gableColumnsCount;
    gableBays.forEach((b) => {
      const y = b * baySpacing;
      const frameRoof = frames[b].roofNodes;
      for (let g = 1; g <= nGable; g++) {
        const x = (g / (nGable + 1)) * span;
        const zTop = getRoofZ(x);

        let topId: number | null = null;
        for (const rnId of frameRoof) {
          const rn = nodes.find((n) => n.id === rnId)!;
          if (Math.abs(rn.x - x) < 0.05) {
            topId = rnId;
            break;
          }
        }
        if (!topId) {
          topId = nextNodeId++;
          nodes.push({
            id: topId,
            x,
            y,
            z: zTop,
            support: null,
            force: null,
            moment: null,
            mass: includeDynamicMasses ? { mx: 1500, my: 1500, mz: 1500 } : null,
          });
        }

        const gBaseId = nextNodeId++;
        nodes.push({
          id: gBaseId,
          x,
          y,
          z: 0,
          support: JSON.parse(JSON.stringify(supportTemplate)),
          force: null,
          moment: null,
          mass: null,
        });

        // Gable column element
        elements.push({
          id: nextElemId++,
          n1: gBaseId,
          n2: topId,
          sectionId: columnSectionId,
          materialId,
          rollAngle: 0,
          hinges: { end_ry: true, end_rz: true },
          q: null,
          thermal: null,
        });
      }
    });
  }

  return { nodes, elements };
}

export function generate2DPortalFrame(
  span = 6.0,
  height = 4.0,
  defaultSectionId = 1,
  defaultMaterialId = 1
): { nodes: Node3D[]; elements: Element3D[] } {
  return generate3DIndustrialHall({
    span,
    eaveHeight: height,
    baySpacing: 6.0,
    numBays: 1,
    roofType: 'flat',
    columnSectionId: defaultSectionId,
    rafterSectionId: defaultSectionId,
    materialId: defaultMaterialId,
  });
}

