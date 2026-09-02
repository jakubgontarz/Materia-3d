import {
  zerosMat,
  zerosVec,
  matMul,
  matVec,
  transpose,
  invSmall,
  pinvSymmetric,
  solveLinSys,
  cholesky,
  solveL,
  solveLT,
  jacobiSymmetric,
  Vec3,
  vec3Normalize,
  vec3Cross,
  vec3Dot,
  vec3Norm
} from './matrix';
import {
  Node3D,
  Element3D,
  Material,
  Section,
  LinearStaticResult3D,
  PointResult3D,
  MemberSampleData3D,
  StabilityResult3D,
  BucklingMode3D,
  ModalResult3D,
  ModalMode3D,
  AnalysisSettings,
  Panel3D
} from './types';
import { distributePanelLoads } from './panels';

// Constants for unit conversion
// Internal units: kN, m, kNm, kN/m, kPa (kN/m^2), degrees C, radians.
// Material units: E in GPa -> * 1e6 kN/m^2, alpha in 1e-5/C -> * 1e-5.
// Section units: A in cm^2 -> * 1e-4 m^2, I in cm^4 -> * 1e-8 m^4.
export const UNIT = {
  GPa: 1e6,
  cm2: 1e-4,
  cm4: 1e-8,
  cm3: 1e-6,
  cm: 1e-2,
  alphaU: 1e-5,
  deg: Math.PI / 180
};

export interface SolverModel3D {
  nodes: Node3D[];
  elements: Element3D[];
  materials: Material[];
  sections: Section[];
  panels?: Panel3D[];
  settings?: AnalysisSettings;
}

export function autoLockZeroStiffnessDofs(
  K: number[][],
  isFixed: boolean[],
  fixedValue?: number[]
): void {
  const nDof = K.length;
  const numNodes = Math.floor(nDof / 6);

  for (let n = 0; n < numNodes; n++) {
    const base = 6 * n;

    // Local max diagonal for translational DOFs (ux, uy, uz)
    let maxTrans = 0;
    for (let d = 0; d < 3; d++) {
      maxTrans = Math.max(maxTrans, Math.abs(K[base + d][base + d]));
    }
    const tolTrans = Math.max(maxTrans, 1) * 1e-9;

    for (let d = 0; d < 3; d++) {
      const dof = base + d;
      if (!isFixed[dof] && Math.abs(K[dof][dof]) < tolTrans) {
        isFixed[dof] = true;
        if (fixedValue) fixedValue[dof] = 0;
      }
    }

    // Local max diagonal for rotational DOFs (rx, ry, rz)
    let maxRot = 0;
    for (let d = 3; d < 6; d++) {
      maxRot = Math.max(maxRot, Math.abs(K[base + d][base + d]));
    }
    const tolRot = Math.max(maxRot, 1) * 1e-9;

    for (let d = 3; d < 6; d++) {
      const dof = base + d;
      if (!isFixed[dof] && Math.abs(K[dof][dof]) < tolRot) {
        isFixed[dof] = true;
        if (fixedValue) fixedValue[dof] = 0;
      }
    }
  }
}

export function computeSupportRotationMatrix(
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

export function applySupportRotations(
  nodes: Node3D[],
  K: number[][],
  F?: number[],
  K2?: number[][]
): (number[][] | null)[] {
  const nNodes = nodes.length;
  const T_nodes = nodes.map((n) => {
    if (!n.support) return null;
    const rotX = n.support.rotX || 0;
    const rotY = n.support.rotY || 0;
    const rotZ = n.support.rotZ || 0;
    if (rotX === 0 && rotY === 0 && rotZ === 0) return null;
    const R = computeSupportRotationMatrix(rotX, rotY, rotZ);
    const Ti = zerosMat(6, 6);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        Ti[r][c] = R[r][c];
        Ti[r + 3][c + 3] = R[r][c];
      }
    }
    return Ti;
  });

  // Transform F if provided: F'_p = Tp^T * F_p
  if (F) {
    for (let p = 0; p < nNodes; p++) {
      const Tp = T_nodes[p];
      if (Tp) {
        const Fp_old = F.slice(6 * p, 6 * p + 6);
        const Fp_new = zerosVec(6);
        for (let i = 0; i < 6; i++) {
          let sum = 0;
          for (let j = 0; j < 6; j++) {
            sum += Tp[j][i] * Fp_old[j]; // Tp^T * Fp
          }
          Fp_new[i] = sum;
        }
        for (let i = 0; i < 6; i++) {
          F[6 * p + i] = Fp_new[i];
        }
      }
    }
  }

  // Transform K and K2 (e.g., mass, geometric stiffness)
  const transformMatrix = (mat: number[][]) => {
    for (let p = 0; p < nNodes; p++) {
      for (let q = 0; q < nNodes; q++) {
        const Tp = T_nodes[p];
        const Tq = T_nodes[q];
        if (!Tp && !Tq) continue;

        const Kpq = zerosMat(6, 6);
        for (let i = 0; i < 6; i++) {
          for (let j = 0; j < 6; j++) {
            Kpq[i][j] = mat[6 * p + i][6 * q + j];
          }
        }

        const temp = zerosMat(6, 6);
        if (Tp) {
          for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) {
              let sum = 0;
              for (let k = 0; k < 6; k++) {
                sum += Tp[k][i] * Kpq[k][j]; // Tp^T * Kpq
              }
              temp[i][j] = sum;
            }
          }
        } else {
          for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) {
              temp[i][j] = Kpq[i][j];
            }
          }
        }

        const Kpq_new = zerosMat(6, 6);
        if (Tq) {
          for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) {
              let sum = 0;
              for (let k = 0; k < 6; k++) {
                sum += temp[i][k] * Tq[k][j]; // temp * Tq
              }
              Kpq_new[i][j] = sum;
            }
          }
        } else {
          for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) {
              Kpq_new[i][j] = temp[i][j];
            }
          }
        }

        for (let i = 0; i < 6; i++) {
          for (let j = 0; j < 6; j++) {
            mat[6 * p + i][6 * q + j] = Kpq_new[i][j];
          }
        }
      }
    }
  };

  transformMatrix(K);
  if (K2) {
    transformMatrix(K2);
  }

  return T_nodes;
}

export function computeLocalAxes(
  n1: Node3D,
  n2: Node3D,
  rollAngleDeg = 0
): { L: number; vx: Vec3; vy: Vec3; vz: Vec3; R: number[][]; T: number[][]; Tt: number[][] } {
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const dz = n2.z - n1.z;
  const L = Math.hypot(dx, dy, dz) || 1e-6;

  const vx: Vec3 = [dx / L, dy / L, dz / L];

  // Choose global reference vector.
  // Standard civil engineering convention:
  // If bar is not vertical (nearly parallel to Z), ref is +Z.
  // If bar is nearly vertical (along Z), ref is +Y.
  let vRef: Vec3 = [0, 0, 1];
  if (Math.abs(vx[2]) > 0.999) {
    vRef = [0, 1, 0];
  }

  // vy0 = vRef x vx / |vRef x vx|
  let vy0 = vec3Cross(vRef, vx);
  if (vec3Norm(vy0) < 1e-6) {
    vRef = [1, 0, 0];
    vy0 = vec3Cross(vRef, vx);
  }
  vy0 = vec3Normalize(vy0);

  // vz0 = vx x vy0
  const vz0 = vec3Normalize(vec3Cross(vx, vy0));

  // Apply roll angle beta
  const beta = rollAngleDeg * (Math.PI / 180);
  const cosB = Math.cos(beta);
  const sinB = Math.sin(beta);

  const vy: Vec3 = [
    vy0[0] * cosB + vz0[0] * sinB,
    vy0[1] * cosB + vz0[1] * sinB,
    vy0[2] * cosB + vz0[2] * sinB,
  ];

  const vz: Vec3 = [
    -vy0[0] * sinB + vz0[0] * cosB,
    -vy0[1] * sinB + vz0[1] * cosB,
    -vy0[2] * sinB + vz0[2] * cosB,
  ];

  // 3x3 rotation matrix R: transforms global vectors to local vectors
  // v_local = R * v_global
  const R: number[][] = [
    [vx[0], vx[1], vx[2]],
    [vy[0], vy[1], vy[2]],
    [vz[0], vz[1], vz[2]],
  ];

  // 12x12 Transformation matrix T
  const T = zerosMat(12, 12);
  for (let b = 0; b < 4; b++) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        T[3 * b + i][3 * b + j] = R[i][j];
      }
    }
  }

  const Tt = transpose(T);

  return { L, vx, vy, vz, R, T, Tt };
}

