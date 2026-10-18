//! Browser UI references actual document layers or a user-chosen filesystem folder.
use crate::ui_core::UiComponents;
use crate::{
    App, Job,
    icons::{Icon, button},
    theme,
};
use eframe::egui::{self, Color32, Pos2, Rect, Stroke, Vec2};
use mycut_photo_core::Document;
use std::{collections::HashMap, path::PathBuf, sync::mpsc};
struct Entry {
    key: String,
    name: String,
    folder: bool,
    path: Option<PathBuf>,
    layer: Option<u64>,
    kind: String,
}
enum Event {
    Entries(Vec<Entry>),
    Thumb(String, egui::ColorImage),
    Error(String),
    Done,
}
#[derive(Default)]
pub struct Browser {
    pub open: bool,
    grid: bool,
    folder_mode: bool,
    root: Option<PathBuf>,
    current: Option<PathBuf>,
    search: String,
    entries: Vec<Entry>,
    textures: HashMap<String, egui::TextureHandle>,
    receiver: Option<mpsc::Receiver<Event>>,
    revision: Option<u64>,
    epoch: u64,
    error: Option<String>,
}
enum Action {
    Select(u64),
    Import(PathBuf),
}
fn folder_icon(painter: &egui::Painter, rect: Rect) {
    let color = Color32::from_rgb(173, 132, 66);
    painter.rect_filled(
        Rect::from_min_size(
            rect.min,
            Vec2::new(rect.width() * 0.46, rect.height() * 0.35),
        ),
        2.,
        color,
    );
    painter.rect_filled(
        Rect::from_min_max(rect.min + Vec2::new(0., rect.height() * 0.2), rect.max),
        2.,
        color,
    );
}
fn folder_row(
    ui: &mut egui::Ui,
    label: &str,
    selected: bool,
    expanded: Option<bool>,
) -> egui::Response {
    let (rect, response) =
        ui.allocate_exact_size(Vec2::new(ui.available_width(), 22.), egui::Sense::click());
    let painter = ui.painter_at(rect);
    if selected {
        painter.rect_filled(rect, 0., Color32::from_rgb(37, 76, 90));
    }
    if let Some(open) = expanded {
        let c = rect.min + Vec2::new(6., 11.);
        let points = if open {
            vec![
                c + Vec2::new(-4., -2.),
                c + Vec2::new(4., -2.),
                c + Vec2::new(0., 3.),
            ]
        } else {
            vec![
                c + Vec2::new(-2., -4.),
                c + Vec2::new(3., 0.),
                c + Vec2::new(-2., 4.),
            ]
        };
        painter.add(egui::Shape::convex_polygon(
            points,
            Color32::GRAY,
            Stroke::NONE,
        ));
    }
    folder_icon(
        &painter,
        Rect::from_min_size(rect.min + Vec2::new(15., 5.), Vec2::new(17., 13.)),
    );
    painter.text(
        rect.min + Vec2::new(38., 11.),
        egui::Align2::LEFT_CENTER,
        label,
        egui::FontId::proportional(13.),
        Color32::LIGHT_GRAY,
    );
    response.on_hover_text(label)
}
fn image_path(path: &std::path::Path) -> bool {
    path.extension().is_some_and(|e| {
        matches!(
            e.to_string_lossy().to_ascii_lowercase().as_str(),
            "png" | "jpg" | "jpeg" | "tif" | "tiff" | "bmp" | "webp"
        )
    })
}
fn thumbnail(image: &image::RgbaImage) -> egui::ColorImage {
    let ratio = (112. / image.width() as f32)
        .min(82. / image.height() as f32)
        .min(1.);
    let small = image::imageops::thumbnail(
        image,
        (image.width() as f32 * ratio).round().max(1.) as u32,
        (image.height() as f32 * ratio).round().max(1.) as u32,
    );
    egui::ColorImage::from_rgba_unmultiplied(
        [small.width() as usize, small.height() as usize],
        small.as_raw(),
    )
}
impl Browser {
    pub fn new() -> Self {
        Self {
            grid: true,
            ..Default::default()
        }
    }
    pub fn ready(&self) -> bool {
        self.receiver.is_none() && self.revision.is_some()
    }
    fn project(&mut self, doc: &Document, revision: u64, ctx: &egui::Context) {
        let layers = doc.layers.clone();
        let (tx, rx) = mpsc::channel();
        self.receiver = Some(rx);
        self.revision = Some(revision);
        self.error = None;
        let ctx = ctx.clone();
        std::thread::spawn(move || {
            let entries = layers
                .iter()
                .map(|l| Entry {
                    key: format!("layer-{}", l.id),
                    name: l.name.clone(),
                    folder: false,
                    path: None,
                    layer: Some(l.id),
                    kind: if l.text.is_some() { "Text" } else { "Raster" }.into(),
                })
                .collect();
            if tx.send(Event::Entries(entries)).is_err() {
                return;
            }
            for l in layers {
                if tx
                    .send(Event::Thumb(
                        format!("layer-{}", l.id),
                        thumbnail(&l.pixels),
                    ))
                    .is_err()
                {
                    return;
                }
                ctx.request_repaint();
            }
            let _ = tx.send(Event::Done);
            ctx.request_repaint();
        });
    }
    fn folder(&mut self, path: PathBuf, ctx: &egui::Context) {
        let Ok(path) = path.canonicalize() else {
            return;
        };
        if self.root.as_ref().is_none_or(|r| !path.starts_with(r)) {
            return;
        }
        self.current = Some(path.clone());
        self.entries.clear();
        self.textures.clear();
        self.error = None;
        let (tx, rx) = mpsc::channel();
        self.receiver = Some(rx);
        let ctx = ctx.clone();
        std::thread::spawn(move || {
            let read = match std::fs::read_dir(&path) {
                Ok(d) => d,
                Err(e) => {
                    let _ = tx.send(Event::Error(e.to_string()));
                    let _ = tx.send(Event::Done);
                    ctx.request_repaint();
                    return;
                }
            };
            let mut entries: Vec<_> = read
                .filter_map(Result::ok)
                .take(2000)
                .filter_map(|entry| {
                    let kind = entry.file_type().ok()?;
                    if kind.is_symlink() || (!kind.is_dir() && !image_path(&entry.path())) {
                        return None;
                    }
                    let path = entry.path();
                    Some(Entry {
                        key: path.to_string_lossy().into_owned(),
                        name: entry.file_name().to_string_lossy().into_owned(),
                        folder: kind.is_dir(),
                        kind: if kind.is_dir() {
                            "Folder".into()
                        } else {
                            path.extension()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_uppercase()
                        },
                        path: Some(path),
                        layer: None,
                    })
                })
                .collect();
            entries.sort_by_key(|e| (!e.folder, e.name.to_lowercase()));
            let paths: Vec<_> = entries
                .iter()
                .filter(|e| !e.folder)
                .filter_map(|e| e.path.clone())
                .take(100)
                .collect();
            if tx.send(Event::Entries(entries)).is_err() {
                return;
            }
            ctx.request_repaint();
            for path in paths {
                if std::fs::metadata(&path).is_ok_and(|m| m.len() <= 64 * 1024 * 1024)
                    && let Ok(doc) = Document::from_image(&path)
                {
                    if tx
                        .send(Event::Thumb(
                            path.to_string_lossy().into_owned(),
                            thumbnail(&doc.layers[0].pixels),
                        ))
                        .is_err()
                    {
                        return;
                    }
                    ctx.request_repaint();
                }
            }
            let _ = tx.send(Event::Done);
            ctx.request_repaint();
        });
    }
    fn poll(&mut self, ctx: &egui::Context) {
        let mut done = false;
        if let Some(rx) = &self.receiver {
            while let Ok(event) = rx.try_recv() {
                match event {
                    Event::Entries(entries) => self.entries = entries,
                    Event::Thumb(key, image) => {
                        self.textures.insert(
                            key.clone(),
                            ctx.load_texture(key, image, egui::TextureOptions::LINEAR),
                        );
                    }
                    Event::Error(e) => self.error = Some(e),
                    Event::Done => done = true,
                }
            }
        }
        if done {
            self.receiver = None;
        }
        if self.receiver.is_some() {
            ctx.request_repaint_after(std::time::Duration::from_millis(30));
        }
    }
    fn show(
        &mut self,
        ui: &mut egui::Ui,
        doc: &Document,
        revision: u64,
        epoch: u64,
        editable: bool,
    ) -> Option<Action> {
        let ctx = ui.ctx().clone();
        if !self.folder_mode && self.epoch != epoch {
            self.receiver = None;
            self.revision = None;
            self.entries.clear();
            self.textures.clear();
            self.epoch = epoch;
        }
        self.poll(&ctx);
        if !self.folder_mode
            && self.receiver.is_none()
            && self.revision != Some(revision)
            && editable
        {
            self.project(doc, revision, &ctx);
        }
        let mut navigate = None;
        ui.hbox(|ui| {
            if button(ui, Icon::Open, false, "Choose asset folder").clicked()
                && let Some(path) = rfd::FileDialog::new().pick_folder()
                && let Ok(path) = path.canonicalize()
            {
                self.root = Some(path.clone());
                self.folder_mode = true;
                navigate = Some(path);
            }
            if ui.selectable_label(!self.folder_mode, "Project").clicked() {
                self.folder_mode = false;
                self.receiver = None;
                self.revision = None;
                self.textures.clear();
            }
            if ui
                .add_enabled(
                    self.root.is_some(),
                    crate::ui_core::Button::new("Folder").selected(self.folder_mode),
                )
                .clicked()
            {
                self.folder_mode = true;
                navigate = self.current.clone().or_else(|| self.root.clone());
            }
            ui.separator();
            ui.text(if self.folder_mode {
                self.current
                    .as_ref()
                    .map_or("Content".into(), |p| p.to_string_lossy())
            } else {
                "Project  /  Current image".into()
            });
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if ui.selectable_label(!self.grid, "List").clicked() {
                    self.grid = false;
                }
                if ui.selectable_label(self.grid, "Tiles").clicked() {
                    self.grid = true;
                }
            });
        });
        ui.add(
            crate::ui_core::InputField::singleline(&mut self.search)
                .hint_text("Search content…")
                .desired_width(f32::INFINITY),
        );
        let mut action = None;
        egui::Panel::left("browser-folders")
            .default_size(165.)
            .size_range(110.0..=320.0)
            .resizable(true)
            .show(ui, |ui| {
                egui::ScrollArea::vertical().show(ui, |ui| {
                    egui::CollapsingHeader::new("Favorites")
                        .default_open(true)
                        .show(ui, |ui| {
                            if folder_row(ui, "Project assets", !self.folder_mode, None).clicked() {
                                self.folder_mode = false;
                                self.revision = None;
                                self.receiver = None;
                            }
                        });
                    egui::CollapsingHeader::new("Content")
                        .default_open(true)
                        .show(ui, |ui| {
                            if self.folder_mode {
                                if let (Some(root), Some(current)) = (&self.root, &self.current)
                                    && current != root
                                    && ui.action("Parent folder").clicked()
                                {
                                    navigate = current.parent().map(ToOwned::to_owned);
                                }
                                if let (Some(root), Some(current)) = (&self.root, &self.current) {
                                    let mut path = root.clone();
                                    let mut ancestors = vec![path.clone()];
                                    if let Ok(relative) = current.strip_prefix(root) {
                                        for component in relative.components() {
                                            path.push(component);
                                            ancestors.push(path.clone());
                                        }
                                    }
                                    for (depth, path) in ancestors.iter().enumerate() {
                                        ui.hbox(|ui| {
                                            crate::ui_core::Spacer::fixed(ui, depth as f32 * 12.);
                                            let title = path
                                                .file_name()
                                                .unwrap_or(path.as_os_str())
                                                .to_string_lossy();
                                            if folder_row(ui, &title, path == current, Some(true))
                                                .clicked()
                                            {
                                                navigate = Some(path.clone());
                                            }
                                        });
                                    }
                                }
                                for entry in self.entries.iter().filter(|e| e.folder) {
                                    let depth = self
                                        .current
                                        .as_ref()
                                        .and_then(|p| {
                                            self.root.as_ref().and_then(|r| p.strip_prefix(r).ok())
                                        })
                                        .map_or(1, |p| p.components().count() + 1);
                                    ui.hbox(|ui| {
                                        crate::ui_core::Spacer::fixed(ui, depth as f32 * 12.);
                                        if folder_row(ui, &entry.name, false, Some(false)).clicked()
                                        {
                                            navigate = entry.path.clone();
                                        }
                                    });
                                }
                            } else {
                                folder_row(ui, "Current image", true, Some(true));
                                ui.indent("browser-local-layers", |ui| {
                                    ui.small_text(format!("{} layer assets", doc.layers.len()));
                                });
                            }
                        });
                });
            });
        egui::CentralPanel::default().show(ui, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| {
                let search = self.search.to_lowercase();
                let entries: Vec<_> = self
                    .entries
                    .iter()
                    .filter(|e| e.name.to_lowercase().contains(&search))
                    .collect();
                if self.grid {
                    ui.flow_box(|ui| {
                        for entry in entries {
                            let (r, response) =
                                ui.allocate_exact_size(Vec2::new(116., 140.), egui::Sense::click());
                            if !ui.is_rect_visible(r) {
                                continue;
                            }
                            let selected = entry.layer.is_some_and(|id| doc.selected == Some(id));
                            let fill = if selected {
                                Color32::from_rgb(48, 73, 81)
                            } else {
                                Color32::from_rgb(40, 41, 45)
                            };
                            let painter = ui.painter();
                            painter.rect_filled(r, 3., fill);
                            let area =
                                Rect::from_min_size(r.min + Vec2::splat(3.), Vec2::new(110., 80.));
                            if !entry.folder {
                                for y in 0..10 {
                                    for x in 0..14 {
                                        let cell = Rect::from_min_size(
                                            area.min + Vec2::new(x as f32 * 8., y as f32 * 8.),
                                            Vec2::splat(8.),
                                        )
                                        .intersect(area);
                                        painter.rect_filled(
                                            cell,
                                            0.,
                                            Color32::from_gray(if (x + y) % 2 == 0 {
                                                26
                                            } else {
                                                33
                                            }),
                                        );
                                    }
                                }
                            }
                            if let Some(texture) = self.textures.get(&entry.key) {
                                let size = texture.size_vec2();
                                let scale = (area.width() / size.x).min(area.height() / size.y);
                                let target = Rect::from_center_size(area.center(), size * scale);
                                painter.image(
                                    texture.id(),
                                    target,
                                    Rect::from_min_max(Pos2::ZERO, Pos2::new(1., 1.)),
                                    Color32::WHITE,
                                );
                            } else if entry.folder {
                                folder_icon(painter, area.shrink2(Vec2::new(15., 17.)));
                            } else {
                                painter.rect_stroke(
                                    area.shrink(18.),
                                    2.,
                                    Stroke::new(1., Color32::GRAY),
                                    egui::StrokeKind::Inside,
                                );
                            }
                            painter.line_segment(
                                [
                                    Pos2::new(r.min.x, r.min.y + 83.),
                                    Pos2::new(r.max.x, r.min.y + 83.),
                                ],
                                Stroke::new(
                                    2.,
                                    if entry.folder {
                                        Color32::from_rgb(173, 132, 66)
                                    } else if entry.kind == "Text" {
                                        Color32::from_rgb(145, 111, 202)
                                    } else {
                                        Color32::from_rgb(54, 177, 191)
                                    },
                                ),
                            );
                            let name = entry
                                .layer
                                .and_then(|id| {
                                    doc.layers
                                        .iter()
                                        .find(|l| l.id == id)
                                        .map(|l| l.name.as_str())
                                })
                                .unwrap_or(&entry.name);
                            let mut job = egui::text::LayoutJob::simple(
                                name.to_owned(),
                                egui::FontId::proportional(12.),
                                Color32::LIGHT_GRAY,
                                106.,
                            );
                            job.wrap.max_rows = 2;
                            job.wrap.overflow_character = Some('…');
                            let galley = painter.layout_job(job);
                            painter.galley(r.min + Vec2::new(5., 88.), galley, Color32::LIGHT_GRAY);
                            painter.text(
                                r.min + Vec2::new(5., 124.),
                                egui::Align2::LEFT_TOP,
                                &entry.kind,
                                egui::FontId::proportional(10.),
                                theme::SECONDARY_TEXT,
                            );
                            if response.clicked()
                                && let Some(id) = entry.layer
                            {
                                action = Some(Action::Select(id));
                            }
                            if response.double_clicked() {
                                if entry.folder {
                                    navigate = entry.path.clone();
                                } else if editable && let Some(path) = &entry.path {
                                    action = Some(Action::Import(path.clone()));
                                }
                            }
                            response.on_hover_text(format!(
                                "{}\n{}",
                                entry.name,
                                if entry.folder {
                                    "Double-click to open"
                                } else {
                                    "Double-click file to import as a layer"
                                }
                            ));
                        }
                    });
                } else {
                    egui::Grid::new("browser-list")
                        .num_columns(3)
                        .striped(true)
                        .min_col_width(70.)
                        .show(ui, |ui| {
                            ui.emphasis("Name");
                            ui.emphasis("Type");
                            ui.emphasis("Source");
                            ui.end_row();
                            for entry in entries {
                                let name = entry
                                    .layer
                                    .and_then(|id| {
                                        doc.layers
                                            .iter()
                                            .find(|l| l.id == id)
                                            .map(|l| l.name.as_str())
                                    })
                                    .unwrap_or(&entry.name);
                                let r = ui.selectable_label(entry.layer == doc.selected, name);
                                if r.clicked()
                                    && let Some(id) = entry.layer
                                {
                                    action = Some(Action::Select(id));
                                }
                                if r.double_clicked() {
                                    if entry.folder {
                                        navigate = entry.path.clone();
                                    } else if editable && let Some(p) = &entry.path {
                                        action = Some(Action::Import(p.clone()));
                                    }
                                }
                                ui.text(&entry.kind);
                                ui.small_text(if entry.layer.is_some() {
                                    "Document"
                                } else {
                                    "Folder"
                                });
                                ui.end_row();
                            }
                        });
                }
                if self.receiver.is_some() {
                    ui.spinner();
                }
                if let Some(error) = &self.error {
                    ui.colored_text(Color32::LIGHT_RED, error);
                }
                ui.small_text(format!(
                    "{} items · Files are imported explicitly; originals remain unchanged",
                    self.entries.len()
                ));
            });
        });
        if let Some(path) = navigate {
            self.folder(path, &ctx);
        }
        action
    }
}
impl App {
    pub(crate) fn content_browser(&mut self, ui: &mut egui::Ui) {
        let mut browser = std::mem::take(&mut self.browser);
        let editable = self.pending.is_none() && !self.gesture && self.text_edit.is_none();
        let action = browser.show(ui, &self.doc, self.revision, self.preview_floor, editable);
        self.browser = browser;
        if editable {
            match action {
                Some(Action::Select(id)) => self.doc.selected = Some(id),
                Some(Action::Import(path)) => self.launch(Job::Import(self.doc.clone(), path)),
                None => {}
            }
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn image_filter_is_case_insensitive() {
        assert!(image_path(std::path::Path::new("sample.PNG")));
        assert!(!image_path(std::path::Path::new("file.exe")));
    }
    #[test]
    fn thumbnail_keeps_aspect_ratio() {
        let image = image::RgbaImage::new(600, 100);
        let thumb = thumbnail(&image);
        assert!(thumb.width() > 5 * thumb.height());
    }
    #[test]
    fn folder_scan_reports_actual_files_and_rejects_escape() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join("Images")).unwrap();
        image::RgbaImage::new(4, 4)
            .save(dir.path().join("test.png"))
            .unwrap();
        std::fs::write(dir.path().join("ignore.txt"), "test").unwrap();
        let root = dir.path().canonicalize().unwrap();
        let mut browser = Browser::new();
        browser.root = Some(root.clone());
        browser.folder(root.clone(), &egui::Context::default());
        let receiver = browser.receiver.as_ref().unwrap();
        let mut names = vec![];
        loop {
            match receiver
                .recv_timeout(std::time::Duration::from_secs(5))
                .unwrap()
            {
                Event::Entries(entries) => names = entries.iter().map(|e| e.name.clone()).collect(),
                Event::Done => break,
                _ => {}
            }
        }
        assert_eq!(names, vec!["Images", "test.png"]);
        browser.folder(root.parent().unwrap().to_owned(), &egui::Context::default());
        assert_eq!(browser.current, Some(root));
    }
}
