export type DiffOp = { type: 'eq' | 'del' | 'ins'; text: string }

export function charDiff(a: string, b: string): DiffOp[] {
  const m = a.length
  const n = b.length

  // LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] = a[i - 1] === b[j - 1] ? dp[i - 1]![j - 1]! + 1 : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
    }
  }

  // Backtrack to build ops (reversed)
  const raw: DiffOp[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      raw.push({ type: 'eq', text: a[i - 1]! })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      raw.push({ type: 'ins', text: b[j - 1]! })
      j--
    } else {
      raw.push({ type: 'del', text: a[i - 1]! })
      i--
    }
  }
  raw.reverse()

  // Merge consecutive ops of the same type
  const merged: DiffOp[] = []
  for (const op of raw) {
    const last = merged[merged.length - 1]
    if (last && last.type === op.type) last.text += op.text
    else merged.push({ ...op })
  }
  return merged
}
