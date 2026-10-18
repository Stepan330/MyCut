# Vendored Craft UI

Source: https://github.com/storytold/craft-libs
Commit: 8f5a2831614e632f91ad367f7af2a6e5b61b9529
Subdirectory: crates/ui/src (library only, no editor applications or branded assets).

Source files are unmodified. The standalone Cargo.toml replaces workspace-inherited
metadata and pins egui to MyCut's existing 0.36.2. Optional serde is enabled by MyCut.
Upstream licenses and NOTICE are included; MyCut uses the MIT option.

The docking/layout/tab implementation is used through MyCut's workspace adapter.
Application documents, panel policies and persistence remain owned by MyCut.
