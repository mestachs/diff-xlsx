import { describe, it, expect } from 'vitest'
import type * as XLSX from 'xlsx'
import { parseSheet, extractStyle, applyTint, resolveColor, OFFICE_THEME_DEFAULTS, EXCEL_INDEXED_COLORS } from './xlsx-parser'

// Minimal WorkSheet builder — only the fields parseSheet reads
function makeWs(
  ref: string,
  cells: Record<string, { v?: string | number | boolean; f?: string; w?: string; s?: unknown }>,
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = { '!ref': ref }
  for (const [addr, c] of Object.entries(cells)) {
    ws[addr] = { ...c } as XLSX.CellObject
  }
  return ws
}

describe('parseSheet', () => {
  it('parses cell values', () => {
    const ws = makeWs('A1:B2', {
      'A1': { v: 'Name' },
      'B1': { v: 'Score' },
      'A2': { v: 'Alice' },
      'B2': { v: 95 },
    })
    const sheet = parseSheet(ws, 'Sheet1')
    expect(sheet.cells['A1']?.value).toBe('Name')
    expect(sheet.cells['B2']?.value).toBe(95)
  })

  it('parses formulas', () => {
    const ws = makeWs('A1:A1', { 'A1': { v: 100, f: 'SUM(B1:B5)' } })
    const sheet = parseSheet(ws, 'Sheet1')
    expect(sheet.cells['A1']?.formula).toBe('SUM(B1:B5)')
    expect(sheet.cells['A1']?.value).toBe(100)
  })

  it('parses formatted text', () => {
    const ws = makeWs('A1:A1', { 'A1': { v: 0.5, w: '50%' } })
    const sheet = parseSheet(ws, 'Sheet1')
    expect(sheet.cells['A1']?.formatted).toBe('50%')
  })

  it('returns empty sheet when !ref is missing', () => {
    const ws: XLSX.WorkSheet = {}
    const sheet = parseSheet(ws, 'Empty')
    expect(sheet.cells).toEqual({})
    expect(sheet.dimensions.maxRow).toBe(0)
  })

  it('trims trailing empty rows — maxRow reflects last populated row', () => {
    // Declared range A1:A100 but only A1 and A3 have data
    const ws = makeWs('A1:A100', {
      'A1': { v: 'hello' },
      'A3': { v: 'world' },
      // A4–A100 are absent (empty)
    })
    const sheet = parseSheet(ws, 'Sheet1')
    expect(sheet.dimensions.maxRow).toBe(2) // 0-indexed: row 3 = index 2
  })

  it('trims trailing empty columns — maxCol reflects last populated column', () => {
    // Declared range A1:Z1 but only A1 and C1 have data
    const ws = makeWs('A1:Z1', {
      'A1': { v: 'ID' },
      'C1': { v: 'Name' },
      // D1–Z1 are absent
    })
    const sheet = parseSheet(ws, 'Sheet1')
    expect(sheet.dimensions.maxCol).toBe(2) // 0-indexed: column C = index 2
  })

  it('trims both trailing rows and columns simultaneously', () => {
    const ws = makeWs('A1:Z1000', {
      'A1': { v: 'x' },
      'B2': { v: 'y' },
      // everything beyond B2 is empty
    })
    const sheet = parseSheet(ws, 'Sheet1')
    expect(sheet.dimensions.maxRow).toBe(1) // row 2 = index 1
    expect(sheet.dimensions.maxCol).toBe(1) // column B = index 1
  })

  it('preserves minRow and minCol from declared range start', () => {
    // Sheet starting at B2 (common in real spreadsheets with blank header area)
    const ws = makeWs('B2:D4', {
      'B2': { v: 'start' },
      'D4': { v: 'end' },
    })
    const sheet = parseSheet(ws, 'Sheet1')
    expect(sheet.dimensions.minRow).toBe(1) // row 2 = index 1
    expect(sheet.dimensions.minCol).toBe(1) // column B = index 1
  })

  it('skips absent (empty) cell addresses within the declared range', () => {
    const ws = makeWs('A1:C3', {
      'A1': { v: 1 },
      'C3': { v: 3 },
      // B2 absent
    })
    const sheet = parseSheet(ws, 'Sheet1')
    expect(sheet.cells['B2']).toBeUndefined()
    expect(Object.keys(sheet.cells)).toHaveLength(2)
  })

  it('handles a completely empty declared range gracefully', () => {
    const ws = makeWs('A1:D10', {})
    const sheet = parseSheet(ws, 'Sheet1')
    expect(Object.keys(sheet.cells)).toHaveLength(0)
    expect(sheet.dimensions.maxRow).toBeGreaterThanOrEqual(sheet.dimensions.minRow)
  })

  it('parses cell style when present', () => {
    const ws = makeWs('A1:A1', {
      'A1': { v: 'hi', s: { font: { bold: true }, fill: { fgColor: { rgb: 'FFFF00' } } } },
    })
    const sheet = parseSheet(ws, 'Sheet1')
    expect(sheet.cells['A1']?.style?.bold).toBe(true)
    expect(sheet.cells['A1']?.style?.bgColor).toBe('FFFF00')
  })

  it('leaves style undefined when no style is present', () => {
    const ws = makeWs('A1:A1', { 'A1': { v: 'x' } })
    const sheet = parseSheet(ws, 'Sheet1')
    expect(sheet.cells['A1']?.style).toBeUndefined()
  })

  it('does not advance maxRow/maxCol for style-only trailing cells', () => {
    // SheetJS with cellStyles:true returns cell objects for styled-but-empty cells.
    // Bounds must only reflect cells with actual content (value or formula).
    const ws = makeWs('A1:A10', {
      'A1': { v: 'hello' },
      // A2–A10 have styling but no value — simulated by omitting v/f
      'A5': { s: { font: { bold: true } } },
      'A10': { s: { fill: { fgColor: { rgb: 'FF0000' } } } },
    })
    const sheet = parseSheet(ws, 'Sheet1')
    expect(sheet.dimensions.maxRow).toBe(0) // only A1 has content → row index 0
  })

  it('stores style-only cells in the cells map but they do not affect bounds', () => {
    const ws = makeWs('A1:C3', {
      'A1': { v: 'data' },
      'C3': { s: { font: { bold: true } } }, // style only, no value
    })
    const sheet = parseSheet(ws, 'Sheet1')
    // A1 has content → bounds = row 0, col 0
    expect(sheet.dimensions.maxRow).toBe(0)
    expect(sheet.dimensions.maxCol).toBe(0)
    // C3 is stored (it has a style) but does not widen the range
    expect(sheet.cells['C3']?.style?.bold).toBe(true)
  })
})

