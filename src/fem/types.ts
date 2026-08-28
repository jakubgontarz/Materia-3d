export type SupportType = 'free' | 'fixed' | 'spring';

export interface SupportComponent {
  type: SupportType;
  k?: number; // stiffness in kN/m or kNm/rad
  delta?: number; // settlement in m or rad
}

export interface Support3D {
  ux: SupportComponent;
  uy: SupportComponent;
  uz: SupportComponent;
  rx: SupportComponent;
  ry: SupportComponent;
  rz: SupportComponent;
  name?: string;
}

export interface NodalForce3D {
  Fx: number; // kN
  Fy: number; // kN
  Fz: number; // kN
}

export interface NodalMoment3D {
  Mx: number; // kNm (torsion / moment about X)
  My: number; // kNm (moment about Y)
  Mz: number; // kNm (moment about Z)
}

export interface NodalMass3D {
  mx: number; // kg
  my: number; // kg
  mz: number; // kg
  Jx?: number; // kg*m^2
  Jy?: number; // kg*m^2
  Jz?: number; // kg*m^2
}

export interface Node3D {
  id: number;
  x: number; // m
  y: number; // m
  z: number; // m
  support: Support3D | null;
  force: NodalForce3D | null;
  moment: NodalMoment3D | null;
  mass: NodalMass3D | null;
}

export interface MemberHinges3D {
  // Start releases (local DOFs): ux, uy, uz, rx (torsion), ry (bending My), rz (bending Mz)
  start_ux?: boolean;
  start_uy?: boolean;
  start_uz?: boolean;
  start_rx?: boolean;
  start_ry?: boolean;
  start_rz?: boolean;
  // End releases (local DOFs)
  end_ux?: boolean;
  end_uy?: boolean;
  end_uz?: boolean;
  end_rx?: boolean;
  end_ry?: boolean;
  end_rz?: boolean;
}

export interface MemberDistributedLoad3D {
  coordinateSystem: 'local' | 'global';
  qxStart: number; // kN/m
  qxEnd: number;
  qyStart: number;
  qyEnd: number;
  qzStart: number;
  qzEnd: number;
}

export interface MemberThermalLoad3D {
  dT_axial?: number; // °C uniform
  dTy_top?: number; // °C along local y
  dTy_bot?: number;
  dTz_top?: number; // °C along local z
  dTz_bot?: number;
}

export interface Element3D {
  id: number;
  n1: number; // node ID
  n2: number; // node ID
  sectionId: number;
  materialId: number;
  rollAngle: number; // beta angle in degrees around local longitudinal x-axis
  hinges: MemberHinges3D;
  q: MemberDistributedLoad3D | null;
  thermal: MemberThermalLoad3D | null;
}

export type PanelShape = 'triangle' | 'rectangle';

export type PanelLoadTransferDir = 'one_way_x' | 'one_way_y' | 'two_way';

export interface PanelPressureLoad {
  dir: 'X' | 'Y' | 'Z' | 'normal'; // global X, Y, Z or normal to panel (local z)
  value: number; // pressure magnitude in kPa (kN/m²)
}

export interface Panel3D {
  id: number;
  shape: PanelShape; // 'triangle' (3 nodes) or 'rectangle' (3 nodes N1, N2, N3)
  nodeIds: number[]; // [n1, n2, n3]
  name?: string;
  color?: string; // custom tint or default
  loadTransferDir?: PanelLoadTransferDir; // 'one_way_x' (along edge N1->N2), 'one_way_y' (perpendicular / local y), 'two_way'
  pressure?: PanelPressureLoad | null;
}

export interface ConstructionLine3D {
  id: number;
  p1: [number, number, number];
  p2: [number, number, number];
  name?: string;
}

export interface DimensionLine3D {
  id: number;
  p1: [number, number, number];
  p2: [number, number, number];
  name?: string;
}

export interface Material {
  id: number;
  name: string;
  E: number; // Young's modulus [GPa]
  nu: number; // Poisson's ratio (default ~0.3 for steel, ~0.2 for concrete)
  G: number; // Shear modulus [GPa] = E / (2*(1+nu))
  alpha: number; // Thermal expansion coeff [1e-5 / °C]
  density: number; // Density [kg/m^3]
}

