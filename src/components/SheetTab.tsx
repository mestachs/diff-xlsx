import type { SheetDiffResult } from '../lib/diff-engine'

interface SheetTabProps {
  sheets: SheetDiffResult[];
  activeSheet: string;
  onSelect: (name: string) => void;
}

const indicatorColor: Record<SheetDiffResult['status'], string> = {
  added: 'bg-emerald-500',
  removed: 'bg-red-500',
  matched: 'bg-slate-300',
}

const statusBadgeClass: Record<'added' | 'removed', string> = {
  added: 'bg-emerald-100 text-emerald-700',
  removed: 'bg-red-100 text-red-700',
}

export function SheetTab({ sheets, activeSheet, onSelect }: SheetTabProps) {
  return (
    <div className="flex overflow-x-auto border-b border-slate-200 bg-white" role="tablist">
      {sheets.map((sheet) => {
        const isActive = activeSheet === sheet.sheetName
        const changeCount = sheet.stats.changed + sheet.stats.added + sheet.stats.removed
        return (
          <button
            key={sheet.sheetName}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              isActive
                ? 'border-blue-500 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(sheet.sheetName)}
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${indicatorColor[sheet.status]}`} />
            <span>{sheet.sheetName}</span>
            {sheet.status !== 'matched' && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusBadgeClass[sheet.status as 'added' | 'removed']}`}>
                {sheet.status === 'added' ? 'new' : 'deleted'}
              </span>
            )}
            {sheet.status === 'matched' && (
              <span className="text-xs text-slate-400">
                {changeCount > 0 ? `${changeCount} changes` : 'no changes'}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
