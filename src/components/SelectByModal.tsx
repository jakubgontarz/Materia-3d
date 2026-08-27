import React, { useState, useMemo, useEffect } from 'react';
import { Node3D, Element3D, Section, Material } from '../fem/types';
import { X, Filter, Ruler, Layers, Box, Check, CheckSquare, Square } from 'lucide-react';

interface SelectByModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node3D[];
  elements: Element3D[];
  sections: Section[];
  materials: Material[];
  onSelectElements: (elemIds: number[], criterionDesc: string) => void;
}

type CriterionTab = 'length' | 'section' | 'material';

export const SelectByModal: React.FC<SelectByModalProps> = ({
  isOpen,
  onClose,
  nodes,
  elements,
  sections,
  materials,
  onSelectElements,
}) => {
  const [tab, setTab] = useState<CriterionTab>('length');

  // Length criterion state
  const [minLen, setMinLen] = useState<string>('');
  const [maxLen, setMaxLen] = useState<string>('');
  const [lengthMode, setLengthMode] = useState<'range' | 'exact' | 'greater' | 'less'>('range');
  const [exactLen, setExactLen] = useState<string>('');
  const [tolerance, setTolerance] = useState<string>('0.01'); // 1 cm default tolerance

  // Section criterion state (selected section IDs)
  const [selectedSectionIds, setSelectedSectionIds] = useState<number[]>([]);

  // Material criterion state (selected material IDs)
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);

  // Node map for fast lookup
  const nodeMap = useMemo(() => {
    const map = new Map<number, Node3D>();
    for (const n of nodes) {
      map.set(n.id, n);
    }
    return map;
  }, [nodes]);

  // Precomputed elements with geometric length, section, material
  const memberData = useMemo(() => {
    return elements.map((el) => {
      const n1 = nodeMap.get(el.n1);
      const n2 = nodeMap.get(el.n2);
      const length = n1 && n2 ? Math.hypot(n2.x - n1.x, n2.y - n1.y, n2.z - n1.z) : 0;
      const sec = sections.find((s) => s.id === el.sectionId);
      const mat = materials.find((m) => m.id === el.materialId);
      return {
        element: el,
        length,
        section: sec,
        material: mat,
      };
    });
  }, [elements, nodeMap, sections, materials]);

  // Model statistics for lengths
  const lengthStats = useMemo(() => {
    if (memberData.length === 0) return { min: 0, max: 0, avg: 0 };
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    for (const m of memberData) {
      if (m.length < min) min = m.length;
      if (m.length > max) max = m.length;
      sum += m.length;
    }
    return {
      min: min === Infinity ? 0 : min,
      max: max === -Infinity ? 0 : max,
      avg: sum / memberData.length,
    };
  }, [memberData]);

  // Sections with element count in current model
  const usedSections = useMemo(() => {
    const counts = new Map<number, number>();
    for (const m of memberData) {
      const sId = m.element.sectionId;
      counts.set(sId, (counts.get(sId) || 0) + 1);
    }
    return sections.map((s) => ({
      ...s,
      count: counts.get(s.id) || 0,
    })).sort((a, b) => b.count - a.count);
  }, [memberData, sections]);

  // Materials with element count in current model
  const usedMaterials = useMemo(() => {
    const counts = new Map<number, number>();
    for (const m of memberData) {
      const mId = m.element.materialId;
      counts.set(mId, (counts.get(mId) || 0) + 1);
    }
    return materials.map((m) => ({
      ...m,
      count: counts.get(m.id) || 0,
    })).sort((a, b) => b.count - a.count);
  }, [memberData, materials]);

  // Initialize or reset defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      if (memberData.length > 0) {
        setMinLen(lengthStats.min.toFixed(2));
        setMaxLen(lengthStats.max.toFixed(2));
        setExactLen(lengthStats.avg.toFixed(2));
      } else {
        setMinLen('');
        setMaxLen('');
        setExactLen('');
      }

      // Default section to first used section or first section
      const firstUsedSec = usedSections.find((s) => s.count > 0) || usedSections[0];
      if (firstUsedSec) {
        setSelectedSectionIds([firstUsedSec.id]);
      } else {
        setSelectedSectionIds([]);
      }

      // Default material to first used material or first material
      const firstUsedMat = usedMaterials.find((m) => m.count > 0) || usedMaterials[0];
      if (firstUsedMat) {
        setSelectedMaterialIds([firstUsedMat.id]);
      } else {
        setSelectedMaterialIds([]);
      }
    }
  }, [isOpen, lengthStats, usedSections, usedMaterials, memberData.length]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Calculate matching element IDs based on active tab and filters
  const matchingElementIds = useMemo<number[]>(() => {
    if (memberData.length === 0) return [];

    if (tab === 'length') {
      const min = parseFloat(minLen);
      const max = parseFloat(maxLen);
      const exact = parseFloat(exactLen);
      const tol = Math.max(0, parseFloat(tolerance) || 0.005);

      return memberData
        .filter((m) => {
          const L = m.length;
          if (lengthMode === 'range') {
            const hasMin = !isNaN(min);
            const hasMax = !isNaN(max);
            if (hasMin && hasMax) return L >= min - 1e-4 && L <= max + 1e-4;
            if (hasMin) return L >= min - 1e-4;
            if (hasMax) return L <= max + 1e-4;
            return true;
          } else if (lengthMode === 'exact') {
            if (isNaN(exact)) return true;
            return Math.abs(L - exact) <= tol;
          } else if (lengthMode === 'greater') {
            if (isNaN(min)) return true;
            return L >= min - 1e-4;
          } else if (lengthMode === 'less') {
            if (isNaN(max)) return true;
            return L <= max + 1e-4;
          }
          return true;
        })
        .map((m) => m.element.id);
    }

    if (tab === 'section') {
      if (selectedSectionIds.length === 0) return [];
      const secSet = new Set(selectedSectionIds);
      return memberData
        .filter((m) => secSet.has(m.element.sectionId))
        .map((m) => m.element.id);
    }

    if (tab === 'material') {
      if (selectedMaterialIds.length === 0) return [];
      const matSet = new Set(selectedMaterialIds);
      return memberData
        .filter((m) => matSet.has(m.element.materialId))
        .map((m) => m.element.id);
    }

    return [];
  }, [tab, memberData, minLen, maxLen, lengthMode, exactLen, tolerance, selectedSectionIds, selectedMaterialIds]);

  if (!isOpen) return null;

  const handleApply = () => {
    let desc = '';
    if (tab === 'length') {
      if (lengthMode === 'range') {
        desc = `długości (${minLen || '0'} m - ${maxLen || '∞'} m)`;
      } else if (lengthMode === 'exact') {
        desc = `długości (${exactLen} m ± ${tolerance} m)`;
      } else if (lengthMode === 'greater') {
        desc = `długości (>= ${minLen} m)`;
      } else {
        desc = `długości (<= ${maxLen} m)`;
      }
    } else if (tab === 'section') {
      const names = usedSections
        .filter((s) => selectedSectionIds.includes(s.id))
        .map((s) => s.name)
        .join(', ');
      desc = `profilu (${names || 'wybrane'})`;
    } else if (tab === 'material') {
      const names = usedMaterials
        .filter((m) => selectedMaterialIds.includes(m.id))
        .map((m) => m.name)
        .join(', ');
      desc = `materiału (${names || 'wybrane'})`;
    }

    onSelectElements(matchingElementIds, desc);
    onClose();
  };

  const toggleSectionId = (id: number) => {
    setSelectedSectionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleMaterialId = (id: number) => {
    setSelectedMaterialIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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
        padding: '20px',
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
          maxWidth: '520px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px #0008',
          border: '1px solid var(--sidebar-border)',
          overflow: 'hidden',
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
            background: 'var(--sidebar-bg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Filter size={17} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, letterSpacing: '-0.01em' }}>
                Zaznacz pręty według kryterium
              </h2>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-dim)' }}>
                Filtruj i zaznacz tylko pręty spełniające wybrany warunek
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
            }}
            title="Zamknij (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            padding: '8px 16px 0 16px',
            gap: '6px',
            borderBottom: '1px solid var(--sidebar-border)',
            background: 'var(--surface-2)',
          }}
        >
          <button
            onClick={() => setTab('length')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: tab === 'length' ? 700 : 500,
              color: tab === 'length' ? 'var(--accent)' : 'var(--text-dim)',
              borderBottom: tab === 'length' ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'all 0.15s',
            }}
          >
            <Ruler size={14} />
            Długość
          </button>

          <button
            onClick={() => setTab('section')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: tab === 'section' ? 700 : 500,
              color: tab === 'section' ? 'var(--accent)' : 'var(--text-dim)',
              borderBottom: tab === 'section' ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'all 0.15s',
            }}
          >
            <Box size={14} />
            Profil / Przekrój
          </button>

          <button
            onClick={() => setTab('material')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '12.5px',
              fontWeight: tab === 'material' ? 700 : 500,
              color: tab === 'material' ? 'var(--accent)' : 'var(--text-dim)',
              borderBottom: tab === 'material' ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              marginBottom: '-1px',
              transition: 'all 0.15s',
            }}
          >
            <Layers size={14} />
            Materiał
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '16px 18px', overflowY: 'auto', flex: '1 1 auto' }}>
          {/* TAB 1: DŁUGOŚĆ */}
          {tab === 'length' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Statystyki modelu */}
              <div
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontSize: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Pręty w modelu: </span>
                  <strong>{memberData.length}</strong>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontFamily: 'var(--mono)', fontSize: '11.5px' }}>
                  <span>Min: <strong>{lengthStats.min.toFixed(2)} m</strong></span>
                  <span>Średnia: <strong>{lengthStats.avg.toFixed(2)} m</strong></span>
                  <span>Max: <strong>{lengthStats.max.toFixed(2)} m</strong></span>
                </div>
              </div>

              {/* Tryb filtrowania długości */}
              <div className="btnrow">
                <button
                  type="button"
                  className={`mini ${lengthMode === 'range' ? 'on' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setLengthMode('range')}
                >
                  Przedział [Min - Max]
                </button>
                <button
                  type="button"
                  className={`mini ${lengthMode === 'exact' ? 'on' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setLengthMode('exact')}
                >
                  Dokładna wartość
                </button>
                <button
                  type="button"
                  className={`mini ${lengthMode === 'greater' ? 'on' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setLengthMode('greater')}
                >
                  Dłuższe niż &ge;
                </button>
                <button
                  type="button"
                  className={`mini ${lengthMode === 'less' ? 'on' : ''}`}
                  style={{ flex: 1 }}
                  onClick={() => setLengthMode('less')}
                >
                  Krótsze niż &le;
                </button>
              </div>

              {/* Formularz długości */}
              {lengthMode === 'range' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '4px' }}>
                      Długość minimalna (L_min)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={minLen}
                        onChange={(e) => setMinLen(e.target.value)}
                        placeholder="np. 2.0"
                        className="tb-input"
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', minWidth: '14px' }}>m</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '4px' }}>
                      Długość maksymalna (L_max)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={maxLen}
                        onChange={(e) => setMaxLen(e.target.value)}
                        placeholder="np. 6.0"
                        className="tb-input"
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', minWidth: '14px' }}>m</span>
                    </div>
                  </div>
                </div>
              )}

              {lengthMode === 'exact' && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '4px' }}>
                      Szukana długość (L)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={exactLen}
                        onChange={(e) => setExactLen(e.target.value)}
                        placeholder="np. 4.0"
                        className="tb-input"
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', minWidth: '14px' }}>m</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '4px' }}>
                      Tolerancja &plusmn;
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={tolerance}
                        onChange={(e) => setTolerance(e.target.value)}
                        placeholder="np. 0.01"
                        className="tb-input"
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', minWidth: '14px' }}>m</span>
                    </div>
                  </div>
                </div>
              )}

              {lengthMode === 'greater' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '4px' }}>
                    Długość większa lub równa niż (&ge;)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={minLen}
                      onChange={(e) => setMinLen(e.target.value)}
                      placeholder="np. 4.0"
                      className="tb-input"
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', minWidth: '14px' }}>m</span>
                  </div>
                </div>
              )}

              {lengthMode === 'less' && (
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '4px' }}>
                    Długość mniejsza lub równa niż (&le;)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={maxLen}
                      onChange={(e) => setMaxLen(e.target.value)}
                      placeholder="np. 3.0"
                      className="tb-input"
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', minWidth: '14px' }}>m</span>
                  </div>
                </div>
              )}

              {/* Szybkie przyciski zakresu */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setMinLen(lengthStats.min.toFixed(2));
                    setMaxLen(lengthStats.max.toFixed(2));
                  }}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    background: 'var(--surface)',
                    border: '1px solid var(--input-border)',
                    borderRadius: '5px',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  Wstaw pełny zakres modelu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMinLen('0');
                    setMaxLen(lengthStats.avg.toFixed(2));
                  }}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    background: 'var(--surface)',
                    border: '1px solid var(--input-border)',
                    borderRadius: '5px',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  Poniżej średniej (&le; {lengthStats.avg.toFixed(2)} m)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMinLen(lengthStats.avg.toFixed(2));
                    setMaxLen((lengthStats.max + 1).toFixed(2));
                  }}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    background: 'var(--surface)',
                    border: '1px solid var(--input-border)',
                    borderRadius: '5px',
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  Powyżej średniej (&ge; {lengthStats.avg.toFixed(2)} m)
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PROFIL / PRZEKRÓJ */}
          {tab === 'section' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                  Wybierz profile do zaznaczenia:
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedSectionIds(usedSections.filter((s) => s.count > 0).map((s) => s.id))}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Wszystkie użyte
                  </button>
                  <span style={{ color: 'var(--text-dim)' }}>|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSectionIds([])}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                    }}
                  >
                    Odznacz
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                {usedSections.map((sec) => {
                  const isChecked = selectedSectionIds.includes(sec.id);
                  const isUsed = sec.count > 0;

                  return (
                    <div
                      key={sec.id}
                      onClick={() => toggleSectionId(sec.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: isChecked ? 'var(--accent)' : 'var(--surface-border)',
                        background: isChecked ? 'var(--accent-soft)' : 'var(--surface)',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isChecked ? (
                          <CheckSquare size={16} color="var(--accent)" />
                        ) : (
                          <Square size={16} color="var(--text-dim)" />
                        )}
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: isChecked ? 'var(--accent)' : 'var(--text)' }}>
                            {sec.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                            A = {sec.A} cm&sup2;, Iy = {sec.Iy} cm&sup4;, Iz = {sec.Iz} cm&sup4;
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: isUsed ? (isChecked ? 'var(--accent)' : 'var(--panel-gutter)') : 'transparent',
                          color: isUsed ? (isChecked ? '#fff' : 'var(--text)') : 'var(--text-dim)',
                        }}
                      >
                        {sec.count} {sec.count === 1 ? 'pręt' : sec.count > 1 && sec.count < 5 ? 'pręty' : 'prętów'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: MATERIAŁ */}
          {tab === 'material' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                  Wybierz materiały do zaznaczenia:
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedMaterialIds(usedMaterials.filter((m) => m.count > 0).map((m) => m.id))}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Wszystkie użyte
                  </button>
                  <span style={{ color: 'var(--text-dim)' }}>|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedMaterialIds([])}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                    }}
                  >
                    Odznacz
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                {usedMaterials.map((mat) => {
                  const isChecked = selectedMaterialIds.includes(mat.id);
                  const isUsed = mat.count > 0;

                  return (
                    <div
                      key={mat.id}
                      onClick={() => toggleMaterialId(mat.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid',
                        borderColor: isChecked ? 'var(--accent)' : 'var(--surface-border)',
                        background: isChecked ? 'var(--accent-soft)' : 'var(--surface)',
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isChecked ? (
                          <CheckSquare size={16} color="var(--accent)" />
                        ) : (
                          <Square size={16} color="var(--text-dim)" />
                        )}
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: isChecked ? 'var(--accent)' : 'var(--text)' }}>
                            {mat.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                            E = {mat.E} GPa, &nu; = {mat.nu}, &rho; = {mat.density} kg/m&sup3;
                          </div>
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: isUsed ? (isChecked ? 'var(--accent)' : 'var(--panel-gutter)') : 'transparent',
                          color: isUsed ? (isChecked ? '#fff' : 'var(--text)') : 'var(--text-dim)',
                        }}
                      >
                        {mat.count} {mat.count === 1 ? 'pręt' : mat.count > 1 && mat.count < 5 ? 'pręty' : 'prętów'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer / Summary and Action */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--sidebar-border)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ fontSize: '12px' }}>
            <span style={{ color: 'var(--text-dim)' }}>Dopasowano: </span>
            <strong
              style={{
                color: matchingElementIds.length > 0 ? 'var(--ok-fg, #16a34a)' : 'var(--danger)',
                fontWeight: 700,
              }}
            >
              {matchingElementIds.length} z {memberData.length} prętów
            </strong>
            {matchingElementIds.length > 0 && memberData.length > 0 && (
              <span style={{ color: 'var(--text-dim)', marginLeft: '4px' }}>
                ({((matchingElementIds.length / memberData.length) * 100).toFixed(0)}%)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                fontSize: '12.5px',
                fontWeight: 500,
                background: 'var(--surface)',
                border: '1px solid var(--input-border)',
                borderRadius: '6px',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              Anuluj
            </button>
            <button
              type="button"
              disabled={matchingElementIds.length === 0}
              onClick={handleApply}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontSize: '12.5px',
                fontWeight: 600,
                background: matchingElementIds.length === 0 ? 'var(--input-border)' : 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: matchingElementIds.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: matchingElementIds.length > 0 ? '0 2px 6px rgba(37,99,235,0.3)' : 'none',
              }}
            >
              <Check size={15} />
              Zaznacz pręty ({matchingElementIds.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
