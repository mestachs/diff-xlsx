interface Stats {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
}

interface DiffStatsProps {
  stats: Stats;
}

export function DiffStats({ stats }: DiffStatsProps) {
  const total = stats.added + stats.removed + stats.changed + stats.unchanged

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-sm border border-slate-200">
      <span className="text-sm font-medium text-slate-500">Changes</span>
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
        +{stats.added} added
      </span>
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
        −{stats.removed} removed
      </span>
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
        ~{stats.changed} changed
      </span>
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-600">
        {stats.unchanged} unchanged
      </span>
      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 ml-auto">
        {total} total cells
      </span>
    </div>
  )
}