export function localStiffness3D(
  E: number,
  G: number,
  A: number,
  Iy: number,
  Iz: number,
  It: number,
  L: number
): number[][] {
  const k = zerosMat(12, 12);

  // Axial (DOFs 0, 6)
  const EAL = (E * A) / L;
  k[0][0] = EAL;
  k[0][6] = -EAL;
  k[6][0] = -EAL;
  k[6][6] = EAL;

  // Torsion (DOFs 3, 9)
  const GItL = (G * It) / L;
  k[3][3] = GItL;
  k[3][9] = -GItL;
  k[9][3] = -GItL;
  k[9][9] = GItL;

  // Bending about local z (translation y, rotation z -> DOFs 1, 5, 7, 11)
  const EIz = E * Iz;
  const L2 = L * L;
  const L3 = L2 * L;

  k[1][1] = (12 * EIz) / L3;
  k[1][5] = (6 * EIz) / L2;
  k[1][7] = (-12 * EIz) / L3;
  k[1][11] = (6 * EIz) / L2;

  k[5][1] = (6 * EIz) / L2;
  k[5][5] = (4 * EIz) / L;
  k[5][7] = (-6 * EIz) / L2;
  k[5][11] = (2 * EIz) / L;

  k[7][1] = (-12 * EIz) / L3;
  k[7][5] = (-6 * EIz) / L2;
  k[7][7] = (12 * EIz) / L3;
  k[7][11] = (-6 * EIz) / L2;

  k[11][1] = (6 * EIz) / L2;
  k[11][5] = (2 * EIz) / L;
  k[11][7] = (-6 * EIz) / L2;
  k[11][11] = (4 * EIz) / L;

  // Bending about local y (translation z, rotation y -> DOFs 2, 4, 8, 10)
  // Note: rotation theta_y positive produces negative w displacement slope
  const EIy = E * Iy;

  k[2][2] = (12 * EIy) / L3;
  k[2][4] = (-6 * EIy) / L2;
  k[2][8] = (-12 * EIy) / L3;
  k[2][10] = (-6 * EIy) / L2;

  k[4][2] = (-6 * EIy) / L2;
  k[4][4] = (4 * EIy) / L;
  k[4][8] = (6 * EIy) / L2;
  k[4][10] = (2 * EIy) / L;

  k[8][2] = (-12 * EIy) / L3;
  k[8][4] = (6 * EIy) / L2;
  k[8][8] = (12 * EIy) / L3;
  k[8][10] = (6 * EIy) / L2;

  k[10][2] = (-6 * EIy) / L2;
  k[10][4] = (2 * EIy) / L;
  k[10][8] = (6 * EIy) / L2;
  k[10][10] = (4 * EIy) / L;

  return k;
}

export function getElementCondIdx(el: Element3D): number[] {
  const condIdx: number[] = [];
  const h = el.hinges || {};
  if (h.start_ux) condIdx.push(0);
  if (h.start_uy) condIdx.push(1);
  if (h.start_uz) condIdx.push(2);
  if (h.start_rx) condIdx.push(3);
  if (h.start_ry) condIdx.push(4);
  if (h.start_rz) condIdx.push(5);

  if (h.end_ux) condIdx.push(6);
  if (h.end_uy) condIdx.push(7);
  if (h.end_uz) condIdx.push(8);
  if (h.end_rx) condIdx.push(9);
  if (h.end_ry) condIdx.push(10);
  if (h.end_rz) condIdx.push(11);
  return condIdx;
}

export function condense3D(
  k: number[][],
  f: number[],
  condIdx: number[]
): { k: number[][]; f: number[] } {
  if (condIdx.length === 0) return { k: k.map((r) => r.slice()), f: f.slice() };
  const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const R = all.filter((i) => !condIdx.includes(i));
  const C = condIdx;

  const Krr = R.map((i) => R.map((j) => k[i][j]));
  const Krc = R.map((i) => C.map((j) => k[i][j]));
  const Kcr = C.map((i) => R.map((j) => k[i][j]));
  const Kcc = C.map((i) => C.map((j) => k[i][j]));

  const Fr = R.map((i) => f[i]);
  const Fc = C.map((i) => f[i]);

  const KccInv = pinvSymmetric(Kcc);
  const KccInvKcr = matMul(KccInv, Kcr);
  const KrcKccInvKcr = matMul(Krc, KccInvKcr);

  const Kred = Krr.map((row, i) => row.map((val, j) => val - KrcKccInvKcr[i][j]));
  const KccInvFc = matVec(KccInv, Fc);
  const KrcKccInvFc = matVec(Krc, KccInvFc);
  const Fred = Fr.map((val, i) => val - KrcKccInvFc[i]);

  const kOut = zerosMat(12, 12);
  const fOut = zerosVec(12);
  for (let i = 0; i < R.length; i++) {
    fOut[R[i]] = Fred[i];
    for (let j = 0; j < R.length; j++) {
      kOut[R[i]][R[j]] = (Kred[i][j] + Kred[j][i]) / 2;
    }
  }
  return { k: kOut, f: fOut };
}

export function backSubstitute3D(
  kFull: number[][],
  fFull: number[],
  dLocalRaw: number[],
  condIdx: number[]
): number[] {
  if (condIdx.length === 0) return dLocalRaw.slice();
  const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const R = all.filter((i) => !condIdx.includes(i));
  const C = condIdx;

  const Kcr = C.map((i) => R.map((j) => kFull[i][j]));
  const Kcc = C.map((i) => C.map((j) => kFull[i][j]));
  const Fc = C.map((i) => fFull[i]);
  const uR = R.map((i) => dLocalRaw[i]);

  const KccInv = pinvSymmetric(Kcc);
  const KcrUr = matVec(Kcr, uR);
  const rhs = Fc.map((val, i) => val - KcrUr[i]);
  const uC = matVec(KccInv, rhs);

  const dOut = dLocalRaw.slice();
  for (let i = 0; i < C.length; i++) dOut[C[i]] = uC[i];
  return dOut;
}

export function getGuyanTransformation3D(
  kFull: number[][],
  condIdx: number[]
): { T_guyan: number[][]; R: number[]; C: number[] } {
  const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  if (condIdx.length === 0) {
    const eye = zerosMat(12, 12);
    for (let i = 0; i < 12; i++) eye[i][i] = 1;
    return { T_guyan: eye, R: all, C: [] };
  }
  const R = all.filter((i) => !condIdx.includes(i));
  const C = condIdx;

  const Kcr = C.map((i) => R.map((j) => kFull[i][j]));
  const Kcc = C.map((i) => C.map((j) => kFull[i][j]));
  const KccInv = pinvSymmetric(Kcc);
  const KccInvKcr = matMul(KccInv, Kcr); // size: C.length x R.length

  // T_guyan is 12 x R.length
  // uFull = T_guyan * uR
  const T_guyan = zerosMat(12, R.length);
  for (let rIdx = 0; rIdx < R.length; rIdx++) {
    T_guyan[R[rIdx]][rIdx] = 1;
  }
  for (let cIdx = 0; cIdx < C.length; cIdx++) {
    const c = C[cIdx];
    for (let rIdx = 0; rIdx < R.length; rIdx++) {
      T_guyan[c][rIdx] = -KccInvKcr[cIdx][rIdx];
    }
  }

  return { T_guyan, R, C };
}

export function condenseGuyan3D(
  matFull: number[][],
  kFull: number[][],
  condIdx: number[]
): number[][] {
  if (condIdx.length === 0) return matFull.map((r) => r.slice());
  const { T_guyan, R } = getGuyanTransformation3D(kFull, condIdx);

  const T_t = transpose(T_guyan);
  const matT = matMul(matFull, T_guyan);
  const matReduced = matMul(T_t, matT);

  const out = zerosMat(12, 12);
  for (let i = 0; i < R.length; i++) {
    for (let j = 0; j < R.length; j++) {
      out[R[i]][R[j]] = (matReduced[i][j] + matReduced[j][i]) / 2;
    }
  }
  return out;
}

export function shapeFunctions3D(x: number, L: number) {
  const xi = x / L;
  const N1 = 1 - xi;
  const N2 = xi;

  const H1 = 1 - 3 * xi * xi + 2 * xi * xi * xi;
  const H2 = L * (xi - 2 * xi * xi + xi * xi * xi);
  const H3 = 3 * xi * xi - 2 * xi * xi * xi;
  const H4 = L * (-xi * xi + xi * xi * xi);

  return { N1, N2, H1, H2, H3, H4 };
}

