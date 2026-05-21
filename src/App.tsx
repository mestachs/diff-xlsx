import { useState, useCallback } from 'react'
import { FileUpload } from './components/FileUpload'
import { DiffStats } from './components/DiffStats'
import { SheetTab } from './components/SheetTab'
import { SpreadsheetGrid } from './components/SpreadsheetGrid'
import { parseXlsxFile } from './lib/xlsx-parser'
import { diffWorkbooks } from './lib/diff-engine'
import type { ParsedWorkbook } from './types'
import type { DiffResult } from './lib/diff-engine'

export default function App() {
  const [oldFile, setOldFile] = useState<ParsedWorkbook | null>(null)
  const [newFile, setNewFile] = useState<ParsedWorkbook | null>(null)
  const [oldFilename, setOldFilename] = useState<string | undefined>()
  const [newFilename, setNewFilename] = useState<string | undefined>()
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null)
  const [activeSheet, setActiveSheet] = useState<string>('')
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span>⊟</span>
            XLSX Diff Viewer
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Compare two Excel spreadsheets visually</p>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex flex-col gap-6">
        <section className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <FileUpload
            label="Old file (base)"
            filename={oldFilename}
            onFile={handleOldFile}
          />
          <div className="text-2xl font-bold text-slate-400 text-center px-2">vs</div>
          <FileUpload
            label="New file (compare)"
            filename={newFilename}
            onFile={handleNewFile}
          />
        </section>

        {loading && (
          <div className="flex items-center gap-3 text-slate-600 py-2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Parsing spreadsheet...
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg" role="alert">
            {error}
          </div>
        )}

        {!oldFile && !newFile && !loading && (
          <div className="text-center py-20 flex flex-col items-center gap-4 text-slate-500">
            <div className="text-6xl">📊</div>
            <h2 className="text-xl font-semibold text-slate-700">Upload two XLSX files to compare</h2>
            <p className="text-sm max-w-md">Drop files or click the upload areas above. Differences will be highlighted cell by cell.</p>
          </div>
        )}

        {(oldFile || newFile) && !diffResult && !loading && (
          <div className="text-center py-16 flex flex-col items-center gap-3 text-slate-400">
            <div className="text-5xl">⏳</div>
            <p>Upload both files to see the diff</p>
          </div>
        )}

        {diffResult && (
          <section className="flex flex-col gap-4">
            <DiffStats stats={diffResult.totalStats} />

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <SheetTab
                sheets={diffResult.sheets}
                activeSheet={activeSheet}
                onSelect={setActiveSheet}
              />
              <div className="p-4">
                {activeSheetResult ? (
                  <SpreadsheetGrid sheet={activeSheetResult} />
                ) : (
                  <div className="text-center py-8 text-slate-400">Select a sheet above</div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="text-center py-4 text-xs text-slate-400 border-t border-slate-100">
        <p>Browser-only • No data uploaded to any server • Open source</p>
      </footer>
    </div>
  )
}
