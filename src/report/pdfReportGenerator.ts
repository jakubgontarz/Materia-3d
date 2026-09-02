import jsPDF from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';
import { ROBOTO_REGULAR_BASE64, ROBOTO_BOLD_BASE64 } from './robotoFont';
import {
  Node3D,
  Element3D,
  Panel3D,
  Material,
  Section,
  ElementGroupDef,
  AnalysisSettings,
  SolverResult3D,
  LinearStaticResult3D,
  StabilityResult3D,
  ModalResult3D,
  MultiCaseResults3D,
  LoadCase3D,
  LoadCombination3D,
} from '../fem/types';

export interface PdfReportOptions {
  modelName: string;
  nodes: Node3D[];
  elements: Element3D[];
  panels?: Panel3D[];
  sections: Section[];
  materials: Material[];
  groups: ElementGroupDef[];
  loadCases: LoadCase3D[];
  combinations: LoadCombination3D[];
  analysisSettings?: AnalysisSettings;
  multiSolved?: MultiCaseResults3D | null;
  activeSolved?: SolverResult3D | null;
  activeResultKey?: string;
  screenshotDataUrl?: string;
}

// Helper formatting utilities
function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null || isNaN(v)) return '—';
  if (Math.abs(v) < 1e-6) return '0.00';
  return v.toFixed(digits);
}

function fmtCoord(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '0.000';
  if (Math.abs(v) < 1e-6) return '0.000';
  return v.toFixed(3);
}

function getSupportDesc(support: Node3D['support']): string {
  if (!support) return 'Swobodny';
  const parts: string[] = [];
  const { ux, uy, uz, rx, ry, rz } = support;

  const isFix = (c: any) => c && c.type === 'fixed';
  const isSpr = (c: any) => c && c.type === 'spring';

  if (isFix(ux) && isFix(uy) && isFix(uz) && isFix(rx) && isFix(ry) && isFix(rz)) {
    return 'Utwierdzenie pełne (UX, UY, UZ, RX, RY, RZ)';
  }
  if (isFix(ux) && isFix(uy) && isFix(uz) && !isFix(rx) && !isFix(ry) && !isFix(rz)) {
    return 'Podpora przegubowa nieprzesuwna (UX, UY, UZ)';
  }

  if (isFix(ux)) parts.push('UX');
  else if (isSpr(ux)) parts.push(`kX=${fmtNum(ux.k)}`);

  if (isFix(uy)) parts.push('UY');
  else if (isSpr(uy)) parts.push(`kY=${fmtNum(uy.k)}`);

  if (isFix(uz)) parts.push('UZ');
  else if (isSpr(uz)) parts.push(`kZ=${fmtNum(uz.k)}`);

  if (isFix(rx)) parts.push('RX');
  else if (isSpr(rx)) parts.push(`kRX=${fmtNum(rx.k)}`);

  if (isFix(ry)) parts.push('RY');
  else if (isSpr(ry)) parts.push(`kRY=${fmtNum(ry.k)}`);

  if (isFix(rz)) parts.push('RZ');
  else if (isSpr(rz)) parts.push(`kRZ=${fmtNum(rz.k)}`);

  return parts.length > 0 ? parts.join(', ') : 'Swobodny';
}

function getHingesDesc(h: Element3D['hinges']): string {
  if (!h) return 'Sztywne';
  const sRel: string[] = [];
  const eRel: string[] = [];
  if (h.start_rx) sRel.push('rx');
  if (h.start_ry) sRel.push('ry');
  if (h.start_rz) sRel.push('rz');
  if (h.start_ux) sRel.push('ux');
  if (h.start_uy) sRel.push('uy');
  if (h.start_uz) sRel.push('uz');

  if (h.end_rx) eRel.push('rx');
  if (h.end_ry) eRel.push('ry');
  if (h.end_rz) eRel.push('rz');
  if (h.end_ux) eRel.push('ux');
  if (h.end_uy) eRel.push('uy');
  if (h.end_uz) eRel.push('uz');

  if (sRel.length === 0 && eRel.length === 0) return 'Sztywne (brak)';
  const sTxt = sRel.length > 0 ? `N1: [${sRel.join(',')}]` : '';
  const eTxt = eRel.length > 0 ? `N2: [${eRel.join(',')}]` : '';
  return [sTxt, eTxt].filter(Boolean).join('; ');
}

function getNatureLabel(nat: string): string {
  switch (nat) {
    case 'permanent':
      return 'Stałe (G)';
    case 'variable':
      return 'Zmienne (Q)';
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
    default:
      return 'Inne / Własne';
  }
}

