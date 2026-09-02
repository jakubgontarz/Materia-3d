import React, { useState, useMemo } from 'react';
import {
  LoadCase3D,
  LoadNature,
  EurocodeCategory,
  getDefaultPsiAndGammas,
  getNatureLabel,
  getNatureBadgeColor,
  generateEurocodeCombinations,
  LoadCombination3D,
} from '../fem/loadcases';
import { SmartNumberInput } from './SmartNumberInput';

interface LoadCasesPanelProps {
  loadCases: LoadCase3D[];
  activeLoadCaseId: number;
  onSelectLoadCase: (id: number) => void;
  onAddLoadCase: (nature: LoadNature, category?: EurocodeCategory, name?: string) => void;
  onUpdateLoadCase: (updated: LoadCase3D) => void;
  onDeleteLoadCase: (id: number) => void;
  autoCombinations: boolean;
  setAutoCombinations: (v: boolean) => void;
  customCombinations?: LoadCombination3D[];
  onInvalidateResults: () => void;
}

export const LoadCasesPanel: React.FC<LoadCasesPanelProps> = ({
  loadCases,
  activeLoadCaseId,
  onSelectLoadCase,
  onAddLoadCase,
  onUpdateLoadCase,
  onDeleteLoadCase,
  autoCombinations,
  setAutoCombinations,
  customCombinations = [],
  onInvalidateResults,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isEditingCase, setIsEditingCase] = useState(false);
  const [showCombinationsModal, setShowCombinationsModal] = useState(false);
  const [showEurocodeParams, setShowEurocodeParams] = useState(false);

  const activeCase = useMemo(() => {
    return loadCases.find((c) => c.id === activeLoadCaseId) || loadCases[0] || null;
  }, [loadCases, activeLoadCaseId]);

  const activeIndex = useMemo(() => {
    return loadCases.findIndex((c) => c.id === activeLoadCaseId);
  }, [loadCases, activeLoadCaseId]);

  const generatedCombinations = useMemo(() => {
    if (!autoCombinations) return [];
    return generateEurocodeCombinations(loadCases);
  }, [autoCombinations, loadCases]);

  const sgnCount = generatedCombinations.filter((c) => c.type === 'SGN').length;
  const sguCount = generatedCombinations.length - sgnCount;

  // Counts of loads in active case
  const loadStats = useMemo(() => {
    if (!activeCase) return { forces: 0, moments: 0, elemLoads: 0, thermals: 0, pressures: 0 };
    const forces = Object.keys(activeCase.nodeForces || {}).length;
    const moments = Object.keys(activeCase.nodeMoments || {}).length;
    const elemLoads = Object.keys(activeCase.elementLoads || {}).length;
    const thermals = Object.keys(activeCase.elementThermals || {}).length;
    const pressures = Object.keys(activeCase.panelPressures || {}).length;
    return { forces, moments, elemLoads, thermals, pressures };
  }, [activeCase]);

  const totalLoadsCount =
    loadStats.forces + loadStats.moments + loadStats.elemLoads + loadStats.thermals + loadStats.pressures;

  const getAutoCaseName = (nature: LoadNature, currentCaseId: number, cases: LoadCase3D[]): string => {
    const matchingCases = cases.filter((c) => c.nature === nature && c.id !== currentCaseId);
    const num = matchingCases.length + 1;
    switch (nature) {
      case 'permanent':
        return `Stałe ${num}`;
      case 'variable':
        return `Użytkowe ${num}`;
      case 'wind':
        return `Wiatr ${num}`;
      case 'snow':
        return `Śnieg ${num}`;
      case 'temperature':
        return `Temperatura ${num}`;
      case 'ice':
        return `Oblodzenie ${num}`;
      case 'accidental':
        return `Wyjątkowe ${num}`;
      case 'other':
      default:
        return `Przypadek ${num}`;
    }
  };

  const handleNatureChange = (newNature: LoadNature) => {
    if (!activeCase) return;
    let newCat: EurocodeCategory | undefined = activeCase.category;
    if (newNature === 'variable' && (!newCat || newCat === 'wind' || newCat === 'snow_low' || newCat === 'snow_high')) {
      newCat = 'A';
    } else if (newNature === 'snow') {
      newCat = 'snow_low';
    } else if (newNature === 'wind') {
      newCat = 'wind';
    } else if (newNature === 'temperature') {
      newCat = 'temperature';
    } else if (newNature === 'ice') {
      newCat = 'ice';
    } else if (newNature === 'permanent') {
      newCat = undefined;
    }

    const defs = getDefaultPsiAndGammas(newNature, newCat);
    const newAutoName = getAutoCaseName(newNature, activeCase.id, loadCases);

    onUpdateLoadCase({
      ...activeCase,
      name: newAutoName,
      nature: newNature,
      category: newCat,
      psi0: defs.psi0,
      psi1: defs.psi1,
      psi2: defs.psi2,
      gammaG_sup: defs.gammaG_sup,
      gammaG_inf: defs.gammaG_inf,
      gammaQ: defs.gammaQ,
      includeSelfWeight: newNature === 'permanent' ? activeCase.includeSelfWeight : false,
    });
    onInvalidateResults();
  };

  const handleAddCase = () => {
    const permCases = loadCases.filter((c) => c.nature === 'permanent');
    const caseName = `Stałe ${permCases.length + 1}`;
    onAddLoadCase('permanent', undefined, caseName);
    setIsEditingCase(true);
  };

  const handleCategoryChange = (newCat: EurocodeCategory) => {
    if (!activeCase) return;
    const defs = getDefaultPsiAndGammas(activeCase.nature, newCat);
    onUpdateLoadCase({
      ...activeCase,
      category: newCat,
      psi0: defs.psi0,
      psi1: defs.psi1,
      psi2: defs.psi2,
      gammaG_sup: defs.gammaG_sup,
      gammaG_inf: defs.gammaG_inf,
      gammaQ: defs.gammaQ,
    });
    onInvalidateResults();
  };

  const handleResetPsiGammas = () => {
    if (!activeCase) return;
    const defs = getDefaultPsiAndGammas(activeCase.nature, activeCase.category);
    onUpdateLoadCase({
      ...activeCase,
      psi0: defs.psi0,
      psi1: defs.psi1,
      psi2: defs.psi2,
      gammaG_sup: defs.gammaG_sup,
      gammaG_inf: defs.gammaG_inf,
      gammaQ: defs.gammaQ,
    });
    onInvalidateResults();
  };

  const handlePrevCase = () => {
    if (activeIndex > 0) {
      onSelectLoadCase(loadCases[activeIndex - 1].id);
    }
  };

  const handleNextCase = () => {
    if (activeIndex < loadCases.length - 1) {
      onSelectLoadCase(loadCases[activeIndex + 1].id);
    }
  };

  return (
    <div className="panel">
      <h3
        className="collapsible-head"
        onClick={() => setCollapsed(!collapsed)}
        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Przypadki obciążeń</span>
          {activeCase && (
            <span
              className="tag"
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                background: getNatureBadgeColor(activeCase.nature).bg,
                color: getNatureBadgeColor(activeCase.nature).fg,
                border: `1px solid ${getNatureBadgeColor(activeCase.nature).border}`,
              }}
            >
              C{activeCase.id}: {activeCase.nature === 'permanent' ? 'Stałe' : activeCase.nature === 'variable' ? `Użytkowe` : activeCase.nature === 'wind' ? 'Wiatr' : activeCase.nature === 'snow' ? 'Śnieg' : activeCase.nature.toUpperCase().slice(0, 3)}
            </span>
          )}
        </div>
        <span className="subtle-icon">{collapsed ? '▸' : '▾'}</span>
      </h3>

      {!collapsed && (
        <div style={{ marginTop: '8px' }}>
          {/* Active Case Selector */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
            <select
              value={activeLoadCaseId}
              onChange={(e) => onSelectLoadCase(Number(e.target.value))}
              style={{ flex: 1, fontWeight: 600 }}
            >
              {loadCases.map((lc) => (
                <option key={lc.id} value={lc.id}>
                  C{lc.id}: {lc.name}
                </option>
              ))}
            </select>
            <button
              className="mini"
              onClick={handlePrevCase}
              disabled={activeIndex <= 0}
              title="Poprzedni przypadek obciążenia"
              style={{
                minWidth: '36px',
                height: '30px',
                padding: '0 10px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px',
                flex: '0 0 auto',
              }}
            >
              ◄
            </button>
            <button
              className="mini"
              onClick={handleNextCase}
              disabled={activeIndex >= loadCases.length - 1}
              title="Następny przypadek obciążenia"
              style={{
                minWidth: '36px',
                height: '30px',
                padding: '0 10px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px',
                flex: '0 0 auto',
              }}
            >
              ►
            </button>
          </div>

          {/* Add New Case & Edit Active Case Button (Same Line) */}
          <div style={{ display: 'flex', gap: '6px', width: '100%', marginBottom: '12px' }}>
            <button
              className="mini"
              onClick={handleAddCase}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}
              title="Dodaj nowy przypadek obciążenia (domyślnie Stałe) i otwórz edycję"
            >
              <span>Dodaj przypadek</span>
            </button>
            <button
              className={`mini ${isEditingCase ? 'active' : ''}`}
              onClick={() => setIsEditingCase(!isEditingCase)}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
                background: isEditingCase ? 'var(--accent-soft)' : undefined,
                borderColor: isEditingCase ? 'var(--accent)' : undefined,
                color: isEditingCase ? 'var(--accent)' : undefined,
                fontWeight: isEditingCase ? 600 : undefined,
              }}
              title={isEditingCase ? 'Ukryj edycję parametrów' : 'Edytuj parametry aktywnego przypadku obciążenia'}
            >
              <span>Edytuj przypadek</span>
            </button>
          </div>

          {/* Active Case Editor - Visible only when isEditingCase is true */}
          {activeCase && isEditingCase && (
            <div
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--surface-border-soft)',
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '12px',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '12.5px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text)' }}>Parametry przypadku C{activeCase.id}</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: totalLoadsCount > 0 ? 'var(--ok)' : 'var(--text-dim)',
                  }}
                >
                  {totalLoadsCount > 0 ? `Zadano ${totalLoadsCount} obciążeń` : 'Brak obciążeń'}
                </span>
              </div>

              {/* Name */}
              <div className="row" style={{ marginBottom: '6px' }}>
                <label style={{ minWidth: '70px' }}>Nazwa</label>
                <input
                  type="text"
                  value={activeCase.name}
                  onChange={(e) => {
                    onUpdateLoadCase({ ...activeCase, name: e.target.value });
                    onInvalidateResults();
                  }}
                  placeholder="np. Ciężar własny"
                  style={{ flex: 1 }}
                />
              </div>

              {/* Nature */}
              <div className="row" style={{ marginBottom: '6px' }}>
                <label style={{ minWidth: '70px' }}>Rodzaj</label>
                <select
                  value={activeCase.nature}
                  onChange={(e) => handleNatureChange(e.target.value as LoadNature)}
                  style={{ flex: 1 }}
                >
                  <option value="permanent">Stałe (G)</option>
                  <option value="variable">Zmienne użytkowe (Q)</option>
                  <option value="wind">Wiatr (W)</option>
                  <option value="snow">Śnieg (S)</option>
                  <option value="ice">Oblodzenie (I)</option>
                  <option value="temperature">Temperatura (T)</option>
                  <option value="accidental">Wyjątkowe (A)</option>
                  <option value="other">Inne / Własne</option>
                </select>
              </div>

              {/* Category (if variable or snow) */}
              {activeCase.nature === 'variable' && (
                <div className="row" style={{ marginBottom: '6px' }}>
                  <label style={{ minWidth: '70px' }}>Kategoria</label>
                  <select
                    value={activeCase.category || 'A'}
                    onChange={(e) => handleCategoryChange(e.target.value as EurocodeCategory)}
                    style={{ flex: 1 }}
                  >
                    <option value="A">Kat. A: Powierzchnie mieszkalne (ψ₀=0.7)</option>
                    <option value="B">Kat. B: Powierzchnie biurowe (ψ₀=0.7)</option>
                    <option value="C">Kat. C: Miejsca zebrań / spotkań (ψ₀=0.7)</option>
                    <option value="D">Kat. D: Powierzchnie handlowe (ψ₀=0.7)</option>
                    <option value="E">Kat. E: Powierzchnie magazynowe (ψ₀=1.0)</option>
                    <option value="F">Kat. F: Garaże i ruch pojazdów ≤ 30kN (ψ₀=0.7)</option>
                    <option value="G">Kat. G: Ruch pojazdów 30-160kN (ψ₀=0.7)</option>
                    <option value="H">Kat. H: Dachy niedostępne (ψ₀=0.0)</option>
                  </select>
                </div>
              )}

              {activeCase.nature === 'snow' && (
                <div className="row" style={{ marginBottom: '6px' }}>
                  <label style={{ minWidth: '70px' }}>Wysokość</label>
                  <select
                    value={activeCase.category === 'snow_high' ? 'snow_high' : 'snow_low'}
                    onChange={(e) => handleCategoryChange(e.target.value as EurocodeCategory)}
                    style={{ flex: 1 }}
                  >
                    <option value="snow_low">Wysokość H ≤ 1000 m n.p.m. (ψ₀=0.5)</option>
                    <option value="snow_high">Wysokość H &gt; 1000 m n.p.m. (ψ₀=0.7)</option>
                  </select>
                </div>
              )}

              {/* Self-weight toggle */}
              <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    gap: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <span>Uwzględnij ciężar własny prętów</span>
                  <input
                    type="checkbox"
                    checked={!!activeCase.includeSelfWeight}
                    onChange={(e) => {
                      onUpdateLoadCase({ ...activeCase, includeSelfWeight: e.target.checked });
                      onInvalidateResults();
                    }}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                  />
                </label>
                <div className="muted" style={{ marginTop: '2px' }}>
                  Dolicza obciążenie grawitacyjne w osi -Z (gęstość × pole przekroju × g) w tym przypadku.
                </div>
              </div>

              {/* Collapsible Eurocode Psi and Gamma multipliers */}
              <div style={{ marginTop: '8px', borderTop: '1px solid var(--surface-border-soft)', paddingTop: '6px' }}>
                <div
                  onClick={() => setShowEurocodeParams(!showEurocodeParams)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    fontSize: '11.5px',
                    color: 'var(--accent)',
                    userSelect: 'none',
                    fontWeight: 600,
                  }}
                >
                  <span>Współczynniki normowe (ψ<sub>0</sub>, ψ<sub>1</sub>, ψ<sub>2</sub>, γ)</span>
                  <span style={{ fontSize: '10px' }}>{showEurocodeParams ? '▲' : '▼'}</span>
                </div>

                {showEurocodeParams && (
                  <div style={{ marginTop: '6px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '6px' }}>
                      <div>
                        <div className="muted" style={{ fontSize: '10.5px' }}>ψ<sub>0</sub> (kombin.)</div>
                        <SmartNumberInput
                          step="0.05"
                          min={0}
                          max={2}
                          value={activeCase.psi0}
                          onChange={(v) => {
                            onUpdateLoadCase({ ...activeCase, psi0: v });
                            onInvalidateResults();
                          }}
                        />
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '10.5px' }}>ψ<sub>1</sub> (częste)</div>
                        <SmartNumberInput
                          step="0.05"
                          min={0}
                          max={2}
                          value={activeCase.psi1}
                          onChange={(v) => {
                            onUpdateLoadCase({ ...activeCase, psi1: v });
                            onInvalidateResults();
                          }}
                        />
                      </div>
                      <div>
                        <div className="muted" style={{ fontSize: '10.5px' }}>ψ<sub>2</sub> (prawie st.)</div>
                        <SmartNumberInput
                          step="0.05"
                          min={0}
                          max={2}
                          value={activeCase.psi2}
                          onChange={(v) => {
                            onUpdateLoadCase({ ...activeCase, psi2: v });
                            onInvalidateResults();
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '6px' }}>
                      {activeCase.nature === 'permanent' ? (
                        <>
                          <div>
                            <div className="muted" style={{ fontSize: '10.5px' }}>γ<sub>G,sup</sub> (niekorz.)</div>
                            <SmartNumberInput
                              step="0.05"
                              min={0.5}
                              max={3}
                              value={activeCase.gammaG_sup}
                              onChange={(v) => {
                                onUpdateLoadCase({ ...activeCase, gammaG_sup: v });
                                onInvalidateResults();
                              }}
                            />
                          </div>
                          <div>
                            <div className="muted" style={{ fontSize: '10.5px' }}>γ<sub>G,inf</sub> (korz.)</div>
                            <SmartNumberInput
                              step="0.05"
                              min={0.5}
                              max={2}
                              value={activeCase.gammaG_inf}
                              onChange={(v) => {
                                onUpdateLoadCase({ ...activeCase, gammaG_inf: v });
                                onInvalidateResults();
                              }}
                            />
                          </div>
                        </>
                      ) : (
                        <div style={{ gridColumn: 'span 2' }}>
                          <div className="muted" style={{ fontSize: '10.5px' }}>γ<sub>Q</sub> (współczynnik obciążenia)</div>
                          <SmartNumberInput
                            step="0.05"
                            min={0.5}
                            max={3}
                            value={activeCase.gammaQ}
                            onChange={(v) => {
                              onUpdateLoadCase({ ...activeCase, gammaQ: v });
                              onInvalidateResults();
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <button
                      className="mini"
                      onClick={handleResetPsiGammas}
                      style={{ fontSize: '10.5px', padding: '4px 8px', width: '100%' }}
                    >
                      Przywróć wartości wg PN-EN 1990
                    </button>
                  </div>
                )}
              </div>

              {/* Applied loads summary badges */}
              <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {loadStats.forces > 0 && (
                  <span className="tag" style={{ fontSize: '10px' }}>
                    Siły węzłowe: {loadStats.forces}
                  </span>
                )}
                {loadStats.moments > 0 && (
                  <span className="tag" style={{ fontSize: '10px' }}>
                    Momenty: {loadStats.moments}
                  </span>
                )}
                {loadStats.elemLoads > 0 && (
                  <span className="tag" style={{ fontSize: '10px' }}>
                    Obciążenia ciągłe: {loadStats.elemLoads}
                  </span>
                )}
                {loadStats.thermals > 0 && (
                  <span className="tag" style={{ fontSize: '10px' }}>
                    Termika: {loadStats.thermals}
                  </span>
                )}
                {loadStats.pressures > 0 && (
                  <span className="tag" style={{ fontSize: '10px' }}>
                    Parcie płyt: {loadStats.pressures}
                  </span>
                )}
              </div>

              {/* Action buttons (Zatwierdź on the left, Usuń on the right) */}
              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <button
                  className="mini"
                  onClick={() => setIsEditingCase(false)}
                  style={{
                    fontSize: '11.5px',
                    padding: '4px 12px',
                    fontWeight: 600,
                    background: 'var(--accent)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  title="Zatwierdź i zamknij edycję parametrów"
                >
                  Zatwierdź
                </button>

                {loadCases.length > 1 && (
                  <button
                    className="mini danger"
                    onClick={() => {
                      onDeleteLoadCase(activeCase.id);
                      onInvalidateResults();
                    }}
                    style={{ fontSize: '11px', padding: '4px 8px' }}
                    title={`Usuń przypadek ${activeCase.name}`}
                  >
                    Usuń ten przypadek
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Eurocode Combinations (PN-EN 1990) */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'var(--surface-2)',
              border: '1px solid var(--surface-border-soft)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                gap: '8px',
                fontWeight: 600,
                fontSize: '12px',
                color: 'var(--text)',
              }}
            >
              <span>Kombinacje automatyczne (Eurokod)</span>
              <input
                type="checkbox"
                checked={autoCombinations}
                onChange={(e) => {
                  setAutoCombinations(e.target.checked);
                  onInvalidateResults();
                }}
                style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
              />
            </label>

            <div className="muted" style={{ marginTop: '2px'}}>
              {autoCombinations ? (
                <>
                  Wygenerowano <b>{generatedCombinations.length}</b> kombinacji ({sgnCount} SGN, {sguCount} SGU) wg PN-EN 1990.
                </>
              ) : (
                'Wyłączono automatyczne kombinacje.'
              )}
            </div>

            {autoCombinations && generatedCombinations.length > 0 && (
              <button
                className="mini"
                onClick={() => setShowCombinationsModal(true)}
                style={{
                  marginTop: '8px',
                  width: '100%',
                  fontSize: '11px',
                  padding: '5px 8px'
                }}
              >
                Zobacz listę kombinacji ({generatedCombinations.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Combinations Modal */}
      {showCombinationsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 400,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowCombinationsModal(false)}
        >
          <div
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              borderRadius: '10px',
              border: '1px solid var(--surface-border)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.35)',
              width: '100%',
              maxWidth: '750px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--surface-border)',
                background: 'var(--surface-2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
                  Kombinacje normowe (PN-EN 1990)
                </h3>
                <div className="muted" style={{ fontSize: '12px', marginTop: '2px' }}>
                  Łącznie: {generatedCombinations.length} ({sgnCount} stan graniczny nośności SGN, {sguCount} użytkowalności SGU)
                </div>
              </div>
              <button
                className="btn btn-sm"
                onClick={() => setShowCombinationsModal(false)}
                style={{ fontSize: '16px', padding: '4px 10px', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
              {/* SGN Table */}
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13.5px', color: 'var(--danger)' }}>
                Stan Graniczny Nośności (SGN / ULS) - {sgnCount} kombinacji
              </h4>
              <div style={{ overflowX: 'auto', marginBottom: '18px' }}>
                <table className="rtab" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>ID</th>
                      <th>Wzór kombinacji</th>
                      <th>Opis i wiodące działanie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedCombinations
                      .filter((c) => c.type === 'SGN')
                      .map((c) => (
                        <tr key={c.id}>
                          <td><b>{c.id.toUpperCase()}</b></td>
                          <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{c.name.replace(/^SGN \d+:\s*/, '')}</td>
                          <td className="muted">{c.description}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* SGU Table */}
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13.5px', color: 'var(--ok)' }}>
                Stan Graniczny Użytkowalności (SGU / SLS) - {sguCount} kombinacji
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="rtab" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Typ</th>
                      <th>Wzór kombinacji</th>
                      <th>Opis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedCombinations
                      .filter((c) => c.type !== 'SGN')
                      .map((c) => (
                        <tr key={c.id}>
                          <td>
                            <span className="tag" style={{ fontSize: '10px' }}>
                              {c.type === 'SGU_CHR' ? 'Charakt.' : c.type === 'SGU_FREQ' ? 'Częsta' : 'Prawie st.'}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{c.name.replace(/^SGU-[A-Za-z]+ \d+:\s*/, '')}</td>
                          <td className="muted">{c.description}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                padding: '10px 18px',
                borderTop: '1px solid var(--surface-border)',
                background: 'var(--surface-2)',
                textAlign: 'right',
              }}
            >
              <button className="btn" onClick={() => setShowCombinationsModal(false)}>
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
