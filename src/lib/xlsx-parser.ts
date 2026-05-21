import * as XLSX from 'xlsx'
import type { CellStyle, ParsedCell, ParsedSheet, ParsedWorkbook } from '../types'

// Default Office theme colors, index 0–11 (dk1, lt1, dk2, lt2, accent1–6, hlink, folHlink).
// Used when a workbook doesn't expose its theme or uses the standard Office palette.
export const OFFICE_THEME_DEFAULTS: string[] = [
  '000000', 'FFFFFF', '44546A', 'E7E6E6',
  '4472C4', 'ED7D31', 'A5A5A5', 'FFC000',
  '5B9BD5', '70AD47', '0563C1', '954F72',
]

// Standard Excel indexed color palette (ECMA-376 §18.8.27), 64 entries.
// Indices 0-7 and 8-15 are the same 8 legacy colors; 16-63 are extended.
export const EXCEL_INDEXED_COLORS: readonly string[] = [
  '000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF', // 0-7
  '000000','FFFFFF','FF0000','00FF00','0000FF','FFFF00','FF00FF','00FFFF', // 8-15
  '800000','008000','000080','808000','800080','008080','C0C0C0','808080', // 16-23
  '9999FF','993366','FFFFCC','CCFFFF','660066','FF8080','0066CC','CCCCFF', // 24-31
  '000080','FF00FF','FFFF00','00FFFF','800080','800000','008080','0000FF', // 32-39
  '00CCFF','CCFFFF','CCFFCC','FFFF99','99CCFF','FF99CC','CC99FF','FFCC99', // 40-47
  '3366FF','33CCCC','99CC00','FFCC00','FF9900','FF6600','666699','969696', // 48-55
  '003366','339966','003300','333300','993300','993366','333399','333333', // 56-63
]

// Apply an OOXML luminance tint to a 6-char hex color (HLS space).
// tint > 0 → lighten toward white; tint < 0 → darken toward black.
export function applyTint(hex: string, tint: number): string {
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  const newL = tint >= 0 ? l + (1 - l) * tint : l + l * tint
  const toHex = (x: number) =>
    Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0').toUpperCase()
  if (s === 0) return toHex(newL) + toHex(newL) + toHex(newL)
  const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s
  const p = 2 * newL - q
  const h2r = (pp: number, qq: number, t: number): number => {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1 / 6) return pp + (qq - pp) * 6 * t
    if (t < 1 / 2) return qq
    if (t < 2 / 3) return pp + (qq - pp) * (2 / 3 - t) * 6
    return pp
  }
  return toHex(h2r(p, q, h + 1 / 3)) + toHex(h2r(p, q, h)) + toHex(h2r(p, q, h - 1 / 3))
}

// Resolve a SheetJS color object to a 6-char uppercase hex string.
// Handles explicit RGB (6 or 8-char ARGB), theme index + optional tint, and indexed palette.
export function resolveColor(
  c: { rgb?: string; theme?: number; tint?: number; indexed?: number } | undefined,
  themeColors: string[],
): string | undefined {
  if (!c) return undefined
  if (c.rgb) return c.rgb.length === 8 ? c.rgb.slice(2) : c.rgb
  if (c.theme !== undefined) {
    const base = themeColors[c.theme]
    if (!base) return undefined
    return c.tint ? applyTint(base, c.tint) : base
  }
  if (c.indexed !== undefined) {
    // 64 = system foreground (black), 65 = system background (white) — both filtered later
    if (c.indexed === 64) return '000000'
    if (c.indexed === 65) return 'FFFFFF'
    return EXCEL_INDEXED_COLORS[c.indexed]
  }
  return undefined
}

// Try to read the workbook's own theme color palette; fall back to Office defaults.
function extractThemeColors(wb: XLSX.WorkBook): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const themes = (wb as any).Themes
  const scheme = themes?.themeElements?.clrScheme
  if (!scheme) return OFFICE_THEME_DEFAULTS

  const names = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink']
  return names.map((name, i) => {
    const entry = scheme[name]
    if (!entry) return OFFICE_THEME_DEFAULTS[i] ?? '000000'
    const raw: string | undefined = entry.srgbClr ?? entry.rgb ?? entry.lastClr
    if (!raw) return OFFICE_THEME_DEFAULTS[i] ?? '000000'
    return raw.length === 8 ? raw.slice(2) : raw
  })
}

export function extractStyle(s: unknown, themeColors: string[] = OFFICE_THEME_DEFAULTS): CellStyle | undefined {
  if (!s || typeof s !== 'object') return undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = s as any
  const style: CellStyle = {}

  const bg = resolveColor(raw.fill?.fgColor ?? raw.fgColor, themeColors)
  // Ignore pure-white and pure-black default fills to reduce noise
  if (bg && bg.toUpperCase() !== 'FFFFFF' && bg.toUpperCase() !== '000000') style.bgColor = bg

  const fg = resolveColor(raw.font?.color ?? raw.color, themeColors)
  if (fg && fg.toUpperCase() !== '000000') style.color = fg

  if (raw.font?.bold) style.bold = true
  if (raw.font?.italic) style.italic = true
  if (raw.font?.underline) style.underline = true
  if (raw.font?.sz && raw.font.sz !== 11) style.fontSize = raw.font.sz

  const h = raw.alignment?.horizontal
  if (h && ['left', 'center', 'right', 'fill', 'justify'].includes(h)) style.align = h
  if (raw.alignment?.wrapText) style.wrapText = true

  return Object.keys(style).length > 0 ? style : undefined
}

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

export function parseSheet(ws: XLSX.WorkSheet, name: string, themeColors: string[] = OFFICE_THEME_DEFAULTS): ParsedSheet {
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

  // Track actual populated bounds — the declared range often has thousands of
  // trailing empty rows/cols that would kill rendering performance.
  let maxRow = range.s.r - 1
  let maxCol = range.s.c - 1

  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const addr = `${colIndexToLetter(col)}${row + 1}`
      const cell = ws[addr] as XLSX.CellObject | undefined
      if (cell !== undefined) {
        const hasContent = cell.v !== undefined || !!cell.f
        const style = extractStyle(cell.s, themeColors)
        if (!hasContent && !style) continue
        const parsed: ParsedCell = {
          value: cell.v !== undefined ? (cell.v as string | number | boolean) : null,
        }
        if (cell.f) parsed.formula = cell.f
        if (cell.w) parsed.formatted = cell.w
        if (style) parsed.style = style
        cells[addr] = parsed
        // Only expand bounds for cells with actual content (value or formula).
        // Style-only cells must not pull the trimmed range outward.
        if (hasContent) {
          if (row > maxRow) maxRow = row
          if (col > maxCol) maxCol = col
        }
      }
    }
  }

  return {
    name,
    cells,
    dimensions: {
      minRow: range.s.r,
      maxRow: Math.max(range.s.r, maxRow),
      minCol: range.s.c,
      maxCol: Math.max(range.s.c, maxCol),
    },
  }
}

export async function parseXlsxFile(file: File): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array', cellFormula: true, cellText: true, cellStyles: true })
  const themeColors = extractThemeColors(wb)

  const sheets: ParsedSheet[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]
    return parseSheet(ws, name, themeColors)
  })

  return { sheets, filename: file.name }
}
