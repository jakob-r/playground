# Architecture & Tech Stack

General product concept lives in `IDEA.md`.

This is a static, browser-only collection of small web pieces (toys, visualizations, explainers, generative art). Same stack and structure as tools.jakob-r.de.

## Tech Stack

- **Framework**: **Svelte 5** (Runes: `$state`, `$derived`, `$effect`) with **SvelteKit** and **TypeScript**.
  - One route per piece, so SvelteKit emits a separate JS chunk per piece. The landing page must not import those chunks.
- **Styling**: **Tailwind CSS v4** plus a small set of CSS custom properties (`frontend/src/app.css`) for the shared palette: warm paper background, ink text, one vermilion accent, a serif for headings. Pieces may bring their own look inside their canvas.
- **Build & Package Manager**: **Vite** + **pnpm**.
- **Output**: `@sveltejs/adapter-static` with prerendering. Every route is known at build time, so the production build is a set of static files. Deployed to GitHub Pages (`.github/workflows/deploy.yml`, `frontend/static/CNAME`).
- **Graphics / compute**: Canvas 2D, SVG, WebGL / WebGPU, Web Audio, workers and WebAssembly are all fine. Heavy libraries and `.wasm` are imported only from `frontend/src/lib/pieces/<slug>/`, so the landing page never downloads them. No CDN loads.

Do not add a backend. If a piece cannot be done locally in the browser, stop and ask.

## Modular Structure

Share chrome across pieces. Keep each piece extractable: its route, its module, and its thumbnail should be the only places that know it exists, plus one metadata entry.

1. **Piece registry (`frontend/src/lib/pieces.ts`)**
   - Data only: `slug`, `title`, `description`, `tags`, thumbnail path.
   - The landing page filters this list for search. It must not import anything under `frontend/src/lib/pieces/<slug>/`.
2. **Core (`frontend/src/lib/core/`)**
   - Shared UI so pieces do not invent their own controls. Currently: `InfoHint` (instant tooltip behind an info icon, `position: fixed` so it cannot be clipped; do not use the native `title` attribute for hints).
   - Add shared controls here when a second piece needs them (sliders, play/pause, reset, fullscreen canvas).
3. **One module per piece (`frontend/src/lib/pieces/<slug>/`)**
   - Entry component `Piece.svelte`, plus any simulation / rendering logic.
   - Route: `frontend/src/routes/<slug>/+page.svelte`, which imports that module and nothing from other pieces. Add `+page.ts` with `export const ssr = false;` when the piece needs browser-only APIs at load.
   - Thumbnail: a small static SVG at `frontend/static/pieces/<slug>.svg`, referenced by the registry. Not a screenshot and not a live render.

Piece names are the source of truth. The slug is the kebab-case form of the name in `IDEA.md`, and the route, module folder, and thumbnail follow it (see `AGENTS.md`).

Pieces:

| Slug | Route | Architectural notes |
| --- | --- | --- |
| _none yet_ | | |

## SvelteKit 3 notes

- Config lives in `frontend/vite.config.ts` (`sveltekit({ adapter })`); there is no `svelte.config.js`.
- `$lib` is gone: use the subpath import `#lib/...` (mapped in `frontend/package.json` `imports`).
- TypeScript is pinned to 5.x; SvelteKit 3.1 does not work with TypeScript 7 yet.

## Coding Conventions

- Keep the root `Makefile` up to date. `make dev` installs if needed and starts the Vite dev server. `make check` runs `svelte-check`. `make build` runs the production build.
- Animations use `requestAnimationFrame`, pause when the tab is hidden, and respect `prefers-reduced-motion` (start paused or slowed).
- Canvases handle `devicePixelRatio` and resize with their container.
- Prefer small dependencies; the platform first.
- Shared controls come from `frontend/src/lib/core/`. A one-off control stays inside the piece module.
