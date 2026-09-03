import React, { useState, useEffect } from 'react';

export const STORAGE_ACKNOWLEDGED_KEY = 'fem_3d_storage_acknowledged';

export const StorageNoticeBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    try {
      const acknowledged = localStorage.getItem(STORAGE_ACKNOWLEDGED_KEY);
      if (acknowledged !== 'true') {
        setIsVisible(true);
      }
    } catch (e) {
      // If localStorage is unavailable, fallback to not showing or hiding on error
      console.warn('Unable to access localStorage for storage notice banner check', e);
    }
  }, []);

  const handleAcknowledge = () => {
    try {
      localStorage.setItem(STORAGE_ACKNOWLEDGED_KEY, 'true');
    } catch (e) {
      console.warn('Unable to save storage acknowledgment flag to localStorage', e);
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className="storage-notice-banner"
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'calc(100% - 32px)',
        maxWidth: '680px',
        background: 'var(--toolbar-bg, #1b2430)',
        color: 'var(--toolbar-fg, #e8edf3)',
        border: '1px solid var(--surface-border, rgba(255, 255, 255, 0.15))',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        backdropFilter: 'blur(8px)',
        fontSize: '12.5px',
        lineHeight: 1.4,
        animation: 'fadeInUpNotice 0.3s ease-out forwards',
      }}
    >
      <style>{`
        @keyframes fadeInUpNotice {
          from {
            opacity: 0;
            transform: translate(-50%, 16px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        @media (max-width: 600px) {
          .storage-notice-banner {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            padding: 14px !important;
          }
          .storage-notice-btn {
            width: 100% !important;
            justify-content: center !important;
            padding: 10px 18px !important;
          }
        }
      `}</style>

      <div
        className="storage-notice-wrap"
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          flex: 1,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--accent-soft, rgba(37, 99, 235, 0.2))',
            color: 'var(--accent, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '1px',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        </div>

        <div style={{ flex: 1, color: 'var(--toolbar-fg, #e8edf3)' }}>
          <span style={{ fontWeight: 600, color: '#ffffff' }}>Pamięć przeglądarki: </span>
          Aplikacja wykorzystuje lokalną pamięć przeglądarki (localStorage) do zapisywania Twoich
          projektów, ustawień i stanu pracy bezpośrednio na urządzeniu. Dane nie są wysyłane na żaden
          zewnętrzny serwer.
        </div>
      </div>

      <button
        className="storage-notice-btn"
        onClick={handleAcknowledge}
        style={{
          flexShrink: 0,
          background: 'var(--accent, #2563eb)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 18px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 6px rgba(37, 99, 235, 0.4)',
          transition: 'all 0.15s ease',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--accent-dark, #1d4ed8)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--accent, #2563eb)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <span>Rozumiem</span>
      </button>
    </div>
  );
};
