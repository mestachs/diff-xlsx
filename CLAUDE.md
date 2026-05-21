# CLAUDE.md

## Project

Browser-only XLSX diff viewer. Two files are uploaded, parsed client-side with SheetJS, compared cell by cell, and rendered as a colour-coded spreadsheet grid. No backend.

## Commands

```bash
bun run dev        # dev server (http://localhost:5173)
bun run build      # production build → dist/
bun run test --run # run unit tests once
bun run test       # watch mode
```

## Architecture

```
src/
  lib/
    xlsx-parser.ts     # File → ParsedWorkbook via SheetJS
    diff-engine.ts     # ParsedWorkbook × 2 → DiffResult
  components/
    FileUpload.tsx     # Drag-and-drop upload zone
    DiffStats.tsx      # Top-level added/removed/changed/unchanged badges
    SheetTab.tsx       # Sheet selector tabs with per-sheet indicators
    SpreadsheetGrid.tsx # The diff grid (column letters, row numbers, coloured cells)
  types.ts             # ParsedCell, ParsedSheet, ParsedWorkbook
  App.tsx              # Wires everything together
```

## Diff logic

Comparison is positional: cell A1 in file A is compared to cell A1 in file B. No column alignment or header detection.

**Formula-first equality** (`diff-engine.ts › cellsEqual`): if either cell has a formula, only the formula strings are compared — not the computed value. This means a cell whose formula is unchanged but whose computed result changed (because other cells changed) is correctly treated as unchanged. A cell whose formula changed is flagged even if the computed value happens to be the same.

Display priority (`SpreadsheetGrid.tsx › cellDisplay`): formula string (`=SUM(A1:A5)`) beats formatted value beats raw value.

## Key types

```ts
// diff-engine.ts
type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged'

interface CellDiff {
  status: DiffStatus
  oldCell?: ParsedCell
  newCell?: ParsedCell
}

interface SheetDiffResult {
  sheetName: string
  status: 'added' | 'removed' | 'matched'
  cellDiffs: Record<string, CellDiff>  // keyed by "A1", "B2", …
  range: { minRow: number; maxRow: number; minCol: number; maxCol: number }
  stats: { added: number; removed: number; changed: number; unchanged: number }
}
```

## Styling

Tailwind CSS v4 via `@tailwindcss/vite`. No CSS modules. All classes are inline on JSX elements.

Diff colour palette: emerald = added, red = removed, amber = changed.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds on push to `main` and deploys to GitHub Pages using the official `actions/upload-pages-artifact` + `actions/deploy-pages` actions. Node.js 22 is pinned explicitly to avoid deprecation warnings. Bun is set up via `oven-sh/setup-bun@v2`.

Vite is configured with `base: './'` for correct asset paths on GitHub Pages.
