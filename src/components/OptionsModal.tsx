import React from 'react';

export const APP_ACCENTS: Record<
  string,
  { name: string; hex: string }
> = {
  blue: { name: 'Niebieski', hex: '#2563eb' },
  indigo: { name: 'Indygo', hex: '#4f46e5' },
  violet: { name: 'Fioletowy', hex: '#7c3aed' },
  teal: { name: 'Morski', hex: '#0d9488' },
  emerald: { name: 'Szmaragdowy', hex: '#059669' },
  amber: { name: 'Bursztynowy', hex: '#d97706' },
  rose: { name: 'Różany', hex: '#e11d48' },
  slate: { name: 'Grafitowy', hex: '#475569' },
};

interface OptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  accent: string;
  setAccent: (a: string) => void;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  showAxes: boolean;
  setShowAxes: (v: boolean) => void;
  includeSelfWeight: boolean;
  setIncludeSelfWeight: (v: boolean) => void;
  snapSize: number;
  setSnapSize: (v: number) => void;
  onOpenAbout?: () => void;
}

export const OptionsModal: React.FC<OptionsModalProps> = ({
  isOpen,
  onClose,
  theme,
  setTheme,
  accent,
  setAccent,
  showGrid,
  setShowGrid,
  showAxes,
  setShowAxes,
  includeSelfWeight,
  setIncludeSelfWeight,
  snapSize,
  setSnapSize,
  onOpenAbout,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0f172a99',
        zIndex: 300,
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
          borderRadius: '12px',
          maxWidth: '440px',
          width: '100%',
          maxHeight: '86vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px #0008',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--sidebar-border)',
            position: 'sticky',
            top: 0,
            background: 'var(--sidebar-bg)',
            zIndex: 2,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600 }}>Opcje programu</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--text-dim)',
              lineHeight: 1,
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '16px 18px', fontSize: '12.5px' }}>
          {/* Motyw i Kolory */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '14px',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                  Motyw aplikacji
                </div>
                <div className="btnrow" style={{ marginTop: 0 }}>
                  <button
                    className={`mini ${theme === 'light' ? 'on' : ''}`}
                    onClick={() => setTheme('light')}
                  >
                    Jasny
                  </button>
                  <button
                    className={`mini ${theme === 'dark' ? 'on' : ''}`}
                    onClick={() => setTheme('dark')}
                  >
                    Ciemny
                  </button>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                  Kolorystyka
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', paddingTop: '2px' }}>
                  {Object.entries(APP_ACCENTS).map(([key, def]) => {
                    const isSel = accent === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setAccent(key)}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: def.hex,
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          outline: isSel ? '2.5px solid var(--text)' : '2px solid transparent',
                          outlineOffset: '2px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                          transform: isSel ? 'scale(1.12)' : 'scale(1)',
                          transition: 'transform 0.12s, outline-color 0.12s',
                        }}
                        title={def.name}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <hr className="sep" />

          {/* Opcje wyświetlania 3D */}
          <div style={{ marginBottom: '14px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Siatka płaszczyzny podstawy (XY)</span>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                style={{ width: '18px', height: '18px', flex: '0 0 auto', accentColor: 'var(--accent)' }}
              />
            </label>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Osie globalne układu 3D (XYZ)</span>
              <input
                type="checkbox"
                checked={showAxes}
                onChange={(e) => setShowAxes(e.target.checked)}
                style={{ width: '18px', height: '18px', flex: '0 0 auto', accentColor: 'var(--accent)' }}
              />
            </label>
          </div>

          <hr className="sep" />

          {/* Ciężar własny */}
          <div style={{ marginBottom: '14px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Uwzględnij ciężar własny prętów</span>
              <input
                type="checkbox"
                checked={includeSelfWeight}
                onChange={(e) => setIncludeSelfWeight(e.target.checked)}
                style={{ width: '18px', height: '18px', flex: '0 0 auto', accentColor: 'var(--accent)' }}
              />
            </label>
            <div className="muted" style={{ marginTop: '3px' }}>
              Dolicza do każdego pręta obciążenie pionowe w dół (-Z): gęstość materiału × pole przekroju × g.
            </div>
          </div>

          <div style={{ marginTop: '14px', marginBottom: '14px' }}>
            <div className="row" style={{ marginBottom: 0 }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, flex: 1, minWidth: 0 }}>
                Krok dociągania węzłów do siatki (Snap)
              </span>
              <input
                type="number"
                step="0.05"
                min="0.01"
                value={snapSize}
                onChange={(e) => setSnapSize(Math.max(0.01, parseFloat(e.target.value) || 0.5))}
                style={{ width: '76px', flex: '0 0 auto', textAlign: 'left' }}
              />
              <span className="unit" style={{ width: 'auto', flex: '0 0 auto', paddingLeft: '2px' }}>
                m
              </span>
            </div>
            <div className="muted" style={{ marginTop: '4px' }}>
              Określa krok (w metrach), do jakiego będą dociągane węzły przy włączonym przycisku „Przyciągaj”.
            </div>
          </div>

          {onOpenAbout && (
            <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--sidebar-border)' }}>
              <button
                className="mini"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                }}
                onClick={() => {
                  onClose();
                  onOpenAbout();
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                O programie
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
