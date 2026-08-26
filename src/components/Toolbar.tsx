import React, { useState, useRef, useEffect } from 'react';
import { Section, Material } from '../fem/types';
import logoImg from '../logo3d64.png';

export const ICONS = {
  select: (
    <svg viewBox="0 0 24 24">
      <path d="M5 3l14 8-6 1.5L11 19z" />
    </svg>
  ),
  node: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
    </svg>
  ),
  bar: (
    <svg viewBox="0 0 24 24">
      <circle cx="5" cy="19" r="2.3" />
      <circle cx="19" cy="5" r="2.3" />
      <path d="M6.8 17.2L17.2 6.8" />
    </svg>
  ),
  del: (
    <svg viewBox="0 0 24 24">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  ),
  run: (
    <svg viewBox="0 0 24 24">
      <path d="M6 4l14 8-14 8z" />
    </svg>
  ),
  back: (
    <svg viewBox="0 0 24 24">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  fit: (
    <svg viewBox="0 0 24 24">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  ),
  neu: (
    <svg viewBox="0 0 24 24">
      <path d="M14 3H6v18h12V7l-4-4zM14 3v4h4" />
    </svg>
  ),
  ul: (
    <svg viewBox="0 0 24 24">
      <path d="M4 9V6a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v1M2 9h20l-2 10H4z" />
    </svg>
  ),
  dl: (
    <svg viewBox="0 0 24 24">
      <path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM7 21v-8h10v8M8 3v5h8V3M10 5v2" />
    </svg>
  ),
  saveAs: (
    <svg viewBox="0 0 24 24">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  importJson: (
    <svg viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  exportJson: (
    <svg viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  undo: (
    <svg viewBox="0 0 24 24">
      <path d="M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2" />
    </svg>
  ),
  redo: (
    <svg viewBox="0 0 24 24">
      <path d="M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h2" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24">
      <path d="M4 4h16v16H4z M4 9.33h16 M4 14.67h16 M9.33 4v16 M14.67 4v16" />
    </svg>
  ),
  gear: (
    <svg viewBox="0 0 24 24">
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37c.996.608 2.296.07 2.572-1.065z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  boxselect: (
    <svg viewBox="0 0 24 24">
      <rect x="4" y="5" width="16" height="14" rx="1.5" strokeDasharray="3 2.2" />
    </svg>
  ),
  moveNode: (
    <svg viewBox="0 0 24 24">
      <path d="M12 3v18M3 12h18" />
      <path d="M5 9l-3 3 3 3M19 9l3 3-3 3M9 5l3-3 3 3M9 19l3 3 3-3" />
    </svg>
  ),
  copyVec: (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="3" width="12" height="12" rx="1.5" />
      <path d="M8 15v3a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-3" />
    </svg>
  ),
  rotate: (
    <svg viewBox="0 0 24 24">
      <path d="M4.5 12a7.5 7.5 0 1 1 2.3 5.4" />
      <path d="M1.5 9.5L4.5 12.5L7.5 9.5" />
    </svg>
  ),
  copyRotate: (
    <svg viewBox="0 0 24 24">
      <path d="M3.5 13a6.5 6.5 0 1 1 2 4.8" />
      <path d="M1 10.5L3.5 13.5L6.5 10.5" />
      <rect x="15" y="3" width="6" height="6" rx="1.3" />
    </svg>
  ),
  mirror: (
    <svg viewBox="0 0 24 24">
      <path d="M12 3v18" strokeDasharray="2.5 2.2" />
      <path d="M8 7L4 11l4 4M16 7l4 4-4 4" />
    </svg>
  ),
  copyMirror: (
    <svg viewBox="0 0 24 24">
      <path d="M10.5 3v18" strokeDasharray="2.5 2.2" />
      <path d="M7 7L3.5 10.5 7 14M14 7l3.5 3.5L14 14" />
      <rect x="16" y="2" width="6" height="6" rx="1.3" />
    </svg>
  ),
  splitBar: (
    <svg viewBox="0 0 24 24">
      <circle cx="4" cy="20" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="20" cy="4" r="2" />
      <path d="M5.41 18.59L10.59 13.41M13.41 10.59L18.59 5.41" />
    </svg>
  ),
  intersect: (
    <svg viewBox="0 0 24 24">
      <path d="M4 4l16 16M20 4L4 20" />
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    </svg>
  ),
  supNone: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7" />
      <path d="M7 7l10 10" />
    </svg>
  ),
  supFixed: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="9" r="1.6" fill="currentColor" stroke="none" />
      <path d="M4 12h16" />
      <path d="M6 12l-3 5M10 12l-3 5M14 12l-3 5M18 12l-3 5" />
    </svg>
  ),
  supPin: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <path d="M12 6l-6 8h12z" />
      <path d="M6 14h12" />
      <path d="M7 14l-2.5 4M11 14l-2.5 4M15 14l-2.5 4M19 14l-2.5 4" />
    </svg>
  ),
  supRollH: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <path d="M12 6l-6 8h12z" />
      <circle cx="8" cy="16.5" r="1.3" />
      <circle cx="12" cy="16.5" r="1.3" />
      <circle cx="16" cy="16.5" r="1.3" />
    </svg>
  ),
  supRollV: (
    <svg viewBox="0 0 24 24">
      <g transform="rotate(90 12 12)">
        <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
        <path d="M12 6l-6 8h12z" />
        <circle cx="8" cy="16.5" r="1.3" />
        <circle cx="12" cy="16.5" r="1.3" />
        <circle cx="16" cy="16.5" r="1.3" />
      </g>
    </svg>
  ),
  supGuideV: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <path d="M9 3v18M15 3v18" />
      <path d="M9 5l-4 3M9 11l-4 3M9 17l-4 3M15 8l4-3M15 14l4-3M15 20l4-3" />
    </svg>
  ),
  supGuideH: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <path d="M4 8h16" />
      <path d="M4 12h16" />
      <path d="M6 12l-3 5M10 12l-3 5M14 12l-3 5M18 12l-3 5" />
    </svg>
  ),
  supSleeve: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <rect x="7" y="7" width="10" height="10" />
      <circle cx="4" cy="12" r="1.3" />
      <circle cx="20" cy="12" r="1.3" />
      <circle cx="12" cy="4" r="1.3" />
      <circle cx="12" cy="20" r="1.3" />
    </svg>
  ),
  pan: (
    <svg viewBox="0 0 24 24">
      <path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a6 6 0 0 0 12 0v-3a2 2 0 0 0-4 0" />
    </svg>
  ),
  orbit: (
    <svg viewBox="0 0 24 24">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  ),
  zoom: (
    <svg viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M11 8v6M8 11h6" />
    </svg>
  ),
  selReplace: (
    <svg viewBox="0 0 24 24">
      <polygon points="3 3 10.07 19.97 12.58 11.58 21 10.07 3 3" />
    </svg>
  ),
  selAdd: (
    <svg viewBox="0 0 24 24">
      <polygon points="3 3 10.07 19.97 12.58 11.58 21 10.07 3 3" />
      <line x1="15" y1="17" x2="21" y2="17" strokeWidth="2.5" />
      <line x1="18" y1="14" x2="18" y2="20" strokeWidth="2.5" />
    </svg>
  ),
  selSubtract: (
    <svg viewBox="0 0 24 24">
      <polygon points="3 3 10.07 19.97 12.58 11.58 21 10.07 3 3" />
      <line x1="15" y1="17" x2="21" y2="17" strokeWidth="2.5" />
    </svg>
  ),
  selToggle: (
    <svg viewBox="0 0 24 24">
      <polygon points="3 3 10.07 19.97 12.58 11.58 21 10.07 3 3" />
      <line x1="15" y1="15" x2="21" y2="15" strokeWidth="2.5" />
      <line x1="18" y1="12" x2="18" y2="18" strokeWidth="2.5" />
      <line x1="15" y1="21" x2="21" y2="21" strokeWidth="2.5" />
    </svg>
  ),
  filterBy: (
    <svg viewBox="0 0 24 24">
      <polygon points="2 3 22 3 14 12.5 14 19 10 21 10 12.5 2 3" />
      <line x1="17" y1="15" x2="22" y2="15" strokeWidth="2.2" />
      <line x1="17" y1="18" x2="22" y2="18" strokeWidth="2.2" />
    </svg>
  ),
  panel: (
    <svg viewBox="0 0 24 24">
      <polygon points="3 17 8 5 21 8 16 20" fill="currentColor" fillOpacity="0.2" />
      <polygon points="3 17 8 5 21 8 16 20" fill="none" strokeWidth="2" />
    </svg>
  ),
  triangle: (
    <svg viewBox="0 0 24 24">
      <polygon points="12 4 21 19 3 19" fill="currentColor" fillOpacity="0.2" />
      <polygon points="12 4 21 19 3 19" fill="none" strokeWidth="2" />
    </svg>
  ),
  rectangle: (
    <svg viewBox="0 0 24 24">
      <rect x="4" y="5" width="16" height="14" rx="1.5" fill="currentColor" fillOpacity="0.2" />
      <rect x="4" y="5" width="16" height="14" rx="1.5" fill="none" strokeWidth="2" />
    </svg>
  ),
};

