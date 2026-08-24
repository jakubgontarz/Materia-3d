export function zerosMat(r: number, c: number): number[][] {
  return Array.from({ length: r }, () => new Array(c).fill(0));
}

export function zerosVec(n: number): number[] {
  return new Array(n).fill(0);
}

export function eyeMat(n: number): number[][] {
  const m = zerosMat(n, n);
  for (let i = 0; i < n; i++) m[i][i] = 1;
  return m;
}

export function matMul(A: number[][], B: number[][]): number[][] {
  const r = A.length;
  const k = B.length;
  const c = B[0].length;
  const out = zerosMat(r, c);
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      let s = 0;
      for (let m = 0; m < k; m++) s += A[i][m] * B[m][j];
      out[i][j] = s;
    }
  }
  return out;
}

export function matVec(A: number[][], v: number[]): number[] {
  const r = A.length;
  const c = A[0].length;
  const out = zerosVec(r);
  for (let i = 0; i < r; i++) {
    let s = 0;
    for (let j = 0; j < c; j++) s += A[i][j] * v[j];
    out[i] = s;
  }
  return out;
}

export function transpose(A: number[][]): number[][] {
  const r = A.length;
  const c = A[0].length;
  const out = zerosMat(c, r);
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) out[j][i] = A[i][j];
  }
  return out;
}

export function invSmall(A: number[][]): number[][] {
  const n = A.length;
  const M = A.map((row, i) => row.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    const tmp = M[col];
    M[col] = M[piv];
    M[piv] = tmp;
    const pv = M[col][col] || 1e-12;
    for (let j = 0; j < 2 * n; j++) M[col][j] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map((row) => row.slice(n));
}

export function solveLinSys(Ain: number[][], bin: number[]): { x: number[]; singular: boolean } {
  const n = Ain.length;
  const A = Ain.map((r) => r.slice());
  const b = bin.slice();
  let singular = false;

  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    }
    if (Math.abs(A[piv][col]) < 1e-11) {
      singular = true;
      continue;
    }
    const tmpA = A[col];
    A[col] = A[piv];
    A[piv] = tmpA;
    const tmpb = b[col];
    b[col] = b[piv];
    b[piv] = tmpb;
    const pv = A[col][col];
    for (let j = col; j < n; j++) A[col][j] /= pv;
    b[col] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      if (f === 0) continue;
      for (let j = col; j < n; j++) A[r][j] -= f * A[col][j];
      b[r] -= f * b[col];
    }
  }
  return { x: b, singular };
}

export function cholesky(A: number[][]): number[][] | null {
  const n = A.length;
  const L = zerosMat(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
      if (i === j) {
        const val = A[i][i] - sum;
        if (val <= 1e-12) return null;
        L[i][j] = Math.sqrt(val);
      } else {
        L[i][j] = (A[i][j] - sum) / (L[j][j] || 1e-12);
      }
    }
  }
  return L;
}

export function solveL(L: number[][], b: number[]): number[] {
  const n = L.length;
  const x = zerosVec(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < i; j++) sum += L[i][j] * x[j];
    x[i] = (b[i] - sum) / (L[i][i] || 1e-12);
  }
  return x;
}

export function solveLT(L: number[][], b: number[]): number[] {
  const n = L.length;
  const x = zerosVec(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) sum += L[j][i] * x[j];
    x[i] = (b[i] - sum) / (L[i][i] || 1e-12);
  }
  return x;
}

export function jacobiSymmetric(
  M: number[][],
  maxIter = 150,
  tol = 1e-11
): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = M.length;
  const A = M.map((r) => r.slice());
  const V = eyeMat(n);

  for (let iter = 0; iter < maxIter; iter++) {
    let maxOff = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        maxOff = Math.max(maxOff, Math.abs(A[i][j]));
      }
    }
    if (maxOff < tol) break;

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p][q];
        if (Math.abs(apq) < 1e-15) continue;
        const app = A[p][p];
        const aqq = A[q][q];
        const theta = 0.5 * Math.atan2(2 * apq, aqq - app);
        const c = Math.cos(theta);
        const s = Math.sin(theta);

        const App = c * c * app - 2 * s * c * apq + s * s * aqq;
        const Aqq = s * s * app + 2 * s * c * apq + c * c * aqq;
        A[p][p] = App;
        A[q][q] = Aqq;
        A[p][q] = 0;
        A[q][p] = 0;

        for (let k = 0; k < n; k++) {
          if (k !== p && k !== q) {
            const akp = A[k][p];
            const akq = A[k][q];
            A[k][p] = c * akp - s * akq;
            A[p][k] = A[k][p];
            A[k][q] = s * akp + c * akq;
            A[q][k] = A[k][q];
          }
          const vkp = V[k][p];
          const vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const eigenvalues: number[] = [];
  for (let i = 0; i < n; i++) eigenvalues.push(A[i][i]);
  return { eigenvalues, eigenvectors: V };
}

// 3D Vector helpers
export type Vec3 = [number, number, number];

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vec3Norm(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

export function vec3Normalize(v: Vec3): Vec3 {
  const len = vec3Norm(v);
  if (len < 1e-12) return [1, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}