describe('extractStyle', () => {
  it('returns undefined for null/undefined input', () => {
    expect(extractStyle(null)).toBeUndefined()
    expect(extractStyle(undefined)).toBeUndefined()
  })

  it('returns undefined for empty style object', () => {
    expect(extractStyle({})).toBeUndefined()
  })

  it('returns undefined when only default white fill is present', () => {
    expect(extractStyle({ fill: { fgColor: { rgb: 'FFFFFF' } } })).toBeUndefined()
  })

  it('returns undefined when only default black fill is present', () => {
    expect(extractStyle({ fill: { fgColor: { rgb: '000000' } } })).toBeUndefined()
  })

  it('returns undefined when font color is default black', () => {
    expect(extractStyle({ font: { color: { rgb: '000000' } } })).toBeUndefined()
  })

  it('strips ARGB alpha prefix: 8-char hex drops first 2 chars', () => {
    // 'FF4472C4' → drop alpha 'FF' → '4472C4'
    const result = extractStyle({ fill: { fgColor: { rgb: 'FF4472C4' } } })
    expect(result?.bgColor).toBe('4472C4')
  })

  it('accepts plain 6-char RGB directly', () => {
    const result = extractStyle({ fill: { fgColor: { rgb: '4472C4' } } })
    expect(result?.bgColor).toBe('4472C4')
  })

  it('handles flat SheetJS layout where fgColor is at the root of cell.s', () => {
    // SheetJS sometimes emits { patternType, fgColor, bgColor } flat instead of { fill: { fgColor } }
    const result = extractStyle({ patternType: 'solid', fgColor: { rgb: '8DB3E2' }, bgColor: { rgb: '8DB3E2' } })
    expect(result?.bgColor).toBe('8DB3E2')
  })

  it('resolves theme colors using the default Office palette', () => {
    // theme index 4 = accent1 = '4472C4' in the default Office theme
    const result = extractStyle({ fill: { fgColor: { theme: 4 } }, font: { bold: true } })
    expect(result?.bgColor).toBe('4472C4')
    expect(result?.bold).toBe(true)
  })

  it('applies tint when resolving a theme color', () => {
    // theme 7 = accent4 = 'FFC000' (gold). A tint darkens/lightens it.
    const result = extractStyle({ fill: { fgColor: { theme: 7, tint: -0.25 } } })
    expect(result?.bgColor).toBeDefined()
    expect(result?.bgColor).not.toBe('FFC000') // tinted, so different from base
  })

  it('parses bold and italic', () => {
    const result = extractStyle({ font: { bold: true, italic: true } })
    expect(result?.bold).toBe(true)
    expect(result?.italic).toBe(true)
  })

  it('parses underline', () => {
    const result = extractStyle({ font: { underline: true } })
    expect(result?.underline).toBe(true)
  })

  it('parses font size when non-default', () => {
    const result = extractStyle({ font: { sz: 14 } })
    expect(result?.fontSize).toBe(14)
  })

  it('ignores default font size 11', () => {
    const result = extractStyle({ font: { sz: 11 } })
    expect(result?.fontSize).toBeUndefined()
  })

  it('parses text alignment', () => {
    const result = extractStyle({ alignment: { horizontal: 'center' } })
    expect(result?.align).toBe('center')
  })

  it('ignores unknown alignment values', () => {
    const result = extractStyle({ alignment: { horizontal: 'distributed' } })
    expect(result?.align).toBeUndefined()
  })

  it('parses wrapText', () => {
    const result = extractStyle({ alignment: { wrapText: true } })
    expect(result?.wrapText).toBe(true)
  })

  it('parses font color', () => {
    const result = extractStyle({ font: { color: { rgb: 'FF0000' } } })
    expect(result?.color).toBe('FF0000')
  })

  it('parses a combined real-world style', () => {
    const result = extractStyle({
      fill: { fgColor: { rgb: 'FFD700' } },
      font: { bold: true, color: { rgb: '1F3864' }, sz: 12 },
      alignment: { horizontal: 'center', wrapText: true },
    })
    expect(result).toMatchObject({
      bgColor: 'FFD700',
      bold: true,
      color: '1F3864',
      fontSize: 12,
      align: 'center',
      wrapText: true,
    })
  })
})

