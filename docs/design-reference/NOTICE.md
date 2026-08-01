# Design Reference (Historical) — Notice

This directory contains historical design-tool export material from an earlier
design-handoff pass. It is retained for reference only.

- **Not production source code.** Nothing here ships to users.
- **Not imported by the application.** No file under `src/` or any build
  config (`vite.config.js`, `tsconfig*.json`, `package.json`) references this
  directory as a module path.
- **Not part of the runtime or build.** Vite never touches this directory
  when building or serving the app.
- **Some exported files contain unresolved or invalid code.** In particular,
  see `UNRESOLVED/`, where the design tool itself could not fully resolve
  the export. Do not copy from this directory without review.
- **Production UI must use `src/components/ui` and `src/styles/beautyroute`.**
  Those are the real, verified, in-use component library and design tokens.

This directory is retained only to support review during a future visual
redesign — as a source of prior design intent, not as code to build on
directly.

The original design-tool handoff index is preserved unchanged at
[`README.md`](./README.md) in this same directory.