export async function generateEngineeringPdfReport(options: PdfReportOptions): Promise<void> {
  const {
    modelName,
    nodes,
    elements,
    panels = [],
    sections,
    materials,
    groups,
    loadCases,
    combinations,
    multiSolved,
    activeSolved,
    activeResultKey,
    screenshotDataUrl,
  } = options;

  // 1. Initialize jsPDF (A4 portrait)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Register embedded Roboto fonts for full UTF-8 Polish characters support
  try {
    doc.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
    doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
    doc.addFileToVFS('Roboto-Bold.ttf', ROBOTO_BOLD_BASE64);
    doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
    doc.setFont('Roboto', 'normal');
  } catch (e) {
    console.warn('Could not register custom Roboto font:', e);
  }

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const marginX = 14;
  const contentWidth = pageWidth - 2 * marginX; // 182

  const primaryColor: [number, number, number] = [30, 41, 59]; // Slate 800
  const secondaryColor: [number, number, number] = [71, 85, 105]; // Slate 600
  const tableHeaderBg: [number, number, number] = [241, 245, 249]; // Slate 100
  const tableBorderColor: [number, number, number] = [203, 213, 225]; // Slate 300

  // Helper for autotable
  const callAutoTable = (opts: UserOptions) => {
    autoTable(doc, {
      margin: { left: marginX, right: marginX },
      tableWidth: contentWidth,
      styles: {
        fontSize: 7.2,
        cellPadding: 1.5,
        textColor: [15, 23, 42],
        lineColor: tableBorderColor,
        lineWidth: 0.15,
        font: 'Roboto',
        fontStyle: 'normal',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: tableHeaderBg,
        textColor: primaryColor,
        font: 'Roboto',
        fontStyle: 'bold',
        fontSize: 7.8,
        halign: 'center',
        lineColor: tableBorderColor,
        lineWidth: 0.2,
        overflow: 'linebreak',
      },
      alternateRowStyles: {
        fillColor: [250, 250, 252],
      },
      ...opts,
    });
  };

  // Calculate model summary statistics
  const nodeMap = new Map<number, Node3D>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const secMap = new Map<number, Section>();
  sections.forEach((s) => secMap.set(s.id, s));

  const matMap = new Map<number, Material>();
  materials.forEach((m) => matMap.set(m.id, m));

  const grpMap = new Map<string, ElementGroupDef>();
  groups.forEach((g) => grpMap.set(g.id, g));

  let totalBarLength = 0;
  let totalStructuralMass = 0; // kg

  elements.forEach((el) => {
    const n1 = nodeMap.get(el.n1);
    const n2 = nodeMap.get(el.n2);
    if (!n1 || !n2) return;
    const L = Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z);
    totalBarLength += L;
    const sec = secMap.get(el.sectionId);
    const mat = matMap.get(el.materialId);
    const rho = mat?.density || 7850;
    const A_m2 = (sec?.A || 0) * 1e-4;
    totalStructuralMass += L * A_m2 * rho;
  });

  const supportedNodesCount = nodes.filter((n) => n.support !== null).length;
  const now = new Date();
  const dateFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // ==========================================
  // TITLE / COVER HEADER SECTION
  // ==========================================
  let currentY = 16;

  // Title Box & Branding
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.6);
  doc.line(marginX, currentY, marginX + contentWidth, currentY);

  currentY += 6.5;
  doc.setFont('Roboto', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('RAPORT Z OBLICZEŃ STATYCZNO-WYTRZYMAŁOŚCIOWYCH', marginX, currentY);

  currentY += 5;
  doc.setFont('Roboto', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
  doc.text('Materia3D — System Analizy Konstrukcji Prętowych i Powierzchniowych 3D (MES / FEM)', marginX, currentY);

  currentY += 3.5;
  doc.setLineWidth(0.2);
  doc.setDrawColor(tableBorderColor[0], tableBorderColor[1], tableBorderColor[2]);
  doc.line(marginX, currentY, marginX + contentWidth, currentY);

  currentY += 5;

  // Project Info Table
  callAutoTable({
    startY: currentY,
    theme: 'plain',
    tableWidth: contentWidth,
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 1.5, textColor: [30, 41, 59], overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 46, fontStyle: 'bold' },
      1: { cellWidth: 45 },
      2: { cellWidth: 46, fontStyle: 'bold' },
      3: { cellWidth: 45 },
    },
    body: [
      [
        { content: 'Nazwa projektu / modelu:' },
        { content: modelName || 'Projekt konstrukcji' },
        { content: 'Data wygenerowania:' },
        { content: dateFormatted },
      ],
      [
        { content: 'Norma obliczeniowa:' },
        { content: 'Eurokod PN-EN 1990 / PN-EN 1991 / PN-EN 1993' },
        { content: 'Liczba węzłów / elementów:' },
        { content: `${nodes.length} węzłów / ${elements.length} prętów (${supportedNodesCount} podpór)` },
      ],
      [
        { content: 'Całkowita masa konstrukcji:' },
        { content: `${fmtNum(totalStructuralMass, 1)} kg (${fmtNum(totalStructuralMass / 1000, 3)} t)` },
        { content: 'Łączna długość elementów:' },
        { content: `${fmtNum(totalBarLength, 2)} m` },
      ],
      [
        { content: 'Typ analizy MES:' },
        { content: 'Statyka liniowa 3D (sprężysta I rzędu) + Kombinatoryka SGN/SGU' },
        { content: 'Liczba paneli powierzchniowych:' },
        { content: `${panels.length}` },
      ],
    ],
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Screenshot image if provided
  if (screenshotDataUrl) {
    try {
      let imgWidth = contentWidth;
      let imgHeight = 75;

      // Extract natural aspect ratio from the image
      try {
        const imgProps = doc.getImageProperties(screenshotDataUrl);
        if (imgProps && imgProps.width > 0 && imgProps.height > 0) {
          const naturalAspect = imgProps.width / imgProps.height;
          const maxAllowedWidth = contentWidth;
          const maxAllowedHeight = 85;

          if (naturalAspect >= maxAllowedWidth / maxAllowedHeight) {
            imgWidth = maxAllowedWidth;
            imgHeight = maxAllowedWidth / naturalAspect;
          } else {
            imgHeight = maxAllowedHeight;
            imgWidth = maxAllowedHeight * naturalAspect;
          }
        }
      } catch (propErr) {
        // Fallback default proportions
        imgWidth = contentWidth;
        imgHeight = 75;
      }

      if (currentY + imgHeight > pageHeight - 25) {
        doc.addPage();
        currentY = 20;
      }

      const imgX = marginX + (contentWidth - imgWidth) / 2;

      doc.setDrawColor(tableBorderColor[0], tableBorderColor[1], tableBorderColor[2]);
      doc.setLineWidth(0.3);
      doc.rect(imgX, currentY, imgWidth, imgHeight);
      doc.addImage(screenshotDataUrl, 'PNG', imgX + 0.4, currentY + 0.4, imgWidth - 0.8, imgHeight - 0.8);

      currentY += imgHeight + 3;
      doc.setFontSize(7.5);
      doc.setFont('Roboto', 'normal');
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text('Rysunek 1: Widok aksonometryczny modelu przestrzennego konstrukcji 3D', marginX + contentWidth / 2, currentY, {
        align: 'center',
      });
      currentY += 6;
    } catch (err) {
      console.error('Error adding screenshot image to PDF', err);
    }
  }

  // Section Heading Helper
  const addSectionTitle = (title: string, secNum: string) => {
    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    const lines = doc.splitTextToSize(`${secNum}. ${title}`, contentWidth);
    doc.text(lines, marginX, currentY);

    currentY += (lines.length * 4) + 1;
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.3);
    doc.line(marginX, currentY, marginX + contentWidth, currentY);
    currentY += 4;
  };

  const addSubSectionTitle = (title: string, subNum: string) => {
    if (currentY > pageHeight - 30) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFont('Roboto', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    const lines = doc.splitTextToSize(`${subNum} ${title}`, contentWidth);
    doc.text(lines, marginX, currentY);
    currentY += (lines.length * 3.8) + 2;
  };

  // ==========================================
  // SECTION 1: GEOMETRIA I PODPORY
  // ==========================================
  addSectionTitle('GEOMETRIA KONSTRUKCJI I WARUNKI BRZEGOWE', '1');

  addSubSectionTitle('Węzły konstrukcji i warunki podparcia', '1.1');
  const nodeRows = nodes.map((n) => [
    `W${n.id}`,
    fmtCoord(n.x),
    fmtCoord(n.y),
    fmtCoord(n.z),
    getSupportDesc(n.support),
  ]);

  callAutoTable({
    startY: currentY,
    head: [['Węzeł', 'Współrzędna X [m]', 'Współrzędna Y [m]', 'Współrzędna Z [m]', 'Warunki podparcia (Więzy)']],
    body: nodeRows,
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
      1: { halign: 'right', cellWidth: 24 },
      2: { halign: 'right', cellWidth: 24 },
      3: { halign: 'right', cellWidth: 24 },
      4: { halign: 'left', cellWidth: 94 },
    },
  });
  currentY = (doc as any).lastAutoTable.finalY + 6;

  addSubSectionTitle('Elementy prętowe (Belki / Słupy / Pręty kratowe)', '1.2');
  const elemRows = elements.map((el) => {
    const n1 = nodeMap.get(el.n1);
    const n2 = nodeMap.get(el.n2);
    const L = n1 && n2 ? Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z) : 0;
    const sec = secMap.get(el.sectionId);
    const mat = matMap.get(el.materialId);
    const grp = el.groupId ? grpMap.get(el.groupId) : undefined;
    return [
      `P${el.id}`,
      `W${el.n1} - W${el.n2}`,
      fmtNum(L, 3),
      sec?.name || `ID ${el.sectionId}`,
      mat?.name || `ID ${el.materialId}`,
      grp?.name || '—',
      `${el.rollAngle || 0}°`,
      getHingesDesc(el.hinges),
    ];
  });

  callAutoTable({
    startY: currentY,
    head: [['Pręt', 'Węzły (N1-N2)', 'Długość L [m]', 'Przekrój', 'Materiał', 'Grupa', 'Obrót β', 'Przeguby / Zwolnienia']],
    body: elemRows,
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'right', cellWidth: 20 },
      3: { halign: 'left', cellWidth: 28 },
      4: { halign: 'left', cellWidth: 24 },
      5: { halign: 'left', cellWidth: 20 },
      6: { halign: 'center', cellWidth: 14 },
      7: { halign: 'left', cellWidth: 40 },
    },
  });
  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Groups summary table if groups exist
  if (groups.length > 0) {
    addSubSectionTitle('Zestawienie grup elementów konstrukcyjnych', '1.3');
    const groupRows = groups.map((g) => {
      const gElems = elements.filter((e) => e.groupId === g.id);
      let gLen = 0;
      let gMass = 0;
      gElems.forEach((e) => {
        const n1 = nodeMap.get(e.n1);
        const n2 = nodeMap.get(e.n2);
        if (n1 && n2) {
          const l = Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z);
          gLen += l;
          const s = secMap.get(e.sectionId);
          const m = matMap.get(e.materialId);
          const rho = m?.density || 7850;
          const A_m2 = (s?.A || 0) * 1e-4;
          gMass += l * A_m2 * rho;
        }
      });
      const sec = g.sectionId ? secMap.get(g.sectionId) : undefined;
      const mat = g.materialId ? matMap.get(g.materialId) : undefined;
      return [
        g.name,
        `${gElems.length} szt.`,
        gElems.map((e) => `P${e.id}`).join(', ') || '—',
        sec?.name || '—',
        mat?.name || '—',
        fmtNum(gLen, 2),
        fmtNum(gMass, 1),
      ];
    });

    callAutoTable({
      startY: currentY,
      head: [['Grupa', 'Ilość', 'Elementy', 'Domyślny przekrój', 'Domyślny materiał', 'Długość [m]', 'Masa [kg]']],
      body: groupRows,
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', cellWidth: 26 },
        1: { halign: 'center', cellWidth: 14 },
        2: { halign: 'left', cellWidth: 40 },
        3: { halign: 'left', cellWidth: 28 },
        4: { halign: 'left', cellWidth: 24 },
        5: { halign: 'right', cellWidth: 24 },
        6: { halign: 'right', cellWidth: 26 },
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Panels if exist
  if (panels.length > 0) {
    addSubSectionTitle('Panele powierzchniowe (Płyty / Tarcze obciążeniowe)', '1.4');
    const panelRows = panels.map((p) => {
      const nodesStr = p.nodeIds.map((id) => `W${id}`).join(' - ');
      const dirStr =
        p.loadTransferDir === 'one_way_x'
          ? 'Jednokierunkowy (wzdłuż osi X)'
          : p.loadTransferDir === 'one_way_y'
            ? 'Jednokierunkowy (wzdłuż osi Y)'
            : 'Dwukierunkowy (powierzchniowy)';
      return [`Panel ${p.id}`, p.name || `Panel #${p.id}`, p.shape, nodesStr, dirStr];
    });

    callAutoTable({
      startY: currentY,
      head: [['ID', 'Nazwa', 'Kształt', 'Węzły obrysu', 'Kierunek rozkładu obciążeń']],
      body: panelRows,
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
        1: { halign: 'left', cellWidth: 30 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'left', cellWidth: 44 },
        4: { halign: 'left', cellWidth: 70 },
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // ==========================================
  // SECTION 2: MATERIAŁY I PRZEKROJE
  // ==========================================
  addSectionTitle('MATERIAŁY I PRZEKROJE POPRZECZNE', '2');

  addSubSectionTitle('Właściwości fizyko-mechaniczne materiałów', '2.1');
  const matRows = materials.map((m) => [
    `M${m.id}`,
    m.name,
    fmtNum(m.E, 1),
    fmtNum(m.nu, 2),
    fmtNum(m.G, 1),
    fmtNum(m.density, 0),
    m.fd != null ? fmtNum(m.fd, 1) : '—',
    m.alpha != null ? fmtNum(m.alpha, 2) : '1.20',
  ]);

  callAutoTable({
    startY: currentY,
    head: [['ID', 'Nazwa materiału', 'E [GPa]', 'ν [-]', 'G [GPa]', 'ρ [kg/m³]', 'fd / fy [MPa]', 'αT [10⁻⁵/°C]']],
    body: matRows,
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 34 },
      2: { halign: 'right', cellWidth: 20 },
      3: { halign: 'right', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 20 },
      5: { halign: 'right', cellWidth: 24 },
      6: { halign: 'right', cellWidth: 28 },
      7: { halign: 'right', cellWidth: 28 },
    },
  });
  currentY = (doc as any).lastAutoTable.finalY + 6;

  addSubSectionTitle('Charakterystyki geometryczne przekrojów poprzecznych', '2.2');
  const secRows = sections.map((s) => {
    const massPerM = (s.A * 1e-4 * 7850);
    return [
      `S${s.id}`,
      s.name,
      s.shape || 'własny',
      fmtNum(s.A, 2),
      fmtNum(s.Iy, 2),
      fmtNum(s.Iz, 2),
      fmtNum(s.It, 2),
      s.Wy != null ? fmtNum(s.Wy, 1) : '—',
      s.Wz != null ? fmtNum(s.Wz, 1) : '—',
      fmtNum(massPerM, 2),
    ];
  });

  callAutoTable({
    startY: currentY,
    head: [['ID', 'Nazwa przekroju', 'Typ', 'A [cm²]', 'Iy [cm⁴]', 'Iz [cm⁴]', 'It [cm⁴]', 'Wy [cm³]', 'Wz [cm³]', 'Masa [kg/m]']],
    body: secRows,
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 30 },
      2: { halign: 'left', cellWidth: 18 },
      3: { halign: 'right', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 20 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 18 },
      7: { halign: 'right', cellWidth: 16 },
      8: { halign: 'right', cellWidth: 16 },
      9: { halign: 'right', cellWidth: 16 },
    },
  });
  currentY = (doc as any).lastAutoTable.finalY + 6;

  // ==========================================
  // SECTION 3: PRZYPADKI I KOMBINACJE OBCIĄŻEŃ
  // ==========================================
  addSectionTitle('ZESTAWIENIE OBCIĄŻEŃ I KOMBINATORYKA (PN-EN 1990)', '3');

  addSubSectionTitle('Przypadki obciążeń podstawowych', '3.1');
  const caseRows = loadCases.map((lc) => [
    `#${lc.id}`,
    lc.name,
    getNatureLabel(lc.nature),
    lc.category ? `Kat. ${lc.category}` : '—',
    lc.includeSelfWeight ? 'TAK' : 'NIE',
    fmtNum(lc.psi0, 2),
    fmtNum(lc.psi1, 2),
    fmtNum(lc.psi2, 2),
    fmtNum(lc.gammaG_sup || 1.35, 2),
    fmtNum(lc.gammaQ || 1.5, 2),
  ]);

  callAutoTable({
    startY: currentY,
    head: [['ID', 'Nazwa przypadku', 'Natura', 'Kat. EC', 'Ciężar wł.', 'ψ₀', 'ψ₁', 'ψ₂', 'γ_sup', 'γ_Q']],
    body: caseRows,
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 36 },
      2: { halign: 'left', cellWidth: 26 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 14 },
      6: { halign: 'right', cellWidth: 14 },
      7: { halign: 'right', cellWidth: 14 },
      8: { halign: 'right', cellWidth: 15 },
      9: { halign: 'right', cellWidth: 15 },
    },
  });
  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 3.2 Applied loads detail table
  addSubSectionTitle('Obciążenia przyłożone (Węzłowe i Ciągłe prętowe)', '3.2');
  const appliedLoadsRows: any[] = [];

  loadCases.forEach((lc) => {
    // Node forces
    if (lc.nodeForces) {
      Object.entries(lc.nodeForces).forEach(([nId, f]) => {
        if (f.Fx !== 0 || f.Fy !== 0 || f.Fz !== 0) {
          appliedLoadsRows.push([
            lc.name,
            `Węzeł W${nId}`,
            'Siła węzłowa skupiona',
            `Fx=${fmtNum(f.Fx)} kN, Fy=${fmtNum(f.Fy)} kN, Fz=${fmtNum(f.Fz)} kN`,
          ]);
        }
      });
    }
    // Node moments
    if (lc.nodeMoments) {
      Object.entries(lc.nodeMoments).forEach(([nId, m]) => {
        if (m.Mx !== 0 || m.My !== 0 || m.Mz !== 0) {
          appliedLoadsRows.push([
            lc.name,
            `Węzeł W${nId}`,
            'Moment węzłowy skupiony',
            `Mx=${fmtNum(m.Mx)} kNm, My=${fmtNum(m.My)} kNm, Mz=${fmtNum(m.Mz)} kNm`,
          ]);
        }
      });
    }
    // Element distributed loads
    if (lc.elementLoads) {
      Object.entries(lc.elementLoads).forEach(([elId, q]) => {
        const parts: string[] = [];
        if (q.qxStart !== 0 || q.qxEnd !== 0) parts.push(`qx=[${fmtNum(q.qxStart)}..${fmtNum(q.qxEnd)}]`);
        if (q.qyStart !== 0 || q.qyEnd !== 0) parts.push(`qy=[${fmtNum(q.qyStart)}..${fmtNum(q.qyEnd)}]`);
        if (q.qzStart !== 0 || q.qzEnd !== 0) parts.push(`qz=[${fmtNum(q.qzStart)}..${fmtNum(q.qzEnd)}]`);
        if (parts.length > 0) {
          appliedLoadsRows.push([
            lc.name,
            `Pręt P${elId}`,
            `Ciągłe (${q.coordinateSystem || 'lokalne'})`,
            `${parts.join(', ')} kN/m`,
          ]);
        }
      });
    }
    // Element thermal loads
    if (lc.elementThermals) {
      Object.entries(lc.elementThermals).forEach(([elId, t]) => {
        const parts: string[] = [];
        if (t.deltaTx || t.dT_axial) parts.push(`ΔT_osiowy=${fmtNum(t.deltaTx ?? t.dT_axial)}°C`);
        if (t.deltaTy) parts.push(`ΔTy=${fmtNum(t.deltaTy)}°C`);
        if (t.deltaTz) parts.push(`ΔTz=${fmtNum(t.deltaTz)}°C`);
        if (parts.length > 0) {
          appliedLoadsRows.push([
            lc.name,
            `Pręt P${elId}`,
            'Termiczne prętowe',
            parts.join(', '),
          ]);
        }
      });
    }
    // Panel pressure loads
    if (lc.panelPressures) {
      Object.entries(lc.panelPressures).forEach(([pId, p]) => {
        if (p.value !== 0) {
          appliedLoadsRows.push([
            lc.name,
            `Panel #${pId}`,
            'Parcie powierzchniowe',
            `p=${fmtNum(p.value)} kN/m² (kierunek ${p.dir})`,
          ]);
        }
      });
    }
  });

  if (appliedLoadsRows.length === 0) {
    appliedLoadsRows.push(['Wszystkie', 'Model', 'Brak obciążeń bezpośrednich', 'Uwzględniony ciężar własny elementów']);
  }

  callAutoTable({
    startY: currentY,
    head: [['Przypadek', 'Element / Węzeł', 'Typ obciążenia', 'Wartości składowe obciążenia']],
    body: appliedLoadsRows,
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 26 },
      2: { halign: 'left', cellWidth: 34 },
      3: { halign: 'left', cellWidth: 90 },
    },
  });
  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 3.3 Combinations table
  if (combinations.length > 0) {
    addSubSectionTitle('Kombinacje normowe (SGN i SGU)', '3.3');
    const combRows = combinations.map((c) => {
      const eqStr = c.factors
        .map((f) => {
          const lc = loadCases.find((l) => l.id === f.caseId);
          return `${fmtNum(f.factor, 2)}·[${lc?.name || `K${f.caseId}`}]`;
        })
        .join(' + ');

      return [c.id, c.name, c.type, eqStr || '—', c.description || '—'];
    });

    callAutoTable({
      startY: currentY,
      head: [['ID', 'Nazwa kombinacji', 'Stan graniczny', 'Równanie kombinacji', 'Opis']],
      body: combRows,
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
        1: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'left', cellWidth: 70 },
        4: { halign: 'left', cellWidth: 44 },
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // 3.4 Envelopes Overview table
  if (multiSolved && multiSolved.envelopes && Object.keys(multiSolved.envelopes).length > 0) {
    addSubSectionTitle('Zestawienie wyznaczonych obwiedni stanów granicznych (Envelopes)', '3.4');
    const envRows = Object.entries(multiSolved.envelopes).map(([envKey, envData]) => {
      const res = envData.result;
      const typeLabel =
        envData.type === 'sgn'
          ? 'SGN (Nośność / STR / GEO)'
          : envData.type === 'sgu'
            ? 'SGU (Użytkowalność / SLS)'
            : 'Całkowita (Wszystkie kombinacje)';
      const sgnCombsCount = combinations.filter((c) => c.type === 'SGN').length;
      const sguCombsCount = combinations.filter((c) => c.type !== 'SGN').length;
      const sourceCount =
        envData.type === 'sgn'
          ? `${sgnCombsCount} komb. SGN`
          : envData.type === 'sgu'
            ? `${sguCombsCount} komb. SGU`
            : `${combinations.length} komb. łącznie`;

      return [
        envKey,
        envData.name,
        typeLabel,
        sourceCount,
        `${fmtNum((res.maxDisp || 0) * 1000, 2)} mm`,
        `${fmtNum((res.maxStress || 0) / 1000, 1)} MPa`,
        `${fmtNum(res.maxN || 0, 1)} kN`,
        `${fmtNum(res.maxMy || 0, 1)} kNm`,
      ];
    });

    callAutoTable({
      startY: currentY,
      head: [['Klucz', 'Nazwa obwiedni', 'Typ stanu', 'Zakres kombinacji', 'u_max [mm]', 'σ_max [MPa]', '|N_max| [kN]', '|My_max| [kNm]']],
      body: envRows,
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
        1: { halign: 'left', fontStyle: 'bold', cellWidth: 36 },
        2: { halign: 'left', cellWidth: 32 },
        3: { halign: 'left', cellWidth: 26 },
        4: { halign: 'right', cellWidth: 18 },
        5: { halign: 'right', cellWidth: 18 },
        6: { halign: 'right', cellWidth: 18 },
        7: { halign: 'right', cellWidth: 18 },
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // ==========================================
  // SECTION 4: WYNIKI OBLICZEŃ STATYCZNYCH
  // ==========================================
  let resultsToDisplay: LinearStaticResult3D | null = null;
  let resultTitleContext = '';

  if (activeSolved && activeSolved.type === 'linear_static') {
    resultsToDisplay = activeSolved;
    resultTitleContext = activeResultKey ? ` (Dla stanu: ${activeResultKey})` : '';
  } else if (multiSolved) {
    const activeKey = multiSolved.activeKey || Object.keys(multiSolved.cases)[0];
    if (activeKey) {
      if (activeKey.startsWith('case_')) {
        const cId = Number(activeKey.replace('case_', ''));
        resultsToDisplay = multiSolved.cases[cId]?.result || null;
        resultTitleContext = ` (Przypadek: ${multiSolved.cases[cId]?.loadCase?.name || activeKey})`;
      } else if (activeKey.startsWith('comb_')) {
        const combId = activeKey.replace('comb_', '');
        resultsToDisplay = multiSolved.combinations[combId]?.result || null;
        resultTitleContext = ` (Kombinacja: ${multiSolved.combinations[combId]?.comb?.name || activeKey})`;
      } else if (activeKey.startsWith('env_')) {
        const envId = activeKey.replace('env_', '');
        resultsToDisplay = multiSolved.envelopes[envId]?.result || null;
        resultTitleContext = ` (Obwiednia: ${multiSolved.envelopes[envId]?.name || activeKey})`;
      }
    }
  }

  // Fallback to SGN envelope or first combination result if available
  if (!resultsToDisplay && multiSolved) {
    if (multiSolved.envelopes?.['env_sgn']) {
      resultsToDisplay = multiSolved.envelopes['env_sgn'].result;
      resultTitleContext = ' (Obwiednia SGN)';
    } else if (Object.values(multiSolved.combinations)[0]) {
      resultsToDisplay = Object.values(multiSolved.combinations)[0].result;
    }
  }

  if (resultsToDisplay && resultsToDisplay.reactions) {
    addSectionTitle(`WYNIKI ANALIZY STATYCZNEJ MES${resultTitleContext}`, '4');

    // 4.1 Reactions & Equilibrium Balance Table
    addSubSectionTitle('Reakcje podporowe i bilans równowagi globalnej', '4.1');

    let sumRx = 0, sumRy = 0, sumRz = 0, sumMx = 0, sumMy = 0, sumMz = 0;
    const reactionRows: any[] = [];

    nodes.forEach((n) => {
      const r = resultsToDisplay?.reactions[n.id];
      if (r) {
        sumRx += r.Rx;
        sumRy += r.Ry;
        sumRz += r.Rz;
        sumMx += r.Mx;
        sumMy += r.My;
        sumMz += r.Mz;

        reactionRows.push([
          `W${n.id}`,
          fmtNum(r.Rx, 2),
          fmtNum(r.Ry, 2),
          fmtNum(r.Rz, 2),
          fmtNum(r.Mx, 2),
          fmtNum(r.My, 2),
          fmtNum(r.Mz, 2),
        ]);
      }
    });

    reactionRows.push([
      { content: 'SUMA REAKCJI (ΣR):', styles: { fontStyle: 'bold', halign: 'right' } },
      { content: fmtNum(sumRx, 2), styles: { fontStyle: 'bold' } },
      { content: fmtNum(sumRy, 2), styles: { fontStyle: 'bold' } },
      { content: fmtNum(sumRz, 2), styles: { fontStyle: 'bold' } },
      { content: fmtNum(sumMx, 2), styles: { fontStyle: 'bold' } },
      { content: fmtNum(sumMy, 2), styles: { fontStyle: 'bold' } },
      { content: fmtNum(sumMz, 2), styles: { fontStyle: 'bold' } },
    ]);

    callAutoTable({
      startY: currentY,
      head: [['Węzeł podparty', 'Rx [kN]', 'Ry [kN]', 'Rz [kN]', 'Mx [kNm]', 'My [kNm]', 'Mz [kNm]']],
      body: reactionRows,
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 26 },
        1: { halign: 'right', cellWidth: 26 },
        2: { halign: 'right', cellWidth: 26 },
        3: { halign: 'right', cellWidth: 26 },
        4: { halign: 'right', cellWidth: 26 },
        5: { halign: 'right', cellWidth: 26 },
        6: { halign: 'right', cellWidth: 26 },
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;

    // 4.2 Nodal Displacements Table
    addSubSectionTitle('Ekstremalne przemieszczenia i obroty węzłów', '4.2');
    const dispRows: any[] = [];
    const D = resultsToDisplay.D || [];

    nodes.forEach((n, idx) => {
      const baseIdx = 6 * idx;
      const ux_mm = (D[baseIdx + 0] || 0) * 1000;
      const uy_mm = (D[baseIdx + 1] || 0) * 1000;
      const uz_mm = (D[baseIdx + 2] || 0) * 1000;
      const u_tot_mm = Math.hypot(ux_mm, uy_mm, uz_mm);

      const rx_mrad = (D[baseIdx + 3] || 0) * 1000;
      const ry_mrad = (D[baseIdx + 4] || 0) * 1000;
      const rz_mrad = (D[baseIdx + 5] || 0) * 1000;

      dispRows.push([
        `W${n.id}`,
        fmtNum(ux_mm, 2),
        fmtNum(uy_mm, 2),
        fmtNum(uz_mm, 2),
        fmtNum(u_tot_mm, 2),
        fmtNum(rx_mrad, 2),
        fmtNum(ry_mrad, 2),
        fmtNum(rz_mrad, 2),
      ]);
    });

    callAutoTable({
      startY: currentY,
      head: [['Węzeł', 'Ux [mm]', 'Uy [mm]', 'Uz [mm]', 'U_total [mm]', 'RotX [mrad]', 'RotY [mrad]', 'RotZ [mrad]']],
      body: dispRows,
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
        1: { halign: 'right', cellWidth: 24 },
        2: { halign: 'right', cellWidth: 24 },
        3: { halign: 'right', cellWidth: 24 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
        5: { halign: 'right', cellWidth: 23 },
        6: { halign: 'right', cellWidth: 23 },
        7: { halign: 'right', cellWidth: 24 },
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;

    // 4.3 Member Internal Forces & Stresses
    addSubSectionTitle('Siły wewnętrzne i naprężenia w elementach prętowych (N, Vy, Vz, Mx, My, Mz, σ)', '4.3');
    const forcesRows: any[] = [];

    elements.forEach((el) => {
      const elemRes = resultsToDisplay?.elements[el.id];
      if (!elemRes || !elemRes.points || elemRes.points.length === 0) return;

      const pts = elemRes.points;
      const ptStart = pts[0];
      const ptMid = pts[Math.floor(pts.length / 2)];
      const ptEnd = pts[pts.length - 1];

      const mat = matMap.get(el.materialId);
      const fd = mat?.fd || 235; // MPa

      [
        { loc: 'Początek (x=0)', pt: ptStart },
        { loc: 'Środek (x=L/2)', pt: ptMid },
        { loc: 'Koniec (x=L)', pt: ptEnd },
      ].forEach(({ loc, pt }, pIdx) => {
        const sigMpa = (pt.sigMax || 0) / 1000;
        const utilPct = fd > 0 ? (Math.abs(sigMpa) / fd) * 100 : 0;

        forcesRows.push([
          pIdx === 0 ? `P${el.id}` : '',
          loc,
          fmtNum(pt.N, 2),
          fmtNum(pt.Vy, 2),
          fmtNum(pt.Vz, 2),
          fmtNum(pt.Mx, 2),
          fmtNum(pt.My, 2),
          fmtNum(pt.Mz, 2),
          fmtNum(sigMpa, 1),
          `${fmtNum(utilPct, 1)}%`,
        ]);
      });
    });

    callAutoTable({
      startY: currentY,
      head: [['Pręt', 'Przekrój', 'N [kN]', 'Vy [kN]', 'Vz [kN]', 'Mx [kNm]', 'My [kNm]', 'Mz [kNm]', 'σ_max [MPa]', 'Wytężenie']],
      body: forcesRows,
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
        1: { halign: 'left', cellWidth: 24 },
        2: { halign: 'right', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 17 },
        4: { halign: 'right', cellWidth: 17 },
        5: { halign: 'right', cellWidth: 18 },
        6: { halign: 'right', cellWidth: 18 },
        7: { halign: 'right', cellWidth: 18 },
        8: { halign: 'right', cellWidth: 21 },
        9: { halign: 'right', fontStyle: 'bold', cellWidth: 19 },
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;

    // 4.4 Envelopes SGN Extremes per Member
    const sgnEnvelope = multiSolved?.envelopes?.['env_sgn'];
    if (sgnEnvelope && sgnEnvelope.minMaxMap) {
      addSubSectionTitle('Ekstremalne wartości sił wewnętrznych z Obwiedni SGN (Min / Max)', '4.4');
      const envElemRows: any[] = [];

      elements.forEach((el) => {
        const minMax = sgnEnvelope.minMaxMap?.elements[el.id];
        if (!minMax) return;

        const N_min = Math.min(...minMax.N_min);
        const N_max = Math.max(...minMax.N_max);
        const My_min = Math.min(...minMax.My_min);
        const My_max = Math.max(...minMax.My_max);
        const Mz_min = Math.min(...minMax.Mz_min);
        const Mz_max = Math.max(...minMax.Mz_max);
        const Vy_max = Math.max(...minMax.Vy_max.map(Math.abs), ...minMax.Vy_min.map(Math.abs));
        const Vz_max = Math.max(...minMax.Vz_max.map(Math.abs), ...minMax.Vz_min.map(Math.abs));
        const sig_max_mpa = Math.max(...minMax.sig_max, ...minMax.sig_min.map(Math.abs)) / 1000;

        const mat = matMap.get(el.materialId);
        const fd = mat?.fd || 235;
        const util = (sig_max_mpa / fd) * 100;

        envElemRows.push([
          `P${el.id}`,
          `[${fmtNum(N_min, 1)} .. ${fmtNum(N_max, 1)}]`,
          fmtNum(Vy_max, 1),
          fmtNum(Vz_max, 1),
          `[${fmtNum(My_min, 1)} .. ${fmtNum(My_max, 1)}]`,
          `[${fmtNum(Mz_min, 1)} .. ${fmtNum(Mz_max, 1)}]`,
          fmtNum(sig_max_mpa, 1),
          `${fmtNum(util, 1)}%`,
        ]);
      });

      callAutoTable({
        startY: currentY,
        head: [['Pręt', 'N_min .. N_max [kN]', '|Vy_max| [kN]', '|Vz_max| [kN]', 'My_min .. My_max [kNm]', 'Mz_min .. Mz_max [kNm]', 'σ_max [MPa]', 'Wytężenie SGN']],
        body: envElemRows,
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
          1: { halign: 'center', cellWidth: 32 },
          2: { halign: 'right', cellWidth: 20 },
          3: { halign: 'right', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 32 },
          5: { halign: 'center', cellWidth: 32 },
          6: { halign: 'right', cellWidth: 16 },
          7: { halign: 'right', fontStyle: 'bold', cellWidth: 16 },
        },
      });
      currentY = (doc as any).lastAutoTable.finalY + 6;

      // 4.5 Envelopes Reactions
      addSubSectionTitle('Ekstremalne reakcje podporowe z Obwiedni SGN (Min / Max)', '4.5');
      const envReacRows: any[] = [];

      nodes.forEach((n) => {
        const rMM = sgnEnvelope.minMaxMap?.reactions[n.id];
        if (!rMM) return;

        envReacRows.push([
          `W${n.id}`,
          `[${fmtNum(rMM.Rx_min, 1)} .. ${fmtNum(rMM.Rx_max, 1)}]`,
          `[${fmtNum(rMM.Ry_min, 1)} .. ${fmtNum(rMM.Ry_max, 1)}]`,
          `[${fmtNum(rMM.Rz_min, 1)} .. ${fmtNum(rMM.Rz_max, 1)}]`,
          `[${fmtNum(rMM.Mx_min, 1)} .. ${fmtNum(rMM.Mx_max, 1)}]`,
          `[${fmtNum(rMM.My_min, 1)} .. ${fmtNum(rMM.My_max, 1)}]`,
          `[${fmtNum(rMM.Mz_min, 1)} .. ${fmtNum(rMM.Mz_max, 1)}]`,
        ]);
      });

      callAutoTable({
        startY: currentY,
        head: [['Węzeł', 'Rx_min .. Rx_max [kN]', 'Ry_min .. Ry_max [kN]', 'Rz_min .. Rz_max [kN]', 'Mx_min .. Mx_max [kNm]', 'My_min .. My_max [kNm]', 'Mz_min .. Mz_max [kNm]']],
        body: envReacRows,
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
          1: { halign: 'center', cellWidth: 27 },
          2: { halign: 'center', cellWidth: 27 },
          3: { halign: 'center', cellWidth: 28 },
          4: { halign: 'center', cellWidth: 28 },
          5: { halign: 'center', cellWidth: 28 },
          6: { halign: 'center', cellWidth: 28 },
        },
      });
      currentY = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // ==========================================
  // SECTION 5: WYTĘŻENIA I NOŚNOŚĆ GRUP PRĘTÓW
  // ==========================================
  addSectionTitle('ANALIZA WYTĘŻENIA I NOŚNOŚCI GRUP ELEMENTÓW (SGN / EC3)', '5');

  // Compute utilization data per element and per group
  // Determine governing result source for capacity verification: SGN envelope if available, else resultsToDisplay
  const capResult = multiSolved?.envelopes?.['env_sgn']?.result || resultsToDisplay;

  interface GroupCapacityData {
    groupId: string;
    groupName: string;
    elements: Element3D[];
    sectionName: string;
    materialName: string;
    fd: number;
    maxStressMpa: number;
    maxUtilPct: number;
    critElemId: number;
    critPointLoc: string;
    critN: number;
    critMy: number;
    critMz: number;
    critVz: number;
    status: string;
  }

  const groupsToEvaluate: { id: string; name: string; elements: Element3D[] }[] = [];

  if (groups.length > 0) {
    groups.forEach((g) => {
      const gElems = elements.filter((e) => e.groupId === g.id);
      if (gElems.length > 0) {
        groupsToEvaluate.push({ id: g.id, name: g.name, elements: gElems });
      }
    });
    // Ungrouped elements
    const ungrouped = elements.filter((e) => !e.groupId);
    if (ungrouped.length > 0) {
      groupsToEvaluate.push({ id: 'ungrouped', name: 'Pozostałe pręty (bez grupy)', elements: ungrouped });
    }
  } else {
    // If no groups explicitly defined, group by Section ID for clear engineering division
    const secGroupMap = new Map<number, Element3D[]>();
    elements.forEach((e) => {
      const list = secGroupMap.get(e.sectionId) || [];
      list.push(e);
      secGroupMap.set(e.sectionId, list);
    });

    secGroupMap.forEach((elems, sId) => {
      const sec = secMap.get(sId);
      groupsToEvaluate.push({
        id: `sec_${sId}`,
        name: `Grupa przekroju: ${sec?.name || `Przekrój S${sId}`}`,
        elements: elems,
      });
    });
  }

  const groupCapacitySummary: GroupCapacityData[] = [];
  let globalMaxUtil = 0;
  let globalCritGroupName = '';
  let globalCritElemId = 0;

  groupsToEvaluate.forEach((grp) => {
    let grpMaxStress = 0;
    let grpMaxUtil = 0;
    let critElemId = grp.elements[0]?.id || 0;
    let critLoc = 'x=0';
    let critN = 0, critMy = 0, critMz = 0, critVz = 0;
    let grpFd = 235;
    let grpSecName = '—';
    let grpMatName = '—';

    grp.elements.forEach((el) => {
      const sec = secMap.get(el.sectionId);
      const mat = matMap.get(el.materialId);
      const fd = mat?.fd || 235;
      grpFd = fd;
      if (sec) grpSecName = sec.name;
      if (mat) grpMatName = mat.name;

      const elemRes = capResult?.elements[el.id];
      if (elemRes && elemRes.points && elemRes.points.length > 0) {
        elemRes.points.forEach((pt, pIdx) => {
          const sigMpa = Math.max(Math.abs((pt.sigMax || 0) / 1000), Math.abs((pt.sigMin || 0) / 1000));
          const utilPct = fd > 0 ? (sigMpa / fd) * 100 : 0;

          if (utilPct >= grpMaxUtil) {
            grpMaxUtil = utilPct;
            grpMaxStress = sigMpa;
            critElemId = el.id;
            critLoc = pIdx === 0 ? 'x=0' : pIdx === elemRes.points.length - 1 ? 'x=L' : 'x=L/2';
            critN = pt.N;
            critMy = pt.My;
            critMz = pt.Mz;
            critVz = pt.Vz;
          }
        });
      }
    });

    let status = 'SPEŁNIONY (Optymalny)';
    if (grpMaxUtil > 100) {
      status = 'PRZEKROCZENIE NOŚNOŚCI';
    } else if (grpMaxUtil > 80) {
      status = 'SPEŁNIONY (Wysokie wytężenie)';
    }

    if (grpMaxUtil >= globalMaxUtil) {
      globalMaxUtil = grpMaxUtil;
      globalCritGroupName = grp.name;
      globalCritElemId = critElemId;
    }

    groupCapacitySummary.push({
      groupId: grp.id,
      groupName: grp.name,
      elements: grp.elements,
      sectionName: grpSecName,
      materialName: grpMatName,
      fd: grpFd,
      maxStressMpa: grpMaxStress,
      maxUtilPct: grpMaxUtil,
      critElemId,
      critPointLoc: critLoc,
      critN,
      critMy,
      critMz,
      critVz,
      status,
    });
  });

  // 5.1 Synthetic Group Utilization Table
  addSubSectionTitle('Zestawienie maksymalnych wytężeń i nośności grup prętów', '5.1');
  const groupTableRows = groupCapacitySummary.map((g) => {
    return [
      g.groupName,
      `${g.elements.length} szt.`,
      `${g.sectionName} / ${g.materialName}`,
      fmtNum(g.fd, 0),
      `P${g.critElemId} (${g.critPointLoc})`,
      fmtNum(g.critN, 1),
      fmtNum(g.critMy, 1),
      fmtNum(g.critMz, 1),
      fmtNum(g.maxStressMpa, 1),
      `${fmtNum(g.maxUtilPct, 1)}%`,
      g.status,
    ];
  });

  callAutoTable({
    startY: currentY,
    head: [['Grupa elementów', 'Ilość', 'Przekrój / Materiał', 'fd [MPa]', 'Pręt kryt.', 'N [kN]', 'My [kNm]', 'Mz [kNm]', 'σ_max [MPa]', 'Wytężenie η', 'Ocena nośności']],
    body: groupTableRows,
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', cellWidth: 26 },
      1: { halign: 'center', cellWidth: 11 },
      2: { halign: 'left', cellWidth: 26 },
      3: { halign: 'right', cellWidth: 14 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 19 },
      5: { halign: 'right', cellWidth: 13 },
      6: { halign: 'right', cellWidth: 13 },
      7: { halign: 'right', cellWidth: 13 },
      8: { halign: 'right', cellWidth: 15 },
      9: { halign: 'right', fontStyle: 'bold', cellWidth: 16 },
      10: { halign: 'left', cellWidth: 16 },
    },
  });
  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 5.2 Detailed Verification Table for All Elements in Groups
  addSubSectionTitle('Wytężenie poszczególnych elementów prętowych w grupach', '5.2');
  const detailElemRows: any[] = [];

  groupCapacitySummary.forEach((grp) => {
    grp.elements.forEach((el) => {
      const sec = secMap.get(el.sectionId);
      const mat = matMap.get(el.materialId);
      const fd = mat?.fd || 235;

      const n1 = nodeMap.get(el.n1);
      const n2 = nodeMap.get(el.n2);
      const L = n1 && n2 ? Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z) : 0;

      let elMaxStress = 0;
      let elCritN = 0, elCritMy = 0, elCritMz = 0;
      let elCritLoc = 'x=0';

      const elemRes = capResult?.elements[el.id];
      if (elemRes && elemRes.points && elemRes.points.length > 0) {
        elemRes.points.forEach((pt, pIdx) => {
          const sigMpa = Math.max(Math.abs((pt.sigMax || 0) / 1000), Math.abs((pt.sigMin || 0) / 1000));
          if (sigMpa >= elMaxStress) {
            elMaxStress = sigMpa;
            elCritN = pt.N;
            elCritMy = pt.My;
            elCritMz = pt.Mz;
            elCritLoc = pIdx === 0 ? 'x=0' : pIdx === elemRes.points.length - 1 ? 'x=L' : 'x=L/2';
          }
        });
      }

      const utilPct = fd > 0 ? (elMaxStress / fd) * 100 : 0;
      const pass = utilPct <= 100;

      detailElemRows.push([
        grp.groupName,
        `P${el.id}`,
        fmtNum(L, 2),
        sec?.name || `S${el.sectionId}`,
        elCritLoc,
        fmtNum(elCritN, 1),
        fmtNum(elCritMy, 1),
        fmtNum(elCritMz, 1),
        fmtNum(elMaxStress, 1),
        `${fmtNum(utilPct, 1)}%`,
        pass ? 'SPEŁNIONY' : 'PRZEKROCZONY',
      ]);
    });
  });

  callAutoTable({
    startY: currentY,
    head: [['Grupa', 'Pręt', 'L [m]', 'Przekrój', 'Przekrój kryt.', 'N [kN]', 'My [kNm]', 'Mz [kNm]', 'σ_max [MPa]', 'Wytężenie η', 'Status']],
    body: detailElemRows,
    columnStyles: {
      0: { halign: 'left', cellWidth: 26 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      2: { halign: 'right', cellWidth: 12 },
      3: { halign: 'left', cellWidth: 26 },
      4: { halign: 'center', cellWidth: 19 },
      5: { halign: 'right', cellWidth: 14 },
      6: { halign: 'right', cellWidth: 14 },
      7: { halign: 'right', cellWidth: 14 },
      8: { halign: 'right', cellWidth: 16 },
      9: { halign: 'right', fontStyle: 'bold', cellWidth: 15 },
      10: { halign: 'center', cellWidth: 14 },
    },
  });
  currentY = (doc as any).lastAutoTable.finalY + 6;

  // 5.3 Global Structural Safety & Capacity Summary Box
  addSubSectionTitle('Podsumowanie oceny nośności konstrukcji i wnioski końcowe', '5.3');
  const isOverallSafe = globalMaxUtil <= 100;

  callAutoTable({
    startY: currentY,
    theme: 'plain',
    tableWidth: contentWidth,
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 48, fontStyle: 'bold' },
      1: { cellWidth: contentWidth - 48 },
    },
    body: [
      [
        { content: 'Maksymalne wytężenie w konstrukcji:' },
        { content: `${fmtNum(globalMaxUtil, 1)}% (Grupa: ${globalCritGroupName}, Pręt krytyczny: P${globalCritElemId})` },
      ],
      [
        { content: 'Warunek Stanu Granicznego Nośności (SGN):' },
        {
          content: isOverallSafe
            ? 'SPEŁNIONY — Naprężenia we wszystkich elementach nie przekraczają wartości obliczeniowych wytrzymałości materiałów (η <= 100%).'
            : 'UWAGA: PRZEKROCZENIE NOŚNOŚCI — Wymagane zwiększenie przekroju poprzecznego elementów krytycznych lub modyfikacja schematu statycznego.',
        },
      ],
      [
        { content: 'Maksymalne ugięcie globalne (SGU):' },
        { content: `${fmtNum((resultsToDisplay?.maxDisp || 0) * 1000, 2)} mm` },
      ],
      [
        { content: 'Zalecenia inżynierskie:' },
        {
          content: isOverallSafe
            ? 'Konstrukcja posiada wymaganą nośność i sztywność wg norm PN-EN 1990 / PN-EN 1991 / PN-EN 1993.'
            : 'Zaleca się optymalizację przekrojów w najbardziej obciążonych grupach konstrukcji.',
        },
      ],
    ],
  });
  currentY = (doc as any).lastAutoTable.finalY + 6;

  // ==========================================
  // SECTION 6: ANALIZA STATECZNOŚCI (jeśli istnieje)
  // ==========================================
  if (activeSolved && activeSolved.type === 'stability' && (activeSolved as StabilityResult3D).modes) {
    const stab = activeSolved as StabilityResult3D;
    addSectionTitle('WYNIKI ANALIZY STATECZNOŚCI OGÓLNEJ (WYBOCZENIE SPRĘŻYSTE)', '6');

    const modeRows = stab.modes.map((m, idx) => [
      `Mod #${m.modeIndex || idx + 1}`,
      fmtNum(m.alphaCr, 3),
      fmtNum(m.maxNcr, 1),
      m.alphaCr < 1.0 ? 'KRYTYCZNY (α_cr < 1.0 - Utrata stateczności!)' : m.alphaCr < 3.0 ? 'Wymagana analiza II rzędu (α_cr < 3.0)' : 'Stateczność zapewniona',
    ]);

    callAutoTable({
      startY: currentY,
      head: [['Postać wyboczenia', 'Mnożnik krytyczny α_cr [-]', 'Siła krytyczna N_cr [kN]', 'Ocena wg PN-EN 1993-1-1']],
      body: modeRows,
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 32 },
        1: { halign: 'right', fontStyle: 'bold', cellWidth: 38 },
        2: { halign: 'right', cellWidth: 38 },
        3: { halign: 'left', cellWidth: 74 },
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // ==========================================
  // SECTION 7: ANALIZA DRGAŃ WŁASNYCH (jeśli istnieje)
  // ==========================================
  if (activeSolved && activeSolved.type === 'modal' && (activeSolved as ModalResult3D).modes) {
    const modal = activeSolved as ModalResult3D;
    addSectionTitle('WYNIKI ANALIZY DYNAMICZNEJ (DRGANIA WŁASNE / MODALNA)', '7');

    const modalRows = modal.modes.map((m, idx) => [
      `Mod #${m.modeIndex || idx + 1}`,
      fmtNum(m.f, 3),
      fmtNum(m.T, 4),
      fmtNum(m.omega, 2),
      `${fmtNum(m.massRatioX || 0, 1)}%`,
      `${fmtNum(m.massRatioY || 0, 1)}%`,
      `${fmtNum(m.massRatioZ || 0, 1)}%`,
    ]);

    callAutoTable({
      startY: currentY,
      head: [['Postać drgań', 'Częstotliwość f [Hz]', 'Okres T [s]', 'Pulsacja ω [rad/s]', 'Udział UX', 'Udział UY', 'Udział UZ']],
      body: modalRows,
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 26 },
        1: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
        2: { halign: 'right', cellWidth: 24 },
        3: { halign: 'right', cellWidth: 26 },
        4: { halign: 'right', cellWidth: 26 },
        5: { halign: 'right', cellWidth: 26 },
        6: { halign: 'right', cellWidth: 26 },
      },
    });
    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // ==========================================
  // FINAL PASS: HEADER, FOOTER & PAGE NUMBERING
  // ==========================================
  const totalPages = doc.internal.pages.length - 1;

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Running Header (from page 2 onwards)
    if (i > 1) {
      doc.setFont('Roboto', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      const projName = modelName || 'Konstrukcja 3D';
      const maxProjWidth = contentWidth - 48;
      const projShort = doc.splitTextToSize(`Materia3D | Projekt: ${projName} | Raport MES`, maxProjWidth)[0];
      doc.text(projShort, marginX, 9);
      doc.text(dateFormatted, pageWidth - marginX, 9, { align: 'right' });

      doc.setDrawColor(tableBorderColor[0], tableBorderColor[1], tableBorderColor[2]);
      doc.setLineWidth(0.15);
      doc.line(marginX, 11, marginX + contentWidth, 11);
    }

    // Running Footer
    doc.setDrawColor(tableBorderColor[0], tableBorderColor[1], tableBorderColor[2]);
    doc.setLineWidth(0.15);
    doc.line(marginX, pageHeight - 11, marginX + contentWidth, pageHeight - 11);

    doc.setFont('Roboto', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('Materia3D FEM Structural Analysis System — Dokument wygenerowany automatycznie', marginX, pageHeight - 7);
    doc.text(`Strona ${i} z ${totalPages}`, pageWidth - marginX, pageHeight - 7, { align: 'right' });
  }

  // Save / Download PDF
  const cleanFilename = (modelName || 'Materia3D_Raport')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_');
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  doc.save(`${cleanFilename}_Raport_${dateStr}.pdf`);
}
