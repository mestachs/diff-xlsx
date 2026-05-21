import { useState, useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { SheetDiffResult, CellDiff } from '../lib/diff-engine'
import type { CellStyle, ParsedCell } from '../types'
import { InlineDiff } from './InlineDiff'

interface SpreadsheetGridProps {
  sheet: SheetDiffResult;
  selectedAddr?: string;
  onCellClick?: (addr: string, diff: CellDiff | undefined) => void;
}

type TextMode = 'overflow' | 'wrap' | 'clip'

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

export function cellDisplay(cell: ParsedCell | undefined): string {
  if (!cell) return ''
  if (cell.formula) return `=${cell.formula}`
  if (cell.formatted) return cell.formatted
  if (cell.value === null || cell.value === undefined) return ''
  return String(cell.value)
}

// Diff background classes used when styled mode is OFF
const diffBg: Record<CellDiff['status'], string> = {
  added:     'bg-emerald-50',
  removed:   'bg-red-50',
  changed:   'bg-amber-50',
  unchanged: '',
}

// Left-border indicator used when styled mode is ON
const diffBorder: Record<CellDiff['status'], string> = {
  added:     'border-l-[3px] border-l-emerald-500',
  removed:   'border-l-[3px] border-l-red-500',
  changed:   'border-l-[3px] border-l-amber-500',
  unchanged: '',
}

function cellStyleToCss(style: CellStyle | undefined): CSSProperties {
  if (!style) return {}
  const css: CSSProperties = {}
  if (style.bgColor) css.backgroundColor = `#${style.bgColor}`
  if (style.color) css.color = `#${style.color}`
  if (style.bold) css.fontWeight = 'bold'
  if (style.italic) css.fontStyle = 'italic'
  if (style.underline) css.textDecoration = 'underline'
  if (style.fontSize) css.fontSize = `${Math.round(style.fontSize * 1.25)}px`
  if (style.align) css.textAlign = style.align as CSSProperties['textAlign']
  return css
}

function CellContent({ diff, showStyles }: { diff: CellDiff | undefined; showStyles: boolean }) {
  const colorless = showStyles
  if (!diff || diff.status === 'unchanged') {
    return <span className={colorless ? '' : 'text-slate-800'}>{cellDisplay(diff?.oldCell)}</span>
  }
  if (diff.status === 'added') {
    return <span className={colorless ? '' : 'text-emerald-800 font-medium'}>{cellDisplay(diff.newCell)}</span>
  }
  if (diff.status === 'removed') {
    return <s className={colorless ? '' : 'text-red-700'}>{cellDisplay(diff.oldCell)}</s>
  }
  return <InlineDiff oldText={cellDisplay(diff.oldCell)} newText={cellDisplay(diff.newCell)} className="text-xs" />
}

// For each row in overflow mode, build a colspan array: number = span, null = covered by left neighbour
function buildColspans(
  row: number,
  cols: number[],
  cellDiffs: Record<string, CellDiff>,
): Array<number | null> {
  const spans: Array<number | null> = []
  let i = 0
  while (i < cols.length) {
    const addr = `${colIndexToLetter(cols[i]!)}${row + 1}`
    const text = cellDisplay(cellDiffs[addr]?.newCell ?? cellDiffs[addr]?.oldCell)
    if (text) {
      let span = 1
      for (let j = i + 1; j < cols.length; j++) {
        const nAddr = `${colIndexToLetter(cols[j]!)}${row + 1}`
        const nText = cellDisplay(cellDiffs[nAddr]?.newCell ?? cellDiffs[nAddr]?.oldCell)
        if (!nText) span++
        else break
      }
      spans.push(span)
      for (let k = 1; k < span; k++) spans.push(null)
      i += span
    } else {
      spans.push(1)
      i++
    }
  }
  return spans
}

const statItemClass: Record<string, string> = {
  added:     'bg-emerald-100 text-emerald-800 rounded px-2 py-0.5 text-xs font-medium',
  removed:   'bg-red-100 text-red-800 rounded px-2 py-0.5 text-xs font-medium',
  changed:   'bg-amber-100 text-amber-800 rounded px-2 py-0.5 text-xs font-medium',
  unchanged: 'bg-slate-100 text-slate-600 rounded px-2 py-0.5 text-xs font-medium',
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-0.5 rounded border transition-colors ${
        active
          ? 'bg-slate-700 text-white border-slate-700'
          : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
      }`}
    >
      {children}
    </button>
  )
}

export function SpreadsheetGrid({ sheet, selectedAddr, onCellClick }: SpreadsheetGridProps) {
  const { cellDiffs, range, stats } = sheet
  const [hideUnchanged, setHideUnchanged] = useState(false)
  const [showStyles, setShowStyles] = useState(false)
  const [textMode, setTextMode] = useState<TextMode>('clip')

  const isEmpty = range.maxRow < range.minRow || range.maxCol < range.minCol || Object.keys(cellDiffs).length === 0

  const cols = useMemo(() => {
    const c: number[] = []
    for (let i = range.minCol; i <= range.maxCol; i++) c.push(i)
    return c
  }, [range.minCol, range.maxCol])

  const rows = useMemo(() => {
    const all: number[] = []
    for (let r = range.minRow; r <= range.maxRow; r++) all.push(r)
    if (!hideUnchanged) return all
    return all.filter((r) =>
      cols.some((c) => {
        const diff = cellDiffs[`${colIndexToLetter(c)}${r + 1}`]
        return diff && diff.status !== 'unchanged'
      }),
    )
  }, [range.minRow, range.maxRow, hideUnchanged, cols, cellDiffs])

  // Precompute colspans for every visible row (only used in overflow mode)
  const colspansByRow = useMemo<Map<number, Array<number | null>>>(() => {
    if (textMode !== 'overflow') return new Map()
    const map = new Map<number, Array<number | null>>()
    for (const r of rows) map.set(r, buildColspans(r, cols, cellDiffs))
    return map
  }, [textMode, rows, cols, cellDiffs])

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-1 shrink-0">
        <span className={statItemClass.added}>+{stats.added} added</span>
        <span className={statItemClass.removed}>−{stats.removed} removed</span>
        <span className={statItemClass.changed}>~{stats.changed} changed</span>
        <span className={statItemClass.unchanged}>{stats.unchanged} unchanged</span>

        <div className="ml-auto flex gap-2 items-center">
          {/* text overflow mode */}
          <div className="flex text-xs border border-slate-300 rounded overflow-hidden">
            {(['overflow', 'wrap', 'clip'] as TextMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setTextMode(mode)}
                className={`px-2.5 py-0.5 transition-colors border-r last:border-r-0 border-slate-300 ${
                  textMode === mode ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <ToggleButton active={showStyles} onClick={() => setShowStyles((v) => !v)}>
            {showStyles ? 'Hide styles' : 'Show styles'}
          </ToggleButton>
          <ToggleButton active={hideUnchanged} onClick={() => setHideUnchanged((v) => !v)}>
            {hideUnchanged ? 'Show all rows' : 'Hide unchanged rows'}
          </ToggleButton>
        </div>
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
              {rows.map((r) => {
                const spans = colspansByRow.get(r)
                return (
                  <tr key={r} className="hover:brightness-95">
                    <td className="px-2 py-1 bg-slate-50 border border-slate-200 text-slate-400 text-xs text-right sticky left-0 select-none">
                      {r + 1}
                    </td>
                    {cols.map((c, i) => {
                      // In overflow mode, skip cells that are covered by a left neighbour's colspan
                      if (spans && spans[i] === null) return null

                      const colSpan = spans?.[i] ?? 1
                      const addr = `${colIndexToLetter(c)}${r + 1}`
                      const diff = cellDiffs[addr]
                      const isSelected = addr === selectedAddr

                      // Per-cell text mode: honour wrapText from style when showStyles is on
                      const styleCell = diff?.newCell ?? diff?.oldCell
                      const effectiveMode: TextMode =
                        showStyles && styleCell?.style?.wrapText ? 'wrap' : textMode

                      const textClass =
                        effectiveMode === 'clip' ? 'truncate max-w-[20rem]' :
                        effectiveMode === 'wrap' ? 'whitespace-normal break-words overflow-hidden max-w-[20rem]' :
                        'whitespace-nowrap' // overflow — colspan handles visual extent

                      const inlineStyle = showStyles ? cellStyleToCss(styleCell?.style) : undefined

                      const bgClass = isSelected
                        ? 'bg-blue-50'
                        : showStyles ? '' : (diff ? diffBg[diff.status] : 'bg-white')

                      const borderClass = isSelected
                        ? 'border-blue-400 ring-1 ring-inset ring-blue-400'
                        : showStyles && diff && diff.status !== 'unchanged'
                          ? `border-slate-200 ${diffBorder[diff.status]}`
                          : 'border-slate-200'

                      return (
                        <td
                          key={c}
                          colSpan={colSpan > 1 ? colSpan : undefined}
                          onClick={() => onCellClick?.(addr, diff)}
                          className={`px-2 py-1 border cursor-pointer transition-colors ${textClass} ${bgClass} ${borderClass}`}
                          style={inlineStyle}
                        >
                          <CellContent diff={diff} showStyles={showStyles} />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
