import { describe, it, expect } from 'vitest'
import { diffWorkbooks } from './diff-engine'
import type { ParsedWorkbook, ParsedSheet } from '../types'

function makeWorkbook(
  name: string,
  sheets: Array<{ name: string; cells: Record<string, string | number | null> }>,
): ParsedWorkbook {
  const parsedSheets: ParsedSheet[] = sheets.map(({ name: sName, cells }) => {
    const parsedCells: ParsedSheet['cells'] = {}
    let maxRow = 0
    let maxCol = 0
    for (const [addr, val] of Object.entries(cells)) {
      parsedCells[addr] = { value: val }
      const match = addr.match(/^([A-Z]+)(\d+)$/)
      if (match) {
        const row = parseInt(match[2]!, 10) - 1
        let col = 0
        for (let i = 0; i < match[1]!.length; i++) col = col * 26 + (match[1]!.charCodeAt(i) - 64)
        col -= 1
        if (row > maxRow) maxRow = row
        if (col > maxCol) maxCol = col
      }
    }
    return { name: sName, cells: parsedCells, dimensions: { minRow: 0, maxRow, minCol: 0, maxCol } }
  })
  return { sheets: parsedSheets, filename: name }
}

describe('diffWorkbooks', () => {
  it('detects unchanged cells', () => {
    const old = makeWorkbook('old.xlsx', [{ name: 'Sheet1', cells: { 'A1': 'Name', 'B1': 'Value', 'A2': 'Alice', 'B2': 100 } }])
    const nw  = makeWorkbook('new.xlsx', [{ name: 'Sheet1', cells: { 'A1': 'Name', 'B1': 'Value', 'A2': 'Alice', 'B2': 100 } }])
    const result = diffWorkbooks(old, nw)
    expect(result.totalStats.changed).toBe(0)
    expect(result.totalStats.added).toBe(0)
    expect(result.totalStats.removed).toBe(0)
    expect(result.totalStats.unchanged).toBe(4)
  })

  it('detects changed cell values', () => {
    const old = makeWorkbook('old.xlsx', [{ name: 'Sheet1', cells: { 'A1': 'Name', 'B2': 100 } }])
    const nw  = makeWorkbook('new.xlsx', [{ name: 'Sheet1', cells: { 'A1': 'Name', 'B2': 200 } }])
    const result = diffWorkbooks(old, nw)
    expect(result.totalStats.changed).toBe(1)
    const sheet = result.sheets[0]!
    expect(sheet.cellDiffs['B2']?.status).toBe('changed')
    expect(sheet.cellDiffs['B2']?.oldCell?.value).toBe(100)
    expect(sheet.cellDiffs['B2']?.newCell?.value).toBe(200)
  })

  it('detects added cells', () => {
    const old = makeWorkbook('old.xlsx', [{ name: 'Sheet1', cells: { 'A1': 'Name' } }])
    const nw  = makeWorkbook('new.xlsx', [{ name: 'Sheet1', cells: { 'A1': 'Name', 'A2': 'Alice', 'B2': 30 } }])
    const result = diffWorkbooks(old, nw)
    expect(result.totalStats.added).toBe(2)
    expect(result.sheets[0]!.cellDiffs['A2']?.status).toBe('added')
    expect(result.sheets[0]!.cellDiffs['B2']?.status).toBe('added')
  })

  it('detects removed cells', () => {
    const old = makeWorkbook('old.xlsx', [{ name: 'Sheet1', cells: { 'A1': 'Name', 'A2': 'Alice', 'B2': 30 } }])
    const nw  = makeWorkbook('new.xlsx', [{ name: 'Sheet1', cells: { 'A1': 'Name' } }])
    const result = diffWorkbooks(old, nw)
    expect(result.totalStats.removed).toBe(2)
    expect(result.sheets[0]!.cellDiffs['A2']?.status).toBe('removed')
  })

  it('detects added sheet', () => {
    const old = makeWorkbook('old.xlsx', [{ name: 'Sheet1', cells: { 'A1': 'ID' } }])
    const nw  = makeWorkbook('new.xlsx', [{ name: 'Sheet1', cells: { 'A1': 'ID' } }, { name: 'Sheet2', cells: { 'A1': 'New' } }])
    const result = diffWorkbooks(old, nw)
    expect(result.sheets.find((s) => s.sheetName === 'Sheet2')?.status).toBe('added')
  })

  it('detects removed sheet', () => {
    const old = makeWorkbook('old.xlsx', [{ name: 'Sheet1', cells: { 'A1': 'ID' } }, { name: 'Sheet2', cells: { 'A1': 'Old' } }])
    const nw  = makeWorkbook('new.xlsx', [{ name: 'Sheet1', cells: { 'A1': 'ID' } }])
    const result = diffWorkbooks(old, nw)
    expect(result.sheets.find((s) => s.sheetName === 'Sheet2')?.status).toBe('removed')
  })

  it('range covers union of both sheets', () => {
    const old = makeWorkbook('old.xlsx', [{ name: 'Sheet1', cells: { 'A1': 'x', 'B2': 'y' } }])
    const nw  = makeWorkbook('new.xlsx', [{ name: 'Sheet1', cells: { 'A1': 'x', 'C3': 'z' } }])
    const result = diffWorkbooks(old, nw)
    const range = result.sheets[0]!.range
    expect(range.maxRow).toBe(2)  // 0-indexed row 2 = row 3
    expect(range.maxCol).toBe(2)  // column C = index 2
  })

  it('detects formula change even when computed value is the same', () => {
    const old = makeWorkbook('old.xlsx', [{ name: 'Sheet1', cells: { 'A1': 100 } }])
    const nw  = makeWorkbook('new.xlsx', [{ name: 'Sheet1', cells: { 'A1': 100 } }])
    old.sheets[0]!.cells['A1'] = { value: 100, formula: 'SUM(B1:B5)' }
    nw.sheets[0]!.cells['A1']  = { value: 100, formula: 'SUM(B1:B6)' }
    const result = diffWorkbooks(old, nw)
    expect(result.sheets[0]!.cellDiffs['A1']?.status).toBe('changed')
  })

  it('treats same formula with different computed values as unchanged', () => {
    const old = makeWorkbook('old.xlsx', [{ name: 'Sheet1', cells: { 'A1': 10 } }])
    const nw  = makeWorkbook('new.xlsx', [{ name: 'Sheet1', cells: { 'A1': 20 } }])
    old.sheets[0]!.cells['A1'] = { value: 10, formula: 'SUM(B1:B5)' }
    nw.sheets[0]!.cells['A1']  = { value: 20, formula: 'SUM(B1:B5)' }
    const result = diffWorkbooks(old, nw)
    expect(result.sheets[0]!.cellDiffs['A1']?.status).toBe('unchanged')
  })
})
