import React, { useState, useMemo } from 'react';
import {
  generate3DIndustrialHall,
  generate3DPortalFrame,
  generate3DTrussTower,
  generate3DGrillage,
} from '../fem/templates';
import { Node3D, Element3D, Section, Material } from '../fem/types';
import {
  Warehouse,
  Layers,
  Box,
  Grid3X3,
  X,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Wind,
  Compass,
  Sliders,
  Triangle,
  ArrowDownToLine,
  Activity,
} from 'lucide-react';
import { SmartNumberInput } from './SmartNumberInput';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (nodes: Node3D[], elements: Element3D[]) => void;
  sections?: Section[];
  materials?: Material[];
  defaultSectionId: number;
  defaultMaterialId: number;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onApplyTemplate,
  sections = [],
  materials = [],
  defaultSectionId,
  defaultMaterialId,
}) => {
  const [selectedType, setSelectedType] = useState<'hall3d' | 'portal3d' | 'tower3d' | 'grillage3d'>('hall3d');

  // Przekroje elementów i materiał
  const [secId, setSecId] = useState<number>(defaultSectionId);
  const [colSecId, setColSecId] = useState<number>(defaultSectionId);
  const [rafterSecId, setRafterSecId] = useState<number>(defaultSectionId);
  const [purlinSecId, setPurlinSecId] = useState<number>(defaultSectionId);
  const [bracingSecId, setBracingSecId] = useState<number>(defaultSectionId);
  const [matId, setMatId] = useState<number>(defaultMaterialId);

  // Parametry zaawansowanej Hali 3D
  const [hallSpan, setHallSpan] = useState(18.0);
  const [hallBaySpacing, setHallBaySpacing] = useState(6.0);
  const [hallNumBays, setHallNumBays] = useState(5);
  const [hallEaveHeight, setHallEaveHeight] = useState(6.0);
  const [hallRoofType, setHallRoofType] = useState<'gable' | 'monopitch' | 'flat' | 'truss'>('gable');
  const [hallRidgeHeight, setHallRidgeHeight] = useState(8.5);
  const [hallTrussDivisions, setHallTrussDivisions] = useState(6);
  const [hallColBase, setHallColBase] = useState<'fixed' | 'pinned'>('fixed');
  const [hallEaveJoint, setHallEaveJoint] = useState<'rigid' | 'pinned'>('rigid');
  const [hallIncludePurlins, setHallIncludePurlins] = useState(true);
  const [hallPurlinsPerRafter, setHallPurlinsPerRafter] = useState(3);
  const [hallRoofBracing, setHallRoofBracing] = useState(true);
  const [hallWallBracing, setHallWallBracing] = useState(true);
  const [hallGableWall, setHallGableWall] = useState(true);
  const [hallGableCols, setHallGableCols] = useState(1);
  const [hallIncludeSnowLoad, setHallIncludeSnowLoad] = useState(true);
  const [hallSnowLoadVal, setHallSnowLoadVal] = useState(-12.0);
  const [hallIncludeWind, setHallIncludeWind] = useState(true);
  const [hallWindLoadVal, setHallWindLoadVal] = useState(15.0);
  const [hallDynamicMasses, setHallDynamicMasses] = useState(true);

  // Aktywna podkarta dla kreatora hali 3D
  const [hallSubTab, setHallSubTab] = useState<'geom' | 'structure' | 'loads' | 'sections'>('geom');

  // Parametry ramy przestrzennej 3D
  const [bayX, setBayX] = useState(6.0);
  const [bayY, setBayY] = useState(6.0);
  const [frameHeight, setFrameHeight] = useState(4.0);
  const [numBaysX, setNumBaysX] = useState(2);
  const [numBaysY, setNumBaysY] = useState(2);

  // Parametry wieży kratowej 3D
  const [towerBase, setTowerBase] = useState(4.0);
  const [towerTop, setTowerTop] = useState(2.0);
  const [towerHeight, setTowerHeight] = useState(12.0);
  const [towerStories, setTowerStories] = useState(4);

  // Parametry rusztu belkowego 3D
  const [grillWidthX, setGrillWidthX] = useState(8.0);
  const [grillWidthY, setGrillWidthY] = useState(8.0);
  const [grillDivX, setGrillDivX] = useState(4);
  const [grillDivY, setGrillDivY] = useState(4);

  // Podsumowanie szacowanych elementów przed wygenerowaniem
  const previewSummary = useMemo(() => {
    if (selectedType === 'hall3d') {
      const totalLen = hallBaySpacing * hallNumBays;
      const footprint = hallSpan * totalLen;
      const roofSlope =
        hallRoofType === 'flat'
          ? 'płaski'
          : hallRoofType === 'monopitch'
          ? 'jednospadowy'
          : hallRoofType === 'truss'
          ? 'kratownicowy (Truss)'
          : 'dwuspadowy';

      // Dokładny model próbny do statystyk
      const sample = generate3DIndustrialHall({
        span: hallSpan,
        baySpacing: hallBaySpacing,
        numBays: hallNumBays,
        eaveHeight: hallEaveHeight,
        roofType: hallRoofType,
        ridgeHeight: hallRidgeHeight,
        trussDivisions: hallTrussDivisions,
        columnBaseType: hallColBase,
        eaveJointType: hallEaveJoint,
        includePurlins: hallIncludePurlins,
        purlinsPerRafter: hallPurlinsPerRafter,
        includeRoofBracing: hallRoofBracing,
        includeWallBracing: hallWallBracing,
        includeGableWall: hallGableWall,
        gableColumnsCount: hallGableCols,
        includeDeadSnowLoad: hallIncludeSnowLoad,
        roofLoadValue: hallSnowLoadVal,
        includeWindLoad: hallIncludeWind,
        windLoadValue: hallWindLoadVal,
        includeDynamicMasses: hallDynamicMasses,
        columnSectionId: colSecId || secId,
        rafterSectionId: rafterSecId || secId,
        purlinSectionId: purlinSecId || secId,
        bracingSectionId: bracingSecId || secId,
        materialId: matId,
      });

      const supCount = sample.nodes.filter((n) => n.support !== null).length;

      return {
        title: 'Zaawansowana Hala Przemysłowa 3D',
        description: `Hala stalowa ${hallSpan.toFixed(1)} m × ${totalLen.toFixed(1)} m (pow. ${footprint.toFixed(
          0
        )} m²), dach ${roofSlope}, wys. okapu ${hallEaveHeight.toFixed(1)} m, kalenica ${
          hallRoofType === 'flat' ? hallEaveHeight.toFixed(1) : hallRidgeHeight.toFixed(1)
        } m.`,
        nodesCount: sample.nodes.length,
        elementsCount: sample.elements.length,
        supportsCount: supCount,
        hasLoads: hallIncludeSnowLoad || hallIncludeWind,
      };
    } else if (selectedType === 'portal3d') {
      const nodesCount = (numBaysX + 1) * (numBaysY + 1) * 2;
      const colCount = (numBaysX + 1) * (numBaysY + 1);
      const beamXCount = (numBaysY + 1) * numBaysX;
      const beamYCount = (numBaysX + 1) * numBaysY;
      const totalElems = colCount + beamXCount + beamYCount;
      return {
        title: 'Przestrzenna rama portalowa 3D',
        description: `Wielonawowy szkielet słupowo-ryglowy o wymiarach ${(bayX * numBaysX).toFixed(1)} m × ${(
          bayY * numBaysY
        ).toFixed(1)} m i wysokości ${frameHeight.toFixed(1)} m.`,
        nodesCount,
        elementsCount: totalElems,
        supportsCount: colCount,
        hasLoads: true,
      };
    } else if (selectedType === 'tower3d') {
      const nodesCount = (towerStories + 1) * 4;
      const rings = (towerStories + 1) * 4;
      const legsAndBracing = towerStories * 4 * 3;
      const totalElems = rings + legsAndBracing;
      return {
        title: 'Przestrzenna wieża kratowa 3D',
        description: `Wielosegmentowa wieża kratowa o podstawie ${towerBase.toFixed(
          1
        )} m, wierzchołku ${towerTop.toFixed(1)} m i wysokości ${towerHeight.toFixed(
          1
        )} m ze stężeniami krzyżulcowymi X.`,
        nodesCount,
        elementsCount: totalElems,
        supportsCount: 4,
        hasLoads: true,
      };
    } else {
      const nodesCount = (grillDivX + 1) * (grillDivY + 1);
      const beamXCount = (grillDivY + 1) * grillDivX;
      const beamYCount = (grillDivX + 1) * grillDivY;
      const totalElems = beamXCount + beamYCount;
      return {
        title: 'Ruszt belkowy stropowy 3D',
        description: `Ortogonalna siatka belek stropowych ${grillWidthX.toFixed(1)} m × ${grillWidthY.toFixed(
          1
        )} m z podparciem w 4 narożach i obciążeniem węzłowym.`,
        nodesCount,
        elementsCount: totalElems,
        supportsCount: 4,
        hasLoads: true,
      };
    }
  }, [
    selectedType,
    hallSpan,
    hallBaySpacing,
    hallNumBays,
    hallEaveHeight,
    hallRoofType,
    hallRidgeHeight,
    hallTrussDivisions,
    hallColBase,
    hallEaveJoint,
    hallIncludePurlins,
    hallPurlinsPerRafter,
    hallRoofBracing,
    hallWallBracing,
    hallGableWall,
    hallGableCols,
    hallIncludeSnowLoad,
    hallSnowLoadVal,
    hallIncludeWind,
    hallWindLoadVal,
    hallDynamicMasses,
    colSecId,
    rafterSecId,
    purlinSecId,
    bracingSecId,
    secId,
    matId,
    bayX,
    bayY,
    frameHeight,
    numBaysX,
    numBaysY,
    towerBase,
    towerTop,
    towerHeight,
    towerStories,
    grillWidthX,
    grillWidthY,
    grillDivX,
    grillDivY,
  ]);

  if (!isOpen) return null;

  const handleGenerate = () => {
    const effSecId = secId || defaultSectionId || 1;
    const effMatId = matId || defaultMaterialId || 1;

    let result: { nodes: Node3D[]; elements: Element3D[] };
    if (selectedType === 'hall3d') {
      result = generate3DIndustrialHall({
        span: hallSpan,
        baySpacing: hallBaySpacing,
        numBays: hallNumBays,
        eaveHeight: hallEaveHeight,
        roofType: hallRoofType,
        ridgeHeight: hallRidgeHeight,
        trussDivisions: hallTrussDivisions,
        columnBaseType: hallColBase,
        eaveJointType: hallEaveJoint,
        includePurlins: hallIncludePurlins,
        purlinsPerRafter: hallPurlinsPerRafter,
        includeRoofBracing: hallRoofBracing,
        includeWallBracing: hallWallBracing,
        includeGableWall: hallGableWall,
        gableColumnsCount: hallGableCols,
        includeDeadSnowLoad: hallIncludeSnowLoad,
        roofLoadValue: hallSnowLoadVal,
        includeWindLoad: hallIncludeWind,
        windLoadValue: hallWindLoadVal,
        includeDynamicMasses: hallDynamicMasses,
        columnSectionId: colSecId || effSecId,
        rafterSectionId: rafterSecId || effSecId,
        purlinSectionId: purlinSecId || effSecId,
        bracingSectionId: bracingSecId || effSecId,
        materialId: effMatId,
      });
    } else if (selectedType === 'portal3d') {
      result = generate3DPortalFrame(bayX, bayY, frameHeight, numBaysX, numBaysY, effSecId, effMatId);
    } else if (selectedType === 'tower3d') {
      result = generate3DTrussTower(towerBase, towerTop, towerHeight, towerStories, effSecId, effMatId);
    } else {
      result = generate3DGrillage(grillWidthX, grillWidthY, grillDivX, grillDivY, effSecId, effMatId);
    }
    onApplyTemplate(result.nodes, result.elements);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0f172a99',
        zIndex: 350,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--sidebar-bg)',
          color: 'var(--text)',
          borderRadius: '14px',
          maxWidth: selectedType === 'hall3d' ? '680px' : '560px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px #0008',
          border: '1px solid var(--sidebar-border)',
          transition: 'max-width 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--sidebar-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles style={{ width: '17px', height: '17px', color: 'var(--accent)' }} />
            <h2 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600 }}>
              Kreator modeli
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              borderRadius: '6px',
              transition: 'background 0.12s ease, color 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--surface-2)';
              e.currentTarget.style.color = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--text-dim)';
            }}
          >
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1, fontSize: '12.5px' }}>
          {/* Template Selection Tabs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              marginBottom: '14px',
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedType('hall3d')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 6px',
                borderRadius: '8px',
                border: selectedType === 'hall3d' ? '2px solid var(--accent)' : '1px solid var(--input-border)',
                background: selectedType === 'hall3d' ? 'var(--accent-soft)' : 'var(--input-bg)',
                color: selectedType === 'hall3d' ? 'var(--accent)' : 'var(--text)',
                fontWeight: selectedType === 'hall3d' ? 600 : 'normal',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Warehouse style={{ width: '18px', height: '18px' }} />
              <span style={{ fontSize: '11.5px' }}>Hala 3D</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('portal3d')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 6px',
                borderRadius: '8px',
                border: selectedType === 'portal3d' ? '2px solid var(--accent)' : '1px solid var(--input-border)',
                background: selectedType === 'portal3d' ? 'var(--accent-soft)' : 'var(--input-bg)',
                color: selectedType === 'portal3d' ? 'var(--accent)' : 'var(--text)',
                fontWeight: selectedType === 'portal3d' ? 600 : 'normal',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Layers style={{ width: '18px', height: '18px' }} />
              <span style={{ fontSize: '11.5px' }}>Rama 3D</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('tower3d')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 6px',
                borderRadius: '8px',
                border: selectedType === 'tower3d' ? '2px solid var(--accent)' : '1px solid var(--input-border)',
                background: selectedType === 'tower3d' ? 'var(--accent-soft)' : 'var(--input-bg)',
                color: selectedType === 'tower3d' ? 'var(--accent)' : 'var(--text)',
                fontWeight: selectedType === 'tower3d' ? 600 : 'normal',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Box style={{ width: '18px', height: '18px' }} />
              <span style={{ fontSize: '11.5px' }}>Wieża 3D</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('grillage3d')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 6px',
                borderRadius: '8px',
                border: selectedType === 'grillage3d' ? '2px solid var(--accent)' : '1px solid var(--input-border)',
                background: selectedType === 'grillage3d' ? 'var(--accent-soft)' : 'var(--input-bg)',
                color: selectedType === 'grillage3d' ? 'var(--accent)' : 'var(--text)',
                fontWeight: selectedType === 'grillage3d' ? 600 : 'normal',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Grid3X3 style={{ width: '18px', height: '18px' }} />
              <span style={{ fontSize: '11.5px' }}>Ruszt 3D</span>
            </button>
          </div>

          {/* Form Fields according to template */}
          {selectedType === 'hall3d' ? (
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--surface-border-soft)',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '14px',
              }}
            >
              {/* Header with quick sub-navigation */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--surface-border-soft)',
                  paddingBottom: '10px',
                  marginBottom: '12px',
                }}
              >
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setHallSubTab('geom')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      borderRadius: '5px',
                      border: 'none',
                      cursor: 'pointer',
                      background: hallSubTab === 'geom' ? 'var(--accent)' : 'transparent',
                      color: hallSubTab === 'geom' ? '#fff' : 'var(--text-dim)',
                      fontWeight: hallSubTab === 'geom' ? 600 : 400,
                    }}
                  >
                    Geometria
                  </button>
                  <button
                    type="button"
                    onClick={() => setHallSubTab('structure')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      borderRadius: '5px',
                      border: 'none',
                      cursor: 'pointer',
                      background: hallSubTab === 'structure' ? 'var(--accent)' : 'transparent',
                      color: hallSubTab === 'structure' ? '#fff' : 'var(--text-dim)',
                      fontWeight: hallSubTab === 'structure' ? 600 : 400,
                    }}
                  >
                    Ustrój i stężenia
                  </button>
                  <button
                    type="button"
                    onClick={() => setHallSubTab('loads')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      borderRadius: '5px',
                      border: 'none',
                      cursor: 'pointer',
                      background: hallSubTab === 'loads' ? 'var(--accent)' : 'transparent',
                      color: hallSubTab === 'loads' ? '#fff' : 'var(--text-dim)',
                      fontWeight: hallSubTab === 'loads' ? 600 : 400,
                    }}
                  >
                    Obciążenia
                  </button>
                  <button
                    type="button"
                    onClick={() => setHallSubTab('sections')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      borderRadius: '5px',
                      border: 'none',
                      cursor: 'pointer',
                      background: hallSubTab === 'sections' ? 'var(--accent)' : 'transparent',
                      color: hallSubTab === 'sections' ? '#fff' : 'var(--text-dim)',
                      fontWeight: hallSubTab === 'sections' ? 600 : 400,
                    }}
                  >
                    Przekroje
                  </button>
                </div>
              </div>

              {/* Sub-tab 1: GEOMETRY */}
              {hallSubTab === 'geom' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Roof Type Selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '6px' }}>
                      Typ dachu i geometria przekroju poprzecznego
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setHallRoofType('gable')}
                        style={{
                          padding: '7px 4px',
                          borderRadius: '6px',
                          border: hallRoofType === 'gable' ? '2px solid var(--accent)' : '1px solid var(--input-border)',
                          background: hallRoofType === 'gable' ? 'var(--accent-soft)' : 'var(--input-bg)',
                          color: hallRoofType === 'gable' ? 'var(--accent)' : 'var(--text)',
                          fontWeight: hallRoofType === 'gable' ? 600 : 400,
                          fontSize: '11px',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        Dwuspadowy
                      </button>
                      <button
                        type="button"
                        onClick={() => setHallRoofType('monopitch')}
                        style={{
                          padding: '7px 4px',
                          borderRadius: '6px',
                          border: hallRoofType === 'monopitch' ? '2px solid var(--accent)' : '1px solid var(--input-border)',
                          background: hallRoofType === 'monopitch' ? 'var(--accent-soft)' : 'var(--input-bg)',
                          color: hallRoofType === 'monopitch' ? 'var(--accent)' : 'var(--text)',
                          fontWeight: hallRoofType === 'monopitch' ? 600 : 400,
                          fontSize: '11px',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        Jednospadowy
                      </button>
                      <button
                        type="button"
                        onClick={() => setHallRoofType('flat')}
                        style={{
                          padding: '7px 4px',
                          borderRadius: '6px',
                          border: hallRoofType === 'flat' ? '2px solid var(--accent)' : '1px solid var(--input-border)',
                          background: hallRoofType === 'flat' ? 'var(--accent-soft)' : 'var(--input-bg)',
                          color: hallRoofType === 'flat' ? 'var(--accent)' : 'var(--text)',
                          fontWeight: hallRoofType === 'flat' ? 600 : 400,
                          fontSize: '11px',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        Płaski
                      </button>
                      <button
                        type="button"
                        onClick={() => setHallRoofType('truss')}
                        style={{
                          padding: '7px 4px',
                          borderRadius: '6px',
                          border: hallRoofType === 'truss' ? '2px solid var(--accent)' : '1px solid var(--input-border)',
                          background: hallRoofType === 'truss' ? 'var(--accent-soft)' : 'var(--input-bg)',
                          color: hallRoofType === 'truss' ? 'var(--accent)' : 'var(--text)',
                          fontWeight: hallRoofType === 'truss' ? 600 : 400,
                          fontSize: '11px',
                          cursor: 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        Kratownicowy
                      </button>
                    </div>
                  </div>

                  {/* Main geometry grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                        Rozpiętość L [m]
                      </label>
                      <SmartNumberInput
                        step="1"
                        min={4}
                        max={120}
                        value={hallSpan}
                        onChange={(val) => setHallSpan(val > 0 ? val : 6)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                        Rozstaw ram B [m]
                      </label>
                      <SmartNumberInput
                        step="0.5"
                        min={2}
                        max={30}
                        value={hallBaySpacing}
                        onChange={(val) => setHallBaySpacing(val > 0 ? val : 3)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                        Liczba przęseł N
                      </label>
                      <SmartNumberInput
                        step="1"
                        min={1}
                        max={30}
                        value={hallNumBays}
                        onChange={(val) => setHallNumBays(Math.max(1, Math.round(val)))}
                      />
                    </div>
                  </div>

                  {/* Heights */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                        Wys. okapu H_okap [m]
                      </label>
                      <SmartNumberInput
                        step="0.5"
                        min={2}
                        max={50}
                        value={hallEaveHeight}
                        onChange={(val) => setHallEaveHeight(val > 0 ? val : 3)}
                      />
                    </div>
                    {hallRoofType !== 'flat' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                          Wys. kalenicy H_kalenica [m]
                        </label>
                        <SmartNumberInput
                          step="0.5"
                          min={hallEaveHeight + 0.1}
                          max={70}
                          value={hallRidgeHeight}
                          onChange={(val) => setHallRidgeHeight(Math.max(hallEaveHeight + 0.2, val))}
                        />
                      </div>
                    )}
                    {hallRoofType === 'truss' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                          Liczba paneli kratownicy
                        </label>
                        <SmartNumberInput
                          step="2"
                          min={4}
                          max={20}
                          value={hallTrussDivisions}
                          onChange={(val) => setHallTrussDivisions(Math.max(4, Math.round(val / 2) * 2))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 2: STRUCTURE & BRACING */}
              {hallSubTab === 'structure' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Support types and joints */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                        Podparcie słupów w fundamentach
                      </label>
                      <select
                        value={hallColBase}
                        onChange={(e) => setHallColBase(e.target.value as any)}
                        style={{ width: '100%' }}
                      >
                        <option value="fixed">Utwierdzenie (sztywne Rx, Ry, Rz)</option>
                        <option value="pinned">Przegub (przegub kulisty / nieprzesuwny)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                        Węzeł rygiel-słup (okap)
                      </label>
                      <select
                        value={hallEaveJoint}
                        onChange={(e) => setHallEaveJoint(e.target.value as any)}
                        style={{ width: '100%' }}
                      >
                        <option value="rigid">Sztywne (węzeł momentowy)</option>
                        <option value="pinned">Przegubowe (np. rygiel oparty na słupie)</option>
                      </select>
                    </div>
                  </div>

                  {/* Purlins options */}
                  <div
                    style={{
                      background: 'var(--surface-3)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11.5px' }}>
                      <input
                        type="checkbox"
                        checked={hallIncludePurlins}
                        onChange={(e) => setHallIncludePurlins(e.target.checked)}
                      />
                      <span>Generuj płatwie dachowe wzdłużne</span>
                    </label>
                    {hallIncludePurlins && hallRoofType !== 'truss' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Linii płatwi na połać:</span>
                        <div style={{ width: '60px' }}>
                          <SmartNumberInput
                            step="1"
                            min={1}
                            max={10}
                            value={hallPurlinsPerRafter}
                            onChange={(val) => setHallPurlinsPerRafter(Math.max(1, Math.round(val)))}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bracing & Gable Posts */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div
                      style={{
                        background: 'var(--surface-3)',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11.5px' }}>
                        <input
                          type="checkbox"
                          checked={hallRoofBracing}
                          onChange={(e) => setHallRoofBracing(e.target.checked)}
                        />
                        <span>Stężenia połaciowe X (wiatrowe)</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11.5px' }}>
                        <input
                          type="checkbox"
                          checked={hallWallBracing}
                          onChange={(e) => setHallWallBracing(e.target.checked)}
                        />
                        <span>Stężenia ścienne pionowe X</span>
                      </label>
                    </div>

                    <div
                      style={{
                        background: 'var(--surface-3)',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11.5px' }}>
                        <input
                          type="checkbox"
                          checked={hallGableWall}
                          onChange={(e) => setHallGableWall(e.target.checked)}
                        />
                        <span>Słupy szczytowe / wiatrowe</span>
                      </label>
                      {hallGableWall && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Liczba słupów na ścianę:</span>
                          <div style={{ width: '60px' }}>
                            <SmartNumberInput
                              step="1"
                              min={1}
                              max={6}
                              value={hallGableCols}
                              onChange={(val) => setHallGableCols(Math.max(1, Math.round(val)))}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: LOADS & MASSES */}
              {hallSubTab === 'loads' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Roof Dead + Snow Load */}
                  <div
                    style={{
                      background: 'var(--surface-3)',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11.5px' }}>
                      <input
                        type="checkbox"
                        checked={hallIncludeSnowLoad}
                        onChange={(e) => setHallIncludeSnowLoad(e.target.checked)}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>Obciążenie dachu (śnieg + pokrycie qz)</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Ciągłe obciążenie pionowe na rygle i płatwie</div>
                      </div>
                    </label>
                    {hallIncludeSnowLoad && (
                      <div style={{ width: '90px' }}>
                        <SmartNumberInput
                          step="1"
                          min={-100}
                          max={0}
                          value={hallSnowLoadVal}
                          onChange={(val) => setHallSnowLoadVal(val)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Wind Load */}
                  <div
                    style={{
                      background: 'var(--surface-3)',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11.5px' }}>
                      <input
                        type="checkbox"
                        checked={hallIncludeWind}
                        onChange={(e) => setHallIncludeWind(e.target.checked)}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>Obciążenie wiatrem poprzecznym Fx</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Parcie wiatru na słupy i węzły okapowe w osi X [kN]</div>
                      </div>
                    </label>
                    {hallIncludeWind && (
                      <div style={{ width: '90px' }}>
                        <SmartNumberInput
                          step="1"
                          min={0}
                          max={200}
                          value={hallWindLoadVal}
                          onChange={(val) => setHallWindLoadVal(val)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Dynamic Masses */}
                  <div
                    style={{
                      background: 'var(--surface-3)',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11.5px' }}>
                      <input
                        type="checkbox"
                        checked={hallDynamicMasses}
                        onChange={(e) => setHallDynamicMasses(e.target.checked)}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>Masy węzłowe dla dynamiki i drgań własnych</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Generuje macierz mas m_x, m_y, m_z do analiz modalnych</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* Sub-tab 4: SECTIONS */}
              {hallSubTab === 'sections' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Słupy główne i szczytowe
                    </label>
                    <select
                      value={colSecId}
                      onChange={(e) => setColSecId(parseInt(e.target.value) || 1)}
                      style={{ width: '100%' }}
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          #{s.id} {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Rygle dachowe / Pasy kratownicy
                    </label>
                    <select
                      value={rafterSecId}
                      onChange={(e) => setRafterSecId(parseInt(e.target.value) || 1)}
                      style={{ width: '100%' }}
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          #{s.id} {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Płatwie / Podciągi wzdłużne
                    </label>
                    <select
                      value={purlinSecId}
                      onChange={(e) => setPurlinSecId(parseInt(e.target.value) || 1)}
                      style={{ width: '100%' }}
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          #{s.id} {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Stężenia wiatrowe / Słupki kratowe
                    </label>
                    <select
                      value={bracingSecId}
                      onChange={(e) => setBracingSecId(parseInt(e.target.value) || 1)}
                      style={{ width: '100%' }}
                    >
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          #{s.id} {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--surface-border-soft)',
                borderRadius: '9px',
                padding: '12px 14px',
                marginBottom: '14px',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '10px', color: 'var(--text)', fontSize: '12.5px' }}>
                {previewSummary.title}
              </div>

              {selectedType === 'portal3d' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Rozpiętość nawy X [m]
                    </label>
                    <SmartNumberInput
                      step="0.5"
                      min={1}
                      max={100}
                      value={bayX}
                      onChange={(val) => setBayX(val > 0 ? val : 1)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Rozstaw ram Y [m]
                    </label>
                    <SmartNumberInput
                      step="0.5"
                      min={1}
                      max={100}
                      value={bayY}
                      onChange={(val) => setBayY(val > 0 ? val : 1)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Liczba naw X
                    </label>
                    <SmartNumberInput
                      step="1"
                      min={1}
                      max={20}
                      value={numBaysX}
                      onChange={(val) => setNumBaysX(Math.max(1, Math.round(val)))}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Liczba przęseł Y
                    </label>
                    <SmartNumberInput
                      step="1"
                      min={1}
                      max={20}
                      value={numBaysY}
                      onChange={(val) => setNumBaysY(Math.max(1, Math.round(val)))}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Wysokość słupów H [m]
                    </label>
                    <SmartNumberInput
                      step="0.5"
                      min={1}
                      max={100}
                      value={frameHeight}
                      onChange={(val) => setFrameHeight(val > 0 ? val : 1)}
                    />
                  </div>
                </div>
              )}

              {selectedType === 'tower3d' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Szerokość podstawy [m]
                    </label>
                    <SmartNumberInput
                      step="0.5"
                      min={0.5}
                      max={50}
                      value={towerBase}
                      onChange={(val) => setTowerBase(val > 0 ? val : 1)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Szerokość głowicy [m]
                    </label>
                    <SmartNumberInput
                      step="0.5"
                      min={0.5}
                      max={50}
                      value={towerTop}
                      onChange={(val) => setTowerTop(val > 0 ? val : 1)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Wysokość całkowita H [m]
                    </label>
                    <SmartNumberInput
                      step="1"
                      min={1}
                      max={200}
                      value={towerHeight}
                      onChange={(val) => setTowerHeight(val > 0 ? val : 1)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Liczba segmentów
                    </label>
                    <SmartNumberInput
                      step="1"
                      min={1}
                      max={25}
                      value={towerStories}
                      onChange={(val) => setTowerStories(Math.max(1, Math.round(val)))}
                    />
                  </div>
                </div>
              )}

              {selectedType === 'grillage3d' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Szerokość X [m]
                    </label>
                    <SmartNumberInput
                      step="1"
                      min={1}
                      max={100}
                      value={grillWidthX}
                      onChange={(val) => setGrillWidthX(val > 0 ? val : 1)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Długość Y [m]
                    </label>
                    <SmartNumberInput
                      step="1"
                      min={1}
                      max={100}
                      value={grillWidthY}
                      onChange={(val) => setGrillWidthY(val > 0 ? val : 1)}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Liczba podziałów X
                    </label>
                    <SmartNumberInput
                      step="1"
                      min={1}
                      max={20}
                      value={grillDivX}
                      onChange={(val) => setGrillDivX(Math.max(1, Math.round(val)))}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                      Liczba podziałów Y
                    </label>
                    <SmartNumberInput
                      step="1"
                      min={1}
                      max={20}
                      value={grillDivY}
                      onChange={(val) => setGrillDivY(Math.max(1, Math.round(val)))}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section and Material selectors for generic templates or hall material */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: selectedType === 'hall3d' ? '1fr' : '1fr 1fr',
              gap: '10px',
              marginBottom: '14px',
            }}
          >
            {selectedType !== 'hall3d' && (
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                  Domyślny przekrój
                </label>
                <select
                  value={secId}
                  onChange={(e) => setSecId(parseInt(e.target.value) || 1)}
                  style={{ width: '100%' }}
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.id} {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                Główny materiał konstrukcyjny
              </label>
              <select
                value={matId}
                onChange={(e) => setMatId(parseInt(e.target.value) || 1)}
                style={{ width: '100%' }}
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.id} {m.name} (E={m.E} GPa)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary Card */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'var(--surface-2)',
              border: '1px solid var(--surface-border-soft)',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
              <CheckCircle2 style={{ width: '14px', height: '14px', color: 'var(--accent)' }} />
              <span>Podsumowanie generowanego modelu:</span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', lineHeight: '1.4' }}>
              {previewSummary.description}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '11.5px', marginTop: '2px' }}>
              <span>Węzły: <strong>{previewSummary.nodesCount}</strong></span>
              <span>Pręty: <strong>{previewSummary.elementsCount}</strong></span>
              <span>Podpory: <strong>{previewSummary.supportsCount}</strong></span>
              <span>Obciążenia: <strong>{previewSummary.hasLoads ? 'Tak' : 'Brak'}</strong></span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '12px 18px',
            borderTop: '1px solid var(--sidebar-border)',
          }}
        >
          <button
            type="button"
            className="mini"
            onClick={onClose}
          >
            Anuluj
          </button>
          <button
            type="button"
            className="mini on"
            onClick={handleGenerate}
          >
            Wstaw szablon
          </button>
        </div>
      </div>
    </div>
  );
};
