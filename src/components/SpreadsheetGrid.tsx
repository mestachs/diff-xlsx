import type { SheetDiffResult, CellDiff } from '../lib/diff-engine'
import type { ParsedCell } from '../types'

interface SpreadsheetGridProps {
  sheet: SheetDiffResult;
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

  // changed: show old → new (formula takes priority over computed value)
  const oldText = cellDisplay(diff.oldCell)
  const newText = cellDisplay(diff.newCell)
  return (
    <span className="flex flex-col gap-0.5 text-xs">
      <s className="text-red-500 opacity-80">{oldText}</s>
      <span className="text-emerald-700 font-semibold">{newText}</span>
    </span>
  )
}

const statItemClass: Record<string, string> = {
  added: 'bg-emerald-100 text-emerald-800 rounded px-2 py-0.5 text-xs font-medium',
  removed: 'bg-red-100 text-red-800 rounded px-2 py-0.5 text-xs font-medium',
  changed: 'bg-amber-100 text-amber-800 rounded px-2 py-0.5 text-xs font-medium',
  unchanged: 'bg-slate-100 text-slate-600 rounded px-2 py-0.5 text-xs font-medium',
}

export function SpreadsheetGrid({ sheet }: SpreadsheetGridProps) {
  const { cellDiffs, range, stats } = sheet

  const isEmpty = range.maxRow < range.minRow || range.maxCol < range.minCol || Object.keys(cellDiffs).length === 0

  const cols: number[] = []
  for (let c = range.minCol; c <= range.maxCol; c++) cols.push(c)

  const rows: number[] = []
  for (let r = range.minRow; r <= range.maxRow; r++) rows.push(r)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 px-1">
        <span className={statItemClass.added}>+{stats.added} added</span>
        <span className={statItemClass.removed}>−{stats.removed} removed</span>
        <span className={statItemClass.changed}>~{stats.changed} changed</span>
        <span className={statItemClass.unchanged}>{stats.unchanged} unchanged</span>
      </div>

      {isEmpty ? (
        <div className="py-10 text-center text-slate-400 italic text-sm">
          {sheet.status === 'added' ? 'Sheet added — empty' : sheet.status === 'removed' ? 'Sheet removed — empty' : 'No data'}
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-slate-200 max-h-[70vh]">
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
                    return (
                      <td
                        key={c}
                        className={`px-2 py-1 border border-slate-100 whitespace-pre-wrap max-w-[20rem] ${diff ? cellBg[diff.status] : 'bg-white'}`}
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
