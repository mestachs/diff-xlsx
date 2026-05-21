# diff-xlsx

A browser-only tool for comparing two Excel spreadsheets visually.

![screenshot placeholder](https://via.placeholder.com/800x400?text=XLSX+Diff+Viewer)

## Features

- Upload two `.xlsx` files and see a cell-by-cell diff
- Cells are highlighted by change type: added (green), removed (red), changed (amber)
- Formula-aware: if a cell has a formula, the formula is shown and diffed — not the computed value. A formula that produces different results because its inputs changed is not flagged as modified.
- Tab per sheet, with per-sheet change counts
- Summary stats (added / removed / changed / unchanged)
- Runs entirely in the browser — no data ever leaves your machine

## Usage

Open the deployed GitHub Pages site, drop or select your two `.xlsx` files (old on the left, new on the right), and the diff appears immediately.

## Tech stack

| Tool | Purpose |
|------|---------|
| [React 19](https://react.dev) | UI |
| [Vite 8](https://vite.dev) | Build & dev server |
| [Tailwind CSS 4](https://tailwindcss.com) | Styling |
| [SheetJS (xlsx)](https://sheetjs.com) | XLSX parsing |
| [Bun](https://bun.sh) | Package manager & test runner |
| [Vitest](https://vitest.dev) | Unit tests |

## Development

```bash
bun install
bun run dev        # start dev server at http://localhost:5173
bun run test       # run tests in watch mode
bun run test --run # run tests once
bun run build      # production build → dist/
```

## Deployment

Pushes to `main` trigger a GitHub Actions workflow that builds and deploys to GitHub Pages automatically.

To set it up on a new repo:
1. Go to **Settings → Pages** and set the source to **GitHub Actions**
2. Push to `main`

## Known limitations

- Column alignment is positional (A vs A, B vs B). Renamed or reordered columns are not detected.
- Multiple tables within a single sheet are not yet treated separately.
- Large sheets (thousands of rows) may be slow to render since the full grid is rendered in the DOM.
