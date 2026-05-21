import { useState, useCallback } from 'react'
import { FileUpload } from './components/FileUpload'
import { DiffStats } from './components/DiffStats'
import { SheetTab } from './components/SheetTab'
import { SpreadsheetGrid } from './components/SpreadsheetGrid'
import { DiffTable } from './components/DiffTable'
import { CellDetail } from './components/CellDetail'
import { parseXlsxFile } from './lib/xlsx-parser'
import { diffWorkbooks } from './lib/diff-engine'
import type { ParsedWorkbook } from './types'
import type { DiffResult, CellDiff } from './lib/diff-engine'

type ViewMode = 'grid' | 'table'

interface SelectedCell {
  sheetName: string;
  addr: string;
  diff: CellDiff;
}

export default function App() {
  const [oldFile, setOldFile] = useState<ParsedWorkbook | null>(null)
  const [newFile, setNewFile] = useState<ParsedWorkbook | null>(null)
  const [oldFilename, setOldFilename] = useState<string | undefined>()
  const [newFilename, setNewFilename] = useState<string | undefined>()
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [activeSheet, setActiveSheet] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleOldFile = useCallback(async (file: File) => {
    try {
      setLoading(true)
      setError(null)
      const wb = await parseXlsxFile(file)
      setOldFile(wb)
      setOldFilename(file.name)
      setNewFile((prev) => {
        if (prev) {
          const result = diffWorkbooks(wb, prev)
          setDiffResult(result)
          setActiveSheet(result.sheets[0]?.sheetName ?? '')
        }
        return prev
      })
    } catch (e) {
      setError(`Failed to parse file: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleNewFile = useCallback(async (file: File) => {
    try {
      setLoading(true)
      setError(null)
      const wb = await parseXlsxFile(file)
      setNewFile(wb)
      setNewFilename(file.name)
      setOldFile((prev) => {
        if (prev) {
          const result = diffWorkbooks(prev, wb)
          setDiffResult(result)
          setActiveSheet(result.sheets[0]?.sheetName ?? '')
        }
        return prev
      })
    } catch (e) {
      setError(`Failed to parse file: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const activeSheetResult = diffResult?.sheets.find((s) => s.sheetName === activeSheet)

  const handleSheetSelect = useCallback((name: string) => {
    setActiveSheet(name)
    setSelectedCell(null)
  }, [])

  const handleCellClick = useCallback((addr: string, diff: CellDiff | undefined) => {
    if (!diff) return
    setSelectedCell({ sheetName: activeSheet, addr, diff })
  }, [activeSheet])

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-900 overflow-hidden">

      {/* compact top bar */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-4">
        <h1 className="font-bold text-slate-900 flex items-center gap-1.5 shrink-0">
          <span>⊟</span> XLSX Diff Viewer
        </h1>
        <div className="flex-1 grid grid-cols-[1fr_auto_1fr] gap-2 items-center max-w-3xl">
          <FileUpload label="Old file" filename={oldFilename} onFile={handleOldFile} />
          <span className="text-slate-400 font-bold text-sm px-1">vs</span>
          <FileUpload label="New file" filename={newFilename} onFile={handleNewFile} />
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500 shrink-0">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Parsing…
          </div>
        )}
      </header>

      <main className="flex-1 min-h-0 flex flex-col px-4 py-3 gap-3 overflow-hidden">

        {error && (
          <div className="shrink-0 bg-red-50 border border-red-200 text-red-800 px-4 py-2 rounded-lg text-sm" role="alert">
            {error}
          </div>
        )}

        {!oldFile && !newFile && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="text-5xl">📊</div>
            <p className="text-sm">Upload two XLSX files above to compare them</p>
          </div>
        )}

        {(oldFile || newFile) && !diffResult && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="text-4xl">⏳</div>
            <p className="text-sm">Upload both files to see the diff</p>
          </div>
        )}

        {diffResult && (
          <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
            <div className="flex gap-3 items-stretch shrink-0">
              <DiffStats stats={diffResult.totalStats} />
              {selectedCell && (
                <CellDetail
                  sheetName={selectedCell.sheetName}
                  addr={selectedCell.addr}
                  diff={selectedCell.diff}
                  onClose={() => setSelectedCell(null)}
                />
              )}
            </div>

            <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">

              {/* toolbar: Grid / Changes toggle */}
              <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-slate-200 bg-slate-50">
                {(['grid', 'table'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      viewMode === mode
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                    }`}
                  >
                    {mode === 'grid' ? 'Grid' : 'Changes'}
                  </button>
                ))}
              </div>

              {/* sheet tabs — wrapping, only in grid mode */}
              {viewMode === 'grid' && (
                <SheetTab
                  sheets={diffResult.sheets}
                  activeSheet={activeSheet}
                  onSelect={handleSheetSelect}
                />
              )}

              {/* content fills the rest */}
              <div className="flex-1 min-h-0 overflow-hidden p-3">
                {viewMode === 'table' ? (
                  <DiffTable result={diffResult} />
                ) : activeSheetResult ? (
                  <SpreadsheetGrid
                    sheet={activeSheetResult}
                    selectedAddr={selectedCell?.addr}
                    onCellClick={handleCellClick}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    Select a sheet above
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  )
}
