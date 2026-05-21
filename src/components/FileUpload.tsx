import { useRef, useState, useCallback } from 'react'
import type { DragEvent } from 'react'

interface FileUploadProps {
  label: string;
  filename?: string;
  onFile: (file: File) => void;
}

export function FileUpload({ label, filename, onFile }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }, [onFile])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setDragging(false), [])
  const handleClick = useCallback(() => inputRef.current?.click(), [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onFile(file)
  }, [onFile])

  const border = dragging
    ? 'border-blue-400 bg-blue-50'
    : filename
      ? 'border-emerald-400 bg-emerald-50'
      : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-all select-none ${border}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      aria-label={`Upload ${label} file`}
    >
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.ods,.csv" className="hidden" onChange={handleChange} />
      <span className="text-xl shrink-0">{filename ? '📄' : '📂'}</span>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</div>
        {filename
          ? <div className="text-sm font-medium text-emerald-700 truncate">{filename}</div>
          : <div className="text-sm text-slate-400">Drop or click to browse</div>
        }
      </div>
    </div>
  )
}