describe('resolveColor', () => {
  it('returns undefined for missing input', () => {
    expect(resolveColor(undefined, OFFICE_THEME_DEFAULTS)).toBeUndefined()
  })

  it('resolves 6-char RGB directly', () => {
    expect(resolveColor({ rgb: 'FFFF00' }, OFFICE_THEME_DEFAULTS)).toBe('FFFF00')
  })

  it('strips ARGB alpha from 8-char hex', () => {
    expect(resolveColor({ rgb: 'FF4472C4' }, OFFICE_THEME_DEFAULTS)).toBe('4472C4')
  })

  it('resolves theme index to default Office color', () => {
    // index 7 = accent4 = 'FFC000'
    expect(resolveColor({ theme: 7 }, OFFICE_THEME_DEFAULTS)).toBe('FFC000')
  })

  it('applies tint when theme index + tint are provided', () => {
    const base = resolveColor({ theme: 4 }, OFFICE_THEME_DEFAULTS) // accent1 = '4472C4'
    const tinted = resolveColor({ theme: 4, tint: 0.5 }, OFFICE_THEME_DEFAULTS)
    expect(tinted).toBeDefined()
    expect(tinted).not.toBe(base)
  })

  it('uses custom theme color array', () => {
    const custom = [...OFFICE_THEME_DEFAULTS]
    custom[4] = 'AABBCC'
    expect(resolveColor({ theme: 4 }, custom)).toBe('AABBCC')
  })

  it('resolves indexed color 5 (Excel yellow)', () => {
    expect(resolveColor({ indexed: 5 }, OFFICE_THEME_DEFAULTS)).toBe('FFFF00')
  })

  it('resolves indexed color 13 (also yellow in the legacy palette)', () => {
    expect(resolveColor({ indexed: 13 }, OFFICE_THEME_DEFAULTS)).toBe('FFFF00')
  })

  it('returns black for indexed 64 (system foreground)', () => {
    expect(resolveColor({ indexed: 64 }, OFFICE_THEME_DEFAULTS)).toBe('000000')
  })

  it('returns white for indexed 65 (system background)', () => {
    expect(resolveColor({ indexed: 65 }, OFFICE_THEME_DEFAULTS)).toBe('FFFFFF')
  })
})

describe('EXCEL_INDEXED_COLORS', () => {
  it('has 64 entries', () => {
    expect(EXCEL_INDEXED_COLORS).toHaveLength(64)
  })

  it('index 5 is yellow', () => {
    expect(EXCEL_INDEXED_COLORS[5]).toBe('FFFF00')
  })

  it('index 0 is black and index 1 is white', () => {
    expect(EXCEL_INDEXED_COLORS[0]).toBe('000000')
    expect(EXCEL_INDEXED_COLORS[1]).toBe('FFFFFF')
  })
})

describe('applyTint', () => {
  it('returns white when tint is 1 (maximum lightening)', () => {
    expect(applyTint('4472C4', 1)).toBe('FFFFFF')
  })

  it('returns black when tint is -1 (maximum darkening)', () => {
    expect(applyTint('4472C4', -1)).toBe('000000')
  })

  it('returns the same color when tint is 0', () => {
    expect(applyTint('4472C4', 0)).toBe('4472C4')
  })

  it('lightens a color with positive tint', () => {
    const result = applyTint('4472C4', 0.5)
    // Each channel should be brighter than the original
    const origL = (0x44 + 0x72 + 0xC4) / 3
    const r = parseInt(result.slice(0, 2), 16)
    const g = parseInt(result.slice(2, 4), 16)
    const b = parseInt(result.slice(4, 6), 16)
    expect((r + g + b) / 3).toBeGreaterThan(origL)
  })
})
