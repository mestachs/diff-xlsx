import { InlineDiff } from './InlineDiff'
import type { CellDiff } from '../lib/diff-engine'
import type { ParsedCell } from '../types'

function cellDisplay(cell: ParsedCell | undefined): string {
  if (!cell) return ''
  if (cell.formula) return `=${cell.formula}`
  if (cell.formatted) return cell.formatted
  if (cell.value === null || cell.value === undefined) return ''
  return String(cell.value)
}

const statusBadge: Record<CellDiff['status'], string> = {
  added:     'bg-emerald-100 text-emerald-800',
  removed:   'bg-red-100 text-red-800',
  changed:   'bg-amber-100 text-amber-800',
  unchanged: 'bg-slate-100 text-slate-600',
}

interface CellDetailProps {
  sheetName: string;
  addr: string;
  diff: CellDiff;
  onClose: () => void;
}

export function CellDetail({ sheetName, addr, diff, onClose }: CellDetailProps) {
  const oldText = cellDisplay(diff.oldCell)
  const newText = cellDisplay(diff.newCell)

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-3 py-2 flex flex-col gap-2 min-w-64 max-w-xl flex-1">
      {/* header */}
      <div className="flex items-center gap-2">
        <span className="font-mono font-bold text-slate-800 text-sm">{addr}</span>
        <span className="text-slate-300 text-xs">·</span>
        <span className="text-xs text-slate-500 truncate">{sheetName}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${statusBadge[diff.status]}`}>
          {diff.status}
        </span>
        <button
          onClick={onClose}
          className="ml-auto text-slate-400 hover:text-slate-700 text-xs leading-none shrink-0"
          aria-label="Close"
        >✕</button>
      </div>

      {diff.status === 'changed' && (
        <div className="flex flex-col gap-1.5 text-xs font-mono">
          <div>
            <span className="font-sans text-slate-400 uppercase tracking-wide text-[10px]">Before</span>
            <div className="bg-red-50 text-red-700 rounded px-2 py-1 mt-0.5 break-all">{oldText}</div>
          </div>
          <div>
            <span className="font-sans text-slate-400 uppercase tracking-wide text-[10px]">After</span>
            <div className="bg-emerald-50 text-emerald-700 rounded px-2 py-1 mt-0.5 break-all">{newText}</div>
          </div>
          <div>
            <span className="font-sans text-slate-400 uppercase tracking-wide text-[10px]">Diff</span>
            <div className="bg-slate-50 rounded px-2 py-1 mt-0.5">
              <InlineDiff oldText={oldText} newText={newText} />
            </div>
          </div>
        </div>
      )}

      {diff.status === 'added' && (
        <div className="text-xs font-mono bg-emerald-50 text-emerald-800 rounded px-2 py-1 break-all">{newText}</div>
      )}

      {diff.status === 'removed' && (
        <div className="text-xs font-mono bg-red-50 text-red-800 rounded px-2 py-1 break-all">
          <del>{oldText}</del>
        </div>
      )}

      {diff.status === 'unchanged' && (
        <div className="text-xs font-mono bg-slate-50 text-slate-600 rounded px-2 py-1 break-all">{oldText}</div>
      )}

      {/* Style swatch */}
      {(diff.newCell ?? diff.oldCell)?.style && (
        <div>
          <span className="font-sans text-slate-400 uppercase tracking-wide text-[10px]">Style</span>
          <pre className="bg-slate-50 text-slate-600 rounded px-2 py-1 mt-0.5 text-[10px] font-mono whitespace-pre-wrap break-all">
            {JSON.stringify((diff.newCell ?? diff.oldCell)!.style, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