export function distributedLoadLocalVector3D(
  qxStart: number,
  qxEnd: number,
  qyStart: number,
  qyEnd: number,
  qzStart: number,
  qzEnd: number,
  L: number
): number[] {
  const f = zerosVec(12);

  // Axial load qx (linear interpolation)
  f[0] = (L / 6) * (2 * qxStart + qxEnd);
  f[6] = (L / 6) * (qxStart + 2 * qxEnd);

  // Transverse load qy (bending around z)
  // Uniform part + triangular part
  f[1] = (L / 20) * (7 * qyStart + 3 * qyEnd);
  f[5] = (L * L / 60) * (3 * qyStart + 2 * qyEnd);
  f[7] = (L / 20) * (3 * qyStart + 7 * qyEnd);
  f[11] = (-L * L / 60) * (2 * qyStart + 3 * qyEnd);

  // Transverse load qz (bending around y)
  f[2] = (L / 20) * (7 * qzStart + 3 * qzEnd);
  f[4] = (-L * L / 60) * (3 * qzStart + 2 * qzEnd);
  f[8] = (L / 20) * (3 * qzStart + 7 * qzEnd);
  f[10] = (L * L / 60) * (2 * qzStart + 3 * qzEnd);

  return f;
}

export function solveLinearStatic3D(model: SolverModel3D): LinearStaticResult3D {
  const { nodes, elements } = distributePanelLoads(model.nodes, model.elements, model.panels);
  const materials = model.materials;
  const sections = model.sections;

  const nodeIndex: Record<number, number> = {};
  nodes.forEach((n, i) => (nodeIndex[n.id] = i));

  const nDof = 6 * nodes.length;
  const K = zerosMat(nDof, nDof);
  const F = zerosVec(nDof);

  const getMat = (id: number) => materials.find((m) => m.id === id) || materials[0];
  const getSec = (id: number) => sections.find((s) => s.id === id) || sections[0];

  const elemData = elements.map((el) => {
    const n1 = nodes.find((n) => n.id === el.n1)!;
    const n2 = nodes.find((n) => n.id === el.n2)!;
    const mat = getMat(el.materialId);
    const sec = getSec(el.sectionId);

    const E = mat.E * UNIT.GPa;
    const G = mat.G * UNIT.GPa;
    const A = sec.A * UNIT.cm2;
    const Iy = sec.Iy * UNIT.cm4;
    const Iz = sec.Iz * UNIT.cm4;
    const It = sec.It * UNIT.cm4;

    const { L, vx, vy, vz, R, T } = computeLocalAxes(n1, n2, el.rollAngle || 0);

    const kFull = localStiffness3D(E, G, A, Iy, Iz, It, L);
    let fFull = zerosVec(12);

    // Member distributed loads
    if (el.q) {
      let qxS = el.q.qxStart;
      let qxE = el.q.qxEnd;
      let qyS = el.q.qyStart;
      let qyE = el.q.qyEnd;
      let qzS = el.q.qzStart;
      let qzE = el.q.qzEnd;

      if (el.q.coordinateSystem === 'global') {
        const qStartLoc = matVec(R, [qxS, qyS, qzS]);
        const qEndLoc = matVec(R, [qxE, qyE, qzE]);
        qxS = qStartLoc[0];
        qyS = qStartLoc[1];
        qzS = qStartLoc[2];
        qxE = qEndLoc[0];
        qyE = qEndLoc[1];
        qzE = qEndLoc[2];
      }

      const fq = distributedLoadLocalVector3D(qxS, qxE, qyS, qyE, qzS, qzE, L);
      fFull = fFull.map((v, i) => v + fq[i]);
    }

    // Self-weight in 3D (gravity in global -Z: [0, 0, -rho*A*g])
    if (model.settings?.params.includeSelfWeight) {
      const qGravGlobal = mat.density * (9.81 / 1000) * A; // kN/m downwards
      const qGravLoc = matVec(R, [0, 0, -qGravGlobal]);
      const fsw = distributedLoadLocalVector3D(
        qGravLoc[0],
        qGravLoc[0],
        qGravLoc[1],
        qGravLoc[1],
        qGravLoc[2],
        qGravLoc[2],
        L
      );
      fFull = fFull.map((v, i) => v + fsw[i]);
    }

    // Member thermal loads (axial dT_x and transverse gradient dTy, dTz)
    if (el.thermal) {
      const dTx = el.thermal.deltaTx ?? el.thermal.dT_axial ?? 0;
      const dTy = el.thermal.deltaTy ?? ((el.thermal.dTy_top ?? 0) - (el.thermal.dTy_bot ?? 0));
      const dTz = el.thermal.deltaTz ?? ((el.thermal.dTz_top ?? 0) - (el.thermal.dTz_bot ?? 0));

      const alpha = (mat.alpha || 1.2) * 1e-5; // Thermal expansion coeff [1/°C]
      const hDim = (sec.h ? sec.h * UNIT.cm : 0.1); // depth along local y [m]
      const bDim = (sec.b ? sec.b * UNIT.cm : 0.1); // width along local z [m]

      const fTherm = zerosVec(12);

      // 1. Axial temperature deltaTx (uniform expansion / compression)
      // Positive deltaTx (expansion) -> equivalent nodal force pulls outward at node 2 (+x) and pushes inward at node 1 (-x)
      if (Math.abs(dTx) > 1e-9) {
        const N_T = E * A * alpha * dTx;
        fTherm[0] += -N_T;
        fTherm[6] += +N_T;
      }

      // 2. Transverse gradient in local y: deltaTy (bending about local z, DOFs 5 and 11)
      // Positive deltaTy (top fiber warmer than bottom fiber) -> curvature towards -y
      if (Math.abs(dTy) > 1e-9 && hDim > 1e-4) {
        const M_Tz = E * Iz * alpha * (dTy / hDim);
        fTherm[5] += -M_Tz;
        fTherm[11] += +M_Tz;
      }

      // 3. Transverse gradient in local z: deltaTz (bending about local y, DOFs 4 and 10)
      if (Math.abs(dTz) > 1e-9 && bDim > 1e-4) {
        const M_Ty = E * Iy * alpha * (dTz / bDim);
        fTherm[4] += +M_Ty;
        fTherm[10] += -M_Ty;
      }

      fFull = fFull.map((v, i) => v + fTherm[i]);
    }

    // Member releases / hinges condensation indices
    const condIdx = getElementCondIdx(el);

    const { k: kCond, f: fCond } = condense3D(kFull, fFull, condIdx);

    const Tt = transpose(T);
    const kGlobal = matMul(matMul(Tt, kCond), T);
    const fGlobal = matVec(Tt, fCond);

    const dofMap = [
      6 * nodeIndex[el.n1] + 0,
      6 * nodeIndex[el.n1] + 1,
      6 * nodeIndex[el.n1] + 2,
      6 * nodeIndex[el.n1] + 3,
      6 * nodeIndex[el.n1] + 4,
      6 * nodeIndex[el.n1] + 5,
      6 * nodeIndex[el.n2] + 0,
      6 * nodeIndex[el.n2] + 1,
      6 * nodeIndex[el.n2] + 2,
      6 * nodeIndex[el.n2] + 3,
      6 * nodeIndex[el.n2] + 4,
      6 * nodeIndex[el.n2] + 5,
    ];

    return {
      el,
      n1,
      n2,
      mat,
      sec,
      L,
      vx,
      vy,
      vz,
      R,
      T,
      Tt,
      kFull,
      fFull,
      condIdx,
      kCond,
      fCond,
      kGlobal,
      fGlobal,
      dofMap,
    };
  });

  // Assemble global stiffness and load vector
  for (const ed of elemData) {
    for (let i = 0; i < 12; i++) {
      F[ed.dofMap[i]] += ed.fGlobal[i];
      for (let j = 0; j < 12; j++) {
        K[ed.dofMap[i]][ed.dofMap[j]] += ed.kGlobal[i][j];
      }
    }
  }

  // Nodal loads
  nodes.forEach((n, idx) => {
    if (n.force) {
      F[6 * idx + 0] += n.force.Fx || 0;
      F[6 * idx + 1] += n.force.Fy || 0;
      F[6 * idx + 2] += n.force.Fz || 0;
    }
    if (n.moment) {
      F[6 * idx + 3] += n.moment.Mx || 0;
      F[6 * idx + 4] += n.moment.My || 0;
      F[6 * idx + 5] += n.moment.Mz || 0;
    }
  });

  // Rotate support conditions (K and F)
  const T_nodes = applySupportRotations(nodes, K, F);

  // Boundary conditions
  const isFixed = new Array(nDof).fill(false);
  const fixedValue = new Array(nDof).fill(0);
  const springInfo: Record<number, { k: number; delta: number }> = {};

  nodes.forEach((n, i) => {
    if (!n.support) return;
    const sp = n.support;
    const compList = [
      { c: sp.ux, dof: 6 * i + 0, isRot: false },
      { c: sp.uy, dof: 6 * i + 1, isRot: false },
      { c: sp.uz, dof: 6 * i + 2, isRot: false },
      { c: sp.rx, dof: 6 * i + 3, isRot: true },
      { c: sp.ry, dof: 6 * i + 4, isRot: true },
      { c: sp.rz, dof: 6 * i + 5, isRot: true },
    ];

    compList.forEach(({ c, dof, isRot }) => {
      if (!c || c.type === 'free') return;
      const deltaVal = (c.delta || 0) * (isRot ? UNIT.deg : 1e-3);
      if (c.type === 'fixed') {
        isFixed[dof] = true;
        fixedValue[dof] = deltaVal;
      } else if (c.type === 'spring') {
        const kVal = c.k || 1000;
        K[dof][dof] += kVal;
        F[dof] += kVal * deltaVal;
        springInfo[dof] = { k: kVal, delta: deltaVal };
      }
    });
  });

  // Check for unconstrained floating DOFs (lock numerical singularities)
  autoLockZeroStiffnessDofs(K, isFixed, fixedValue);

  const freeIdx: number[] = [];
  const fixedIdx: number[] = [];
  for (let i = 0; i < nDof; i++) {
    if (isFixed[i]) fixedIdx.push(i);
    else freeIdx.push(i);
  }

  const Kff = freeIdx.map((i) => freeIdx.map((j) => K[i][j]));
  const Kfc = freeIdx.map((i) => fixedIdx.map((j) => K[i][j]));
  const Uc = fixedIdx.map((i) => fixedValue[i]);
  const Ff = freeIdx.map((i) => F[i]);

  const rhs = Ff.map((val, i) => val - matVec([Kfc[i]], Uc)[0]);

  let singular = false;
  const solved = freeIdx.length > 0 ? solveLinSys(Kff, rhs) : { x: [], singular: false };
  const Uf = solved.x;
  singular = solved.singular;

  const D = zerosVec(nDof);
  freeIdx.forEach((gi, i) => {
    D[gi] = Uf[i];
  });
  fixedIdx.forEach((gi, i) => {
    D[gi] = Uc[i];
  });

  const Rglobal = matVec(K, D).map((v, i) => v - F[i]);
  Object.keys(springInfo).forEach((dofStr) => {
    const dof = +dofStr;
    const { k, delta } = springInfo[dof];
    Rglobal[dof] = k * (delta - D[dof]);
  });

  // Globalize displacement vector D
  const D_global = [...D];
  nodes.forEach((n, i) => {
    const Tp = T_nodes[i];
    if (Tp) {
      const D_local_i = D.slice(6 * i, 6 * i + 6);
      const D_global_i = matVec(Tp, D_local_i);
      for (let d = 0; d < 6; d++) {
        D_global[6 * i + d] = D_global_i[d];
      }
    }
  });

  // Overwrite D with D_global for global post-processing and returned values
  for (let i = 0; i < nDof; i++) {
    D[i] = D_global[i];
  }

  // Sample internal forces and displacements along each member (40 subdivisions per member)
  const NSAMP = 40;
  let maxDisp = 0;
  let maxN = 0;
  let maxVy = 0;
  let maxVz = 0;
  let maxMx = 0;
  let maxMy = 0;
  let maxMz = 0;
  let maxStress = 0;

  const results: MemberSampleData3D[] = elemData.map((ed) => {
    const dg = ed.dofMap.map((i) => D[i]);
    const dLocalRaw = matVec(ed.T, dg);
    const dLocal = backSubstitute3D(ed.kFull, ed.fFull, dLocalRaw, ed.condIdx);
    const Fend = matVec(ed.kFull, dLocal).map((v, i) => v - ed.fFull[i]);

    const pts: PointResult3D[] = [];
    const L = ed.L;
    const sec = ed.sec;
    const mat = ed.mat;
    const E = mat.E * UNIT.GPa;
    const G = mat.G * UNIT.GPa;
    const A = sec.A * UNIT.cm2;
    const Iy = sec.Iy * UNIT.cm4;
    const Iz = sec.Iz * UNIT.cm4;
    const It = sec.It * UNIT.cm4;

    const N0 = -Fend[0];
    const Vy0 = Fend[1];
    const Vz0 = Fend[2];
    const Mx0 = -Fend[3];
    const My0 = -Fend[4];
    const Mz0 = -Fend[5];

    // Local distributed loads on member (including self-weight if enabled)
    let qxS = 0, qxE = 0, qyS = 0, qyE = 0, qzS = 0, qzE = 0;
    if (ed.el.q) {
      let qx1 = ed.el.q.qxStart, qx2 = ed.el.q.qxEnd;
      let qy1 = ed.el.q.qyStart, qy2 = ed.el.q.qyEnd;
      let qz1 = ed.el.q.qzStart, qz2 = ed.el.q.qzEnd;
      if (ed.el.q.coordinateSystem === 'global') {
        const qSLoc = matVec(ed.R, [qx1, qy1, qz1]);
        const qELoc = matVec(ed.R, [qx2, qy2, qz2]);
        qx1 = qSLoc[0]; qy1 = qSLoc[1]; qz1 = qSLoc[2];
        qx2 = qELoc[0]; qy2 = qELoc[1]; qz2 = qELoc[2];
      }
      qxS += qx1; qxE += qx2;
      qyS += qy1; qyE += qy2;
      qzS += qz1; qzE += qz2;
    }
    if (model.settings?.params.includeSelfWeight) {
      const qGravGlobal = mat.density * (9.81 / 1000) * A;
      const qGravLoc = matVec(ed.R, [0, 0, -qGravGlobal]);
      qxS += qGravLoc[0]; qxE += qGravLoc[0];
      qyS += qGravLoc[1]; qyE += qGravLoc[1];
      qzS += qGravLoc[2]; qzE += qGravLoc[2];
    }

    const cTopY = (sec.cTopY || sec.h / 2) * UNIT.cm;
    const cBotY = (sec.cBotY || sec.h / 2) * UNIT.cm;
    const cTopZ = (sec.cTopZ || sec.b / 2) * UNIT.cm;
    const cBotZ = (sec.cBotZ || sec.b / 2) * UNIT.cm;

    for (let k = 0; k <= NSAMP; k++) {
      const x = (L * k) / NSAMP;
      const { N1, N2, H1, H2, H3, H4 } = shapeFunctions3D(x, L);

      // Add particular deflection solution and slopes for distributed loads (fixed-fixed particular solution)
      let uy_part = 0;
      let duy_part = 0;
      if (E * Iz > 0 && (Math.abs(qyS) > 1e-9 || Math.abs(qyE) > 1e-9)) {
        const qS = qyS;
        const dq = qyE - qyS;
        const factor = (x * x * (L - x) * (L - x)) / (24 * E * Iz);
        uy_part = factor * (qS + (dq / (5 * L)) * (x + 2 * L));

        const d_uniform = (qS / (12 * E * Iz)) * x * (L - x) * (L - 2 * x);
        const d_tri = (dq / (120 * E * Iz * L)) * x * (L - x) * (4 * L * L - 5 * L * x - 5 * x * x);
        duy_part = d_uniform + d_tri;
      }

      let uz_part = 0;
      let duz_part = 0;
      if (E * Iy > 0 && (Math.abs(qzS) > 1e-9 || Math.abs(qzE) > 1e-9)) {
        const qS = qzS;
        const dq = qzE - qzS;
        const factor = (x * x * (L - x) * (L - x)) / (24 * E * Iy);
        uz_part = factor * (qS + (dq / (5 * L)) * (x + 2 * L));

        const d_uniform = (qS / (12 * E * Iy)) * x * (L - x) * (L - 2 * x);
        const d_tri = (dq / (120 * E * Iy * L)) * x * (L - x) * (4 * L * L - 5 * L * x - 5 * x * x);
        duz_part = d_uniform + d_tri;
      }

      // Interpolate nodal end displacements + particular solution
      const ux = N1 * dLocal[0] + N2 * dLocal[6];
      const uy = H1 * dLocal[1] + H2 * dLocal[5] + H3 * dLocal[7] + H4 * dLocal[11] + uy_part;
      const uz = H1 * dLocal[2] - H2 * dLocal[4] + H3 * dLocal[8] - H4 * dLocal[10] + uz_part;

      const rotx = N1 * dLocal[3] + N2 * dLocal[9];

      // Slopes
      const xi = x / L;
      const dH1 = (-6 * xi + 6 * xi * xi) / L;
      const dH2 = 1 - 4 * xi + 3 * xi * xi;
      const dH3 = (6 * xi - 6 * xi * xi) / L;
      const dH4 = -2 * xi + 3 * xi * xi;

      const rotz = dH1 * dLocal[1] + dH2 * dLocal[5] + dH3 * dLocal[7] + dH4 * dLocal[11] + duy_part;
      const roty = -(dH1 * dLocal[2] - dH2 * dLocal[4] + dH3 * dLocal[8] - dH4 * dLocal[10]) - duz_part;

      // Global displacements
      const Ux = ed.vx[0] * ux + ed.vy[0] * uy + ed.vz[0] * uz;
      const Uy = ed.vx[1] * ux + ed.vy[1] * uy + ed.vz[1] * uz;
      const Uz = ed.vx[2] * ux + ed.vy[2] * uy + ed.vz[2] * uz;

      // Integrals of distributed load from 0 to x
      const Iqx = qxS * x + ((qxE - qxS) / (2 * L)) * x * x;
      const Iqy = qyS * x + ((qyE - qyS) / (2 * L)) * x * x;
      const Iqz = qzS * x + ((qzE - qzS) / (2 * L)) * x * x;

      const MqyIntegral = qyS * (x * x / 2) + ((qyE - qyS) / (6 * L)) * Math.pow(x, 3);
      const MqzIntegral = qzS * (x * x / 2) + ((qzE - qzS) / (6 * L)) * Math.pow(x, 3);

      // Postprocessed internal forces along element
      const N = N0 - Iqx;
      const Vy = Vy0 + Iqy;
      const Vz = Vz0 + Iqz;
      const Mx = Mx0;
      const My = My0 - Vz0 * x - MqzIntegral;
      const Mz = Mz0 + Vy0 * x + MqyIntegral;

      // Extreme normal stresses: sigma = N/A +- My*z/Iy +- Mz*y/Iz
      const sigAxial = A > 0 ? N / A : 0;
      const sigBendingY = Iy > 0 ? (Math.abs(My) * Math.max(cTopZ, cBotZ)) / Iy : 0;
      const sigBendingZ = Iz > 0 ? (Math.abs(Mz) * Math.max(cTopY, cBotY)) / Iz : 0;

      const sigMax = sigAxial + sigBendingY + sigBendingZ;
      const sigMin = sigAxial - sigBendingY - sigBendingZ;

      const dispMag = Math.hypot(Ux, Uy, Uz);
      maxDisp = Math.max(maxDisp, dispMag);
      maxN = Math.max(maxN, Math.abs(N));
      maxVy = Math.max(maxVy, Math.abs(Vy));
      maxVz = Math.max(maxVz, Math.abs(Vz));
      maxMx = Math.max(maxMx, Math.abs(Mx));
      maxMy = Math.max(maxMy, Math.abs(My));
      maxMz = Math.max(maxMz, Math.abs(Mz));
      maxStress = Math.max(maxStress, Math.abs(sigMax), Math.abs(sigMin));

      pts.push({
        x,
        N,
        Vy,
        Vz,
        Mx,
        My,
        Mz,
        ux_local: ux,
        uy_local: uy,
        uz_local: uz,
        rotx_local: rotx,
        roty_local: roty,
        rotz_local: rotz,
        Ux_global: Ux,
        Uy_global: Uy,
        Uz_global: Uz,
        sigMax,
        sigMin,
      });
    }

    return {
      pts,
      L,
      vx: ed.vx,
      vy: ed.vy,
      vz: ed.vz,
      n1: ed.n1,
      n2: ed.n2,
    };
  });

  const reactions: Record<number, { Rx: number; Ry: number; Rz: number; Mx: number; My: number; Mz: number }> = {};
  nodes.forEach((n, idx) => {
    reactions[n.id] = {
      Rx: Rglobal[6 * idx + 0] || 0,
      Ry: Rglobal[6 * idx + 1] || 0,
      Rz: Rglobal[6 * idx + 2] || 0,
      Mx: Rglobal[6 * idx + 3] || 0,
      My: Rglobal[6 * idx + 4] || 0,
      Mz: Rglobal[6 * idx + 5] || 0,
    };
  });

  const elementsMap: Record<number, { points: PointResult3D[] }> = {};
  elemData.forEach((ed, idx) => {
    elementsMap[ed.el.id] = {
      points: results[idx].pts,
    };
  });

  return {
    type: 'linear_static',
    D,
    Rglobal,
    results,
    reactions,
    elements: elementsMap,
    singular,
    maxDisp,
    maxN,
    maxVy,
    maxVz,
    maxMx,
    maxMy,
    maxMz,
    maxStress,
  };
}