export interface Section {
  id: number;
  name: string;
  shape: string; // 'catIPN', 'catIPE', 'catHEA', 'catHEB', 'catHEM', 'catUPN', 'catUPE', 'rect', 'circ', 'pipe', 'box', 'tee', 'angle', 'custom'
  category?: 'katalog' | 'ksztalt' | 'wlasny';
  A: number; // Area [cm^2]
  Iy: number; // Moment of inertia about principal y-axis [cm^4] (strong or primary)
  Iz: number; // Moment of inertia about principal z-axis [cm^4] (weak or secondary)
  It: number; // Torsional constant (Saint-Venant J) [cm^4]
  Wy?: number; // Section modulus about y [cm^3]
  Wz?: number; // Section modulus about z [cm^3]
  Wt?: number; // Torsional section modulus [cm^3]
  iy?: number; // Radius of gyration [cm]
  iz?: number; // Radius of gyration [cm]
  h: number; // Height [cm]
  b: number; // Width [cm]
  tf?: number; // Flange thickness [cm]
  tw?: number; // Web thickness [cm]
  t?: number; // Wall thickness [cm]
  cTopY?: number; // Distance from centroid to top y [cm]
  cBotY?: number; // Distance from centroid to bottom y [cm]
  cTopZ?: number; // Distance from centroid to top z [cm]
  cBotZ?: number; // Distance from centroid to bottom z [cm]
}

export type AnalysisType = 'linear_static' | 'stability' | 'modal' | 'harmonic';

export interface AnalysisSettings {
  type: AnalysisType;
  params: {
    bucklingModes: number;
    modalModes: number;
    harmonicFreq?: number;
    includeElementMass?: boolean;
    includeSelfWeight?: boolean;
    includeGravity?: boolean;
  };
}

export interface PointResult3D {
  x: number; // distance along member [m]
  N: number; // Axial force [kN]
  Vy: number; // Shear force local y [kN]
  Vz: number; // Shear force local z [kN]
  Mx: number; // Torsional moment local x (Mt) [kNm]
  My: number; // Bending moment about local y [kNm]
  Mz: number; // Bending moment about local z [kNm]
  ux_local: number; // Local displacement x [m]
  uy_local: number; // Local displacement y [m]
  uz_local: number; // Local displacement z [m]
  rotx_local: number; // Local rotation x [rad]
  roty_local: number; // Local rotation y [rad]
  rotz_local: number; // Local rotation z [rad]
  Ux_global: number; // Global displacement X [m]
  Uy_global: number; // Global displacement Y [m]
  Uz_global: number; // Global displacement Z [m]
  sigMax: number; // Max normal stress [kPa]
  sigMin: number; // Min normal stress [kPa]
}

export interface MemberSampleData3D {
  pts: PointResult3D[];
  L: number;
  vx: [number, number, number]; // local x unit vector in global space
  vy: [number, number, number]; // local y unit vector in global space
  vz: [number, number, number]; // local z unit vector in global space
  n1: Node3D;
  n2: Node3D;
}

export interface LinearStaticResult3D {
  type: 'linear_static';
  D: number[]; // global displacements vector (6*N)
  Rglobal: number[]; // global reactions vector (6*N)
  results: MemberSampleData3D[];
  reactions: Record<number, { Rx: number; Ry: number; Rz: number; Mx: number; My: number; Mz: number }>;
  elements: Record<number, { points: PointResult3D[] }>;
  singular: boolean;
  maxDisp: number;
  maxN: number;
  maxVy: number;
  maxVz: number;
  maxMx: number;
  maxMy: number;
  maxMz: number;
  maxStress: number;
}

export interface BucklingMode3D {
  modeIndex: number;
  alphaCr: number;
  D: number[];
  results: MemberSampleData3D[];
  maxDisp: number;
  maxNcr: number;
}

export interface StabilityResult3D {
  type: 'stability';
  modes: BucklingMode3D[];
  currentMode: number;
  modalSign: number;
  staticSolved: LinearStaticResult3D;
  singular: boolean;
  noCompression?: boolean;
  reactions: Record<number, { Rx: number; Ry: number; Rz: number; Mx: number; My: number; Mz: number }>;
  elements: Record<number, { points: PointResult3D[] }>;
}

export interface ModalMode3D {
  modeIndex: number;
  omega: number; // rad/s
  f: number; // Hz
  T: number; // s
  massRatioX: number; // %
  massRatioY: number; // %
  massRatioZ: number; // %
  D: number[];
  results: MemberSampleData3D[];
  maxDisp: number;
}

export interface ModalResult3D {
  type: 'modal';
  modes: ModalMode3D[];
  currentMode: number;
  modalSign: number;
  singular: boolean;
  noMass?: boolean;
  reactions: Record<number, { Rx: number; Ry: number; Rz: number; Mx: number; My: number; Mz: number }>;
  elements: Record<number, { points: PointResult3D[] }>;
}

export type SolverResult3D = LinearStaticResult3D | StabilityResult3D | ModalResult3D;

export type ToolMode = 'select' | 'addBar' | 'addPanel' | 'grid' | 'lines';

