import React from 'react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

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
          maxWidth: '440px',
          width: '100%',
          maxHeight: '88vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px #0008',
          border: '1px solid var(--sidebar-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--sidebar-border)',
            position: 'sticky',
            top: 0,
            background: 'var(--sidebar-bg)',
            zIndex: 2,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>O programie</h2>
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

        <div style={{ padding: '20px', fontSize: '12.5px', lineHeight: 1.5 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              marginBottom: '18px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--surface-border-soft)',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '12px',
                background: 'var(--surface-2)',
                border: '1px solid var(--surface-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                fontWeight: 800,
                fontSize: '20px',
                fontFamily: 'var(--mono)',
                flex: '0 0 auto',
              }}
            >
              3D
            </div>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                Materia 3D
              </div>
              <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>
                Statyka, Stateczność i Dynamika Konstrukcji Prętowych 3D
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '14px' }}>
            <div
              style={{
                fontWeight: 600,
                marginBottom: '6px',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Autor i kontakt
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', fontSize: '12px' }}>
              <span className="muted">Autor:</span>
              <span style={{ fontWeight: 600 }}>Jakub Gontarz</span>
              <span className="muted">E-mail:</span>
              <span>
                <a
                  href="mailto:j.gontarz@pollub.pl"
                  style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
                >
                  j.gontarz@pollub.pl
                </a>
              </span>
            </div>
            <div
              className="muted"
              style={{
                marginTop: '10px',
                fontSize: '11.5px',
                lineHeight: 1.4,
                background: 'var(--surface)',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid var(--surface-border-soft)',
              }}
            >
              💬 <strong>Uwagi i zgłoszenia:</strong> Jeśli znalazłeś błąd w działaniu programu lub chciałbyś
              zasugerować nowe funkcje i poprawki, zachęcam do kontaktu drogą mailową.
            </div>
          </div>

          <div className="card" style={{ marginBottom: '14px' }}>
            <div
              style={{
                fontWeight: 600,
                marginBottom: '6px',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Prywatność i przetwarzanie danych
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
              Wszystkie obliczenia w programie są wykonywane <strong>lokalnie w Twojej przeglądarce</strong> za pomocą
              silnika MES 3D. Program nie przesyła żadnych danych na zewnętrzne serwery.
            </div>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <div
              style={{
                fontWeight: 600,
                marginBottom: '6px',
                color: 'var(--text)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Narzędzia i technologie
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span
                className="tag"
                style={{
                  fontSize: '10.5px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent-dark)',
                  fontWeight: 600,
                }}
              >
                MES 3D / FEM 3D
              </span>
              <span
                className="tag"
                style={{
                  fontSize: '10.5px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent-dark)',
                  fontWeight: 600,
                }}
              >
                HTML5 Canvas 3D
              </span>
              <span
                className="tag"
                style={{
                  fontSize: '10.5px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'var(--surface)',
                  border: '1px solid var(--surface-border)',
                  color: 'var(--text-dim)',
                }}
              >
                TypeScript / React
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
