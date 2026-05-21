import type { ParsedCell, ParsedSheet, ParsedWorkbook } from '../types'

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged'

export interface CellDiff {
  status: DiffStatus;
  oldCell?: ParsedCell;
  newCell?: ParsedCell;
}

export interface SheetDiffResult {
  sheetName: string;
  status: 'added' | 'removed' | 'matched';
  cellDiffs: Record<string, CellDiff>; // key: "A1", "B2", etc.
  range: { minRow: number; maxRow: number; minCol: number; maxCol: number };
  stats: { added: number; removed: number; changed: number; unchanged: number };
}

export interface DiffResult {
  sheets: SheetDiffResult[];
  totalStats: { added: number; removed: number; changed: number; unchanged: number };
}

function cellsEqual(a: ParsedCell, b: ParsedCell): boolean {
  // Formula is the authoritative content; compare only formulas when either cell has one.
  // This avoids false positives when the same formula yields different computed values.
  if (a.formula || b.formula) {
    return (a.formula ?? '') === (b.formula ?? '')
  }
  return a.value === b.value
}

function sheetRange(sheet: ParsedSheet) {
  return sheet.dimensions
}

function allCellsAs(sheet: ParsedSheet, status: 'added' | 'removed'): Record<string, CellDiff> {
  const diffs: Record<string, CellDiff> = {}
  for (const [addr, cell] of Object.entries(sheet.cells)) {
    diffs[addr] = status === 'added' ? { status: 'added', newCell: cell } : { status: 'removed', oldCell: cell }
  }
  return diffs
}

function diffSheets(oldSheet: ParsedSheet, newSheet: ParsedSheet): SheetDiffResult {
  const stats = { added: 0, removed: 0, changed: 0, unchanged: 0 }
  const cellDiffs: Record<string, CellDiff> = {}

  const allAddrs = new Set([...Object.keys(oldSheet.cells), ...Object.keys(newSheet.cells)])

  for (const addr of allAddrs) {
    const oldCell = oldSheet.cells[addr]
    const newCell = newSheet.cells[addr]

    if (oldCell && !newCell) {
      cellDiffs[addr] = { status: 'removed', oldCell }
      stats.removed++
    } else if (!oldCell && newCell) {
      cellDiffs[addr] = { status: 'added', newCell }
      stats.added++
    } else if (oldCell && newCell) {
      if (cellsEqual(oldCell, newCell)) {
        cellDiffs[addr] = { status: 'unchanged', oldCell }
        stats.unchanged++
      } else {
        cellDiffs[addr] = { status: 'changed', oldCell, newCell }
        stats.changed++
      }
    }
  }

  const old = sheetRange(oldSheet)
  const nw = sheetRange(newSheet)
  const range = {
    minRow: Math.min(old.minRow, nw.minRow),
    maxRow: Math.max(old.maxRow, nw.maxRow),
    minCol: Math.min(old.minCol, nw.minCol),
    maxCol: Math.max(old.maxCol, nw.maxCol),
  }

  return { sheetName: oldSheet.name, status: 'matched', cellDiffs, range, stats }
}

export function diffWorkbooks(oldWb: ParsedWorkbook, newWb: ParsedWorkbook): DiffResult {
  const sheets: SheetDiffResult[] = []
  const totalStats = { added: 0, removed: 0, changed: 0, unchanged: 0 }

  const oldMap = new Map(oldWb.sheets.map((s) => [s.name, s]))
  const newMap = new Map(newWb.sheets.map((s) => [s.name, s]))
  const allNames = [...new Set([...oldWb.sheets.map((s) => s.name), ...newWb.sheets.map((s) => s.name)])]

  for (const name of allNames) {
    const oldSheet = oldMap.get(name)
    const newSheet = newMap.get(name)

    if (oldSheet && newSheet) {
      const result = diffSheets(oldSheet, newSheet)
      sheets.push(result)
      totalStats.added += result.stats.added
      totalStats.removed += result.stats.removed
      totalStats.changed += result.stats.changed
      totalStats.unchanged += result.stats.unchanged
    } else if (oldSheet) {
      const cellDiffs = allCellsAs(oldSheet, 'removed')
      const n = Object.keys(cellDiffs).length
      sheets.push({ sheetName: name, status: 'removed', cellDiffs, range: sheetRange(oldSheet), stats: { added: 0, removed: n, changed: 0, unchanged: 0 } })
      totalStats.removed += n
    } else if (newSheet) {
      const cellDiffs = allCellsAs(newSheet, 'added')
      const n = Object.keys(cellDiffs).length
      sheets.push({ sheetName: name, status: 'added', cellDiffs, range: sheetRange(newSheet), stats: { added: n, removed: 0, changed: 0, unchanged: 0 } })
      totalStats.added += n
    }
  }

  return { sheets, totalStats }
}
