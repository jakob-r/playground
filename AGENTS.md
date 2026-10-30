# AGENTS

General concept lives in `IDEA.md`.
Architecture, patterns, and tech stack live in `ARCHITECTURE.md`.
Agents update `ARCHITECTURE.md` (and this file) as they make decisions.

## Frontend

Browser only. There is no backend. Anything the visitor puts in (drawings, text, files, camera, microphone) never leaves the browser: no API calls, analytics, or CDN requests that include that content.

One exception: a third-party request derived from visitor input is allowed only when it is opt-in (off by default), its label says where the request goes, and an info hint says what that party learns.

WebAssembly, WebGL, WebGPU, Web Audio and workers are all fine when a piece needs them. Only that piece's route loads them.

Each piece is its own route. The landing page and shared layout load piece metadata only, not piece implementations.

## Local Development (`Makefile`)

Agents should always create or update the root `Makefile` so running the project locally can be done with `make dev`.

## Git

We use git, all on the main branch.
Agents commit and push to the main branch regularly.
If you encounter unstaged changes, commit them when it looks like they were simply left uncommitted. Otherwise ask the user to commit.

## Naming

A piece's name is the source of truth. Its slug is the kebab-case form of the name, and its route, module folder (`frontend/src/lib/pieces/<slug>/`), thumbnail (`frontend/static/pieces/<slug>.svg`), and registry entry all use that slug. Renaming a piece means renaming all of these together.
