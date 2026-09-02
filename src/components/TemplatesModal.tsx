import React, { useState, useMemo } from 'react';
import {
  generate3DPortalFrame,
  generate3DTrussTower,
  generate3DGrillage,
  generate2DPortalFrame,
} from '../fem/templates';
import { Node3D, Element3D, Section, Material } from '../fem/types';
import { Box, Layers, Grid3X3, Square, X, Sparkles, CheckCircle2 } from 'lucide-react';
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
  const [selectedType, setSelectedType] = useState<'portal3d' | 'tower3d' | 'grillage3d' | 'portal2d'>('portal3d');

  // Wybrany przekrój i materiał dla generatora
  const [secId, setSecId] = useState<number>(defaultSectionId);
  const [matId, setMatId] = useState<number>(defaultMaterialId);

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

  // Parametry ramy 2D
  const [span2D, setSpan2D] = useState(6.0);
  const [height2D, setHeight2D] = useState(4.0);

  // Podsumowanie szacowanych elementów przed wygenerowaniem
  const previewSummary = useMemo(() => {
    if (selectedType === 'portal3d') {
      const nodesCount = (numBaysX + 1) * (numBaysY + 1) * 2;
      const colCount = (numBaysX + 1) * (numBaysY + 1);
      const beamXCount = (numBaysY + 1) * numBaysX;
      const beamYCount = (numBaysX + 1) * numBaysY;
      const totalElems = colCount + beamXCount + beamYCount;
      return {
        title: 'Przestrzenna rama portalowa 3D',
        description: `Wielonawowy szkielet słupowo-ryglowy o wymiarach ${(bayX * numBaysX).toFixed(1)} m × ${(bayY * numBaysY).toFixed(1)} m i wysokości ${frameHeight.toFixed(1)} m.`,
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
        description: `Wielosegmentowa wieża kratowa o podstawie ${towerBase.toFixed(1)} m, wierzchołku ${towerTop.toFixed(1)} m i wysokości ${towerHeight.toFixed(1)} m ze stężeniami krzyżulcowymi X.`,
        nodesCount,
        elementsCount: totalElems,
        supportsCount: 4,
        hasLoads: true,
      };
    } else if (selectedType === 'grillage3d') {
      const nodesCount = (grillDivX + 1) * (grillDivY + 1);
      const beamXCount = (grillDivY + 1) * grillDivX;
      const beamYCount = (grillDivX + 1) * grillDivY;
      const totalElems = beamXCount + beamYCount;
      return {
        title: 'Ruszt belkowy stropowy 3D',
        description: `Ortogonalna siatka belek stropowych ${grillWidthX.toFixed(1)} m × ${grillWidthY.toFixed(1)} m z podparciem w 4 narożach i obciążeniem węzłowym.`,
        nodesCount,
        elementsCount: totalElems,
        supportsCount: 4,
        hasLoads: true,
      };
    } else {
      return {
        title: 'Płaska rama portalowa 2D',
        description: `Jednonawowa rama w płaszczyźnie pionowej XZ o rozpiętości ${span2D.toFixed(1)} m i wysokości ${height2D.toFixed(1)} m z obciążeniem poziomym i pionowym.`,
        nodesCount: 4,
        elementsCount: 3,
        supportsCount: 2,
        hasLoads: true,
      };
    }
  }, [selectedType, bayX, bayY, frameHeight, numBaysX, numBaysY, towerBase, towerTop, towerHeight, towerStories, grillWidthX, grillWidthY, grillDivX, grillDivY, span2D, height2D]);

  if (!isOpen) return null;

  const handleGenerate = () => {
    const effSecId = secId || defaultSectionId || 1;
    const effMatId = matId || defaultMaterialId || 1;

    let result: { nodes: Node3D[]; elements: Element3D[] };
    if (selectedType === 'portal3d') {
      result = generate3DPortalFrame(bayX, bayY, frameHeight, numBaysX, numBaysY, effSecId, effMatId);
    } else if (selectedType === 'tower3d') {
      result = generate3DTrussTower(towerBase, towerTop, towerHeight, towerStories, effSecId, effMatId);
    } else if (selectedType === 'grillage3d') {
      result = generate3DGrillage(grillWidthX, grillWidthY, grillDivX, grillDivY, effSecId, effMatId);
    } else {
      result = generate2DPortalFrame(span2D, height2D, effSecId, effMatId);
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
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px #0008',
          border: '1px solid var(--sidebar-border)',
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
              Kreator modeli i szablony konstrukcji
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

            <button
              type="button"
              onClick={() => setSelectedType('portal2d')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '9px 6px',
                borderRadius: '8px',
                border: selectedType === 'portal2d' ? '2px solid var(--accent)' : '1px solid var(--input-border)',
                background: selectedType === 'portal2d' ? 'var(--accent-soft)' : 'var(--input-bg)',
                color: selectedType === 'portal2d' ? 'var(--accent)' : 'var(--text)',
                fontWeight: selectedType === 'portal2d' ? 600 : 'normal',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Square style={{ width: '18px', height: '18px' }} />
              <span style={{ fontSize: '11.5px' }}>Rama 2D</span>
            </button>
          </div>

          {/* Form Fields according to template */}
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

            {selectedType === 'portal2d' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                    Rozpiętość L [m]
                  </label>
                  <SmartNumberInput
                    step="0.5"
                    min={1}
                    max={50}
                    value={span2D}
                    onChange={(val) => setSpan2D(val > 0 ? val : 1)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                    Wysokość H [m]
                  </label>
                  <SmartNumberInput
                    step="0.5"
                    min={1}
                    max={50}
                    value={height2D}
                    onChange={(val) => setHeight2D(val > 0 ? val : 1)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section and Material selectors */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              marginBottom: '14px',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '4px' }}>
                Domyślny przekrój
              </label>
              <select
                value={secId}
                onChange={(e) => setSecId(parseInt(e.target.value) || 1)}
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
                Domyślny materiał
              </label>
              <select
                value={matId}
                onChange={(e) => setMatId(parseInt(e.target.value) || 1)}
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
            <div style={{ display: 'flex', gap: '14px', fontSize: '11.5px', marginTop: '2px' }}>
              <span>Węzły: <strong>{previewSummary.nodesCount}</strong></span>
              <span>Pręty: <strong>{previewSummary.elementsCount}</strong></span>
              <span>Podpory: <strong>{previewSummary.supportsCount}</strong></span>
              <span>Obciążenia: <strong>Tak</strong></span>
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
