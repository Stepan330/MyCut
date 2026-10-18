#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
//! Working photo slice; legacy MyCut remains a separate application.
use crate::ui_core::UiComponents;
use eframe::egui::{self, Color32, Pos2, Rect, Sense, Vec2};
use mycut_photo_core::{Document, History, RasterAction};
use std::{path::PathBuf, sync::mpsc};
mod browser;
mod icons;
mod interaction;
mod properties;
mod text_edit;
mod theme;
mod ui_core;
mod ui_lab;
mod ui_settings;
mod workspace;
use icons::{Icon, button as icon_button};

#[derive(Clone, Copy, PartialEq, Debug)]
enum Scene {
    PhotoEditor,
    UiLab,
}

#[derive(Clone, Copy, PartialEq)]
enum Tool {
    Move,
    Brush,
    Eraser,
    Crop,
    Pan,
    Text,
}
enum Job {
    Open(PathBuf),
    Import(Document, PathBuf),
    Save(Document, PathBuf),
    Export(Document, PathBuf),
    Filter(Document, RasterAction),
}
enum JobResult {
    Replace(Document, bool, Option<PathBuf>),
    Saved(PathBuf),
    Exported(PathBuf),
}
struct App {
    doc: Document,
    history: History,
    tool: Tool,
    color: [u8; 4],
    radius: f32,
    zoom: f32,
    fit_pending: bool,
    pan: Vec2,
    texture: Option<egui::TextureHandle>,
    preview_dirty: bool,
    status: String,
    error: Option<String>,
    pending: Option<mpsc::Receiver<Result<JobResult, String>>>,
    preview_tx: mpsc::Sender<(u64, Document)>,
    preview_rx: mpsc::Receiver<(u64, egui::ColorImage)>,
    revision: u64,
    preview_floor: u64,
    displayed_revision: Option<u64>,
    preview_sent: Option<u64>,
    gesture: bool,
    last: Option<Pos2>,
    move_origin: Option<[i32; 2]>,
    crop_start: Option<Pos2>,
    crop: Option<Rect>,
    path: Option<PathBuf>,
    dirty: bool,
    resize_open: bool,
    resize: [u32; 2],
    brightness: i32,
    contrast: f32,
    blur: f32,
    confirm: Option<Job>,
    confirm_new: bool,
    confirm_close: bool,
    capture: Option<PathBuf>,
    capture_requested: bool,
    capture_frames: u32,
    settings: interaction::Settings,
    settings_open: bool,
    motion: interaction::Motion,
    gizmo: interaction::Gizmo,
    transform_drag: Option<interaction::TransformDrag>,
    text_edit: Option<text_edit::TextSession>,
    text_size: f32,
    text_font: String,
    font_cache: std::collections::HashMap<String, std::sync::Arc<Vec<u8>>>,
    ui_zone_extra: f32,
    browser: browser::Browser,
    outliner_global: bool,
    outliner_view: ui_core::outliner::Outliner,
    transform_linked: bool,
    settings_search: String,
    settings_tab: u8,
    workspace: workspace::Workspace,
    persist_ui: bool,
    scene: Scene,
    ui_lab: ui_lab::UiLab,
}
impl App {
    fn new(cc: &eframe::CreationContext<'_>) -> Self {
        if let Some(state) = &cc.wgpu_render_state {
            eprintln!("MyCut GPU adapter: {:?}", state.adapter.get_info());
        }
        let mut app = Self::from_context(&cc.egui_ctx);
        ui_core::unreal_theme::fonts(&cc.egui_ctx);
        app.persist_ui = true;
        app.fit_pending = true;
        app.load_interface(&cc.egui_ctx);
        app.scene = Scene::UiLab;
        app.ui_lab.concept_view = true;
        app.ui_lab.unreal_view = true;
        if let Some(path) = ui_lab::UiLab::path()
            && path.exists()
            && let Err(e) = app.ui_lab.load(&path)
        {
            app.ui_lab.message = format!("Could not load UI Lab preset: {e}");
        }
        if let Some(path) = workspace::Workspace::path()
            && path.exists()
        {
            match workspace::Workspace::load(&path) {
                Ok(layout) => {
                    app.browser.open = layout.layout.contains(&workspace::PanelId::ContentBrowser);
                    app.workspace = layout;
                }
                Err(e) => {
                    app.error = Some(format!(
                        "Workspace settings could not be loaded; default layout restored: {e}"
                    ))
                }
            }
        }
        app
    }
    fn from_context(context: &egui::Context) -> Self {
        context.set_visuals(egui::Visuals::dark());
        context.style_mut_of(egui::Theme::Dark, |style| {
            style.spacing.item_spacing = Vec2::new(5., 3.);
            style.interaction.interact_radius = 7.;
            style.visuals.panel_fill = Color32::from_rgb(15, 26, 38);
            style.visuals.window_fill = Color32::from_rgb(21, 35, 49);
            style.visuals.extreme_bg_color = Color32::from_rgb(8, 17, 27);
            style.visuals.selection.bg_fill = Color32::from_rgb(15, 87, 98);
        });
        theme::apply(context);
        let (tx, rx) = mpsc::channel::<(u64, Document)>();
        let (out_tx, out_rx) = mpsc::channel();
        let ctx = context.clone();
        std::thread::spawn(move || {
            while let Ok(mut request) = rx.recv() {
                while let Ok(new) = rx.try_recv() {
                    request = new;
                }
                let image = request.1.composite();
                let display = if image.width().max(image.height()) > 2048 {
                    let ratio = 2048. / image.width().max(image.height()) as f32;
                    image::imageops::thumbnail(
                        &image,
                        (image.width() as f32 * ratio).round().max(1.) as u32,
                        (image.height() as f32 * ratio).round().max(1.) as u32,
                    )
                } else {
                    image
                };
                let size = [display.width() as usize, display.height() as usize];
                if out_tx
                    .send((
                        request.0,
                        egui::ColorImage::from_rgba_unmultiplied(size, display.as_raw()),
                    ))
                    .is_err()
                {
                    break;
                }
                ctx.request_repaint();
            }
        });
        Self {
            doc: blank_document(),
            history: History::default(),
            tool: Tool::Move,
            color: [48, 209, 220, 255],
            radius: 18.,
            zoom: 0.7,
            fit_pending: false,
            pan: Vec2::ZERO,
            texture: None,
            preview_dirty: true,
            status: "MyCut Next · Photo preview · Open an image or add a blank layer".into(),
            error: None,
            pending: None,
            preview_tx: tx,
            preview_rx: out_rx,
            revision: 0,
            preview_floor: 0,
            displayed_revision: None,
            preview_sent: None,
            gesture: false,
            last: None,
            move_origin: None,
            crop_start: None,
            crop: None,
            path: None,
            dirty: false,
            resize_open: false,
            resize: [1280, 720],
            brightness: 0,
            contrast: 0.,
            blur: 2.,
            confirm: None,
            confirm_new: false,
            confirm_close: false,
            capture: None,
            capture_requested: false,
            capture_frames: 0,
            workspace: workspace::Workspace::default(),
            persist_ui: false,
            scene: Scene::PhotoEditor,
            ui_lab: ui_lab::UiLab::default(),
            settings: interaction::Settings::default(),
            settings_open: false,
            motion: interaction::Motion::default(),
            gizmo: interaction::Gizmo::default(),
            transform_drag: None,
            text_edit: None,
            text_size: 48.,
            text_font: "C:/Windows/Fonts/arial.ttf".into(),
            font_cache: Default::default(),
            ui_zone_extra: 0.,
            browser: browser::Browser::new(),
            outliner_global: false,
            outliner_view: ui_core::outliner::Outliner::in_scene_order(),
            transform_linked: true,
            settings_search: String::new(),
            settings_tab: 0,
        }
    }
    fn changed(&mut self) {
        self.changed_continuously();
        // Undo, document replacement and discrete commands invalidate older snapshots.
        self.preview_floor = self.revision;
    }
    fn changed_continuously(&mut self) {
        self.revision += 1;
        self.preview_dirty = true;
        self.dirty = true;
    }
    fn command(&mut self, edit: impl FnOnce(&mut Document) -> Result<(), String>) {
        self.finish_text(true);
        if self.text_edit.is_some() {
            return;
        }
        self.history.commit();
        self.history.begin(&self.doc);
        match edit(&mut self.doc) {
            Ok(()) => {
                self.history.commit();
                self.changed();
            }
            Err(e) => {
                self.history.cancel(&mut self.doc);
                self.error = Some(e);
            }
        }
    }
    fn launch(&mut self, job: Job) {
        self.finish_text(true);
        if self.text_edit.is_some() {
            return;
        }
        if self.pending.is_some() {
            return;
        }
        let (tx, rx) = mpsc::channel();
        let job_ctx = job;
        std::thread::spawn(move || {
            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| match job_ctx {
                Job::Open(path) => {
                    let doc = if path
                        .extension()
                        .is_some_and(|e| e.eq_ignore_ascii_case("mycutnext"))
                    {
                        Document::open(&path)
                    } else {
                        Document::from_image(&path)
                    };
                    doc.map(|d| JobResult::Replace(d, false, Some(path)))
                }
                Job::Import(mut d, p) => d
                    .import_layer(&p)
                    .map(|_| JobResult::Replace(d, true, None)),
                Job::Filter(mut d, a) => d.apply(a).map(|_| JobResult::Replace(d, true, None)),
                Job::Save(d, p) => d.save(&p).map(|_| JobResult::Saved(p)),
                Job::Export(d, p) => d.export(&p).map(|_| JobResult::Exported(p)),
            }))
            .unwrap_or_else(|_| Err("Operation failed; the current document is unchanged".into()));
            let _ = tx.send(result);
        });
        self.pending = Some(rx);
        self.status = "Processing… the current document is preserved".into();
    }
    fn open_dialog(&mut self, import: bool) {
        if let Some(path) = rfd::FileDialog::new()
            .add_filter(
                "Images / MyCut Next",
                &[
                    "png",
                    "jpg",
                    "jpeg",
                    "bmp",
                    "tiff",
                    "tif",
                    "webp",
                    "mycutnext",
                ],
            )
            .pick_file()
        {
            let job = if import {
                Job::Import(self.doc.clone(), path)
            } else {
                Job::Open(path)
            };
            if !import && self.dirty {
                self.confirm = Some(job);
            } else {
                self.launch(job);
            }
        }
    }
    fn save_dialog(&mut self, export: bool) {
        let dialog = rfd::FileDialog::new();
        let dialog = if export {
            dialog
                .add_filter("PNG", &["png"])
                .add_filter("JPEG", &["jpg"])
                .set_file_name("MyCut.png")
        } else {
            dialog
                .add_filter("MyCut Next project", &["mycutnext"])
                .set_file_name("Untitled.mycutnext")
        };
        if let Some(path) = dialog.save_file() {
            self.launch(if export {
                Job::Export(self.doc.clone(), path)
            } else {
                Job::Save(self.doc.clone(), path)
            });
        }
    }
    fn process(&mut self, ctx: &egui::Context) {
        if let Some(rx) = &self.pending {
            if let Ok(result) = rx.try_recv() {
                self.pending = None;
                match result {
                    Ok(JobResult::Replace(doc, undo, source)) => {
                        if undo {
                            self.history.begin(&self.doc);
                            self.history.commit();
                        } else {
                            self.history = History::default();
                            self.path = source;
                            self.pan = Vec2::ZERO;
                            self.zoom = 0.7;
                            self.fit_pending = true;
                        }
                        self.doc = doc;
                        self.crop = None;
                        self.changed();
                        self.dirty = undo;
                        self.status = "Ready".into();
                    }
                    Ok(JobResult::Saved(path)) => {
                        self.status = format!("Saved {}", path.display());
                        self.path = Some(path);
                        self.dirty = false;
                    }
                    Ok(JobResult::Exported(path)) => {
                        self.status = format!("Exported {}", path.display())
                    }
                    Err(e) => {
                        self.error = Some(e);
                        self.status = "Operation failed; document preserved".into();
                    }
                }
            } else {
                ctx.request_repaint_after(std::time::Duration::from_millis(30));
            }
        }
        while let Ok((revision, image)) = self.preview_rx.try_recv() {
            if self.preview_sent == Some(revision) {
                self.preview_sent = None;
            }
            // A completed intermediate frame is useful while a gesture continues.
            // Never flash a snapshot from before Undo/Cancel/Open or regress in time.
            if revision >= self.preview_floor
                && revision <= self.revision
                && self.displayed_revision.is_none_or(|shown| revision > shown)
            {
                if let Some(texture) = &mut self.texture {
                    texture.set(image, egui::TextureOptions::LINEAR);
                } else {
                    self.texture =
                        Some(ctx.load_texture("canvas", image, egui::TextureOptions::LINEAR));
                }
                self.displayed_revision = Some(revision);
            }
        }
    }
    fn queue_preview(&mut self, ctx: &egui::Context) {
        // At most one raster snapshot in flight. Rapid gestures coalesce to the latest revision.
        if self.preview_dirty && self.preview_sent.is_none() {
            let mut preview = self.doc.clone();
            if let Some(edit) = &self.text_edit
                && let Some(layer) = preview.layers.iter_mut().find(|l| l.id == edit.id)
            {
                layer.visible = false;
            }
            if self.preview_tx.send((self.revision, preview)).is_ok() {
                self.preview_sent = Some(self.revision);
                self.preview_dirty = false;
            } else {
                self.preview_dirty = false;
                self.error =
                    Some("Preview worker stopped; save your project and restart MyCut Next".into());
            }
        }
        // Do not rely on another mouse event (or only on a cross-thread wakeup).
        // Poll only while work is outstanding; an idle document stays event-driven.
        if self.preview_sent.is_some() || self.preview_dirty {
            ctx.request_repaint_after(std::time::Duration::from_millis(16));
        }
    }
    fn tools_panel(&mut self, ui: &mut egui::Ui) {
        egui::ScrollArea::vertical().show(ui, |ui| {
            for (tool, icon, hint) in [
                (Tool::Move, Icon::Move, "Move · V"),
                (Tool::Brush, Icon::Brush, "Brush · B"),
                (Tool::Eraser, Icon::Eraser, "Eraser · E"),
                (Tool::Crop, Icon::Crop, "Crop · C"),
                (Tool::Pan, Icon::Pan, "Pan · H / Space"),
                (Tool::Text, Icon::Text, "Text · T"),
            ] {
                if icon_button(ui, icon, self.tool == tool, hint).clicked() {
                    self.finish_text(true);
                    if self.text_edit.is_none() {
                        self.tool = tool;
                    }
                }
            }
        });
    }
    fn outliner_panel(&mut self, ui: &mut egui::Ui) {
        ui.hbox(|ui| {
            ui.selectable_value(&mut self.outliner_global, false, "Local · Layers");
            ui.selectable_value(&mut self.outliner_global, true, "Global");
        });
        self.outliner(ui);
    }
    fn outliner(&mut self, ui: &mut egui::Ui) {
        ui.hbox(|ui| {
            if icon_button(ui, Icon::Add, false, "Transparent layer").clicked() {
                self.command(|d| {
                    d.add_image(
                        "Paint layer".into(),
                        image::RgbaImage::new(d.width, d.height),
                    )?;
                    Ok(())
                });
            }
            if icon_button(ui, Icon::Duplicate, false, "Duplicate layer").clicked() {
                self.command(|d| {
                    let l = d.selected().ok_or("Select a layer")?.clone();
                    let id = d.add_image(format!("{} copy", l.name), l.pixels.as_ref().clone())?;
                    let copy = d.selected_mut().unwrap();
                    copy.x = l.x;
                    copy.y = l.y;
                    copy.opacity = l.opacity;
                    copy.visible = l.visible;
                    copy.transform = l.transform;
                    copy.text = l.text;
                    d.selected = Some(id);
                    Ok(())
                });
            }
            if icon_button(ui, Icon::Delete, false, "Delete layer").clicked() {
                self.command(|d| {
                    let id = d.selected.ok_or("Select a layer")?;
                    d.layers.retain(|l| l.id != id);
                    d.selected = d.layers.last().map(|l| l.id);
                    Ok(())
                });
            }
            for (icon, step) in [(Icon::Up, 1_isize), (Icon::Down, -1)] {
                if icon_button(ui, icon, false, "Move layer up/down").clicked() {
                    self.command(|d| {
                        let i = d
                            .layers
                            .iter()
                            .position(|l| Some(l.id) == d.selected)
                            .ok_or("Select a layer")?;
                        let j = i as isize + step;
                        if j >= 0 && (j as usize) < d.layers.len() {
                            d.layers.swap(i, j as usize);
                        }
                        Ok(())
                    });
                }
            }
        });
        use ui_core::outliner::{OutlinerOptions, OutlinerRow};
        let title = self
            .path
            .as_ref()
            .and_then(|p| p.file_name())
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or("Untitled image".into());
        let global_roots = [("Project", "Project"), (title.as_str(), "Image")];
        let rows: Vec<_> = self
            .doc
            .layers
            .iter()
            .rev()
            .map(|l| OutlinerRow {
                id: l.id,
                label: &l.name,
                kind: if l.text.is_some() { "Text" } else { "Raster" },
                icon: if l.text.is_some() {
                    Icon::Text
                } else {
                    Icon::Image
                },
                visible: l.visible,
            })
            .collect();
        let actions = self.outliner_view.show(
            ui,
            &rows,
            self.doc.selected,
            OutlinerOptions {
                roots: if self.outliner_global {
                    &global_roots
                } else {
                    &[]
                },
                noun: "layers",
                ..Default::default()
            },
        );
        for action in actions {
            self.apply_outliner_action(action);
        }
    }
    fn apply_outliner_action(&mut self, action: ui_core::outliner::Action) {
        use ui_core::outliner::Action;
        match action {
            Action::Select(id) if self.doc.layers.iter().any(|l| l.id == id) => {
                if self.doc.selected != Some(id) {
                    self.finish_text(true);
                    if self.text_edit.is_none() {
                        self.doc.selected = Some(id);
                    }
                }
            }
            Action::ToggleVisibility(id) => self.command(|d| {
                let layer = d
                    .layers
                    .iter_mut()
                    .find(|l| l.id == id)
                    .ok_or("Layer no longer exists")?;
                layer.visible = !layer.visible;
                Ok(())
            }),
            _ => {}
        }
    }
    fn details(&mut self, ui: &mut egui::Ui) {
        if let Some(layer) = self.doc.selected().cloned() {
            ui.small_text(if layer.text.is_some() {
                "EDITABLE TEXT"
            } else {
                "RASTER LAYER"
            });
            if layer.text.is_some() {
                ui.hbox(|ui| {
                    if ui.action("Edit text").clicked() {
                        self.begin_text([layer.x as f32, layer.y as f32], Some(layer.id), ui.ctx());
                    }
                    if ui.action("Rasterize text").clicked() {
                        self.command(|d| {
                            d.selected_mut().unwrap().text = None;
                            Ok(())
                        });
                    }
                });
            }
            let mut name = layer.name.clone();
            let response = ui.input(&mut name);
            if response.changed() {
                self.history.begin(&self.doc);
                self.doc.selected_mut().unwrap().name = name;
                self.dirty = true;
            }
            if response.lost_focus() {
                self.history.commit();
            }
            let mut locked = layer.locked;
            if ui.checkbox(&mut locked, "Lock layer").changed() {
                self.command(|d| {
                    d.selected_mut().unwrap().locked = locked;
                    Ok(())
                });
            }
            self.transform_details(ui, &layer);
            ui.separator();
            egui::CollapsingHeader::new("Image adjustments")
                .default_open(true)
                .show(ui, |ui| {
                    ui.flow_box(|ui| {
                        for (name, action) in [
                            ("Rotate 90°", RasterAction::RotateRight),
                            ("Grayscale", RasterAction::Grayscale),
                            ("Invert", RasterAction::Invert),
                        ] {
                            if ui.action(name).clicked() {
                                self.launch(Job::Filter(self.doc.clone(), action));
                            }
                        }
                    });
                    ui.hbox(|ui| {
                        ui.text("Brightness");
                        ui.add(
                            crate::ui_core::NumberField::new(&mut self.brightness)
                                .range(-255..=255),
                        );
                        if ui.action("Apply").clicked() {
                            self.launch(Job::Filter(
                                self.doc.clone(),
                                RasterAction::Brightness(self.brightness),
                            ));
                        }
                    });
                    ui.hbox(|ui| {
                        ui.text("Contrast");
                        ui.add(
                            crate::ui_core::NumberField::new(&mut self.contrast)
                                .range(-99.0..=99.0),
                        );
                        if ui.action("Apply").clicked() {
                            self.launch(Job::Filter(
                                self.doc.clone(),
                                RasterAction::Contrast(self.contrast),
                            ));
                        }
                    });
                    ui.hbox(|ui| {
                        ui.text("Blur");
                        ui.add(crate::ui_core::NumberField::new(&mut self.blur).range(0.1..=30.0));
                        if ui.action("Apply").clicked() {
                            self.launch(Job::Filter(
                                self.doc.clone(),
                                RasterAction::Blur(self.blur),
                            ));
                        }
                    });
                });
        }
        ui.separator();
        ui.small_text("Photo slice: RGBA8 / sRGB. No legacy project import yet. Resize flattens; crop preserves layers. Filters are destructive and undoable.");
    }
    fn canvas(&mut self, ui: &mut egui::Ui) {
        let (response, painter) = ui.allocate_painter(ui.available_size(), Sense::click_and_drag());
        let rect = response.rect;
        let ctx = ui.ctx();
        // Native startup may render a provisional 10k-point viewport before the OS size arrives.
        if self.fit_pending {
            ctx.request_repaint();
        }
        if self.fit_pending && !ui.is_sizing_pass() && ctx.cumulative_frame_nr() >= 2 {
            self.zoom = ((rect.width() - 24.).max(1.) / self.doc.width as f32)
                .min((rect.height() - 24.).max(1.) / self.doc.height as f32)
                .clamp(0.03, 4.);
            self.pan = Vec2::ZERO;
            self.fit_pending = false;
        }
        if response.hovered() && !ctx.input(|i| i.modifiers.ctrl) && self.text_edit.is_none() {
            let scroll = ctx.input(|i| i.smooth_scroll_delta.y);
            if scroll != 0.0 {
                let old = self.zoom;
                self.zoom = (old * (scroll * 0.002).exp()).clamp(0.03, 12.);
                if let Some(mouse) = ctx.pointer_hover_pos() {
                    let center = rect.center() + self.pan;
                    self.pan += (mouse - center) * (1. - self.zoom / old);
                }
            }
        }
        let size = Vec2::new(self.doc.width as f32, self.doc.height as f32) * self.zoom;
        let image_rect = Rect::from_center_size(rect.center() + self.pan, size);
        let clip = image_rect.intersect(rect);
        let checker = painter.with_clip_rect(clip);
        checker.rect_filled(image_rect, 0., Color32::from_gray(39));
        let tile = 20.;
        let startx = clip.min.x.max(image_rect.min.x);
        let starty = clip.min.y.max(image_rect.min.y);
        for y in 0..((clip.height() / tile).ceil() as i32 + 1).max(0) {
            for x in 0..((clip.width() / tile).ceil() as i32 + 1).max(0) {
                if (x + y) % 2 == 0 {
                    checker.rect_filled(
                        Rect::from_min_size(
                            Pos2::new(startx + x as f32 * tile, starty + y as f32 * tile),
                            Vec2::splat(tile),
                        ),
                        0.,
                        Color32::from_gray(51),
                    );
                }
            }
        }
        if let Some(tex) = &self.texture {
            painter.image(
                tex.id(),
                image_rect,
                Rect::from_min_max(Pos2::ZERO, Pos2::new(1., 1.)),
                Color32::WHITE,
            );
        }
        let handle = if self.tool == Tool::Move && self.text_edit.is_none() {
            self.doc
                .selected()
                .filter(|l| !l.locked && l.visible)
                .and_then(|l| {
                    self.gizmo.update_draw(
                        l,
                        interaction::GizmoInput {
                            pointer: if response.hovered() || self.gesture {
                                ctx.pointer_hover_pos()
                            } else {
                                None
                            },
                            origin: image_rect.min,
                            zoom: self.zoom,
                            motion: &self.motion,
                            settings: &self.settings,
                            painter: &painter,
                            active: self.transform_drag.as_ref().map(|d| d.handle),
                        },
                    )
                })
        } else {
            None
        };
        let pointer = response.interact_pointer_pos();
        let local = pointer.map(|p| {
            Pos2::new(
                (p.x - image_rect.min.x) / self.zoom,
                (p.y - image_rect.min.y) / self.zoom,
            )
        });
        if self.text_edit.is_none()
            && response.hovered()
            && ctx.input(|i| i.pointer.primary_pressed())
            && let (Some(handle), Some(local)) = (handle, local)
            && let Some(layer) = self.doc.selected().cloned()
        {
            self.history.commit();
            self.history.begin(&self.doc);
            self.transform_drag = Some(interaction::TransformDrag::new(
                layer,
                handle,
                [local.x, local.y],
            ));
            self.gesture = true;
        }
        if let Some(drag) = &self.transform_drag {
            if let Some(local) = local {
                let modifiers = ctx.input(|i| i.modifiers);
                if let Some(layer) = self
                    .doc
                    .layers
                    .iter_mut()
                    .find(|l| l.id == drag.original.id)
                {
                    let before = layer.transform;
                    drag.update(
                        layer,
                        [local.x, local.y],
                        modifiers.shift,
                        modifiers.alt,
                        modifiers.ctrl,
                    );
                    if layer.transform != before {
                        self.changed_continuously();
                    }
                }
            }
            if !ctx.input(|i| i.pointer.primary_down()) {
                self.transform_drag = None;
                self.gesture = false;
                self.history.commit();
            }
            return;
        }
        if self.tool == Tool::Text
            && self.text_edit.is_none()
            && response.clicked()
            && let Some(local) = local
        {
            let id = self
                .doc
                .hit_test(local.x as i32, local.y as i32)
                .filter(|id| {
                    self.doc
                        .layers
                        .iter()
                        .any(|l| l.id == *id && l.text.is_some())
                });
            self.begin_text([local.x, local.y], id, ctx);
        }
        if self.tool == Tool::Move
            && response.double_clicked()
            && let Some(local) = local
            && let Some(id) = self
                .doc
                .hit_test(local.x as i32, local.y as i32)
                .filter(|id| {
                    self.doc
                        .layers
                        .iter()
                        .any(|l| l.id == *id && l.text.is_some())
                })
        {
            self.begin_text([local.x, local.y], Some(id), ctx);
        }
        if self.text_edit.is_some() {
            self.text_overlay(ctx, image_rect);
            return;
        }
        let pan = self.tool == Tool::Pan
            || ctx.input(|i| i.key_down(egui::Key::Space))
            || response.dragged_by(egui::PointerButton::Middle);
        let pressed = response.drag_started_by(egui::PointerButton::Primary)
            || response.clicked_by(egui::PointerButton::Primary);
        if pressed && !pan && self.tool != Tool::Text {
            let press = ctx
                .input(|i| i.pointer.press_origin())
                .map(|p| {
                    Pos2::new(
                        (p.x - image_rect.min.x) / self.zoom,
                        (p.y - image_rect.min.y) / self.zoom,
                    )
                })
                .or(local);
            if let (Some(pos), Some(screen)) = (press, pointer)
                && image_rect.contains(screen)
            {
                if self.tool == Tool::Crop {
                    self.crop_start = Some(pos);
                    self.crop = None;
                } else {
                    if self.tool == Tool::Move {
                        self.doc.selected = self
                            .doc
                            .hit_test(pos.x.floor() as i32, pos.y.floor() as i32);
                    }
                    self.history.commit();
                    self.history.begin(&self.doc);
                    self.gesture = true;
                    self.last = Some(pos);
                    self.move_origin = self.doc.selected().map(|l| [l.x, l.y]);
                }
            }
        }
        if pan && response.dragged() {
            self.pan += ctx.input(|i| i.pointer.delta());
        } else if self.gesture
            && let Some(pos) = local
        {
            if self.tool == Tool::Brush || self.tool == Tool::Eraser {
                let last = self.last.unwrap_or(pos);
                if (pressed || self.last != Some(pos))
                    && self.doc.stroke(
                        [last.x, last.y],
                        [pos.x, pos.y],
                        self.radius,
                        self.color,
                        self.tool == Tool::Eraser,
                    )
                {
                    self.changed_continuously();
                }
                self.last = Some(pos);
            } else if self.tool == Tool::Move
                && let (Some(start), Some(origin)) = (self.last, self.move_origin)
                && let Some(l) = self.doc.selected_mut().filter(|l| !l.locked)
            {
                let x = origin[0] + (pos.x - start.x).round() as i32;
                let y = origin[1] + (pos.y - start.y).round() as i32;
                if (l.x, l.y) != (x, y) {
                    l.x = x;
                    l.y = y;
                    self.changed_continuously();
                }
            }
        }
        if let (Some(start), Some(pos)) = (self.crop_start, local) {
            self.crop = Some(
                Rect::from_two_pos(start, pos).intersect(Rect::from_min_size(
                    Pos2::ZERO,
                    Vec2::new(self.doc.width as f32, self.doc.height as f32),
                )),
            );
        }
        if !ctx.input(|i| i.pointer.primary_down()) {
            if self.gesture {
                self.history.commit();
                self.gesture = false;
                self.last = None;
            }
            self.crop_start = None;
        }
        if let Some(crop) = self.crop {
            let r = Rect::from_min_max(
                image_rect.min + crop.min.to_vec2() * self.zoom,
                image_rect.min + crop.max.to_vec2() * self.zoom,
            );
            painter.rect_stroke(
                r,
                0.,
                egui::Stroke::new(1.5, Color32::from_rgb(48, 209, 220)),
                egui::StrokeKind::Inside,
            );
        }
        if response.hovered()
            && matches!(self.tool, Tool::Brush | Tool::Eraser)
            && let Some(pos) = pointer
        {
            painter.circle_stroke(
                pos,
                self.radius * self.zoom,
                egui::Stroke::new(1., Color32::WHITE),
            );
        }
    }
}
impl App {
    fn capture_frame(&mut self, ctx: &egui::Context, ready: bool) {
        if self.capture.is_some() {
            self.capture_frames += 1;
            let screenshot = ctx.input(|i| {
                i.events.iter().find_map(|event| {
                    if let egui::Event::Screenshot { image, .. } = event {
                        Some(image.clone())
                    } else {
                        None
                    }
                })
            });
            if let Some(image) = screenshot {
                let bytes: Vec<u8> = image.pixels.iter().flat_map(|p| p.to_array()).collect();
                let path = self.capture.take().unwrap();
                if let Err(e) = image::save_buffer(
                    &path,
                    &bytes,
                    image.width() as u32,
                    image.height() as u32,
                    image::ColorType::Rgba8,
                ) {
                    eprintln!("Capture failed: {e}");
                }
                self.dirty = false;
                ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            } else if ready && self.capture_frames >= 12 && !self.capture_requested {
                ctx.send_viewport_cmd(egui::ViewportCommand::Screenshot(egui::UserData::default()));
                self.capture_requested = true;
            }
            ctx.request_repaint_after(std::time::Duration::from_millis(50));
        }
    }
    fn show(&mut self, ui: &mut egui::Ui) {
        let ctx = ui.ctx().clone();
        if self.scene == Scene::UiLab {
            let mut lab = std::mem::take(&mut self.ui_lab);
            let editor = lab.show(ui);
            if editor {
                if self.persist_ui
                    && self.capture.is_none()
                    && let Some(path) = ui_lab::UiLab::path()
                    && let Err(e) = lab.save(&path)
                {
                    lab.message = e;
                }
                lab.leave(&ctx, self.settings.ui_scale);
                self.scene = Scene::PhotoEditor;
            }
            self.ui_lab = lab;
            self.capture_frame(&ctx, true);
            if ctx.input(|i| i.viewport().close_requested()) && self.dirty {
                ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
                self.confirm_close = true;
            }
            if self.confirm_close {
                crate::ui_core::Window::new("Unsaved photo project").show(&ctx, |ui| {
                    ui.text("Your photo project is still open in the editor.");
                    if ui.action("Return to Photo Editor to save").clicked() {
                        self.ui_lab.leave(&ctx, self.settings.ui_scale);
                        self.scene = Scene::PhotoEditor;
                        self.confirm_close = false;
                    }
                    if ui.action("Discard project and close").clicked() {
                        self.dirty = false;
                        ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                    }
                    if ui.action("Cancel").clicked() {
                        self.confirm_close = false;
                    }
                });
            }
            return;
        }
        self.motion
            .update(ctx.pointer_hover_pos(), ctx.input(|i| i.stable_dt));
        let desired = interaction::expansion(self.motion.speed, 0., &self.settings).min(12.);
        self.ui_zone_extra =
            desired.max(self.ui_zone_extra - self.settings.shrink_speed * self.motion.dt);
        ctx.style_mut_of(egui::Theme::Dark, |s| {
            s.interaction.interact_radius = 7. + self.ui_zone_extra;
            s.animation_time = 0.12 * self.settings.animation;
        });
        if self.ui_zone_extra > 0.1 {
            ctx.request_repaint_after(std::time::Duration::from_millis(16));
        }
        ctx.data_mut(|d| d.insert_temp(egui::Id::new("mycut-animation"), self.settings.animation));
        if !self.gesture && self.text_edit.is_none() {
            let ctrl_scroll = ctx.input(|i| {
                if i.modifiers.ctrl {
                    i.smooth_scroll_delta.y
                } else {
                    0.
                }
            });
            if ctrl_scroll != 0. {
                self.settings.ui_scale =
                    (self.settings.ui_scale * (ctrl_scroll * 0.002).exp()).clamp(0.65, 2.);
                ctx.set_zoom_factor(self.settings.ui_scale);
            }
            if ctx.input_mut(|i| i.consume_key(egui::Modifiers::CTRL, egui::Key::Num0)) {
                self.settings.ui_scale = 1.;
                ctx.set_zoom_factor(1.);
            }
        }
        self.process(&ctx);
        self.capture_frame(
            &ctx,
            self.texture.is_some() && (!self.browser.open || self.browser.ready()),
        );
        let busy = self.pending.is_some();
        if !busy
            && !self.gesture
            && let Some(path) =
                ctx.input(|i| i.raw.dropped_files.first().map(|f| f.path().to_owned()))
        {
            if self.dirty {
                self.confirm = Some(Job::Open(path));
            } else {
                self.launch(Job::Open(path));
            }
        }
        if !busy && !self.gesture && self.text_edit.is_none() && !ctx.egui_wants_keyboard_input() {
            if ctx.input_mut(|i| i.consume_key(egui::Modifiers::CTRL, egui::Key::Z)) {
                self.history.undo(&mut self.doc);
                self.changed();
            }
            if ctx.input_mut(|i| i.consume_key(egui::Modifiers::CTRL, egui::Key::Y)) {
                self.history.redo(&mut self.doc);
                self.changed();
            }
            if ctx.input_mut(|i| i.consume_key(egui::Modifiers::CTRL, egui::Key::O)) {
                self.open_dialog(false);
            }
            if ctx.input_mut(|i| i.consume_key(egui::Modifiers::CTRL, egui::Key::S)) {
                self.save_dialog(false);
            }
            for (key, tool) in [
                (egui::Key::V, Tool::Move),
                (egui::Key::B, Tool::Brush),
                (egui::Key::E, Tool::Eraser),
                (egui::Key::C, Tool::Crop),
                (egui::Key::H, Tool::Pan),
                (egui::Key::T, Tool::Text),
            ] {
                if ctx.input(|i| i.key_pressed(key)) {
                    self.tool = tool;
                }
            }
        }
        if !busy && ctx.input(|i| i.key_pressed(egui::Key::Escape)) {
            if self.text_edit.is_some() {
                self.finish_text(false);
            } else {
                self.history.cancel(&mut self.doc);
                self.changed();
            }
            self.gesture = false;
            self.transform_drag = None;
            self.crop = None;
            self.crop_start = None;
        }
        if self.text_edit.is_some()
            && ctx.input_mut(|i| i.consume_key(egui::Modifiers::CTRL, egui::Key::Enter))
        {
            self.finish_text(true);
        }
        egui::Panel::top("header").show(ui, |ui| {
            ui.add_enabled_ui(!busy && !self.gesture && self.text_edit.is_none(), |ui| {
                ui.hbox(|ui| {
                    ui.emphasis("MyCut Next");
                    ui.small_text("Photo preview");
                    if ui.action("UI Lab").clicked() {
                        self.scene = Scene::UiLab;
                    }
                    if icon_button(ui, Icon::Settings, false, "Interface settings / UI scale")
                        .clicked()
                    {
                        self.settings_open = !self.settings_open;
                    }
                    if icon_button(ui, Icon::Open, self.browser.open, "Content Browser").clicked() {
                        self.browser.open = !self.browser.open;
                    }
                    if icon_button(ui, Icon::New, false, "New document").clicked() {
                        self.confirm_new = true;
                    }
                    if icon_button(ui, Icon::Open, false, "Open image/project · Ctrl+O").clicked()
                    {
                        self.open_dialog(false);
                    }
                    if icon_button(ui, Icon::Add, false, "Import image as layer").clicked() {
                        self.open_dialog(true);
                    }
                    if icon_button(ui, Icon::Save, false, "Save project · Ctrl+S").clicked() {
                        self.save_dialog(false);
                    }
                    if icon_button(ui, Icon::Export, false, "Export image").clicked() {
                        self.save_dialog(true);
                    }
                    if ui
                        .add_enabled_ui(self.history.can_undo(), |ui| {
                            icon_button(ui, Icon::Undo, false, "Undo · Ctrl+Z")
                        })
                        .inner
                        .clicked()
                    {
                        self.history.undo(&mut self.doc);
                        self.changed();
                    }
                    if ui
                        .add_enabled_ui(self.history.can_redo(), |ui| {
                            icon_button(ui, Icon::Redo, false, "Redo · Ctrl+Y")
                        })
                        .inner
                        .clicked()
                    {
                        self.history.redo(&mut self.doc);
                        self.changed();
                    }
                    if icon_button(ui, Icon::Resize, false, "Resize image").clicked() {
                        self.resize = [self.doc.width, self.doc.height];
                        self.resize_open = true;
                    }
                    if self.dirty {
                        ui.text("●");
                    }
                });
            });
        });
        egui::Panel::bottom("status").show(ui, |ui| {
            ui.hbox(|ui| {
                if busy {
                    ui.spinner();
                }
                ui.small_text(&self.status);
                ui.separator();
                ui.small_text(format!(
                    "{} × {} · {} layers · {:.0}%",
                    self.doc.width,
                    self.doc.height,
                    self.doc.layers.len(),
                    self.zoom * 100.
                ));
            });
        });
        egui::Panel::top("options").show(ui, |ui| {
            ui.add_enabled_ui(!busy && !self.gesture, |ui| {
                ui.hbox(|ui| {
                    if self.tool == Tool::Text {
                        self.text_options(ui);
                    }
                    if matches!(self.tool, Tool::Brush | Tool::Eraser) {
                        ui.text("Radius");
                        ui.add(
                            crate::ui_core::NumberField::new(&mut self.radius)
                                .range(0.5..=256.0)
                                .suffix(" px"),
                        );
                        ui.color_edit_button_srgba_unmultiplied(&mut self.color);
                    }
                    if self.tool == Tool::Crop {
                        ui.text("Drag a rectangle → Apply crop");
                        if ui
                            .add_enabled(
                                self.crop.is_some(),
                                crate::ui_core::Button::new("Apply crop"),
                            )
                            .clicked()
                            && let Some(r) = self.crop.take()
                        {
                            let x = r.min.x.floor().max(0.) as u32;
                            let y = r.min.y.floor().max(0.) as u32;
                            let w = (r.max.x.floor() as u32).saturating_sub(x);
                            let h = (r.max.y.floor() as u32).saturating_sub(y);
                            self.command(|d| d.crop(x, y, w, h));
                        }
                    }
                    if ui.action("Fit").clicked() {
                        self.fit_pending = true;
                    }
                    ui.small_text("Wheel: zoom · Space + drag: pan · Esc: cancel");
                });
            });
        });
        egui::CentralPanel::default().show(ui, |ui| {
            self.workspace(ui);
        });
        if !self.gesture && self.text_edit.is_none() {
            self.interface_controls(&ctx);
        }
        if self.resize_open {
            let mut open = true;
            crate::ui_core::Window::new("Resize canvas image")
                .resizable(true)
                .default_size([360., 200.])
                .open(&mut open)
                .show(&ctx, |ui| {
                    ui.text("Destructive resize flattens layers; Undo restores them.");
                    ui.add(
                        crate::ui_core::NumberField::new(&mut self.resize[0])
                            .range(1..=16384)
                            .prefix("Width "),
                    );
                    ui.add(
                        crate::ui_core::NumberField::new(&mut self.resize[1])
                            .range(1..=16384)
                            .prefix("Height "),
                    );
                    if ui.action("Resize").clicked() {
                        let [w, h] = self.resize;
                        self.command(|d| d.resize(w, h));
                        self.resize_open = false;
                    }
                });
            self.resize_open &= open;
        }
        if self.confirm.is_some() || self.confirm_new {
            crate::ui_core::Window::new("Replace current document?")
                .collapsible(false)
                .show(&ctx, |ui| {
                    ui.text("Unsaved changes will be discarded. Cancel to save first.");
                    ui.hbox(|ui| {
                        if ui.action("Discard and continue").clicked() {
                            if let Some(job) = self.confirm.take() {
                                self.launch(job);
                            } else {
                                self.doc = blank_document();
                                self.history = History::default();
                                self.path = None;
                                self.changed();
                                self.dirty = false;
                            }
                            self.confirm_new = false;
                        }
                        if ui.action("Cancel").clicked() {
                            self.confirm = None;
                            self.confirm_new = false;
                        }
                    });
                });
        }
        if let Some(error) = self.error.clone() {
            crate::ui_core::Window::new("Operation failed")
                .collapsible(false)
                .show(&ctx, |ui| {
                    ui.colored_text(Color32::LIGHT_RED, error);
                    if ui.action("OK").clicked() {
                        self.error = None;
                    }
                });
        }
        if ctx.input(|i| i.viewport().close_requested()) && (self.dirty || busy) {
            ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
            self.confirm_close = true;
        }
        if self.confirm_close {
            crate::ui_core::Window::new("Unsaved project").show(&ctx, |ui| {
                ui.text("Save your project before closing, or explicitly discard changes.");
                ui.add_enabled_ui(!busy, |ui| {
                    if ui.action("Save project").clicked() {
                        self.save_dialog(false);
                        self.confirm_close = false;
                    }
                    if ui.action("Discard and close").clicked() {
                        self.dirty = false;
                        self.confirm_close = false;
                        ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                    }
                });
                if ui.action("Cancel").clicked() {
                    self.confirm_close = false;
                }
            });
        }
        // Inspector and canvas mutate the document during this frame. Submit AFTER
        // all input/commands, so a click or final stroke is visible without more input.
        self.queue_preview(&ctx);
    }
}
impl eframe::App for App {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        self.show(ui);
    }
    fn on_exit(&mut self) {
        if !self.capture_requested {
            if self.persist_ui
                && let Some(path) = ui_lab::UiLab::path()
                && let Err(e) = self.ui_lab.save(&path)
            {
                eprintln!("Cannot save UI Lab preset: {e}");
            }
            self.save_interface();
            if self.persist_ui
                && let Some(path) = workspace::Workspace::path()
                && let Err(e) = self.workspace.save(&path)
            {
                eprintln!("Cannot save workspace: {e}");
            }
        }
    }
}
fn main() -> eframe::Result {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1280., 800.])
            .with_min_inner_size([900., 600.]),
        renderer: eframe::Renderer::Wgpu,
        ..Default::default()
    };
    eframe::run_native(
        "MyCut Next — UI Lab / Photo Editor",
        options,
        Box::new(|cc| {
            let mut app = App::new(cc);
            let args: Vec<String> = std::env::args().collect();
            if args.iter().any(|arg| arg == "--editor") {
                app.scene = Scene::PhotoEditor;
            }
            if args.get(1).is_some_and(|arg| arg.starts_with("--capture")) {
                app.scene = if args[1].starts_with("--capture-lab") {
                    Scene::UiLab
                } else {
                    Scene::PhotoEditor
                };
                app.ui_lab = ui_lab::UiLab::default();
                if args[1] == "--capture-lab-unreal" {
                    app.ui_lab.unreal_view = true;
                }
                if args[1] == "--capture-lab-concept" {
                    app.ui_lab.concept_view = true;
                }
                if args[1] == "--capture-lab-hbox" {
                    app.ui_lab.focus_box_demo();
                }
                if args[1] == "--capture-lab-debug" {
                    app.ui_lab.config.bounds = true;
                    app.ui_lab.config.zones = true;
                    app.ui_lab.config.ids = true;
                    app.ui_lab.config.grid = true;
                }
                app.capture = args.get(2).map(PathBuf::from);
                app.doc = demo_document();
                app.settings = interaction::Settings::default();
                app.workspace = workspace::Workspace::default();
                app.persist_ui = false;
                cc.egui_ctx.set_zoom_factor(1.);
                let paint_id = app.doc.selected;
                if let Some(layer) = app.doc.selected_mut() {
                    layer.pixels = std::sync::Arc::new(
                        image::imageops::crop_imm(layer.pixels.as_ref(), 240, 120, 480, 360)
                            .to_image(),
                    );
                    layer.x = 240;
                    layer.y = 120;
                }
                if let Ok(bytes) = std::fs::read("C:/Windows/Fonts/arial.ttf") {
                    let spec = mycut_photo_core::TextSpec {
                        content: "MyCut\nCreate. Shape. Color.".into(),
                        size: 38.,
                        color: [220, 236, 240, 255],
                        font: "C:/Windows/Fonts/arial.ttf".into(),
                    };
                    if let Ok(pixels) = mycut_photo_core::render_text(&spec, &bytes)
                        && app.doc.add_image("MyCut title".into(), pixels).is_ok()
                    {
                        let l = app.doc.selected_mut().unwrap();
                        l.x = 65;
                        l.y = 30;
                        l.text = Some(spec);
                    }
                }
                if args[1] == "--capture-text" {
                    let id = app.doc.selected;
                    app.begin_text([65., 30.], id, &cc.egui_ctx);
                } else {
                    app.doc.selected = paint_id;
                }
                app.settings_open = args[1] == "--capture-settings";
                if args[1] == "--capture-panels" {
                    app.settings_open = true;
                    app.settings_tab = 2;
                }
                if args[1] == "--capture-docked" {
                    let _ = app.workspace.apply(craft_ui::docking::Action::Move {
                        panel: workspace::PanelId::Outliner,
                        anchor: workspace::PanelId::Canvas,
                        placement: craft_ui::docking::Placement::Split(
                            craft_ui::docking::Zone::Left,
                        ),
                    });
                }
                app.browser.open = args[1] == "--capture-browser";
                app.changed();
                app.dirty = false;
                app.status = "Photo preview · GPU window verification fixture".into();
            }
            Ok(Box::new(app))
        }),
    )
}

