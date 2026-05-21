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

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragging(false)
  }, [])

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  const borderColor = dragging
    ? 'border-blue-400 bg-blue-50'
    : filename
      ? 'border-emerald-400 bg-emerald-50'
      : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50'

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all flex flex-col items-center gap-2 text-center select-none ${borderColor}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      aria-label={`Upload ${label} file`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.ods,.csv"
        className="hidden"
        onChange={handleChange}
      />
      <div className="text-4xl">{filename ? '📄' : '📂'}</div>
      <div className="font-semibold text-slate-700">{label}</div>
      {filename ? (
        <div className="text-sm text-emerald-700 font-medium break-all">{filename}</div>
      ) : (
        <div className="text-sm text-slate-500">Drop an XLSX file here or click to browse</div>
      )}
    </div>
  )
}
