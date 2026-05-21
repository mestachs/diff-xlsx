import type { SheetDiffResult } from '../lib/diff-engine'

interface SheetTabProps {
  sheets: SheetDiffResult[];
  activeSheet: string;
  onSelect: (name: string) => void;
}

const indicatorColor: Record<SheetDiffResult['status'], string> = {
  added:   'bg-emerald-500',
  removed: 'bg-red-500',
  matched: 'bg-slate-300',
}

const statusBadgeClass: Record<'added' | 'removed', string> = {
  added:   'bg-emerald-100 text-emerald-700',
  removed: 'bg-red-100 text-red-700',
}

export function SheetTab({ sheets, activeSheet, onSelect }: SheetTabProps) {
  return (
    <div className="flex flex-wrap gap-px p-1.5 bg-slate-100 border-b border-slate-200" role="tablist">
      {sheets.map((sheet) => {
        const isActive = activeSheet === sheet.sheetName
        const changeCount = sheet.stats.changed + sheet.stats.added + sheet.stats.removed
        return (
          <button
            key={sheet.sheetName}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(sheet.sheetName)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${indicatorColor[sheet.status]}`} />
            <span>{sheet.sheetName}</span>
            {sheet.status !== 'matched' && (
              <span className={`text-xs px-1 py-0 rounded font-medium ${statusBadgeClass[sheet.status as 'added' | 'removed']}`}>
                {sheet.status === 'added' ? 'new' : 'del'}
              </span>
            )}
            {sheet.status === 'matched' && changeCount > 0 && (
              <span className="text-slate-400 font-normal">{changeCount}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
