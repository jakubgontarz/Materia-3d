import {
  Node3D,
  Element3D,
  Panel3D,
  Material,
  Section,
  NodalForce3D,
  NodalMoment3D,
  MemberDistributedLoad3D,
  MemberThermalLoad3D,
  PanelPressureLoad,
  LinearStaticResult3D,
  StabilityResult3D,
  PointResult3D,
  MemberSampleData3D,
  AnalysisSettings,
} from './types';
import { solveLinearStatic3D, SolverModel3D } from './solver3d';

export type LoadNature =
  | 'permanent' // G - Obciążenia stałe, ciężar własny, wykończenie
  | 'variable' // Q - Użytkowe wg PN-EN 1991 (Kat. A-H)
  | 'wind' // W - Wiatr wg PN-EN 1991-1-4
  | 'snow' // S - Śnieg wg PN-EN 1991-1-3
  | 'ice' // Oblodzenie
  | 'temperature' // T - Temperatura wg PN-EN 1991-1-5
  | 'accidental' // A - Wyjątkowe
  | 'other'; // Inne / Niestandardowe

export type EurocodeCategory =
  | 'A' // Mieszkalne (A)
  | 'B' // Biurowe (B)
  | 'C' // Miejsca zebrań (C)
  | 'D' // Handlowe (D)
  | 'E' // Magazynowe (E)
  | 'F' // Garaże <= 30kN (F)
  | 'G' // Ruch 30-160kN (G)
  | 'H' // Dachy (H)
  | 'wind' // Wiatr
  | 'snow_low' // Śnieg H <= 1000m
  | 'snow_high' // Śnieg H > 1000m
  | 'ice' // Oblodzenie
  | 'temperature' // Temperatura
  | 'accidental' // Wyjątkowe
  | 'other'; // Inne

export interface LoadCase3D {
  id: number;
  name: string;
  nature: LoadNature;
  category?: EurocodeCategory;
  includeSelfWeight: boolean; // Ciężar własny prętów w tym przypadku
  psi0: number;
  psi1: number;
  psi2: number;
  gammaG_sup: number;
  gammaG_inf: number;
  gammaQ: number;

  // Loads specific to this load case
  nodeForces?: Record<number, NodalForce3D>; // nodeId -> force
  nodeMoments?: Record<number, NodalMoment3D>; // nodeId -> moment
  elementLoads?: Record<number, MemberDistributedLoad3D>; // elemId -> load
  elementThermals?: Record<number, MemberThermalLoad3D>; // elemId -> thermal
  panelPressures?: Record<number, PanelPressureLoad>; // panelId -> pressure
}

export type CombinationCategory = 'SGN' | 'SGU_CHR' | 'SGU_FREQ' | 'SGU_QP' | 'CUSTOM';

export interface LoadCombinationFactor {
  caseId: number;
  factor: number;
}

export interface LoadCombination3D {
  id: string;
  name: string;
  type: CombinationCategory;
  description: string;
  factors: LoadCombinationFactor[];
  isAuto?: boolean;
}

export interface EnvelopeMinMaxMap {
  elements: Record<
    number,
    {
      N_min: number[];
      N_max: number[];
      My_min: number[];
      My_max: number[];
      Mz_min: number[];
      Mz_max: number[];
      Vy_min: number[];
      Vy_max: number[];
      Vz_min: number[];
      Vz_max: number[];
      Mx_min: number[];
      Mx_max: number[];
      sig_min: number[];
      sig_max: number[];
      disp_max: number[];
    }
  >;
  reactions: Record<
    number,
    {
      Rx_min: number;
      Rx_max: number;
      Ry_min: number;
      Ry_max: number;
      Rz_min: number;
      Rz_max: number;
      Mx_min: number;
      Mx_max: number;
      My_min: number;
      My_max: number;
      Mz_min: number;
      Mz_max: number;
    }
  >;
}

export interface MultiCaseResults3D {
  type: 'linear_static' | 'stability';
  activeKey: string;
  cases: Record<number, { loadCase: LoadCase3D; result: LinearStaticResult3D; stabilityResult?: StabilityResult3D }>;
  combinations: Record<string, { comb: LoadCombination3D; result: LinearStaticResult3D; stabilityResult?: StabilityResult3D }>;
  envelopes: Record<
    string,
    {
      name: string;
      type: 'sgn' | 'sgu' | 'all';
      result: LinearStaticResult3D;
      minMaxMap?: EnvelopeMinMaxMap;
      stabilityResult?: StabilityResult3D;
    }
  >;
}

export const INITIAL_DEFAULT_LOAD_CASE: LoadCase3D = {
  id: 1,
  name: 'Ciężar własny i stałe',
  nature: 'permanent',
  category: undefined,
  includeSelfWeight: false,
  psi0: 1.0,
  psi1: 1.0,
  psi2: 1.0,
  gammaG_sup: 1.35,
  gammaG_inf: 1.0,
  gammaQ: 1.5,
  nodeForces: {},
  nodeMoments: {},
  elementLoads: {},
  elementThermals: {},
  panelPressures: {},
};

