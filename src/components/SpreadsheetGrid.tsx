import { useState } from 'react'
import type { SheetDiffResult, CellDiff } from '../lib/diff-engine'
import type { ParsedCell } from '../types'
import { InlineDiff } from './InlineDiff'

interface SpreadsheetGridProps {
  sheet: SheetDiffResult;
  selectedAddr?: string;
  onCellClick?: (addr: string, diff: CellDiff | undefined) => void;
}

function colIndexToLetter(col: number): string {
  let letter = ''
  let n = col + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}

function cellDisplay(cell: ParsedCell | undefined): string {
  if (!cell) return ''
  if (cell.formula) return `=${cell.formula}`
  if (cell.formatted) return cell.formatted
  if (cell.value === null || cell.value === undefined) return ''
  return String(cell.value)
}

const cellBg: Record<CellDiff['status'], string> = {
  added: 'bg-emerald-50',
  removed: 'bg-red-50',
  changed: 'bg-amber-50',
  unchanged: '',
}

function CellContent({ diff }: { diff: CellDiff | undefined }) {
  if (!diff || diff.status === 'unchanged') {
    return <span className="text-slate-800">{cellDisplay(diff?.oldCell)}</span>
  }

  if (diff.status === 'added') {
    return <span className="text-emerald-800 font-medium">{cellDisplay(diff.newCell)}</span>
  }

  if (diff.status === 'removed') {
    return <s className="text-red-700">{cellDisplay(diff.oldCell)}</s>
  }

  // changed: inline char diff
  return <InlineDiff oldText={cellDisplay(diff.oldCell)} newText={cellDisplay(diff.newCell)} className="text-xs" />
}

const statItemClass: Record<string, string> = {
  added: 'bg-emerald-100 text-emerald-800 rounded px-2 py-0.5 text-xs font-medium',
  removed: 'bg-red-100 text-red-800 rounded px-2 py-0.5 text-xs font-medium',
  changed: 'bg-amber-100 text-amber-800 rounded px-2 py-0.5 text-xs font-medium',
  unchanged: 'bg-slate-100 text-slate-600 rounded px-2 py-0.5 text-xs font-medium',
}

export function SpreadsheetGrid({ sheet, selectedAddr, onCellClick }: SpreadsheetGridProps) {
  const { cellDiffs, range, stats } = sheet
  const [hideUnchanged, setHideUnchanged] = useState(false)

  const isEmpty = range.maxRow < range.minRow || range.maxCol < range.minCol || Object.keys(cellDiffs).length === 0

  const cols: number[] = []
  for (let c = range.minCol; c <= range.maxCol; c++) cols.push(c)

  const allRows: number[] = []
  for (let r = range.minRow; r <= range.maxRow; r++) allRows.push(r)

  const rows = hideUnchanged
    ? allRows.filter((r) =>
        cols.some((c) => {
          const diff = cellDiffs[`${colIndexToLetter(c)}${r + 1}`]
          return diff && diff.status !== 'unchanged'
        }),
      )
    : allRows

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="flex flex-wrap items-center gap-2 px-1 shrink-0">
        <span className={statItemClass.added}>+{stats.added} added</span>
        <span className={statItemClass.removed}>−{stats.removed} removed</span>
        <span className={statItemClass.changed}>~{stats.changed} changed</span>
        <span className={statItemClass.unchanged}>{stats.unchanged} unchanged</span>
        <button
          onClick={() => setHideUnchanged((v) => !v)}
          className={`ml-auto text-xs px-3 py-0.5 rounded border transition-colors ${
            hideUnchanged
              ? 'bg-slate-700 text-white border-slate-700'
              : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
          }`}
        >
          {hideUnchanged ? 'Show all rows' : 'Hide unchanged rows'}
        </button>
      </div>

      {isEmpty ? (
        <div className="py-10 text-center text-slate-400 italic text-sm">
          {sheet.status === 'added' ? 'Sheet added — empty' : sheet.status === 'removed' ? 'Sheet removed — empty' : 'No data'}
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200 flex-1 min-h-0">
          <table className="border-collapse text-sm font-mono">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="px-2 py-1.5 bg-slate-100 border border-slate-300 text-slate-400 text-xs text-right min-w-[3rem] sticky left-0 z-20" />
                {cols.map((c) => (
                  <th key={c} className="px-3 py-1.5 bg-slate-100 border border-slate-300 text-slate-600 text-xs font-semibold text-center min-w-[6rem]">
                    {colIndexToLetter(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r} className="hover:brightness-95">
                  <td className="px-2 py-1 bg-slate-50 border border-slate-200 text-slate-400 text-xs text-right sticky left-0 select-none">
                    {r + 1}
                  </td>
                  {cols.map((c) => {
                    const addr = `${colIndexToLetter(c)}${r + 1}`
                    const diff = cellDiffs[addr]
                    const isSelected = addr === selectedAddr
                    return (
                      <td
                        key={c}
                        onClick={() => onCellClick?.(addr, diff)}
                        className={`px-2 py-1 border whitespace-pre-wrap max-w-[20rem] cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-blue-400 bg-blue-50 ring-1 ring-inset ring-blue-400'
                            : `border-slate-100 ${diff ? cellBg[diff.status] : 'bg-white'} hover:brightness-95`
                        }`}
                      >
                        <CellContent diff={diff} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
