# Brush research and implementation — 2026-10-17

Research uses existing separate checkouts under `MyCut-research`, not vendored app sources.
GitHub landing pages were checked; code analysis and tests below are pinned to local SHAs,
not a claim that these are the newest upstream revisions. Both checkouts were clean.

| Source / commit | Real source inspected | Finding / dependencies | Decision |
| --- | --- | --- | --- |
| PhotoCraft `c11ef015b7640b4dad43bf775373fd345902e382` | `crates/paint/src/brush.rs`, `dynamics.rs`, `render.rs`, `brush_tests.rs`; `crates/engine/tests/brush_smoothing.rs`; `crates/ui-egui/src/brush_sections.rs` | Serializable brush settings; incremental smoothing (exponential or pulled string), arc-length dab generation, flow and stroke-opacity separation, pressure, tiled raster coverage. Paint depends on geom, color, raster and serde; egui controls belong to UI. | **C now**, possible **B later** for a Rust/WASM paint adapter. Direct use requires a Rust build/binding and a raster integration, not a JavaScript import. Medium/high integration cost; no fork needed for this implementation. |
| craft-libs `8f5a2831614e632f91ad367f7af2a6e5b61b9529` | root README/Cargo.toml/AGENTS/LICENSE-MIT; `crates/ui/src/lib.rs` | Shared egui buttons, icons, docking, layout, theme, settings and color-management libraries. No brush crate in this checkout. `craft-ui` requires egui; not a React widget library. | **C** for UI/core boundary, **D for direct brush integration** (no brush component). An optional Rust adapter is future work, not added. |

Licenses: both roots declare MIT OR Apache-2.0. Their MIT files name © 2026 ArtCraft
Team and respective contributors; copied substantial code would require keeping that
notice and permission text, or Apache compliance if choosing Apache. Per-file/assets
exceptions must be checked before extraction. No Rust source, assets, trademarks, or
third-party dependencies were copied into this prototype: the JavaScript/SVG pipeline
is an original architecture-level implementation, category C, not a port of PhotoCraft.

## Verified upstream component

`cargo test --manifest-path MyCut-research/photocraft/Cargo.toml -p photocraft-paint --lib --offline`
with the existing local toolchain/cache: **105 passed, 0 failed**. Tests cover smoothing,
spacing, coverage, pressure, opacity, determinism and more. This does not test the whole
PhotoCraft application or establish feature parity for MyCut. craft-libs code is not linked
and was not rebuilt as a brush dependency, because there is none in this revision.

## MyCut implementation

- `src/brush-engine.mjs`: validated per-stroke settings, incremental Smooth / Pulled string /
  Off, interpolated arc-length dabs, optional pressure-size. Mouse uses full pressure.
- `src/brush-renderer.jsx`: hard round, soft radial and flat square/elliptically scaled tips,
  angle, roundness, flow per dab, isolated opacity per stroke. Soft tip hardness capped at
  0.8 to keep a soft rim; choose Round with hardness 1 for a hard edge.
- `src/tools.mjs`: controls are generated from the existing common Tool descriptor;
  changing tip leaves smoothing and previously painted strokes unchanged.
- `src/tool-canvas.jsx`: coalesced pointer samples, live rendering, final endpoint catch-up,
  inherited lock/visibility guards, selected-layer paint and one gesture / one Undo.
- Legacy path strokes still render unchanged. Flat-tip content bounds conservatively
  include rotated square corners. Compact new stroke coordinates preserve pressure.

## Explicit limits

This remains SVG painting, not PhotoCraft's sparse tiled rasterizer. No ABR/sample-tip
import, textures, scattering, blend modes, tilt, smudge, time-based airbrush, ICC paint,
GPU brush compute or bit-depth support was added. No claim of full PhotoCraft parity.
The geometry pipeline is local-object based: a nonuniformly transformed layer can distort
the paint footprint, as before. Smooth strength is measured in object units, not zoom-invariant
screen units. There is no timed catch-up while stationary; release connects the endpoint.

Interactive strokes retain up to 10,000 accepted points. SVG work is capped at 6,000 dabs:
extremely long/dense strokes increase effective spacing to cover the full path rather than
silently clipping its tail. Bounds can therefore be conservative. Pressure support is tested
with synthetic samples; physical tablet/device/driver behavior is not verified here.

## Checks

MyCut build and all **65 unit tests passed** (five new brush cases). `tests/brush-ui.mjs`
checks live render, tip changes, softness/flow, immutable old stroke settings, Undo/Redo
and Escape cancellation in the real Electron window: **passed**. Existing workflow-ui,
tools-ui and commands-ui also passed. The screenshot `test-results/brush/brush-types.png`
was visually inspected: all controls remain accessible in wrapping rows and the canvas
shows hard, soft and flat strokes. The first new UI run failed on the test's `.1` range
input literal (Chromium requires `0.1`); correcting that test input produced the pass.

Sources: [PhotoCraft](https://github.com/storytold/photocraft),
[craft-libs](https://github.com/storytold/craft-libs).