fn demo_document() -> Document {
    let mut doc = Document::new(960, 600).unwrap();
    let background = image::RgbaImage::from_fn(960, 600, |x, y| {
        image::Rgba([
            (20 + x / 30) as u8,
            (35 + y / 10) as u8,
            (65 + x / 15) as u8,
            255,
        ])
    });
    doc.add_image("Background".into(), background).unwrap();
    let shape = image::RgbaImage::from_fn(960, 600, |x, y| {
        if (x as i32 - 480).pow(2) + (y as i32 - 300).pow(2) < 170 * 170 {
            image::Rgba([38, 211, 211, 255])
        } else {
            image::Rgba([0, 0, 0, 0])
        }
    });
    doc.add_image("Paint layer".into(), shape).unwrap();
    doc.stroke([300., 430.], [660., 430.], 14., [255, 177, 61, 255], false);
    doc
}
fn blank_document() -> Document {
    let mut d = Document::new(1280, 720).unwrap();
    d.add_image("Paint layer".into(), image::RgbaImage::new(1280, 720))
        .unwrap();
    d
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shared_outliner_actions_preserve_selection_and_undo_visibility() {
        use ui_core::outliner::Action;
        let ctx = egui::Context::default();
        let mut app = App::from_context(&ctx);
        app.doc = demo_document();
        let id = app.doc.layers[0].id;
        let order: Vec<_> = app.doc.layers.iter().map(|l| l.id).collect();
        app.apply_outliner_action(Action::Select(id));
        assert_eq!(app.doc.selected, Some(id));
        assert!(!app.history.can_undo());
        app.apply_outliner_action(Action::ToggleVisibility(id));
        assert!(!app.doc.layers[0].visible);
        assert_eq!(app.doc.selected, Some(id));
        assert!(app.history.can_undo());
        app.history.undo(&mut app.doc);
        assert!(app.doc.layers[0].visible);
        assert_eq!(
            app.doc.layers.iter().map(|l| l.id).collect::<Vec<_>>(),
            order
        );
        app.apply_outliner_action(Action::Select(u64::MAX));
        assert_eq!(app.doc.selected, Some(id));
    }
    #[test]
    fn canvas_scale_drag_is_nondestructive_anchored_and_one_undo() {
        let ctx = egui::Context::default();
        let mut app = App::from_context(&ctx);
        app.doc = Document::new(200, 100).unwrap();
        app.doc
            .add_image(
                "image".into(),
                image::RgbaImage::from_pixel(80, 40, image::Rgba([255; 4])),
            )
            .unwrap();
        let l = app.doc.selected_mut().unwrap();
        l.x = 60;
        l.y = 30;
        let source = l.pixels.clone();
        app.zoom = 2.;
        let start = Pos2::new(480., 340.);
        let end = Pos2::new(560., 380.);
        canvas_frame(&ctx, &mut app, vec![egui::Event::PointerMoved(start)]);
        canvas_frame(&ctx, &mut app, vec![pointer_button(start, true)]);
        assert!(
            app.transform_drag.is_some(),
            "corner must capture before object move"
        );
        canvas_frame(&ctx, &mut app, vec![egui::Event::PointerMoved(end)]);
        canvas_frame(&ctx, &mut app, vec![pointer_button(end, false)]);
        let layer = app.doc.selected().unwrap();
        assert_eq!(layer.transform.scale, [1.5, 1.5]);
        assert_eq!(layer.world_point([0., 0.]), [60., 30.]);
        assert!(std::sync::Arc::ptr_eq(&source, &layer.pixels));
        assert!(!app.gesture);
        app.history.undo(&mut app.doc);
        assert_eq!(app.doc.selected().unwrap().transform.scale, [1., 1.]);
        assert!(!app.history.can_undo());
    }
    #[test]
    fn global_local_and_docked_panels_share_selection_and_ui_scale_does_not_change_canvas() {
        let ctx = egui::Context::default();
        let mut app = App::from_context(&ctx);
        app.doc = demo_document();
        let selected = app.doc.selected;
        let dimensions = (app.doc.width, app.doc.height);
        let zoom = app.zoom;
        for (global, moved) in [(false, false), (true, false), (false, true), (true, true)] {
            app.outliner_global = global;
            if moved {
                app.workspace
                    .apply(craft_ui::docking::Action::Move {
                        panel: workspace::PanelId::Outliner,
                        anchor: workspace::PanelId::Details,
                        placement: craft_ui::docking::Placement::Tab { before: None },
                    })
                    .unwrap();
            }
            app_frame(&ctx, &mut app, vec![]);
            assert_eq!(app.doc.selected, selected);
        }
        app.settings.ui_scale = 1.5;
        ctx.set_zoom_factor(1.5);
        app_frame(&ctx, &mut app, vec![]);
        assert_eq!(ctx.zoom_factor(), 1.5);
        assert_eq!(app.zoom, zoom);
        assert_eq!((app.doc.width, app.doc.height), dimensions);
    }
    type PreviewRequest = (u64, Document);
    type PreviewFrame = (u64, egui::ColorImage);
    fn controlled_preview(
        ctx: &egui::Context,
    ) -> (
        App,
        mpsc::Receiver<PreviewRequest>,
        mpsc::Sender<PreviewFrame>,
    ) {
        let mut app = App::from_context(ctx);
        let (requests_tx, requests_rx) = mpsc::channel();
        let (frames_tx, frames_rx) = mpsc::channel();
        // Replace the worker with deterministic channels: tests control slow completion
        // without sleeps, mouse wakeups or scheduling-dependent races.
        app.preview_tx = requests_tx;
        app.preview_rx = frames_rx;
        (app, requests_rx, frames_tx)
    }
    fn preview_frame(request: PreviewRequest) -> PreviewFrame {
        let (revision, doc) = request;
        let pixels = doc.composite();
        (
            revision,
            egui::ColorImage::from_rgba_unmultiplied(
                [pixels.width() as usize, pixels.height() as usize],
                pixels.as_raw(),
            ),
        )
    }
    fn app_frame(ctx: &egui::Context, app: &mut App, events: Vec<egui::Event>) {
        let input = egui::RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(800., 600.))),
            events,
            ..Default::default()
        };
        ctx.run_ui(input, |ui| app.show(ui))
            .drop_without_applying_deltas();
    }
    #[test]
    fn eraser_click_is_submitted_after_input_and_presented_without_mouse_movement() {
        let ctx = egui::Context::default();
        let (mut app, requests, frames) = controlled_preview(&ctx);
        app.doc = demo_document();
        app.tool = Tool::Eraser;
        app_frame(&ctx, &mut app, vec![]);
        frames
            .send(preview_frame(requests.try_recv().unwrap()))
            .unwrap();
        app_frame(&ctx, &mut app, vec![]);
        assert_eq!(app.displayed_revision, Some(0));
        let texture_id = app.texture.as_ref().unwrap().id();
        let pos = Pos2::new(300., 300.);
        app_frame(
            &ctx,
            &mut app,
            vec![egui::Event::PointerMoved(pos), pointer_button(pos, true)],
        );
        app_frame(&ctx, &mut app, vec![pointer_button(pos, false)]);
        assert!(app.revision > 0, "eraser click must modify the document");
        let latest = requests
            .try_recv()
            .expect("last click must submit preview in the SAME frame");
        assert_eq!(latest.0, app.revision);
        let revision = latest.0;
        frames.send(preview_frame(latest)).unwrap();
        // Absolutely no pointer event follows the click.
        app_frame(&ctx, &mut app, vec![]);
        assert_eq!(app.displayed_revision, Some(revision));
        assert_eq!(
            app.texture.as_ref().unwrap().id(),
            texture_id,
            "reuse the GPU texture"
        );
        assert!(app.preview_sent.is_none());
    }
    #[test]
    fn continuous_edits_show_completed_frames_instead_of_starving() {
        let ctx = egui::Context::default();
        let (mut app, requests, frames) = controlled_preview(&ctx);
        app.changed_continuously();
        app.queue_preview(&ctx);
        let first = requests.try_recv().unwrap();
        assert_eq!(first.0, 1);
        for _ in 0..20 {
            app.changed_continuously();
            app.queue_preview(&ctx);
        }
        assert!(
            requests.try_recv().is_err(),
            "only one raster snapshot may be in flight"
        );
        frames.send(preview_frame(first)).unwrap();
        app.process(&ctx);
        assert_eq!(
            app.displayed_revision,
            Some(1),
            "must display progress even though revision 21 already exists"
        );
        app.queue_preview(&ctx);
        let latest = requests.try_recv().unwrap();
        assert_eq!(latest.0, 21, "coalesce to latest edit");
        frames.send(preview_frame(latest)).unwrap();
        app.process(&ctx);
        assert_eq!(app.displayed_revision, Some(21));
    }
    #[test]
    fn undo_discards_in_flight_pixels_and_requests_restored_document() {
        let ctx = egui::Context::default();
        let (mut app, requests, frames) = controlled_preview(&ctx);
        app.doc = demo_document();
        app.command(|d| d.apply(RasterAction::Invert));
        app.queue_preview(&ctx);
        let old = requests.try_recv().unwrap();
        app.history.undo(&mut app.doc);
        app.changed();
        frames.send(preview_frame(old)).unwrap();
        app.process(&ctx);
        assert!(
            app.displayed_revision.is_none(),
            "must not display pre-Undo pixels"
        );
        app.queue_preview(&ctx);
        let restored = requests.try_recv().unwrap();
        assert_eq!(restored.1.composite(), demo_document().composite());
        frames.send(preview_frame(restored)).unwrap();
        app.process(&ctx);
        assert_eq!(app.displayed_revision, Some(app.revision));
    }
    #[test]
    fn ui_builds_for_empty_document_and_selected_layer() {
        let ctx = egui::Context::default();
        let mut app = App::from_context(&ctx);
        app.doc = Document::new(1280, 720).unwrap();
        for demo in [false, true] {
            if demo {
                app.doc = demo_document();
            }
            let output = ctx.run_ui(egui::RawInput::default(), |ui| app.show(ui));
            assert!(!output.shapes.is_empty());
            output.drop_without_applying_deltas();
        }
    }
    #[test]
    fn failed_command_preserves_document_and_history() {
        let ctx = egui::Context::default();
        let mut app = App::from_context(&ctx);
        app.command(|d| d.crop(0, 0, 0, 0));
        assert!(app.error.is_some());
        assert!(!app.history.can_undo());
        assert_eq!(app.doc.width, 1280);
    }
    #[test]
    fn raster_edit_is_one_undo_transaction() {
        let ctx = egui::Context::default();
        let mut app = App::from_context(&ctx);
        app.doc = demo_document();
        app.command(|d| d.apply(RasterAction::Invert));
        assert!(app.history.can_undo());
        app.history.undo(&mut app.doc);
        assert!(!app.history.can_undo());
        assert_eq!(app.doc.composite(), demo_document().composite());
    }
    fn canvas_frame(ctx: &egui::Context, app: &mut App, events: Vec<egui::Event>) {
        let input = egui::RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(800., 600.))),
            events,
            ..Default::default()
        };
        let output = ctx.run_ui(input, |ui| {
            egui::CentralPanel::default().show(ui, |ui| app.canvas(ui));
        });
        output.drop_without_applying_deltas();
    }
    fn pointer_button(pos: Pos2, pressed: bool) -> egui::Event {
        egui::Event::PointerButton {
            pos,
            button: egui::PointerButton::Primary,
            pressed,
            modifiers: egui::Modifiers::NONE,
        }
    }
    #[test]
    fn egui_brush_drag_and_single_click_create_undoable_pixels() {
        let ctx = egui::Context::default();
        let mut app = App::from_context(&ctx);
        app.tool = Tool::Brush;
        let start = Pos2::new(350., 300.);
        let end = Pos2::new(450., 300.);
        canvas_frame(&ctx, &mut app, vec![]);
        canvas_frame(
            &ctx,
            &mut app,
            vec![
                egui::Event::PointerMoved(start),
                pointer_button(start, true),
            ],
        );
        canvas_frame(&ctx, &mut app, vec![egui::Event::PointerMoved(end)]);
        let revision = app.revision;
        for _ in 0..3 {
            canvas_frame(&ctx, &mut app, vec![]);
        }
        assert_eq!(
            app.revision, revision,
            "repaint ticks must not repeat a stationary stroke"
        );
        canvas_frame(&ctx, &mut app, vec![pointer_button(end, false)]);
        assert!(
            app.doc.composite().get_pixel(640, 360)[3] > 0,
            "drag must paint canvas"
        );
        assert!(app.history.can_undo());
        app.history.undo(&mut app.doc);
        assert!(!app.history.can_undo());
        assert_eq!(app.doc.composite().get_pixel(640, 360)[3], 0);
        canvas_frame(
            &ctx,
            &mut app,
            vec![
                egui::Event::PointerMoved(Pos2::new(400., 300.)),
                pointer_button(Pos2::new(400., 300.), true),
            ],
        );
        canvas_frame(
            &ctx,
            &mut app,
            vec![pointer_button(Pos2::new(400., 300.), false)],
        );
        assert!(
            app.doc.composite().get_pixel(640, 360)[3] > 0,
            "single click must paint too"
        );
    }
    #[test]
    fn egui_move_picks_topmost_visible_layer_and_preserves_delta() {
        let ctx = egui::Context::default();
        let mut app = App::from_context(&ctx);
        app.doc = demo_document();
        app.tool = Tool::Move;
        let start = Pos2::new(400., 300.);
        let end = Pos2::new(470., 335.);
        canvas_frame(&ctx, &mut app, vec![]);
        canvas_frame(
            &ctx,
            &mut app,
            vec![
                egui::Event::PointerMoved(start),
                pointer_button(start, true),
            ],
        );
        canvas_frame(&ctx, &mut app, vec![egui::Event::PointerMoved(end)]);
        canvas_frame(&ctx, &mut app, vec![pointer_button(end, false)]);
        let layer = app.doc.selected().unwrap();
        assert_eq!(layer.name, "Paint layer");
        assert_eq!((layer.x, layer.y), (100, 50));
        app.history.undo(&mut app.doc);
        assert_eq!(app.doc.selected().unwrap().x, 0);
    }
    #[test]
    fn egui_crop_drag_keeps_selection_until_apply() {
        let ctx = egui::Context::default();
        let mut app = App::from_context(&ctx);
        app.tool = Tool::Crop;
        let start = Pos2::new(350., 250.);
        let end = Pos2::new(450., 350.);
        canvas_frame(&ctx, &mut app, vec![]);
        canvas_frame(
            &ctx,
            &mut app,
            vec![
                egui::Event::PointerMoved(start),
                pointer_button(start, true),
            ],
        );
        canvas_frame(&ctx, &mut app, vec![egui::Event::PointerMoved(end)]);
        canvas_frame(&ctx, &mut app, vec![pointer_button(end, false)]);
        assert!(
            app.crop
                .is_some_and(|r| r.width() > 140. && r.height() > 140.)
        );
        assert_eq!(app.doc.width, 1280);
        assert!(!app.history.can_undo());
    }
}
