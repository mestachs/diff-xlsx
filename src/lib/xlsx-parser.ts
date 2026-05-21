import * as XLSX from 'xlsx'
import type { ParsedCell, ParsedSheet, ParsedWorkbook } from '../types'

function colIndexToLetter(col: number): string {
  let letter = ''
  let n = col + 1
  while (n > 0) {
    const rem = (n - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}

function parseSheet(ws: XLSX.WorkSheet, name: string): ParsedSheet {
  const ref = ws['!ref']
  if (!ref) {
    return {
      name,
      cells: {},
      dimensions: { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 },
    }
  }

  const range = XLSX.utils.decode_range(ref)
  const cells: Record<string, ParsedCell> = {}

  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const addr = `${colIndexToLetter(col)}${row + 1}`
      const cell = ws[addr] as XLSX.CellObject | undefined
      if (cell !== undefined) {
        const parsed: ParsedCell = {
          value: cell.v !== undefined ? (cell.v as string | number | boolean) : null,
        }
        if (cell.f) parsed.formula = cell.f
        if (cell.w) parsed.formatted = cell.w
        cells[addr] = parsed
      }
    }
  }

  return {
    name,
    cells,
    dimensions: {
      minRow: range.s.r,
      maxRow: range.e.r,
      minCol: range.s.c,
      maxCol: range.e.c,
    },
  }
}

export async function parseXlsxFile(file: File): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellFormula: true, cellText: true })

  const sheets: ParsedSheet[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    return parseSheet(ws, name)
  })

  return { sheets, filename: file.name }
}