export function getDefaultPsiAndGammas(
  nature: LoadNature,
  category?: EurocodeCategory
): {
  psi0: number;
  psi1: number;
  psi2: number;
  gammaG_sup: number;
  gammaG_inf: number;
  gammaQ: number;
} {
  if (nature === 'permanent') {
    return { psi0: 1.0, psi1: 1.0, psi2: 1.0, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
  }
  if (nature === 'wind') {
    return { psi0: 0.6, psi1: 0.2, psi2: 0.0, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
  }
  if (nature === 'snow') {
    if (category === 'snow_high') {
      return { psi0: 0.7, psi1: 0.5, psi2: 0.2, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
    }
    return { psi0: 0.5, psi1: 0.2, psi2: 0.0, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
  }
  if (nature === 'ice') {
    return { psi0: 0.7, psi1: 0.3, psi2: 0.0, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
  }
  if (nature === 'temperature') {
    return { psi0: 0.6, psi1: 0.5, psi2: 0.0, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
  }
  if (nature === 'accidental') {
    return { psi0: 1.0, psi1: 0.5, psi2: 0.2, gammaG_sup: 1.0, gammaG_inf: 1.0, gammaQ: 1.0 };
  }

  // Variable (Użytkowe) categories A-H
  switch (category) {
    case 'A': // Mieszkalne
      return { psi0: 0.7, psi1: 0.5, psi2: 0.3, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
    case 'B': // Biurowe
      return { psi0: 0.7, psi1: 0.5, psi2: 0.3, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
    case 'C': // Miejsca zebrań
      return { psi0: 0.7, psi1: 0.7, psi2: 0.6, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
    case 'D': // Handlowe
      return { psi0: 0.7, psi1: 0.7, psi2: 0.6, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
    case 'E': // Magazynowe
      return { psi0: 1.0, psi1: 0.9, psi2: 0.8, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
    case 'F': // Parkingi <= 30kN
      return { psi0: 0.7, psi1: 0.7, psi2: 0.6, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
    case 'G': // Ruch 30-160kN
      return { psi0: 0.7, psi1: 0.5, psi2: 0.3, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
    case 'H': // Dachy
      return { psi0: 0.0, psi1: 0.0, psi2: 0.0, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
    default:
      return { psi0: 0.7, psi1: 0.5, psi2: 0.3, gammaG_sup: 1.35, gammaG_inf: 1.0, gammaQ: 1.5 };
  }
}

export function getNatureLabel(nature: LoadNature): string {
  switch (nature) {
    case 'permanent':
      return 'Stałe (G)';
    case 'variable':
      return 'Zmienne użytkowe (Q)';
    case 'wind':
      return 'Wiatr (W)';
    case 'snow':
      return 'Śnieg (S)';
    case 'ice':
      return 'Oblodzenie (I)';
    case 'temperature':
      return 'Temperatura (T)';
    case 'accidental':
      return 'Wyjątkowe (A)';
    case 'other':
      return 'Inne';
  }
}

export function getNatureBadgeColor(nature: LoadNature): { bg: string; fg: string; border: string } {
  switch (nature) {
    case 'permanent':
      return { bg: 'rgba(59, 130, 246, 0.15)', fg: '#3b82f6', border: 'rgba(59, 130, 246, 0.35)' };
    case 'variable':
      return { bg: 'rgba(16, 185, 129, 0.15)', fg: '#10b981', border: 'rgba(16, 185, 129, 0.35)' };
    case 'wind':
      return { bg: 'rgba(6, 182, 212, 0.15)', fg: '#06b6d4', border: 'rgba(6, 182, 212, 0.35)' };
    case 'snow':
      return { bg: 'rgba(168, 85, 247, 0.15)', fg: '#a855f7', border: 'rgba(168, 85, 247, 0.35)' };
    case 'ice':
      return { bg: 'rgba(14, 165, 233, 0.15)', fg: '#38bdf8', border: 'rgba(14, 165, 233, 0.35)' };
    case 'temperature':
      return { bg: 'rgba(249, 115, 22, 0.15)', fg: '#f97316', border: 'rgba(249, 115, 22, 0.35)' };
    case 'accidental':
      return { bg: 'rgba(239, 68, 68, 0.15)', fg: '#ef4444', border: 'rgba(239, 68, 68, 0.35)' };
    case 'other':
    default:
      return { bg: 'rgba(107, 114, 128, 0.15)', fg: '#9ca3af', border: 'rgba(107, 114, 128, 0.35)' };
  }
}

/**
 * Builds a SolverModel3D specifically containing the loads and self-weight settings of a given LoadCase3D.
 */
export function createModelForLoadCase(
  nodes: Node3D[],
  elements: Element3D[],
  panels: Panel3D[],
  materials: Material[],
  sections: Section[],
  loadCase: LoadCase3D,
  analysisSettings?: AnalysisSettings
): SolverModel3D {
  // Map nodes with this case's forces and moments
  const caseNodes: Node3D[] = nodes.map((n) => {
    const f = loadCase.nodeForces?.[n.id] ?? null;
    const m = loadCase.nodeMoments?.[n.id] ?? null;
    return {
      ...n,
      force: f ? { ...f } : null,
      moment: m ? { ...m } : null,
    };
  });

  // Map elements with this case's distributed and thermal loads
  const caseElements: Element3D[] = elements.map((el) => {
    const q = loadCase.elementLoads?.[el.id] ?? null;
    const thermal = loadCase.elementThermals?.[el.id] ?? null;
    return {
      ...el,
      q: q ? { ...q } : null,
      thermal: thermal ? { ...thermal } : null,
    };
  });

  // Map panels with this case's pressure loads
  const casePanels: Panel3D[] = (panels || []).map((p) => {
    const pr = loadCase.panelPressures?.[p.id] ?? null;
    return {
      ...p,
      pressure: pr ? { ...pr } : null,
    };
  });

  const settings: AnalysisSettings = {
    type: analysisSettings?.type || 'linear_static',
    params: {
      bucklingModes: analysisSettings?.params.bucklingModes || 4,
      modalModes: analysisSettings?.params.modalModes || 4,
      harmonicFreq: analysisSettings?.params.harmonicFreq,
      includeElementMass: analysisSettings?.params.includeElementMass,
      includeSelfWeight: !!loadCase.includeSelfWeight,
      includeGravity: analysisSettings?.params.includeGravity,
    },
  };

  return {
    nodes: caseNodes,
    elements: caseElements,
    panels: casePanels,
    materials,
    sections,
    settings,
  };
}

/**
 * Generates Eurocode (PN-EN 1990) combinations based on the set of user-defined load cases.
 * Handles mutual exclusivity for wind cases, snow cases, etc.
 */
export function generateEurocodeCombinations(loadCases: LoadCase3D[]): LoadCombination3D[] {
  if (!loadCases || loadCases.length === 0) return [];

  const permanentCases = loadCases.filter((c) => c.nature === 'permanent');
  const variableCases = loadCases.filter((c) => c.nature !== 'permanent');

  const combinations: LoadCombination3D[] = [];
  let sgnIndex = 1;
  let sguChIndex = 1;
  let sguFreqIndex = 1;
  let sguQpIndex = 1;

  // 1. Permanent only combination (SGN and SGU)
  if (permanentCases.length > 0) {
    // SGN permanent only
    combinations.push({
      id: `sgn_${sgnIndex++}`,
      name: `SGN ${combinations.length + 1}: ${permanentCases.map((c) => `${c.gammaG_sup.toFixed(2)}*C${c.id}`).join(' + ')}`,
      type: 'SGN',
      description: 'Stan Graniczny Nośności - tylko obciążenia stałe (niekorzystne)',
      factors: permanentCases.map((c) => ({ caseId: c.id, factor: c.gammaG_sup })),
      isAuto: true,
    });

    // SGU permanent only
    combinations.push({
      id: `sgu_chr_${sguChIndex++}`,
      name: `SGU-Ch 1: ${permanentCases.map((c) => `1.00*C${c.id}`).join(' + ')}`,
      type: 'SGU_CHR',
      description: 'Stan Graniczny Użytkowalności (Charakterystyczna) - tylko stałe',
      factors: permanentCases.map((c) => ({ caseId: c.id, factor: 1.0 })),
      isAuto: true,
    });
  }

  if (variableCases.length === 0) {
    return combinations;
  }

  // Group variable cases into mutually exclusive groups:
  // - All 'wind' cases: at most 1 active at a time
  // - All 'snow' cases: at most 1 active at a time
  // - All 'temperature' cases: at most 1 active at a time
  // - 'variable' cases: can be independent
  const windCases = variableCases.filter((c) => c.nature === 'wind');
  const snowCases = variableCases.filter((c) => c.nature === 'snow');
  const tempCases = variableCases.filter((c) => c.nature === 'temperature');
  const otherVarCases = variableCases.filter(
    (c) => c.nature !== 'wind' && c.nature !== 'snow' && c.nature !== 'temperature'
  );

  // Build list of all valid compatible subsets of variable cases (where each exclusive group has <= 1 member)
  const windOptions: (LoadCase3D | null)[] = [null, ...windCases];
  const snowOptions: (LoadCase3D | null)[] = [null, ...snowCases];
  const tempOptions: (LoadCase3D | null)[] = [null, ...tempCases];

  // Helper power set for other variable cases
  function getSubsets<T>(array: T[]): T[][] {
    const result: T[][] = [[]];
    for (const item of array) {
      const len = result.length;
      for (let i = 0; i < len; i++) {
        result.push([...result[i], item]);
      }
    }
    return result;
  }

  const otherSubsets = getSubsets(otherVarCases);

  const compatibleSets: LoadCase3D[][] = [];
  for (const w of windOptions) {
    for (const s of snowOptions) {
      for (const t of tempOptions) {
        for (const oSet of otherSubsets) {
          const set: LoadCase3D[] = [];
          if (w) set.push(w);
          if (s) set.push(s);
          if (t) set.push(t);
          set.push(...oSet);
          if (set.length > 0) {
            compatibleSets.push(set);
          }
        }
      }
    }
  }

  // --- SGN (STR/GEO) COMBINATIONS ---
  // For each compatible set, each member in turn acts as the LEADING variable action (γQ = 1.5),
  // while others act as ACCOMPANYING variable actions (γQ * ψ0).
  const sgnSignatures = new Set<string>();

  for (const set of compatibleSets) {
    for (let leadIdx = 0; leadIdx < set.length; leadIdx++) {
      const leadCase = set[leadIdx];
      const accCases = set.filter((_, idx) => idx !== leadIdx);

      const factors: LoadCombinationFactor[] = [];
      const parts: string[] = [];

      // Permanent actions
      for (const perm of permanentCases) {
        factors.push({ caseId: perm.id, factor: perm.gammaG_sup });
        parts.push(`${perm.gammaG_sup.toFixed(2)}*C${perm.id}`);
      }

      // Leading action
      factors.push({ caseId: leadCase.id, factor: leadCase.gammaQ });
      parts.push(`${leadCase.gammaQ.toFixed(2)}*C${leadCase.id}`);

      // Accompanying actions
      for (const acc of accCases) {
        const factor = Math.round(acc.gammaQ * acc.psi0 * 1000) / 1000;
        factors.push({ caseId: acc.id, factor });
        parts.push(`${factor.toFixed(2)}*C${acc.id}`);
      }

      // Unique signature check
      const sig = factors
        .slice()
        .sort((a, b) => a.caseId - b.caseId)
        .map((f) => `${f.caseId}:${f.factor}`)
        .join(';');

      if (!sgnSignatures.has(sig)) {
        sgnSignatures.add(sig);
        combinations.push({
          id: `sgn_${sgnIndex++}`,
          name: `SGN ${combinations.filter((c) => c.type === 'SGN').length + 1}: ${parts.join(' + ')}`,
          type: 'SGN',
          description: `SGN: Wiodące ${leadCase.name} (γQ=${leadCase.gammaQ.toFixed(2)})${accCases.length > 0 ? `, towarzyszące: ${accCases.map((a) => a.name).join(', ')}` : ''}`,
          factors,
          isAuto: true,
        });
      }
    }
  }

  // --- SGU (SLS) COMBINATIONS ---
  // 1. SGU Charakterystyczna: 1.0 * G + 1.0 * Q_lead + sum(psi0 * Q_acc)
  const sguChSignatures = new Set<string>();
  for (const set of compatibleSets) {
    for (let leadIdx = 0; leadIdx < set.length; leadIdx++) {
      const leadCase = set[leadIdx];
      const accCases = set.filter((_, idx) => idx !== leadIdx);

      const factors: LoadCombinationFactor[] = [];
      const parts: string[] = [];

      for (const perm of permanentCases) {
        factors.push({ caseId: perm.id, factor: 1.0 });
        parts.push(`1.00*C${perm.id}`);
      }

      factors.push({ caseId: leadCase.id, factor: 1.0 });
      parts.push(`1.00*C${leadCase.id}`);

      for (const acc of accCases) {
        const factor = Math.round(acc.psi0 * 1000) / 1000;
        factors.push({ caseId: acc.id, factor });
        parts.push(`${factor.toFixed(2)}*C${acc.id}`);
      }

      const sig = factors
        .slice()
        .sort((a, b) => a.caseId - b.caseId)
        .map((f) => `${f.caseId}:${f.factor}`)
        .join(';');

      if (!sguChSignatures.has(sig)) {
        sguChSignatures.add(sig);
        combinations.push({
          id: `sgu_chr_${sguChIndex++}`,
          name: `SGU-Ch ${combinations.filter((c) => c.type === 'SGU_CHR').length + 1}: ${parts.join(' + ')}`,
          type: 'SGU_CHR',
          description: `SGU Charakterystyczna: Wiodące ${leadCase.name}`,
          factors,
          isAuto: true,
        });
      }
    }
  }

  // 2. SGU Częsta: 1.0 * G + psi1 * Q_lead + sum(psi2 * Q_acc)
  const sguFreqSignatures = new Set<string>();
  for (const set of compatibleSets) {
    for (let leadIdx = 0; leadIdx < set.length; leadIdx++) {
      const leadCase = set[leadIdx];
      const accCases = set.filter((_, idx) => idx !== leadIdx);

      const factors: LoadCombinationFactor[] = [];
      const parts: string[] = [];

      for (const perm of permanentCases) {
        factors.push({ caseId: perm.id, factor: 1.0 });
        parts.push(`1.00*C${perm.id}`);
      }

      const fLead = Math.round(leadCase.psi1 * 1000) / 1000;
      factors.push({ caseId: leadCase.id, factor: fLead });
      parts.push(`${fLead.toFixed(2)}*C${leadCase.id}`);

      for (const acc of accCases) {
        const fAcc = Math.round(acc.psi2 * 1000) / 1000;
        factors.push({ caseId: acc.id, factor: fAcc });
        parts.push(`${fAcc.toFixed(2)}*C${acc.id}`);
      }

      const sig = factors
        .slice()
        .sort((a, b) => a.caseId - b.caseId)
        .map((f) => `${f.caseId}:${f.factor}`)
        .join(';');

      if (!sguFreqSignatures.has(sig)) {
        sguFreqSignatures.add(sig);
        combinations.push({
          id: `sgu_freq_${sguFreqIndex++}`,
          name: `SGU-Częsta ${combinations.filter((c) => c.type === 'SGU_FREQ').length + 1}: ${parts.join(' + ')}`,
          type: 'SGU_FREQ',
          description: `SGU Częsta: Główny ${leadCase.name} (ψ1=${fLead.toFixed(2)})`,
          factors,
          isAuto: true,
        });
      }
    }
  }

  // 3. SGU Prawie stała: 1.0 * G + sum(psi2 * Q_i)
  const sguQpSignatures = new Set<string>();
  for (const set of compatibleSets) {
    const factors: LoadCombinationFactor[] = [];
    const parts: string[] = [];

    for (const perm of permanentCases) {
      factors.push({ caseId: perm.id, factor: 1.0 });
      parts.push(`1.00*C${perm.id}`);
    }

    for (const vCase of set) {
      const f = Math.round(vCase.psi2 * 1000) / 1000;
      factors.push({ caseId: vCase.id, factor: f });
      parts.push(`${f.toFixed(2)}*C${vCase.id}`);
    }

    const sig = factors
      .slice()
      .sort((a, b) => a.caseId - b.caseId)
      .map((f) => `${f.caseId}:${f.factor}`)
      .join(';');

    if (!sguQpSignatures.has(sig)) {
      sguQpSignatures.add(sig);
      combinations.push({
        id: `sgu_qp_${sguQpIndex++}`,
        name: `SGU-QP ${combinations.filter((c) => c.type === 'SGU_QP').length + 1}: ${parts.join(' + ')}`,
        type: 'SGU_QP',
        description: 'SGU Prawie stała (Quasi-permanent)',
        factors,
        isAuto: true,
      });
    }
  }

  return combinations;
}

/**
 * Superimposes linear static results according to a combination formula:
 * R_comb = sum(factor_i * R_i)
 */
export function superimposeLinearStaticResults(
  baseResults: Record<number, LinearStaticResult3D>,
  factors: LoadCombinationFactor[],
  elements: Element3D[],
  sections: Section[]
): LinearStaticResult3D {
  const activeFactors = factors.filter((f) => Math.abs(f.factor) > 1e-9 && baseResults[f.caseId]);
  if (activeFactors.length === 0) {
    const firstId = Number(Object.keys(baseResults)[0]);
    return baseResults[firstId];
  }

  const firstRes = baseResults[activeFactors[0].caseId];
  const nDof = firstRes.D.length;

  const D = new Array(nDof).fill(0);
  const Rglobal = new Array(nDof).fill(0);

  // Superimpose global displacement & reaction vectors
  for (const { caseId, factor } of activeFactors) {
    const res = baseResults[caseId];
    if (!res) continue;
    for (let i = 0; i < nDof; i++) {
      D[i] += factor * (res.D[i] || 0);
      Rglobal[i] += factor * (res.Rglobal?.[i] || 0);
    }
  }

  // Superimpose reactions per node
  const reactions: Record<number, { Rx: number; Ry: number; Rz: number; Mx: number; My: number; Mz: number }> = {};
  for (const { caseId, factor } of activeFactors) {
    const res = baseResults[caseId];
    if (!res?.reactions) continue;
    for (const [nodeIdStr, r] of Object.entries(res.reactions)) {
      const nId = Number(nodeIdStr);
      if (!reactions[nId]) {
        reactions[nId] = { Rx: 0, Ry: 0, Rz: 0, Mx: 0, My: 0, Mz: 0 };
      }
      reactions[nId].Rx += factor * r.Rx;
      reactions[nId].Ry += factor * r.Ry;
      reactions[nId].Rz += factor * r.Rz;
      reactions[nId].Mx += factor * r.Mx;
      reactions[nId].My += factor * r.My;
      reactions[nId].Mz += factor * r.Mz;
    }
  }

  // Superimpose member sample points
  let maxDisp = 0;
  let maxN = 0;
  let maxVy = 0;
  let maxVz = 0;
  let maxMx = 0;
  let maxMy = 0;
  let maxMz = 0;
  let maxStress = 0;

  const results: MemberSampleData3D[] = firstRes.results.map((baseElemSample, elemIdx) => {
    const numPts = baseElemSample.pts.length;
    const combinedPts: PointResult3D[] = [];

    const elem = elements[elemIdx];
    const sec = sections.find((s) => s.id === elem?.sectionId) || sections[0];
    const A = (sec.A || 10) * 1e-4; // m^2
    const Wy = (sec.Wy || (sec.Iy / (sec.h / 2))) * 1e-6; // m^3
    const Wz = (sec.Wz || (sec.Iz / (sec.b / 2))) * 1e-6; // m^3

    for (let pIdx = 0; pIdx < numPts; pIdx++) {
      let N = 0;
      let Vy = 0;
      let Vz = 0;
      let Mx = 0;
      let My = 0;
      let Mz = 0;
      let ux_local = 0;
      let uy_local = 0;
      let uz_local = 0;
      let rotx_local = 0;
      let roty_local = 0;
      let rotz_local = 0;
      let Ux_global = 0;
      let Uy_global = 0;
      let Uz_global = 0;

      for (const { caseId, factor } of activeFactors) {
        const res = baseResults[caseId];
        const pt = res?.results?.[elemIdx]?.pts?.[pIdx];
        if (!pt) continue;

        N += factor * pt.N;
        Vy += factor * pt.Vy;
        Vz += factor * pt.Vz;
        Mx += factor * pt.Mx;
        My += factor * pt.My;
        Mz += factor * pt.Mz;
        ux_local += factor * pt.ux_local;
        uy_local += factor * pt.uy_local;
        uz_local += factor * pt.uz_local;
        rotx_local += factor * (pt.rotx_local || 0);
        roty_local += factor * (pt.roty_local || 0);
        rotz_local += factor * (pt.rotz_local || 0);
        Ux_global += factor * pt.Ux_global;
        Uy_global += factor * pt.Uy_global;
        Uz_global += factor * pt.Uz_global;
      }

      // Compute combined stress: sigma = N/A +/- My/Wy +/- Mz/Wz (in kPa)
      const sigN = A > 0 ? N / A : 0;
      const sigMy = Wy > 0 ? Math.abs(My) / Wy : 0;
      const sigMz = Wz > 0 ? Math.abs(Mz) / Wz : 0;
      const sigMax = sigN + sigMy + sigMz;
      const sigMin = sigN - sigMy - sigMz;

      const ptDisp = Math.hypot(Ux_global, Uy_global, Uz_global);
      if (ptDisp > maxDisp) maxDisp = ptDisp;
      if (Math.abs(N) > maxN) maxN = Math.abs(N);
      if (Math.abs(Vy) > maxVy) maxVy = Math.abs(Vy);
      if (Math.abs(Vz) > maxVz) maxVz = Math.abs(Vz);
      if (Math.abs(Mx) > maxMx) maxMx = Math.abs(Mx);
      if (Math.abs(My) > maxMy) maxMy = Math.abs(My);
      if (Math.abs(Mz) > maxMz) maxMz = Math.abs(Mz);
      if (Math.abs(sigMax) > maxStress) maxStress = Math.abs(sigMax);
      if (Math.abs(sigMin) > maxStress) maxStress = Math.abs(sigMin);

      combinedPts.push({
        x: baseElemSample.pts[pIdx].x,
        N,
        Vy,
        Vz,
        Mx,
        My,
        Mz,
        ux_local,
        uy_local,
        uz_local,
        rotx_local,
        roty_local,
        rotz_local,
        Ux_global,
        Uy_global,
        Uz_global,
        sigMax,
        sigMin,
      });
    }

    return {
      ...baseElemSample,
      pts: combinedPts,
    };
  });

  const elementsRecord: Record<number, { points: PointResult3D[] }> = {};
  elements.forEach((el, i) => {
    elementsRecord[el.id] = { points: results[i]?.pts || [] };
  });

  return {
    type: 'linear_static',
    D,
    Rglobal,
    results,
    reactions,
    elements: elementsRecord,
    singular: false,
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

/**
 * Computes an Envelope (Obwiednia) over a collection of LinearStaticResult3D combinations.
 * Selects the extreme values (min & max) for internal forces, reactions, displacements, and stresses.
 */
export function computeEnvelope(
  name: string,
  type: 'sgn' | 'sgu' | 'all',
  combinationResults: LinearStaticResult3D[],
  elements: Element3D[]
): { result: LinearStaticResult3D; minMaxMap: EnvelopeMinMaxMap } {
  if (combinationResults.length === 0) {
    throw new Error('No combination results to build envelope');
  }

  const firstRes = combinationResults[0];
  const numElems = firstRes.results.length;

  const minMaxMap: EnvelopeMinMaxMap = {
    elements: {},
    reactions: {},
  };

  let globalMaxDisp = 0;
  let globalMaxN = 0;
  let globalMaxVy = 0;
  let globalMaxVz = 0;
  let globalMaxMx = 0;
  let globalMaxMy = 0;
  let globalMaxMz = 0;
  let globalMaxStress = 0;

  // Build envelope sample points per element
  const envelopeResults: MemberSampleData3D[] = [];

  for (let elemIdx = 0; elemIdx < numElems; elemIdx++) {
    const baseSample = firstRes.results[elemIdx];
    const numPts = baseSample.pts.length;
    const elem = elements[elemIdx];
    const eId = elem ? elem.id : elemIdx + 1;

    const N_min = new Array(numPts).fill(Infinity);
    const N_max = new Array(numPts).fill(-Infinity);
    const My_min = new Array(numPts).fill(Infinity);
    const My_max = new Array(numPts).fill(-Infinity);
    const Mz_min = new Array(numPts).fill(Infinity);
    const Mz_max = new Array(numPts).fill(-Infinity);
    const Vy_min = new Array(numPts).fill(Infinity);
    const Vy_max = new Array(numPts).fill(-Infinity);
    const Vz_min = new Array(numPts).fill(Infinity);
    const Vz_max = new Array(numPts).fill(-Infinity);
    const Mx_min = new Array(numPts).fill(Infinity);
    const Mx_max = new Array(numPts).fill(-Infinity);
    const sig_min = new Array(numPts).fill(Infinity);
    const sig_max = new Array(numPts).fill(-Infinity);
    const disp_max = new Array(numPts).fill(0);

    // Max envelope representative point for standard diagram renderer
    const repPts: PointResult3D[] = [];

    for (let pIdx = 0; pIdx < numPts; pIdx++) {
      let worstDisp = 0;
      let worstUx = 0, worstUy = 0, worstUz = 0;

      for (const res of combinationResults) {
        const pt = res.results[elemIdx]?.pts[pIdx];
        if (!pt) continue;

        if (pt.N < N_min[pIdx]) N_min[pIdx] = pt.N;
        if (pt.N > N_max[pIdx]) N_max[pIdx] = pt.N;

        if (pt.My < My_min[pIdx]) My_min[pIdx] = pt.My;
        if (pt.My > My_max[pIdx]) My_max[pIdx] = pt.My;

        if (pt.Mz < Mz_min[pIdx]) Mz_min[pIdx] = pt.Mz;
        if (pt.Mz > Mz_max[pIdx]) Mz_max[pIdx] = pt.Mz;

        if (pt.Vy < Vy_min[pIdx]) Vy_min[pIdx] = pt.Vy;
        if (pt.Vy > Vy_max[pIdx]) Vy_max[pIdx] = pt.Vy;

        if (pt.Vz < Vz_min[pIdx]) Vz_min[pIdx] = pt.Vz;
        if (pt.Vz > Vz_max[pIdx]) Vz_max[pIdx] = pt.Vz;

        if (pt.Mx < Mx_min[pIdx]) Mx_min[pIdx] = pt.Mx;
        if (pt.Mx > Mx_max[pIdx]) Mx_max[pIdx] = pt.Mx;

        if (pt.sigMin < sig_min[pIdx]) sig_min[pIdx] = pt.sigMin;
        if (pt.sigMax > sig_max[pIdx]) sig_max[pIdx] = pt.sigMax;

        const dMag = Math.hypot(pt.Ux_global, pt.Uy_global, pt.Uz_global);
        if (dMag > disp_max[pIdx]) {
          disp_max[pIdx] = dMag;
        }
        if (dMag > worstDisp) {
          worstDisp = dMag;
          worstUx = pt.Ux_global;
          worstUy = pt.Uy_global;
          worstUz = pt.Uz_global;
        }
      }

      // Pick governing extremal value for representative diagram (largest magnitude with sign)
      const govN = Math.abs(N_max[pIdx]) >= Math.abs(N_min[pIdx]) ? N_max[pIdx] : N_min[pIdx];
      const govMy = Math.abs(My_max[pIdx]) >= Math.abs(My_min[pIdx]) ? My_max[pIdx] : My_min[pIdx];
      const govMz = Math.abs(Mz_max[pIdx]) >= Math.abs(Mz_min[pIdx]) ? Mz_max[pIdx] : Mz_min[pIdx];
      const govVy = Math.abs(Vy_max[pIdx]) >= Math.abs(Vy_min[pIdx]) ? Vy_max[pIdx] : Vy_min[pIdx];
      const govVz = Math.abs(Vz_max[pIdx]) >= Math.abs(Vz_min[pIdx]) ? Vz_max[pIdx] : Vz_min[pIdx];
      const govMx = Math.abs(Mx_max[pIdx]) >= Math.abs(Mx_min[pIdx]) ? Mx_max[pIdx] : Mx_min[pIdx];
      const govSigMax = sig_max[pIdx];
      const govSigMin = sig_min[pIdx];

      if (worstDisp > globalMaxDisp) globalMaxDisp = worstDisp;
      if (Math.abs(govN) > globalMaxN) globalMaxN = Math.abs(govN);
      if (Math.abs(govMy) > globalMaxMy) globalMaxMy = Math.abs(govMy);
      if (Math.abs(govMz) > globalMaxMz) globalMaxMz = Math.abs(govMz);
      if (Math.abs(govVy) > globalMaxVy) globalMaxVy = Math.abs(govVy);
      if (Math.abs(govVz) > globalMaxVz) globalMaxVz = Math.abs(govVz);
      if (Math.abs(govMx) > globalMaxMx) globalMaxMx = Math.abs(govMx);
      if (Math.abs(govSigMax) > globalMaxStress) globalMaxStress = Math.abs(govSigMax);
      if (Math.abs(govSigMin) > globalMaxStress) globalMaxStress = Math.abs(govSigMin);

      repPts.push({
        x: baseSample.pts[pIdx].x,
        N: govN,
        Vy: govVy,
        Vz: govVz,
        Mx: govMx,
        My: govMy,
        Mz: govMz,
        ux_local: 0,
        uy_local: 0,
        uz_local: 0,
        rotx_local: 0,
        roty_local: 0,
        rotz_local: 0,
        Ux_global: worstUx,
        Uy_global: worstUy,
        Uz_global: worstUz,
        sigMax: govSigMax,
        sigMin: govSigMin,
      });
    }

    minMaxMap.elements[eId] = {
      N_min,
      N_max,
      My_min,
      My_max,
      Mz_min,
      Mz_max,
      Vy_min,
      Vy_max,
      Vz_min,
      Vz_max,
      Mx_min,
      Mx_max,
      sig_min,
      sig_max,
      disp_max,
    };

    envelopeResults.push({
      ...baseSample,
      pts: repPts,
    });
  }

  // Envelope reactions per node
  const envelopeReactions: Record<number, { Rx: number; Ry: number; Rz: number; Mx: number; My: number; Mz: number }> = {};

  const allNodeIds = new Set<number>();
  for (const res of combinationResults) {
    if (res.reactions) {
      Object.keys(res.reactions).forEach((nId) => allNodeIds.add(Number(nId)));
    }
  }

  for (const nId of allNodeIds) {
    let Rx_min = Infinity, Rx_max = -Infinity;
    let Ry_min = Infinity, Ry_max = -Infinity;
    let Rz_min = Infinity, Rz_max = -Infinity;
    let Mx_min = Infinity, Mx_max = -Infinity;
    let My_min = Infinity, My_max = -Infinity;
    let Mz_min = Infinity, Mz_max = -Infinity;

    for (const res of combinationResults) {
      const r = res.reactions?.[nId];
      if (!r) continue;
      if (r.Rx < Rx_min) Rx_min = r.Rx;
      if (r.Rx > Rx_max) Rx_max = r.Rx;
      if (r.Ry < Ry_min) Ry_min = r.Ry;
      if (r.Ry > Ry_max) Ry_max = r.Ry;
      if (r.Rz < Rz_min) Rz_min = r.Rz;
      if (r.Rz > Rz_max) Rz_max = r.Rz;
      if (r.Mx < Mx_min) Mx_min = r.Mx;
      if (r.Mx > Mx_max) Mx_max = r.Mx;
      if (r.My < My_min) My_min = r.My;
      if (r.My > My_max) My_max = r.My;
      if (r.Mz < Mz_min) Mz_min = r.Mz;
      if (r.Mz > Mz_max) Mz_max = r.Mz;
    }

    minMaxMap.reactions[nId] = {
      Rx_min,
      Rx_max,
      Ry_min,
      Ry_max,
      Rz_min,
      Rz_max,
      Mx_min,
      Mx_max,
      My_min,
      My_max,
      Mz_min,
      Mz_max,
    };

    // Pick governing representative reaction
    envelopeReactions[nId] = {
      Rx: Math.abs(Rx_max) >= Math.abs(Rx_min) ? Rx_max : Rx_min,
      Ry: Math.abs(Ry_max) >= Math.abs(Ry_min) ? Ry_max : Ry_min,
      Rz: Math.abs(Rz_max) >= Math.abs(Rz_min) ? Rz_max : Rz_min,
      Mx: Math.abs(Mx_max) >= Math.abs(Mx_min) ? Mx_max : Mx_min,
      My: Math.abs(My_max) >= Math.abs(My_min) ? My_max : My_min,
      Mz: Math.abs(Mz_max) >= Math.abs(Mz_min) ? Mz_max : Mz_min,
    };
  }

  const elementsRecord: Record<number, { points: PointResult3D[] }> = {};
  elements.forEach((el, i) => {
    elementsRecord[el.id] = { points: envelopeResults[i]?.pts || [] };
  });

  const result: LinearStaticResult3D = {
    type: 'linear_static',
    D: firstRes.D,
    Rglobal: firstRes.Rglobal,
    results: envelopeResults,
    reactions: envelopeReactions,
    elements: elementsRecord,
    singular: false,
    maxDisp: globalMaxDisp,
    maxN: globalMaxN,
    maxVy: globalMaxVy,
    maxVz: globalMaxVz,
    maxMx: globalMaxMx,
    maxMy: globalMaxMy,
    maxMz: globalMaxMz,
    maxStress: globalMaxStress,
  };

  return { result, minMaxMap };
}

/**
 * Solves all user-defined Load Cases via 3D FEM, computes combinations via linear superposition,
 * and generates governing Envelopes (SGN, SGU, All).
 */
export function solveAllLoadCasesAndCombinations3D(
  nodes: Node3D[],
  elements: Element3D[],
  panels: Panel3D[],
  materials: Material[],
  sections: Section[],
  loadCases: LoadCase3D[],
  autoCombinations = true,
  customCombinations: LoadCombination3D[] = [],
  analysisSettings?: AnalysisSettings
): MultiCaseResults3D {
  const casesRecord: Record<number, { loadCase: LoadCase3D; result: LinearStaticResult3D }> = {};
  const baseResultsMap: Record<number, LinearStaticResult3D> = {};

  // 1. Solve FEM for each load case independently
  for (const lc of loadCases) {
    const model = createModelForLoadCase(
      nodes,
      elements,
      panels,
      materials,
      sections,
      lc,
      analysisSettings
    );
    const res = solveLinearStatic3D(model);
    casesRecord[lc.id] = { loadCase: lc, result: res };
    baseResultsMap[lc.id] = res;
  }

  // 2. Generate combinations
  const allCombinations: LoadCombination3D[] = [];
  if (autoCombinations) {
    const autoCombs = generateEurocodeCombinations(loadCases);
    allCombinations.push(...autoCombs);
  }
  if (customCombinations && customCombinations.length > 0) {
    allCombinations.push(...customCombinations);
  }

  const combinationsRecord: Record<string, { comb: LoadCombination3D; result: LinearStaticResult3D }> = {};
  const sgnResults: LinearStaticResult3D[] = [];
  const sguResults: LinearStaticResult3D[] = [];
  const allCombResults: LinearStaticResult3D[] = [];

  for (const comb of allCombinations) {
    const combRes = superimposeLinearStaticResults(
      baseResultsMap,
      comb.factors,
      elements,
      sections
    );
    combinationsRecord[comb.id] = { comb, result: combRes };
    allCombResults.push(combRes);

    if (comb.type === 'SGN') {
      sgnResults.push(combRes);
    } else {
      sguResults.push(combRes);
    }
  }

  // 3. Compute Envelopes
  const envelopesRecord: Record<
    string,
    {
      name: string;
      type: 'sgn' | 'sgu' | 'all';
      result: LinearStaticResult3D;
      minMaxMap?: EnvelopeMinMaxMap;
    }
  > = {};

  if (sgnResults.length > 0) {
    const { result, minMaxMap } = computeEnvelope('Obwiednia SGN', 'sgn', sgnResults, elements);
    envelopesRecord['env_sgn'] = {
      name: 'Obwiednia SGN (STR/GEO)',
      type: 'sgn',
      result,
      minMaxMap,
    };
  }

  if (sguResults.length > 0) {
    const { result, minMaxMap } = computeEnvelope('Obwiednia SGU', 'sgu', sguResults, elements);
    envelopesRecord['env_sgu'] = {
      name: 'Obwiednia SGU (SLS)',
      type: 'sgu',
      result,
      minMaxMap,
    };
  }

  if (allCombResults.length > 0) {
    const { result, minMaxMap } = computeEnvelope('Obwiednia Wszystkich', 'all', allCombResults, elements);
    envelopesRecord['env_all'] = {
      name: 'Obwiednia Całkowita (Wszystkie)',
      type: 'all',
      result,
      minMaxMap,
    };
  }

  // Determine initial active key
  let defaultActiveKey = `case_${loadCases[0]?.id || 1}`;
  if (envelopesRecord['env_sgn']) {
    defaultActiveKey = 'env_sgn';
  } else if (allCombinations[0]) {
    defaultActiveKey = allCombinations[0].id;
  }

  return {
    type: 'linear_static',
    activeKey: defaultActiveKey,
    cases: casesRecord,
    combinations: combinationsRecord,
    envelopes: envelopesRecord,
  };
}
