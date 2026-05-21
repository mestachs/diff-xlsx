export type CellValue = string | number | boolean | null;

export interface ParsedCell {
  value: CellValue;
  formula?: string;
  formatted?: string;
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
