import { describe, it, expect } from 'vitest'
import { charDiff } from './diff-utils'

function ops(result: ReturnType<typeof charDiff>) {
  return result.map((o) => `${o.type}:${o.text}`)
}

describe('charDiff', () => {
  it('returns a single eq op for identical strings', () => {
    const result = charDiff('hello', 'hello')
    expect(result).toEqual([{ type: 'eq', text: 'hello' }])
  })

  it('returns ins for a pure addition', () => {
    const result = charDiff('', 'abc')
    expect(result).toEqual([{ type: 'ins', text: 'abc' }])
  })

  it('returns del for a pure deletion', () => {
    const result = charDiff('abc', '')
    expect(result).toEqual([{ type: 'del', text: 'abc' }])
  })

  it('handles two empty strings', () => {
    expect(charDiff('', '')).toEqual([])
  })

  it('detects a single character substitution', () => {
    // "cat" → "bat": c deleted, b inserted, at unchanged
    const result = charDiff('cat', 'bat')
    expect(ops(result)).toEqual(['del:c', 'ins:b', 'eq:at'])
  })

  it('detects a change at the end', () => {
    const result = charDiff('foo1', 'foo2')
    expect(ops(result)).toEqual(['eq:foo', 'del:1', 'ins:2'])
  })

  it('detects a change in the middle', () => {
    const result = charDiff('a-b', 'a+b')
    expect(ops(result)).toEqual(['eq:a', 'del:-', 'ins:+', 'eq:b'])
  })

  it('handles insertion in the middle', () => {
    const result = charDiff('ab', 'axb')
    expect(ops(result)).toEqual(['eq:a', 'ins:x', 'eq:b'])
  })

  it('handles deletion in the middle', () => {
    const result = charDiff('axb', 'ab')
    expect(ops(result)).toEqual(['eq:a', 'del:x', 'eq:b'])
  })

  it('merges consecutive ops of the same type', () => {
    // All characters differ — should be one del and one ins, not per-char ops
    const result = charDiff('abc', 'xyz')
    expect(result.length).toBeLessThanOrEqual(3)
    const delOp = result.find((o) => o.type === 'del')
    const insOp = result.find((o) => o.type === 'ins')
    expect(delOp).toBeDefined()
    expect(insOp).toBeDefined()
  })

  it('real formula example: $C$17 → $C$16', () => {
    const a = "=IF(ISBLANK(B43),\"\",INT(ROUNDUP(F43/('Paramètres'!$C$17*4),0)))"
    const b = "=IF(ISBLANK(B43),\"\",INT(ROUNDUP(F43/('Paramètres'!$C$16*4),0)))"
    const result = charDiff(a, b)

    const delOp = result.find((o) => o.type === 'del')
    const insOp = result.find((o) => o.type === 'ins')
    // Only the differing digit should be marked
    expect(delOp?.text).toBe('7')
    expect(insOp?.text).toBe('6')
    // Everything else is eq
    const eqText = result.filter((o) => o.type === 'eq').map((o) => o.text).join('')
    expect(eqText).toBe(a.replace('17', '1').replace('*4)', '*4)')) // shared prefix + suffix
  })

  it('handles a completely replaced string', () => {
    const result = charDiff('old', 'new')
    const types = result.map((o) => o.type)
    expect(types).not.toContain('eq') // no common chars between 'old' and 'new'
  })
})
