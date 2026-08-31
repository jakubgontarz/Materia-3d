import React from 'react';
import { GraphicsMode } from '../render/engine3d';

export const APP_ACCENTS: Record<
  string,
  { name: string; hex: string; darkHex: string; lightHex: string; rgb: [number, number, number] }
> = {
  blue: { name: 'Niebieski', hex: '#2563eb', darkHex: '#1d4ed8', lightHex: '#60a5fa', rgb: [37, 99, 235] },
  indigo: { name: 'Indygo', hex: '#4f46e5', darkHex: '#4338ca', lightHex: '#818cf8', rgb: [79, 70, 229] },
  violet: { name: 'Fioletowy', hex: '#7c3aed', darkHex: '#6d28d9', lightHex: '#a78bfa', rgb: [124, 58, 237] },
  teal: { name: 'Morski', hex: '#0d9488', darkHex: '#0f766e', lightHex: '#2dd4bf', rgb: [13, 148, 136] },
  emerald: { name: 'Szmaragdowy', hex: '#059669', darkHex: '#047857', lightHex: '#34d399', rgb: [5, 150, 105] },
  amber: { name: 'Bursztynowy', hex: '#d97706', darkHex: '#b45309', lightHex: '#fbbf24', rgb: [217, 119, 6] },
  rose: { name: 'Różany', hex: '#e11d48', darkHex: '#be123c', lightHex: '#fb7185', rgb: [225, 29, 72] },
  slate: { name: 'Grafitowy', hex: '#475569', darkHex: '#334155', lightHex: '#94a3b8', rgb: [71, 85, 105] },
};

interface OptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  accent: string;
  setAccent: (a: string) => void;
  graphicsMode: GraphicsMode;
  setGraphicsMode: (mode: GraphicsMode) => void;
  showGrid?: boolean;
  setShowGrid?: (v: boolean) => void;
  includeSelfWeight: boolean;
  setIncludeSelfWeight: (v: boolean) => void;
  snapSize?: number;
  setSnapSize?: (v: number) => void;
  momentsAsArcs: boolean;
  setMomentsAsArcs: (v: boolean) => void;
}

export const OptionsModal: React.FC<OptionsModalProps> = ({
  isOpen,
  onClose,
  theme,
  setTheme,
  accent,
  setAccent,
  graphicsMode,
  setGraphicsMode,
  includeSelfWeight,
  setIncludeSelfWeight,
  momentsAsArcs,
  setMomentsAsArcs,
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
          {/* Tryb grafiki (Wydajność, Zrównoważony, Jakość) */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
              Tryb grafiki
            </div>
            <div className="btnrow" style={{ marginTop: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
              <button
                className={`mini ${graphicsMode === 'performance' ? 'on' : ''}`}
                onClick={() => setGraphicsMode('performance')}
                style={{ textAlign: 'center', justifyContent: 'center' }}
              >
                Wydajność
              </button>
              <button
                className={`mini ${graphicsMode === 'balanced' ? 'on' : ''}`}
                onClick={() => setGraphicsMode('balanced')}
                style={{ textAlign: 'center', justifyContent: 'center' }}
              >
                Zrównoważony
              </button>
              <button
                className={`mini ${graphicsMode === 'quality' ? 'on' : ''}`}
                onClick={() => setGraphicsMode('quality')}
                style={{ textAlign: 'center', justifyContent: 'center' }}
              >
                Jakość
              </button>
            </div>
            <div className="muted" style={{ marginTop: '5px', fontSize: '11.5px', lineHeight: '1.4' }}>
              {graphicsMode === 'performance' && (
                <span>
                  <strong>Tryb wydajności:</strong> Pręty jako estetyczne linie 2D (nie bryły 3D), obciążenia renderowane nad modelem, przeguby 2D zawsze nad prętami, a etykiety na samym wierzchu (maksymalna płynność i natychmiastowa responsywność).
                </span>
              )}
              {graphicsMode === 'balanced' && (
                <span>
                  <strong>Tryb zrównoważony:</strong> Zoptymalizowany standardowy rendering bryłowy 3D.
                </span>
              )}
              {graphicsMode === 'quality' && (
                <span>
                  <strong>Tryb jakości:</strong> Zaawansowane trójpunktowe oświetlenie, filmowe mapowanie tonów (ACES) oraz wysokie wygładzenie geometrii brył.
                </span>
              )}
            </div>
          </div>

          <hr className="sep" />

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

          <hr className="sep" />

          {/* Rysowanie momentów jako łuk */}
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
              <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Momenty skupione jako łuk</span>
              <input
                type="checkbox"
                checked={momentsAsArcs}
                onChange={(e) => setMomentsAsArcs(e.target.checked)}
                style={{ width: '18px', height: '18px', flex: '0 0 auto', accentColor: 'var(--accent)' }}
              />
            </label>
            <div className="muted" style={{ marginTop: '3px' }}>
              Rysuje momenty skupione i reakcje jako tradycyjne łuki z grotem w płaszczyźnie obrotu (zgodnie z zasadą prawej dłoni) zamiast strzałek o podwójnym grocie.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