export function localGeometricStiffness3D(N: number, L: number): number[][] {
  const kg = zerosMat(12, 12);
  if (Math.abs(N) < 1e-12 || L < 1e-6) return kg;
  const factor = N / L;

  // Translation y & Rotation z
  kg[1][1] = factor * 1.2;
  kg[1][5] = factor * (L / 10);
  kg[1][7] = factor * -1.2;
  kg[1][11] = factor * (L / 10);

  kg[5][1] = factor * (L / 10);
  kg[5][5] = factor * ((2 * L * L) / 15);
  kg[5][7] = factor * (-L / 10);
  kg[5][11] = factor * ((-L * L) / 30);

  kg[7][1] = factor * -1.2;
  kg[7][5] = factor * (-L / 10);
  kg[7][7] = factor * 1.2;
  kg[7][11] = factor * (-L / 10);

  kg[11][1] = factor * (L / 10);
  kg[11][5] = factor * ((-L * L) / 30);
  kg[11][7] = factor * (-L / 10);
  kg[11][11] = factor * ((2 * L * L) / 15);

  // Translation z & Rotation y
  kg[2][2] = factor * 1.2;
  kg[2][4] = factor * (-L / 10);
  kg[2][8] = factor * -1.2;
  kg[2][10] = factor * (-L / 10);

  kg[4][2] = factor * (-L / 10);
  kg[4][4] = factor * ((2 * L * L) / 15);
  kg[4][8] = factor * (L / 10);
  kg[4][10] = factor * ((-L * L) / 30);

  kg[8][2] = factor * -1.2;
  kg[8][4] = factor * (L / 10);
  kg[8][8] = factor * 1.2;
  kg[8][10] = factor * (L / 10);

  kg[10][2] = factor * (-L / 10);
  kg[10][4] = factor * ((-L * L) / 30);
  kg[10][8] = factor * (L / 10);
  kg[10][10] = factor * ((2 * L * L) / 15);

  return kg;
}

