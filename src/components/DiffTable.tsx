import { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import type { DiffResult, CellDiff } from '../lib/diff-engine'
import type { ParsedCell } from '../types'
import { InlineDiff } from './InlineDiff'

interface DiffRow {
  sheetName: string;
  address: string;
  row: number;
  col: number;
  changeType: 'added' | 'removed' | 'formula' | 'value';
  oldValue: string;
  newValue: string;
}

function cellDisplay(cell: ParsedCell | undefined): string {
  if (!cell) return ''
  if (cell.formula) return `=${cell.formula}`
  if (cell.formatted) return cell.formatted
  if (cell.value === null || cell.value === undefined) return ''
  return String(cell.value)
}

function parseAddress(addr: string): { row: number; col: number } {
  const match = addr.match(/^([A-Z]+)(\d+)$/)
  if (!match) return { row: 0, col: 0 }
  let col = 0
  for (let i = 0; i < match[1]!.length; i++) col = col * 26 + (match[1]!.charCodeAt(i) - 64)
  return { row: parseInt(match[2]!, 10), col }
}

function getChangeType(diff: CellDiff): DiffRow['changeType'] {
  if (diff.status === 'added') return 'added'
  if (diff.status === 'removed') return 'removed'
  if (diff.oldCell?.formula || diff.newCell?.formula) return 'formula'
  return 'value'
}

const ALL_TYPES = ['added', 'removed', 'formula', 'value'] as const

const typeBadge: Record<DiffRow['changeType'], string> = {
  added:   'bg-emerald-100 text-emerald-800',
  removed: 'bg-red-100 text-red-800',
  formula: 'bg-violet-100 text-violet-800',
  value:   'bg-amber-100 text-amber-800',
}

const ROW_HEIGHT = 34
const BUFFER = 12

interface DiffTableProps {
  result: DiffResult;
}

export function DiffTable({ result }: DiffTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(400)
  const [sheetFilter, setSheetFilter] = useState('all')
  const [activeTypes, setActiveTypes] = useState<Set<DiffRow['changeType']>>(new Set(ALL_TYPES))
  const [textFilter, setTextFilter] = useState('')

  // Build and sort rows once per result
  const allRows = useMemo<DiffRow[]>(() => {
    const rows: DiffRow[] = []
    for (const sheet of result.sheets) {
      for (const [addr, diff] of Object.entries(sheet.cellDiffs)) {
        if (diff.status === 'unchanged') continue
        const { row, col } = parseAddress(addr)
        rows.push({
          sheetName: sheet.sheetName,
          address: addr,
          row,
          col,
          changeType: getChangeType(diff),
          oldValue: cellDisplay(diff.oldCell),
          newValue: cellDisplay(diff.newCell),
        })
      }
    }
    rows.sort((a, b) => {
      const s = a.sheetName.localeCompare(b.sheetName)
      if (s !== 0) return s
      if (a.row !== b.row) return a.row - b.row
      return a.col - b.col
    })
    return rows
  }, [result])

  const sheetNames = useMemo(
    () => [...new Set(allRows.map((r) => r.sheetName))].sort(),
    [allRows],
  )

  const filteredRows = useMemo(() => {
    const needle = textFilter.toLowerCase().trim()
    return allRows.filter((r) =>
      (sheetFilter === 'all' || r.sheetName === sheetFilter) &&
      activeTypes.has(r.changeType) &&
      (!needle ||
        r.sheetName.toLowerCase().includes(needle) ||
        r.oldValue.toLowerCase().includes(needle) ||
        r.newValue.toLowerCase().includes(needle)),
    )
  }, [allRows, sheetFilter, activeTypes, textFilter])

  // Measure container height for virtual scrolling
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setViewHeight(el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Reset scroll when filters change
  useEffect(() => {
    setScrollTop(0)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [sheetFilter, activeTypes, textFilter])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const toggleType = useCallback((type: DiffRow['changeType']) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
  }, [])

  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER)
  const endIdx = Math.min(filteredRows.length, Math.ceil((scrollTop + viewHeight) / ROW_HEIGHT) + BUFFER)
  const visibleRows = filteredRows.slice(startIdx, endIdx)
  const paddingTop = startIdx * ROW_HEIGHT
  const paddingBottom = Math.max(0, (filteredRows.length - endIdx) * ROW_HEIGHT)

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">🔍</span>
          <input
            type="text"
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value)}
            placeholder="Search sheet, formula, value…"
            className="pl-7 pr-7 py-1 text-sm border border-slate-300 rounded bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 w-56"
          />
          {textFilter && (
            <button
              onClick={() => setTextFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs leading-none"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <select
          value={sheetFilter}
          onChange={(e) => setSheetFilter(e.target.value)}
          className="text-sm border border-slate-300 rounded px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="all">All sheets</option>
          {sheetNames.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {ALL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`px-2.5 py-0.5 rounded text-xs font-medium border transition-opacity ${
                activeTypes.has(type)
                  ? `${typeBadge[type]} border-transparent`
                  : 'bg-slate-100 text-slate-400 border-slate-200 opacity-50'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-slate-400">
          {filteredRows.length.toLocaleString()} / {allRows.length.toLocaleString()} changes
        </span>
      </div>

      {/* virtual-scrolled table */}
      <div className="rounded-lg border border-slate-200 overflow-hidden flex-1 min-h-0 flex flex-col">
        {/* sticky header */}
        <div className="grid bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-600"
          style={{ gridTemplateColumns: '160px 72px 100px 1fr' }}>
          <span className="px-3 py-2 border-r border-slate-200">Sheet</span>
          <span className="px-3 py-2 border-r border-slate-200">Cell</span>
          <span className="px-3 py-2 border-r border-slate-200">Type</span>
          <span className="px-3 py-2">Change</span>
        </div>

        {/* scrollable body */}
        <div
          ref={scrollRef}
          className="overflow-y-auto flex-1 min-h-0"
          onScroll={handleScroll}
        >
          {filteredRows.length === 0 ? (
            <div className="py-16 text-center text-slate-400 italic text-sm">No changes match the current filters</div>
          ) : (
            <>
              <div style={{ height: paddingTop }} />
              {visibleRows.map((row, i) => (
                <div
                  key={startIdx + i}
                  className="grid border-b border-slate-100 hover:bg-slate-50 text-xs"
                  style={{ gridTemplateColumns: '160px 72px 100px 1fr', minHeight: ROW_HEIGHT }}
                >
                  <span className="px-3 py-1.5 flex items-center border-r border-slate-100 text-slate-500 font-mono truncate">
                    {row.sheetName}
                  </span>
                  <span className="px-3 py-1.5 flex items-center border-r border-slate-100 text-slate-700 font-mono font-semibold">
                    {row.address}
                  </span>
                  <span className="px-3 py-1.5 flex items-center border-r border-slate-100">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${typeBadge[row.changeType]}`}>
                      {row.changeType}
                    </span>
                  </span>
                  <span className="px-3 py-1.5 flex items-center overflow-hidden">
                    {row.changeType === 'added' && (
                      <ins className="text-emerald-800 no-underline font-mono truncate">{row.newValue}</ins>
                    )}
                    {row.changeType === 'removed' && (
                      <del className="text-red-700 font-mono truncate">{row.oldValue}</del>
                    )}
                    {(row.changeType === 'formula' || row.changeType === 'value') && (
                      <InlineDiff oldText={row.oldValue} newText={row.newValue} />
                    )}
                  </span>
                </div>
              ))}
              <div style={{ height: paddingBottom }} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
