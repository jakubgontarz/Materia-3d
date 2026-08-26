import React, { useState, useEffect } from 'react';
import { Node3D, Element3D, Section, Material } from '../fem/types';

export const STORAGE_MODELS_KEY = 'materia_3d_saved_models';

export interface StoredModelRecord {
  id: string;
  name: string;
  updatedAt: string;
  nodesCount: number;
  elementsCount: number;
  data: {
    nodes: Node3D[];
    elements: Element3D[];
    sections: Section[];
    materials: Material[];
    analysisSettings: any;
    defaultSectionId?: number;
    defaultMaterialId?: number;
  };
}

export function getStoredModelsList(): StoredModelRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_MODELS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) {
    console.error('Failed to read models from localStorage', e);
  }
  return [];
}

export function saveStoredModelsList(list: StoredModelRecord[]) {
  try {
    localStorage.setItem(STORAGE_MODELS_KEY, JSON.stringify(list));
  } catch (e) {
    console.error('Failed to save models to localStorage', e);
  }
}

// -------------------------------------------------------------
// SAVE TO BROWSER MEMORY MODAL (Zapisz / Zapisz jako)
// -------------------------------------------------------------
interface SaveLocalModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onConfirmSave: (name: string) => void;
}

export const SaveLocalModal: React.FC<SaveLocalModalProps> = ({
  isOpen,
  onClose,
  currentName,
  onConfirmSave,
}) => {
  const [modelName, setModelName] = useState(currentName || 'model-3d');
  const [overwriteConfirm, setOverwriteConfirm] = useState<{ isOpen: boolean; name: string }>({
    isOpen: false,
    name: '',
  });

  useEffect(() => {
    if (isOpen) {
      setModelName(currentName || 'model-3d');
      setOverwriteConfirm({ isOpen: false, name: '' });
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let name = modelName.trim() || 'model-3d';
    if (name.toLowerCase().endsWith('.json')) {
      name = name.slice(0, -5);
    }
    name = name || 'model-3d';

    const list = getStoredModelsList();
    const exists = list.some((m) => m.name.toLowerCase() === name.toLowerCase());

    if (exists) {
      setOverwriteConfirm({ isOpen: true, name });
    } else {
      onConfirmSave(name);
      onClose();
    }
  };

  return (
    <>
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
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 20px 60px #0008',
            border: '1px solid var(--sidebar-border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid var(--sidebar-border)',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600 }}>Zapisz w pamięci przeglądarki</h2>
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

          <form onSubmit={handleSubmit} style={{ padding: '16px 18px', fontSize: '12.5px' }}>
            <div className="row" style={{ marginBottom: '12px' }}>
              <label style={{ minWidth: '90px' }}>Nazwa modelu</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                style={{ flex: 1 }}
                autoFocus
              />
            </div>
            <div className="muted" style={{ marginBottom: '14px' }}>
              Model zostanie bezpiecznie zapisany w pamięci Twojej przeglądarki (localStorage).
            </div>
            <div className="btnrow" style={{ justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="mini" onClick={onClose}>
                Anuluj
              </button>
              <button type="submit" className="mini on">
                Zapisz
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Nadpisanie - modal potwierdzenia */}
      {overwriteConfirm.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#0f172a99',
            zIndex: 450,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setOverwriteConfirm({ isOpen: false, name: '' })}
        >
          <div
            style={{
              background: 'var(--sidebar-bg)',
              color: 'var(--text)',
              borderRadius: '12px',
              maxWidth: '390px',
              width: '100%',
              boxShadow: '0 20px 60px #0008',
              border: '1px solid var(--sidebar-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: '1px solid var(--sidebar-border)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600 }}>Nadpisanie modelu</h3>
              <button
                onClick={() => setOverwriteConfirm({ isOpen: false, name: '' })}
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
            <div style={{ padding: '16px 18px', fontSize: '12.5px', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 14px 0' }}>
                Model o nazwie <strong>&bdquo;{overwriteConfirm.name}&rdquo;</strong> już istnieje w pamięci przeglądarki.
                <br />
                Czy chcesz go nadpisać?
              </p>
              <div className="btnrow" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="mini"
                  onClick={() => setOverwriteConfirm({ isOpen: false, name: '' })}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  className="mini on"
                  onClick={() => {
                    onConfirmSave(overwriteConfirm.name);
                    setOverwriteConfirm({ isOpen: false, name: '' });
                    onClose();
                  }}
                >
                  Nadpisz
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// -------------------------------------------------------------
// LOAD FROM BROWSER MEMORY MODAL (Wczytaj z pamięci)
// -------------------------------------------------------------
interface LoadLocalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadModel: (record: StoredModelRecord) => void;
}

export const LoadLocalModal: React.FC<LoadLocalModalProps> = ({ isOpen, onClose, onLoadModel }) => {
  const [list, setList] = useState<StoredModelRecord[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: '',
  });

  const refreshList = () => {
    setList(getStoredModelsList());
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
      setDeleteConfirm({ isOpen: false, id: '', name: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, id, name });
  };

  const confirmDelete = () => {
    const updated = list.filter((m) => m.id !== deleteConfirm.id);
    saveStoredModelsList(updated);
    setList(updated);
    setDeleteConfirm({ isOpen: false, id: '', name: '' });
  };

  return (
    <>
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
            maxWidth: '460px',
            width: '100%',
            maxHeight: '85vh',
            boxShadow: '0 20px 60px #0008',
            border: '1px solid var(--sidebar-border)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid var(--sidebar-border)',
              flex: '0 0 auto',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600 }}>Wczytaj model z pamięci</h2>
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

          <div style={{ padding: '16px 18px', fontSize: '12.5px', overflowY: 'auto', flex: '1 1 auto' }}>
            {list.length === 0 ? (
              <div className="muted" style={{ padding: '32px 0', textAlign: 'center' }}>
                Brak zapisanych modeli w pamięci przeglądarki.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '4px 0 16px' }}>
                {list.map((m) => {
                  const d = new Date(m.updatedAt || Date.now());
                  const dateStr =
                    d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '9px 12px',
                        background: 'var(--surface)',
                        border: '1px solid var(--surface-border)',
                        borderRadius: '8px',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                        onClick={() => {
                          onLoadModel(m);
                          onClose();
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '13px',
                            color: 'var(--text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {m.name}
                        </div>
                        <div className="muted" style={{ fontSize: '10.5px', marginTop: '2px' }}>
                          Węzłów: {m.nodesCount ?? m.data?.nodes?.length ?? 0}, Prętów:{' '}
                          {m.elementsCount ?? m.data?.elements?.length ?? 0} • {dateStr}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flex: '0 0 auto' }}>
                        <button
                          className="mini on"
                          onClick={() => {
                            onLoadModel(m);
                            onClose();
                          }}
                          title="Wczytaj ten model"
                          style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600 }}
                        >
                          Wczytaj
                        </button>
                        <button
                          className="mini"
                          onClick={(e) => handleDelete(m.id, m.name, e)}
                          title="Usuń z pamięci"
                          style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            color: 'var(--danger)',
                          }}
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--sidebar-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              flex: '0 0 auto',
            }}
          >
            <button className="mini" onClick={onClose}>
              Zamknij
            </button>
          </div>
        </div>
      </div>

      {/* Potwierdzenie usunięcia */}
      {deleteConfirm.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#0f172a99',
            zIndex: 450,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
        >
          <div
            style={{
              background: 'var(--sidebar-bg)',
              color: 'var(--text)',
              borderRadius: '12px',
              maxWidth: '390px',
              width: '100%',
              boxShadow: '0 20px 60px #0008',
              border: '1px solid var(--sidebar-border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: '1px solid var(--sidebar-border)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600 }}>Usunięcie modelu</h3>
              <button
                onClick={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
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
            <div style={{ padding: '16px 18px', fontSize: '12.5px', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 14px 0' }}>
                Czy na pewno chcesz usunąć model <strong>&bdquo;{deleteConfirm.name}&rdquo;</strong> z pamięci
                przeglądarki?
              </p>
              <div className="btnrow" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="mini"
                  onClick={() => setDeleteConfirm({ isOpen: false, id: '', name: '' })}
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  className="mini danger"
                  style={{ fontWeight: 600 }}
                  onClick={confirmDelete}
                >
                  Usuń
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// -------------------------------------------------------------
// EXPORT JSON TO FILE MODAL (Eksportuj json)
// -------------------------------------------------------------
interface ExportJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  onConfirmExport: (filename: string) => void;
}

export const ExportJsonModal: React.FC<ExportJsonModalProps> = ({
  isOpen,
  onClose,
  currentName,
  onConfirmExport,
}) => {
  const [fileName, setFileName] = useState(currentName || 'model-3d');

  useEffect(() => {
    if (isOpen) {
      setFileName(currentName || 'model-3d');
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let name = fileName.trim() || 'model-3d';
    if (name.toLowerCase().endsWith('.json')) {
      name = name.slice(0, -5);
    }
    name = name || 'model-3d';
    onConfirmExport(name);
    onClose();
  };

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
          maxWidth: '390px',
          width: '100%',
          boxShadow: '0 20px 60px #0008',
          border: '1px solid var(--sidebar-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid var(--sidebar-border)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '14.5px', fontWeight: 600 }}>Eksportuj model do pliku JSON</h2>
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

        <form onSubmit={handleSubmit} style={{ padding: '16px 18px', fontSize: '12.5px' }}>
          <div className="row" style={{ marginBottom: '12px' }}>
            <label style={{ minWidth: '85px' }}>Nazwa pliku</label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              style={{ flex: 1 }}
              autoFocus
            />
            <span className="unit" style={{ width: 'auto', paddingLeft: '4px' }}>
              .json
            </span>
          </div>
          <div className="muted" style={{ marginBottom: '14px' }}>
            Plik zostanie pobrany w formacie JSON z pełną geometrią 3D, przekrojami, materiałami, podporami i obciążeniami.
          </div>
          <div className="btnrow" style={{ justifyContent: 'flex-end', gap: '8px' }}>
            <button type="button" className="mini" onClick={onClose}>
              Anuluj
            </button>
            <button type="submit" className="mini on">
              Pobierz plik
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