interface ToolbarProps {
  mode: 'select' | 'addBar' | 'addPanel';
  setMode: (m: 'select' | 'addBar' | 'addPanel') => void;
  panelShape?: 'triangle' | 'rectangle';
  setPanelShape?: (s: 'triangle' | 'rectangle') => void;
  navMode?: string;
  setNavMode?: (m: any) => void;
  effectiveSelMode?: 'replace' | 'add' | 'subtract' | 'toggle';
  setMobileSelMode?: (m: 'replace' | 'add' | 'subtract' | 'toggle') => void;
  onOpenSelectBy?: () => void;
  selectByOpen?: boolean;
  isSolved: boolean;
  onSolveOrBack: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onNewModel: () => void;
  onSaveModel: () => void;
  onSaveAsModel: () => void;
  onLoadModel: () => void;
  onImportJson: () => void;
  onExportJson: () => void;
  onOpenOptions: () => void;
  onOpenAbout: () => void;
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;
  allowNewNodesInBarMode: boolean;
  setAllowNewNodesInBarMode: (v: boolean) => void;
  sections: Section[];
  materials: Material[];
  defaultSectionId: number;
  setDefaultSectionId: (id: number) => void;
  defaultMaterialId: number;
  setDefaultMaterialId: (id: number) => void;
  snapSize?: number;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  mode,
  setMode,
  panelShape = 'triangle',
  setPanelShape,
  navMode = 'orbit',
  setNavMode,
  effectiveSelMode = 'replace',
  setMobileSelMode,
  onOpenSelectBy,
  selectByOpen = false,
  isSolved,
  onSolveOrBack,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onNewModel,
  onSaveModel,
  onSaveAsModel,
  onLoadModel,
  onImportJson,
  onExportJson,
  onOpenOptions,
  onOpenAbout,
  snapEnabled,
  setSnapEnabled,
  allowNewNodesInBarMode,
  setAllowNewNodesInBarMode,
  sections,
  materials,
  defaultSectionId,
  setDefaultSectionId,
  defaultMaterialId,
  setDefaultMaterialId,
  snapSize = 0.5,
}) => {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [menuOpen]);

  return (
    <div id="toolbar">
      {/* Grupa Oblicz: float: right zakotwicza na samej górze z prawej strony 1. linii */}
      <div className="tb-group tb-group-run">
        <button
          className="tb-btn primary"
          id="btnRun"
          onClick={onSolveOrBack}
          title={isSolved ? 'Ukryj wyniki i wróć do edycji modelu (Enter)' : 'Uruchom obliczenia (Enter)'}
        >
          {isSolved ? ICONS.back : ICONS.run}
          <span>{isSolved ? 'WRÓĆ' : 'OBLICZ'}</span>
        </button>
      </div>

      {/* Główna grupa: Menu z logo, Cofnij, Ponów, Zaznacz, Rysuj */}
      <div className="tb-group" style={{ position: 'relative' }}>
        {/* Przycisk Menu z logo */}
        <div style={{ position: 'relative', display: 'inline-flex' }} ref={menuRef}>
          <button
            className={`tb-btn ${menuOpen ? 'active' : ''}`}
            id="btnMenu"
            onClick={() => setMenuOpen(!menuOpen)}
            title="Główne menu programu"
            style={{ minWidth: '46px' }}
          >
            <img
              src={logoImg}
              alt="Menu"
              style={{
                width: '18px',
                height: '18px',
                objectFit: 'contain',
                filter: menuOpen ? 'brightness(1.2)' : 'none',
              }}
            />
            <span>Menu</span>
          </button>

          {/* Rozwijane Menu */}
          {menuOpen && (
            <div
              className="toolbar-dropdown-menu"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '6px',
                background: 'var(--sidebar-bg)',
                border: '1px solid var(--sidebar-border)',
                borderRadius: '10px',
                padding: '6px',
                minWidth: '210px',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              <button
                className="menu-item-btn"
                onClick={() => {
                  setMenuOpen(false);
                  onNewModel();
                }}
              >
                <span className="menu-item-icon">{ICONS.neu}</span>
                <span className="menu-item-text">Nowy</span>
              </button>

              <button
                className="menu-item-btn"
                onClick={() => {
                  setMenuOpen(false);
                  onLoadModel();
                }}
              >
                <span className="menu-item-icon">{ICONS.ul}</span>
                <span className="menu-item-text">Wczytaj</span>
              </button>

              <button
                className="menu-item-btn"
                onClick={() => {
                  setMenuOpen(false);
                  onSaveModel();
                }}
              >
                <span className="menu-item-icon">{ICONS.dl}</span>
                <span className="menu-item-text">Zapisz</span>
              </button>

              <button
                className="menu-item-btn"
                onClick={() => {
                  setMenuOpen(false);
                  onSaveAsModel();
                }}
              >
                <span className="menu-item-icon">{ICONS.saveAs}</span>
                <span className="menu-item-text">Zapisz jako</span>
              </button>

              <div style={{ height: '1px', background: 'var(--surface-border-soft)', margin: '4px 2px' }} />

              <button
                className="menu-item-btn"
                onClick={() => {
                  setMenuOpen(false);
                  onImportJson();
                }}
              >
                <span className="menu-item-icon">{ICONS.importJson}</span>
                <span className="menu-item-text">Importuj json</span>
              </button>

              <button
                className="menu-item-btn"
                onClick={() => {
                  setMenuOpen(false);
                  onExportJson();
                }}
              >
                <span className="menu-item-icon">{ICONS.exportJson}</span>
                <span className="menu-item-text">Eksportuj json</span>
              </button>

              <div style={{ height: '1px', background: 'var(--surface-border-soft)', margin: '4px 2px' }} />

              <button
                className="menu-item-btn"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenOptions();
                }}
              >
                <span className="menu-item-icon">{ICONS.gear}</span>
                <span className="menu-item-text">Opcje</span>
              </button>

              <button
                className="menu-item-btn"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenAbout();
                }}
              >
                <span className="menu-item-icon">{ICONS.info}</span>
                <span className="menu-item-text">O programie</span>
              </button>
            </div>
          )}
        </div>

        <button className="tb-btn" id="btnUndo" onClick={onUndo} disabled={!canUndo} title="Cofnij (Ctrl+Z)">
          {ICONS.undo}
          <span>Cofnij</span>
        </button>
        <button className="tb-btn" id="btnRedo" onClick={onRedo} disabled={!canRedo} title="Ponów (Ctrl+Y)">
          {ICONS.redo}
          <span>Ponów</span>
        </button>
        <div className="tb-sep" />
        <button
          className={`tb-btn ${mode === 'select' ? 'active' : ''}`}
          id="btnModeSelect"
          onClick={() => setMode('select')}
          title="Zaznacz / przesuń (V)"
        >
          {ICONS.select}
          <span>Zaznacz</span>
        </button>
        <button
          className={`tb-btn ${mode === 'addBar' ? 'active' : ''}`}
          id="btnModeDraw"
          onClick={() => setMode('addBar')}
          title="Rysuj pręt / węzeł (R / B)"
        >
          {ICONS.bar}
          <span>Rysuj</span>
        </button>
        <button
          className={`tb-btn ${mode === 'addPanel' ? 'active' : ''}`}
          id="btnModePanel"
          onClick={() => setMode('addPanel')}
          title="Rysuj obrys / okładzinę (O)"
        >
          {ICONS.panel}
          <span>Obrys</span>
        </button>
      </div>

      {/* Kontekstowa grupa narzędzi dla aktywnego trybu (wyświetlana w toolbarze na ekranach poziomych) */}
      {mode === 'select' && (
        <div className="tb-group tb-group-contextual">
          <button
            className={`tb-btn ${navMode === 'boxSelect' ? 'active' : ''}`}
            onClick={() => setNavMode?.(navMode === 'boxSelect' ? 'orbit' : 'boxSelect')}
            title="Zaznaczanie ramką / obszarem (Ramka)"
          >
            {ICONS.boxselect}
            <span>Ramka</span>
          </button>
          <div className="tb-sep" />
          <button
            className={`tb-btn ${effectiveSelMode === 'replace' ? 'active' : ''}`}
            onClick={() => setMobileSelMode?.('replace')}
            title="Wybór zwykły (Zastąp zaznaczenie)"
          >
            {ICONS.selReplace}
            <span>Zwykły</span>
          </button>
          <button
            className={`tb-btn ${effectiveSelMode === 'add' ? 'active' : ''}`}
            onClick={() => setMobileSelMode?.('add')}
            title="Dodaj do zaznaczenia (Ctrl)"
          >
            {ICONS.selAdd}
            <span>Dodaj</span>
          </button>
          <button
            className={`tb-btn ${effectiveSelMode === 'subtract' ? 'active' : ''}`}
            onClick={() => setMobileSelMode?.('subtract')}
            title="Odejmij od zaznaczenia (Shift)"
          >
            {ICONS.selSubtract}
            <span>Odejmij</span>
          </button>
          <button
            className={`tb-btn ${effectiveSelMode === 'toggle' ? 'active' : ''}`}
            onClick={() => setMobileSelMode?.('toggle')}
            title="Odwróć zaznaczenie (Ctrl+Shift)"
          >
            {ICONS.selToggle}
            <span>Odwróć</span>
          </button>
          <div className="tb-sep" />
          <button
            className={`tb-btn ${selectByOpen ? 'active' : ''}`}
            onClick={onOpenSelectBy}
            title="Zaznacz według kryteriów... (długości, profilu, materiału)"
          >
            {ICONS.filterBy}
            <span>Zaznacz wg</span>
          </button>
        </div>
      )}

      {mode === 'addBar' && (
        <div className="tb-group tb-group-contextual">
          <span className="tb-label">Przekrój</span>
          <select
            id="defSectionSel"
            className="tb-select"
            value={defaultSectionId}
            onChange={(e) => setDefaultSectionId(parseInt(e.target.value))}
          >
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <span className="tb-label" style={{ marginLeft: '4px' }}>Materiał</span>
          <select
            id="defMaterialSel"
            className="tb-select"
            value={defaultMaterialId}
            onChange={(e) => setDefaultMaterialId(parseInt(e.target.value))}
          >
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <div className="tb-sep" />
          <button
            className={`tb-btn ${snapEnabled ? 'active' : ''}`}
            id="snapToggleBtn"
            onClick={() => setSnapEnabled(!snapEnabled)}
            title={`Przyciąganie do siatki (${snapSize} m)`}
          >
            {ICONS.grid}
            <span>Przyciągaj</span>
          </button>
          <button
            className={`tb-btn ${allowNewNodesInBarMode ? 'active' : ''}`}
            id="newNodesToggleBtn"
            onClick={() => setAllowNewNodesInBarMode(!allowNewNodesInBarMode)}
            title="Twórz nowe węzły podczas rysowania pręta (Autowęzły)"
          >
            {ICONS.node}
            <span>Autowęzły</span>
          </button>
        </div>
      )}

      {mode === 'addPanel' && (
        <div className="tb-group tb-group-contextual">
          <span className="tb-label">Kształt</span>
          <button
            className={`tb-btn ${panelShape === 'triangle' ? 'active' : ''}`}
            id="btnPanelTriangle"
            onClick={() => setPanelShape?.('triangle')}
            title="Okładzina trójkątna (3 węzły)"
          >
            {ICONS.triangle}
            <span>Trójkąt</span>
          </button>
          <button
            className={`tb-btn ${panelShape === 'rectangle' ? 'active' : ''}`}
            id="btnPanelRectangle"
            onClick={() => setPanelShape?.('rectangle')}
            title="Okładzina prostokątna (2 węzły boku + 3. węzeł szerokości)"
          >
            {ICONS.rectangle}
            <span>Prostokąt</span>
          </button>
          <div className="tb-sep" />
          <button
            className={`tb-btn ${snapEnabled ? 'active' : ''}`}
            onClick={() => setSnapEnabled(!snapEnabled)}
            title={`Przyciąganie do siatki (${snapSize} m)`}
          >
            {ICONS.grid}
            <span>Przyciągaj</span>
          </button>
          <button
            className={`tb-btn ${allowNewNodesInBarMode ? 'active' : ''}`}
            onClick={() => setAllowNewNodesInBarMode(!allowNewNodesInBarMode)}
            title="Twórz nowe węzły podczas rysowania obrysu (Autowęzły)"
          >
            {ICONS.node}
            <span>Autowęzły</span>
          </button>
        </div>
      )}
    </div>
  );
};