export function solveStability3D(
  model: SolverModel3D,
  maxModes = 4,
  precomputedStaticResult?: LinearStaticResult3D
): StabilityResult3D {
  const staticSolved = precomputedStaticResult || solveLinearStatic3D(model);
  if (staticSolved.singular) {
    return {
      type: 'stability',
      modes: [],
      currentMode: 0,
      modalSign: 1,
      staticSolved,
      singular: true,
      reactions: staticSolved.reactions || {},
      elements: staticSolved.elements || {},
    };
  }

  const { nodes, elements } = distributePanelLoads(model.nodes, model.elements, model.panels);
  const nDof = 6 * nodes.length;
  const nodeIndex: Record<number, number> = {};
  nodes.forEach((n, i) => (nodeIndex[n.id] = i));

  const KG = zerosMat(nDof, nDof);
  const K = zerosMat(nDof, nDof);

  let hasCompression = false;

  elements.forEach((el, idx) => {
    const n1 = nodes.find((n) => n.id === el.n1)!;
    const n2 = nodes.find((n) => n.id === el.n2)!;
    const { L, T, Tt } = computeLocalAxes(n1, n2, el.rollAngle || 0);

    const edRes = staticSolved.results[idx];
    const Navg = (edRes.pts[0].N + edRes.pts[edRes.pts.length - 1].N) / 2;
    if (Navg < -1e-6) hasCompression = true;

    const condIdx = getElementCondIdx(el);
    const mat = model.materials.find((m) => m.id === el.materialId) || model.materials[0];
    const sec = model.sections.find((s) => s.id === el.sectionId) || model.sections[0];
    const E = mat.E * UNIT.GPa;
    const G = mat.G * UNIT.GPa;
    const A = sec.A * UNIT.cm2;
    const Iy = sec.Iy * UNIT.cm4;
    const Iz = sec.Iz * UNIT.cm4;
    const It = sec.It * UNIT.cm4;

    const kFull = localStiffness3D(E, G, A, Iy, Iz, It, L);
    const { k: kCond } = condense3D(kFull, zerosVec(12), condIdx);
    const kGlobal = matMul(matMul(Tt, kCond), T);

    const kgFull = localGeometricStiffness3D(Navg, L);
    const kgCond = condenseGuyan3D(kgFull, kFull, condIdx);
    const kgGlobal = matMul(matMul(Tt, kgCond), T);

    const dofMap = [
      6 * nodeIndex[el.n1] + 0,
      6 * nodeIndex[el.n1] + 1,
      6 * nodeIndex[el.n1] + 2,
      6 * nodeIndex[el.n1] + 3,
      6 * nodeIndex[el.n1] + 4,
      6 * nodeIndex[el.n1] + 5,
      6 * nodeIndex[el.n2] + 0,
      6 * nodeIndex[el.n2] + 1,
      6 * nodeIndex[el.n2] + 2,
      6 * nodeIndex[el.n2] + 3,
      6 * nodeIndex[el.n2] + 4,
      6 * nodeIndex[el.n2] + 5,
    ];

    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        KG[dofMap[i]][dofMap[j]] += kgGlobal[i][j];
        K[dofMap[i]][dofMap[j]] += kGlobal[i][j];
      }
    }
  });

  // Rotate support conditions for stiffness matrix K and geometric stiffness matrix KG
  const T_nodes = applySupportRotations(nodes, K, undefined, KG);

  const isFixed = new Array(nDof).fill(false);
  nodes.forEach((n, i) => {
    if (!n.support) return;
    const sp = n.support;
    const dirs = [sp.ux, sp.uy, sp.uz, sp.rx, sp.ry, sp.rz];
    dirs.forEach((c, d) => {
      if (!c || c.type === 'free') return;
      if (c.type === 'fixed') isFixed[6 * i + d] = true;
      else if (c.type === 'spring') K[6 * i + d][6 * i + d] += c.k || 1000;
    });
  });

  autoLockZeroStiffnessDofs(K, isFixed);

  let maxDiag = 0;
  for (let i = 0; i < nDof; i++) maxDiag = Math.max(maxDiag, Math.abs(K[i][i]));

  const freeIdx: number[] = [];
  for (let i = 0; i < nDof; i++) {
    if (!isFixed[i]) freeIdx.push(i);
  }

  if (freeIdx.length === 0 || !hasCompression) {
    return {
      type: 'stability',
      modes: [],
      currentMode: 0,
      modalSign: 1,
      staticSolved,
      singular: false,
      noCompression: true,
      reactions: staticSolved.reactions || {},
      elements: staticSolved.elements || {},
    };
  }

  const Kff = freeIdx.map((i) => freeIdx.map((j) => K[i][j]));
  const KGff = freeIdx.map((i) => freeIdx.map((j) => KG[i][j]));
  const nFree = freeIdx.length;

  const B = zerosMat(nFree, nFree);
  for (let i = 0; i < nFree; i++) {
    for (let j = 0; j < nFree; j++) {
      B[i][j] = -KGff[i][j];
    }
  }

  let Lchol = cholesky(Kff);
  if (!Lchol) {
    for (const shiftFactor of [1e-7, 1e-5, 1e-3, 1e-1]) {
      const regKff = Kff.map((row, i) =>
        row.map((v, j) => (i === j ? v + shiftFactor * Math.max(maxDiag, 1) : v))
      );
      Lchol = cholesky(regKff);
      if (Lchol) break;
    }
    if (!Lchol) {
      return {
        type: 'stability',
        modes: [],
        currentMode: 0,
        modalSign: 1,
        staticSolved,
        singular: true,
        reactions: staticSolved.reactions || {},
        elements: staticSolved.elements || {},
      };
    }
  }

  const Y = zerosMat(nFree, nFree);
  for (let col = 0; col < nFree; col++) {
    const bCol = B.map((row) => row[col]);
    const yCol = solveL(Lchol, bCol);
    for (let row = 0; row < nFree; row++) Y[row][col] = yCol[row];
  }

  const Btilde = zerosMat(nFree, nFree);
  for (let row = 0; row < nFree; row++) {
    const yRow = Y[row];
    const bRow = solveL(Lchol, yRow);
    for (let col = 0; col < nFree; col++) Btilde[row][col] = bRow[col];
  }

  for (let i = 0; i < nFree; i++) {
    for (let j = i + 1; j < nFree; j++) {
      const avg = (Btilde[i][j] + Btilde[j][i]) / 2;
      Btilde[i][j] = avg;
      Btilde[j][i] = avg;
    }
  }

  const { eigenvalues: mu, eigenvectors: V } = jacobiSymmetric(Btilde, 200, 1e-12);

  const rawModes: { alphaCr: number; D: number[] }[] = [];
  for (let k = 0; k < nFree; k++) {
    const val = mu[k];
    if (val > 1e-9) {
      const alphaCr = 1 / val;
      const y_k = V.map((row) => row[k]);
      const phi_free = solveLT(Lchol, y_k);

      const D = zerosVec(nDof);
      freeIdx.forEach((gi, idx) => {
        D[gi] = phi_free[idx];
      });

      // Transform D back to global coordinates for correct displacement and shape calculations
      const D_global = [...D];
      nodes.forEach((n, i) => {
        const Tp = T_nodes[i];
        if (Tp) {
          const D_local_i = D.slice(6 * i, 6 * i + 6);
          const D_global_i = matVec(Tp, D_local_i);
          for (let d = 0; d < 6; d++) {
            D_global[6 * i + d] = D_global_i[d];
          }
        }
      });

      rawModes.push({ alphaCr, D: D_global });
    }
  }

  rawModes.sort((a, b) => a.alphaCr - b.alphaCr);
  const selectedRawModes = rawModes.slice(0, maxModes);

  const modes: BucklingMode3D[] = selectedRawModes.map((rm, modeIndex) => {
    const alphaCr = rm.alphaCr;
    let D = rm.D;

    // Normalizing displacements
    let maxDisp = 0;
    for (let i = 0; i < nodes.length; i++) {
      const disp = Math.hypot(D[6 * i + 0], D[6 * i + 1], D[6 * i + 2]);
      maxDisp = Math.max(maxDisp, disp);
    }
    if (maxDisp > 1e-12) {
      const norm = 1.0 / maxDisp;
      D = D.map((v) => v * norm);
      maxDisp = 1.0;
    }

    const results: MemberSampleData3D[] = elements.map((el, elIdx) => {
      const n1 = nodes.find((n) => n.id === el.n1)!;
      const n2 = nodes.find((n) => n.id === el.n2)!;
      const { L, vx, vy, vz, T } = computeLocalAxes(n1, n2, el.rollAngle || 0);

      const mat = model.materials.find((m) => m.id === el.materialId) || model.materials[0];
      const sec = model.sections.find((s) => s.id === el.sectionId) || model.sections[0];
      const E = mat.E * UNIT.GPa;
      const G = mat.G * UNIT.GPa;
      const A = sec.A * UNIT.cm2;
      const Iy = sec.Iy * UNIT.cm4;
      const Iz = sec.Iz * UNIT.cm4;
      const It = sec.It * UNIT.cm4;
      const kFull = localStiffness3D(E, G, A, Iy, Iz, It, L);
      const condIdx = getElementCondIdx(el);

      const dofMap = [
        6 * nodeIndex[el.n1] + 0,
        6 * nodeIndex[el.n1] + 1,
        6 * nodeIndex[el.n1] + 2,
        6 * nodeIndex[el.n1] + 3,
        6 * nodeIndex[el.n1] + 4,
        6 * nodeIndex[el.n1] + 5,
        6 * nodeIndex[el.n2] + 0,
        6 * nodeIndex[el.n2] + 1,
        6 * nodeIndex[el.n2] + 2,
        6 * nodeIndex[el.n2] + 3,
        6 * nodeIndex[el.n2] + 4,
        6 * nodeIndex[el.n2] + 5,
      ];
      const dg = dofMap.map((i) => D[i]);
      const dLocalRaw = matVec(T, dg);
      const dLocal = backSubstitute3D(kFull, zerosVec(12), dLocalRaw, condIdx);

      const pts: PointResult3D[] = [];
      const NSAMP = 20;

      for (let k = 0; k <= NSAMP; k++) {
        const x = (L * k) / NSAMP;
        const { N1, N2, H1, H2, H3, H4 } = shapeFunctions3D(x, L);

        const ux = N1 * dLocal[0] + N2 * dLocal[6];
        const uy = H1 * dLocal[1] + H2 * dLocal[5] + H3 * dLocal[7] + H4 * dLocal[11];
        const uz = H1 * dLocal[2] - H2 * dLocal[4] + H3 * dLocal[8] - H4 * dLocal[10];

        const Ux = vx[0] * ux + vy[0] * uy + vz[0] * uz;
        const Uy = vx[1] * ux + vy[1] * uy + vz[1] * uz;
        const Uz = vx[2] * ux + vy[2] * uy + vz[2] * uz;

        const basePr = staticSolved.results[elIdx].pts[k];

        pts.push({
          x,
          N: alphaCr * basePr.N,
          Vy: alphaCr * basePr.Vy,
          Vz: alphaCr * basePr.Vz,
          Mx: alphaCr * basePr.Mx,
          My: alphaCr * basePr.My,
          Mz: alphaCr * basePr.Mz,
          ux_local: ux,
          uy_local: uy,
          uz_local: uz,
          rotx_local: 0,
          roty_local: 0,
          rotz_local: 0,
          Ux_global: Ux,
          Uy_global: Uy,
          Uz_global: Uz,
          sigMax: alphaCr * basePr.sigMax,
          sigMin: alphaCr * basePr.sigMin,
        });
      }

      return { pts, L, vx, vy, vz, n1, n2 };
    });

    let maxNcr = 0;
    staticSolved.results.forEach((r) => {
      r.pts.forEach((p) => {
        if (p.N < 0) maxNcr = Math.max(maxNcr, Math.abs(p.N * alphaCr));
      });
    });

    return {
      modeIndex,
      alphaCr,
      D,
      results,
      maxDisp,
      maxNcr,
    };
  });

  const elementsMap: Record<number, { points: PointResult3D[] }> = {};
  elements.forEach((el, idx) => {
    elementsMap[el.id] = {
      points: (modes[0]?.results[idx] || staticSolved.results[idx])?.pts || [],
    };
  });

  return {
    type: 'stability',
    modes,
    currentMode: 0,
    modalSign: 1,
    staticSolved,
    singular: false,
    noCompression: modes.length === 0,
    reactions: staticSolved.reactions || {},
    elements: elementsMap,
  };
}

