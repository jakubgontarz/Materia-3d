import React, { useState } from 'react';
import {
  generate3DPortalFrame,
  generate3DTrussTower,
  generate3DGrillage,
  generate2DPortalFrame,
} from '../fem/templates';
import { Node3D, Element3D } from '../fem/types';
import { Box, Layers, Grid3X3, Square, X } from 'lucide-react';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (nodes: Node3D[], elements: Element3D[]) => void;
  defaultSectionId: number;
  defaultMaterialId: number;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onApplyTemplate,
  defaultSectionId,
  defaultMaterialId,
}) => {
  const [selectedType, setSelectedType] = useState<'portal3d' | 'tower3d' | 'grillage3d' | 'portal2d'>('portal3d');

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

  if (!isOpen) return null;

  const handleGenerate = () => {
    let result: { nodes: Node3D[]; elements: Element3D[] };
    if (selectedType === 'portal3d') {
      result = generate3DPortalFrame(bayX, bayY, frameHeight, numBaysX, numBaysY, defaultSectionId, defaultMaterialId);
    } else if (selectedType === 'tower3d') {
      result = generate3DTrussTower(towerBase, towerTop, towerHeight, towerStories, defaultSectionId, defaultMaterialId);
    } else if (selectedType === 'grillage3d') {
      result = generate3DGrillage(grillWidthX, grillWidthY, grillDivX, grillDivY, defaultSectionId, defaultMaterialId);
    } else {
      result = generate2DPortalFrame(span2D, height2D, defaultSectionId, defaultMaterialId);
    }
    onApplyTemplate(result.nodes, result.elements);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Box className="h-5 w-5 text-blue-500" />
            <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-200">
              Generator Szablonów Konstrukcji 3D i 2D
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {/* Template Selection Tabs */}
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              onClick={() => setSelectedType('portal3d')}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center transition-all ${
                selectedType === 'portal3d'
                  ? 'border-blue-500 bg-blue-500/15 text-blue-400 font-semibold'
                  : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Layers className="h-5 w-5" />
              <span>Rama 3D</span>
            </button>

            <button
              onClick={() => setSelectedType('tower3d')}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center transition-all ${
                selectedType === 'tower3d'
                  ? 'border-blue-500 bg-blue-500/15 text-blue-400 font-semibold'
                  : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Box className="h-5 w-5" />
              <span>Wieża 3D</span>
            </button>

            <button
              onClick={() => setSelectedType('grillage3d')}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center transition-all ${
                selectedType === 'grillage3d'
                  ? 'border-blue-500 bg-blue-500/15 text-blue-400 font-semibold'
                  : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Grid3X3 className="h-5 w-5" />
              <span>Ruszt 3D</span>
            </button>

            <button
              onClick={() => setSelectedType('portal2d')}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center transition-all ${
                selectedType === 'portal2d'
                  ? 'border-blue-500 bg-blue-500/15 text-blue-400 font-semibold'
                  : 'border-slate-800 bg-slate-800/40 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Square className="h-5 w-5" />
              <span>Rama 2D</span>
            </button>
          </div>

          {/* Form Fields according to template */}
          {selectedType === 'portal3d' && (
            <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-800/30 p-4">
              <h3 className="font-semibold text-slate-200">Przestrzenna rama portalowa 3D (hala / szkielet)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-slate-400">Rozpiętość nawy X [m]</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={bayX}
                    onChange={(e) => setBayX(parseFloat(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">Rozstaw ram Y [m]</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={bayY}
                    onChange={(e) => setBayY(parseFloat(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">Liczba naw X</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="10"
                    value={numBaysX}
                    onChange={(e) => setNumBaysX(parseInt(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">Liczba przęseł Y</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="10"
                    value={numBaysY}
                    onChange={(e) => setNumBaysY(parseInt(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-slate-400">Wysokość słupów H [m]</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={frameHeight}
                    onChange={(e) => setFrameHeight(parseFloat(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedType === 'tower3d' && (
            <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-800/30 p-4">
              <h3 className="font-semibold text-slate-200">Przestrzenna wieża kratowa 3D ze stężeniami X</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-slate-400">Szerokość podstawy [m]</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={towerBase}
                    onChange={(e) => setTowerBase(parseFloat(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">Szerokość głowicy [m]</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={towerTop}
                    onChange={(e) => setTowerTop(parseFloat(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">Wysokość całkowita [m]</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="1.0"
                    value={towerHeight}
                    onChange={(e) => setTowerHeight(parseFloat(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">Liczba segmentów / kondygnacji</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="12"
                    value={towerStories}
                    onChange={(e) => setTowerStories(parseInt(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedType === 'grillage3d' && (
            <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-800/30 p-4">
              <h3 className="font-semibold text-slate-200">Ruszt belkowy stropowy 3D</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-slate-400">Szerokość X [m]</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="1.0"
                    value={grillWidthX}
                    onChange={(e) => setGrillWidthX(parseFloat(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">Długość Y [m]</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="1.0"
                    value={grillWidthY}
                    onChange={(e) => setGrillWidthY(parseFloat(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">Podział wzdłuż X</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="10"
                    value={grillDivX}
                    onChange={(e) => setGrillDivX(parseInt(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">Podział wzdłuż Y</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="10"
                    value={grillDivY}
                    onChange={(e) => setGrillDivY(parseInt(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedType === 'portal2d' && (
            <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-800/30 p-4">
              <h3 className="font-semibold text-slate-200">Rama portalowa 2D w płaszczyźnie pionowej XZ</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-slate-400">Rozpiętość L [m]</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={span2D}
                    onChange={(e) => setSpan2D(parseFloat(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-slate-400">Wysokość H [m]</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={height2D}
                    onChange={(e) => setHeight2D(parseFloat(e.target.value) || 1)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-slate-200 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            Anuluj
          </button>
          <button
            onClick={handleGenerate}
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-sm"
          >
            Wstaw szablon
          </button>
        </div>
      </div>
    </div>
  );
};
