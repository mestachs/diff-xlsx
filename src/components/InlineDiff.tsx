import { useMemo } from 'react'
import { charDiff } from '../lib/diff-utils'

interface InlineDiffProps {
  oldText: string;
  newText: string;
  className?: string;
}

export function InlineDiff({ oldText, newText, className = '' }: InlineDiffProps) {
  const ops = useMemo(() => charDiff(oldText, newText), [oldText, newText])

  return (
    <span className={`font-mono break-all ${className}`}>
      {ops.map((op, i) => {
        if (op.type === 'eq') return <span key={i}>{op.text}</span>
        if (op.type === 'del') return <del key={i} className="bg-red-200 text-red-800 no-underline rounded-sm">{op.text}</del>
        return <ins key={i} className="bg-emerald-200 text-emerald-800 no-underline rounded-sm">{op.text}</ins>
      })}
    </span>
  )
}