export function localConsistentMass3D(mTotal: number, L: number): number[][] {
  const m = zerosMat(12, 12);
  if (mTotal <= 1e-15 || L < 1e-6) return m;

  // Translational mass
  const ma = mTotal / 6;
  m[0][0] = 2 * ma;
  m[0][6] = 1 * ma;
  m[6][0] = 1 * ma;
  m[6][6] = 2 * ma;

  const mb = mTotal / 420;
  // y transverse
  m[1][1] = 156 * mb;
  m[1][5] = 22 * L * mb;
  m[1][7] = 54 * mb;
  m[1][11] = -13 * L * mb;

  m[5][1] = 22 * L * mb;
  m[5][5] = 4 * L * L * mb;
  m[5][7] = 13 * L * mb;
  m[5][11] = -3 * L * L * mb;

  m[7][1] = 54 * mb;
  m[7][5] = 13 * L * mb;
  m[7][7] = 156 * mb;
  m[7][11] = -22 * L * mb;

  m[11][1] = -13 * L * mb;
  m[11][5] = -3 * L * L * mb;
  m[11][7] = -22 * L * mb;
  m[11][11] = 4 * L * L * mb;

  // z transverse
  m[2][2] = 156 * mb;
  m[2][4] = -22 * L * mb;
  m[2][8] = 54 * mb;
  m[2][10] = 13 * L * mb;

  m[4][2] = -22 * L * mb;
  m[4][4] = 4 * L * L * mb;
  m[4][8] = -13 * L * mb;
  m[4][10] = -3 * L * L * mb;

  m[8][2] = 54 * mb;
  m[8][4] = -13 * L * mb;
  m[8][8] = 156 * mb;
  m[8][10] = 22 * L * mb;

  m[10][2] = 13 * L * mb;
  m[10][4] = -3 * L * L * mb;
  m[10][8] = 22 * L * mb;
  m[10][10] = 4 * L * L * mb;

  return m;
}

