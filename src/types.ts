export type CellValue = string | number | boolean | null;

export interface CellStyle {
  bgColor?: string;   // 6-char hex, e.g. "FFFF00"
  color?: string;     // 6-char hex
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;  // in points
  align?: 'left' | 'center' | 'right' | 'fill' | 'justify';
  wrapText?: boolean;
}

export interface ParsedCell {
  value: CellValue;
  formula?: string;
  formatted?: string;
  style?: CellStyle;
}

export interface ParsedSheet {
  name: string;
  cells: Record<string, ParsedCell>; // key: "A1", "B2", etc.
  dimensions: { minRow: number; maxRow: number; minCol: number; maxCol: number };
}

export interface ParsedWorkbook {
  sheets: ParsedSheet[];
  filename: string;
}