export function solveModal3D(model: SolverModel3D, maxModes = 4): ModalResult3D {
  const { nodes, elements } = distributePanelLoads(model.nodes, model.elements, model.panels);
  const nDof = 6 * nodes.length;
  const nodeIndex: Record<number, number> = {};
  nodes.forEach((n, i) => (nodeIndex[n.id] = i));

  const K = zerosMat(nDof, nDof);
  const M = zerosMat(nDof, nDof);

  const includeElemMass = model.settings?.params.includeElementMass !== false;

  elements.forEach((el) => {
    const n1 = nodes.find((n) => n.id === el.n1)!;
    const n2 = nodes.find((n) => n.id === el.n2)!;
    const { L, T, Tt } = computeLocalAxes(n1, n2, el.rollAngle || 0);

    const mat = model.materials.find((m) => m.id === el.materialId) || model.materials[0];
    const sec = model.sections.find((s) => s.id === el.sectionId) || model.sections[0];
    const E = mat.E * UNIT.GPa;
    const G = mat.G * UNIT.GPa;
    const A = sec.A * UNIT.cm2;
    const Iy = sec.Iy * UNIT.cm4;
    const Iz = sec.Iz * UNIT.cm4;
    const It = sec.It * UNIT.cm4;

    const condIdx = getElementCondIdx(el);
    const kFull = localStiffness3D(E, G, A, Iy, Iz, It, L);
    const { k: kCond } = condense3D(kFull, zerosVec(12), condIdx);
    const kGlobal = matMul(matMul(Tt, kCond), T);

    const mTotal = includeElemMass ? (mat.density * A * L) / 1000 : 0; // tonnes
    let mGlobal = zerosMat(12, 12);
    if (mTotal > 1e-15) {
      const mLocal = localConsistentMass3D(mTotal, L);
      const mCond = condenseGuyan3D(mLocal, kFull, condIdx);
      mGlobal = matMul(matMul(Tt, mCond), T);
    }

    const dofMap = [
      6 * nodeIndex[el.n1] + 0,
      6 * nodeIndex[el.n1] + 1,
      6 * nodeIndex[el.n1] + 2,
      6 * nodeIndex[el.n1] + 3,
      6 * nodeIndex[el.n1] + 4,
      6 * nodeIndex[el.n1] + 5,
      6 * nodeIndex[el.n2] + 0,
      6 * nodeIndex[el.n2] + 1,
      6 * nodeIndex[el.n2] + 2,
      6 * nodeIndex[el.n2] + 3,
      6 * nodeIndex[el.n2] + 4,
      6 * nodeIndex[el.n2] + 5,
    ];

    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 12; j++) {
        K[dofMap[i]][dofMap[j]] += kGlobal[i][j];
        M[dofMap[i]][dofMap[j]] += mGlobal[i][j];
      }
    }
  });

  // Lumped nodal masses
  nodes.forEach((n, i) => {
    if (n.mass) {
      const mx = (n.mass.mx || 0) / 1000;
      const my = (n.mass.my || 0) / 1000;
      const mz = (n.mass.mz || 0) / 1000;
      if (mx > 0) M[6 * i + 0][6 * i + 0] += mx;
      if (my > 0) M[6 * i + 1][6 * i + 1] += my;
      if (mz > 0) M[6 * i + 2][6 * i + 2] += mz;
    }
  });

  // Rotate support conditions for stiffness matrix K and mass matrix M
  const T_nodes = applySupportRotations(nodes, K, undefined, M);

  const isFixed = new Array(nDof).fill(false);
  nodes.forEach((n, i) => {
    if (!n.support) return;
    const sp = n.support;
    const dirs = [sp.ux, sp.uy, sp.uz, sp.rx, sp.ry, sp.rz];
    dirs.forEach((c, d) => {
      if (!c || c.type === 'free') return;
      if (c.type === 'fixed') isFixed[6 * i + d] = true;
      else if (c.type === 'spring') K[6 * i + d][6 * i + d] += c.k || 1000;
    });
  });

  autoLockZeroStiffnessDofs(K, isFixed);

  let maxDiag = 0;
  for (let i = 0; i < nDof; i++) maxDiag = Math.max(maxDiag, Math.abs(K[i][i]));

  const freeIdx: number[] = [];
  for (let i = 0; i < nDof; i++) {
    if (!isFixed[i]) freeIdx.push(i);
  }

  if (freeIdx.length === 0) {
    return {
      type: 'modal',
      modes: [],
      currentMode: 0,
      modalSign: 1,
      singular: false,
      noMass: false,
      reactions: {},
      elements: {},
    };
  }

  const Kff = freeIdx.map((i) => freeIdx.map((j) => K[i][j]));
  const Mff = freeIdx.map((i) => freeIdx.map((j) => M[i][j]));
  const nFree = freeIdx.length;

  let totalFreeMass = 0;
  for (let i = 0; i < nFree; i++) totalFreeMass += Math.abs(Mff[i][i]);
  if (totalFreeMass < 1e-12) {
    return {
      type: 'modal',
      modes: [],
      currentMode: 0,
      modalSign: 1,
      singular: false,
      noMass: true,
      reactions: {},
      elements: {},
    };
  }

  let Lchol = cholesky(Kff);
  if (!Lchol) {
    for (const shiftFactor of [1e-7, 1e-5, 1e-3, 1e-1]) {
      const regKff = Kff.map((row, i) =>
        row.map((v, j) => (i === j ? v + shiftFactor * Math.max(maxDiag, 1) : v))
      );
      Lchol = cholesky(regKff);
      if (Lchol) break;
    }
    if (!Lchol) {
      return {
        type: 'modal',
        modes: [],
        currentMode: 0,
        modalSign: 1,
        singular: true,
        noMass: false,
        reactions: {},
        elements: {},
      };
    }
  }

  const Y = zerosMat(nFree, nFree);
  for (let col = 0; col < nFree; col++) {
    const bCol = Mff.map((row) => row[col]);
    const yCol = solveL(Lchol, bCol);
    for (let row = 0; row < nFree; row++) Y[row][col] = yCol[row];
  }

  const Btilde = zerosMat(nFree, nFree);
  for (let row = 0; row < nFree; row++) {
    const yRow = Y[row];
    const bRow = solveL(Lchol, yRow);
    for (let col = 0; col < nFree; col++) Btilde[row][col] = bRow[col];
  }

  for (let i = 0; i < nFree; i++) {
    for (let j = i + 1; j < nFree; j++) {
      const avg = (Btilde[i][j] + Btilde[j][i]) / 2;
      Btilde[i][j] = avg;
      Btilde[j][i] = avg;
    }
  }

  const { eigenvalues: mu, eigenvectors: V } = jacobiSymmetric(Btilde, 200, 1e-12);

  let MtotX = 0;
  let MtotY = 0;
  let MtotZ = 0;
  for (let i = 0; i < nodes.length; i++) {
    MtotX += M[6 * i + 0][6 * i + 0];
    MtotY += M[6 * i + 1][6 * i + 1];
    MtotZ += M[6 * i + 2][6 * i + 2];
  }

  const rawModes: {
    omega: number;
    f: number;
    T: number;
    D: number[];
    massRatioX: number;
    massRatioY: number;
    massRatioZ: number;
  }[] = [];

  for (let k = 0; k < nFree; k++) {
    const val = mu[k];
    if (val > 1e-14) {
      const omega = 1.0 / Math.sqrt(val);
      const f = omega / (2 * Math.PI);
      const T = 1.0 / f;
      const y_k = V.map((row) => row[k]);
      const phi_free = solveLT(Lchol, y_k);

      const D = zerosVec(nDof);
      freeIdx.forEach((gi, idx) => {
        D[gi] = phi_free[idx];
      });

      // Compute local mass-displacements product
      const mRowD_local = zerosVec(nDof);
      for (let i = 0; i < nDof; i++) {
        let sum = 0;
        for (let j = 0; j < nDof; j++) {
          sum += M[i][j] * D[j];
        }
        mRowD_local[i] = sum;
      }

      // Transform D and mRowD_local back to global coordinates for correct participation & shape calculations
      const D_global = [...D];
      const mRowD_global = [...mRowD_local];
      nodes.forEach((n, i) => {
        const Tp = T_nodes[i];
        if (Tp) {
          const D_local_i = D.slice(6 * i, 6 * i + 6);
          const D_global_i = matVec(Tp, D_local_i);
          for (let d = 0; d < 6; d++) {
            D_global[6 * i + d] = D_global_i[d];
          }

          const mRowD_local_i = mRowD_local.slice(6 * i, 6 * i + 6);
          const mRowD_global_i = matVec(Tp, mRowD_local_i);
          for (let d = 0; d < 6; d++) {
            mRowD_global[6 * i + d] = mRowD_global_i[d];
          }
        }
      });

      // Generalized modal mass & participation using globalized vectors
      let Mgen = 0;
      let Lx = 0;
      let Ly = 0;
      let Lz = 0;
      for (let i = 0; i < nDof; i++) {
        Mgen += D_global[i] * mRowD_global[i];
        if (i % 6 === 0) Lx += mRowD_global[i];
        if (i % 6 === 1) Ly += mRowD_global[i];
        if (i % 6 === 2) Lz += mRowD_global[i];
      }

      let massRatioX = 0;
      let massRatioY = 0;
      let massRatioZ = 0;
      if (Mgen > 1e-15) {
        massRatioX = MtotX > 1e-9 ? ((Lx * Lx) / Mgen / MtotX) * 100 : 0;
        massRatioY = MtotY > 1e-9 ? ((Ly * Ly) / Mgen / MtotY) * 100 : 0;
        massRatioZ = MtotZ > 1e-9 ? ((Lz * Lz) / Mgen / MtotZ) * 100 : 0;
      }

      rawModes.push({ omega, f, T, D: D_global, massRatioX, massRatioY, massRatioZ });
    }
  }

  rawModes.sort((a, b) => a.f - b.f);
  const selectedRawModes = rawModes.slice(0, maxModes);

  const modes: ModalMode3D[] = selectedRawModes.map((rm, modeIndex) => {
    let D = rm.D;
    let maxDisp = 0;
    for (let i = 0; i < nodes.length; i++) {
      const disp = Math.hypot(D[6 * i + 0], D[6 * i + 1], D[6 * i + 2]);
      maxDisp = Math.max(maxDisp, disp);
    }
    if (maxDisp > 1e-12) {
      const norm = 1.0 / maxDisp;
      D = D.map((v) => v * norm);
      maxDisp = 1.0;
    }

    const results: MemberSampleData3D[] = elements.map((el) => {
      const n1 = nodes.find((n) => n.id === el.n1)!;
      const n2 = nodes.find((n) => n.id === el.n2)!;
      const { L, vx, vy, vz, T } = computeLocalAxes(n1, n2, el.rollAngle || 0);

      const mat = model.materials.find((m) => m.id === el.materialId) || model.materials[0];
      const sec = model.sections.find((s) => s.id === el.sectionId) || model.sections[0];
      const E = mat.E * UNIT.GPa;
      const G = mat.G * UNIT.GPa;
      const A = sec.A * UNIT.cm2;
      const Iy = sec.Iy * UNIT.cm4;
      const Iz = sec.Iz * UNIT.cm4;
      const It = sec.It * UNIT.cm4;
      const kFull = localStiffness3D(E, G, A, Iy, Iz, It, L);
      const condIdx = getElementCondIdx(el);

      const dofMap = [
        6 * nodeIndex[el.n1] + 0,
        6 * nodeIndex[el.n1] + 1,
        6 * nodeIndex[el.n1] + 2,
        6 * nodeIndex[el.n1] + 3,
        6 * nodeIndex[el.n1] + 4,
        6 * nodeIndex[el.n1] + 5,
        6 * nodeIndex[el.n2] + 0,
        6 * nodeIndex[el.n2] + 1,
        6 * nodeIndex[el.n2] + 2,
        6 * nodeIndex[el.n2] + 3,
        6 * nodeIndex[el.n2] + 4,
        6 * nodeIndex[el.n2] + 5,
      ];
      const dg = dofMap.map((i) => D[i]);
      const dLocalRaw = matVec(T, dg);
      const dLocal = backSubstitute3D(kFull, zerosVec(12), dLocalRaw, condIdx);

      const pts: PointResult3D[] = [];
      const NSAMP = 20;

      for (let k = 0; k <= NSAMP; k++) {
        const x = (L * k) / NSAMP;
        const { N1, N2, H1, H2, H3, H4 } = shapeFunctions3D(x, L);

        const ux = N1 * dLocal[0] + N2 * dLocal[6];
        const uy = H1 * dLocal[1] + H2 * dLocal[5] + H3 * dLocal[7] + H4 * dLocal[11];
        const uz = H1 * dLocal[2] - H2 * dLocal[4] + H3 * dLocal[8] - H4 * dLocal[10];

        const Ux = vx[0] * ux + vy[0] * uy + vz[0] * uz;
        const Uy = vx[1] * ux + vy[1] * uy + vz[1] * uz;
        const Uz = vx[2] * ux + vy[2] * uy + vz[2] * uz;

        pts.push({
          x,
          N: 0,
          Vy: 0,
          Vz: 0,
          Mx: 0,
          My: 0,
          Mz: 0,
          ux_local: ux,
          uy_local: uy,
          uz_local: uz,
          rotx_local: 0,
          roty_local: 0,
          rotz_local: 0,
          Ux_global: Ux,
          Uy_global: Uy,
          Uz_global: Uz,
          sigMax: 0,
          sigMin: 0,
        });
      }

      return { pts, L, vx, vy, vz, n1, n2 };
    });

    return {
      modeIndex,
      omega: rm.omega,
      f: rm.f,
      T: rm.T,
      massRatioX: rm.massRatioX,
      massRatioY: rm.massRatioY,
      massRatioZ: rm.massRatioZ,
      D,
      results,
      maxDisp,
    };
  });

  const elementsMap: Record<number, { points: PointResult3D[] }> = {};
  elements.forEach((el, idx) => {
    elementsMap[el.id] = {
      points: modes[0]?.results[idx]?.pts || [],
    };
  });

  return {
    type: 'modal',
    modes,
    currentMode: 0,
    modalSign: 1,
    singular: false,
    noMass: modes.length === 0,
    reactions: {},
    elements: elementsMap,
  };
}
