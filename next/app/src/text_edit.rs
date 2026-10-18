use crate::ui_core::UiComponents;
use crate::{App, Tool};
use eframe::egui::{self, Color32, Pos2, Rect, Vec2};
use mycut_photo_core::{TextSpec, render_text};
use std::sync::Arc;
pub struct TextSession {
    pub id: u64,
    pub spec: TextSpec,
    pub focus: bool,
    dirty_before: bool,
}
impl App {
    fn font_bytes(&mut self, path: &str, ctx: &egui::Context) -> Result<Arc<Vec<u8>>, String> {
        if !self.font_cache.contains_key(path) {
            let metadata = std::fs::metadata(path)
                .map_err(|e| format!("Font unavailable; choose a .ttf/.otf font: {e}"))?;
            if metadata.len() > 32 * 1024 * 1024 {
                return Err("Font file exceeds 32 MiB".into());
            }
            let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
            render_text(
                &TextSpec {
                    content: String::new(),
                    size: 12.,
                    color: [255; 4],
                    font: path.into(),
                },
                &bytes,
            )?;
            self.font_cache.insert(path.into(), Arc::new(bytes));
        }
        let bytes = self.font_cache[path].clone();
        let key = egui::Id::new("mycut-current-font");
        if ctx.data(|d| d.get_temp::<String>(key)).as_deref() != Some(path) {
            let mut definitions = egui::FontDefinitions::default();
            definitions.font_data.insert(
                "mycut-text".into(),
                Arc::new(egui::FontData::from_owned(bytes.as_ref().clone())),
            );
            definitions.families.insert(
                egui::FontFamily::Name("MyCutText".into()),
                vec!["mycut-text".into()],
            );
            ctx.set_fonts(definitions);
            ctx.data_mut(|d| d.insert_temp(key, path.to_owned()));
        }
        Ok(bytes)
    }
    pub(crate) fn begin_text(&mut self, at: [f32; 2], existing: Option<u64>, ctx: &egui::Context) {
        self.finish_text(true);
        if self.text_edit.is_some() {
            return;
        }
        let spec = existing
            .and_then(|id| self.doc.layers.iter().find(|l| l.id == id))
            .and_then(|l| l.text.clone())
            .unwrap_or(TextSpec {
                content: "Текст".into(),
                size: self.text_size,
                color: self.color,
                font: self.text_font.clone(),
            });
        let result = (|| {
            let font = self.font_bytes(&spec.font, ctx)?;
            render_text(&spec, &font)
        })();
        let pixels = match result {
            Ok(p) => p,
            Err(e) => {
                self.error = Some(e);
                return;
            }
        };
        let dirty_before = self.dirty;
        self.history.commit();
        self.history.begin(&self.doc);
        let id = if let Some(id) = existing {
            if self
                .doc
                .layers
                .iter()
                .any(|l| l.id == id && !l.locked && l.text.is_some())
            {
                id
            } else {
                self.history.cancel(&mut self.doc);
                return;
            }
        } else {
            match self.doc.add_image("Text".into(), pixels) {
                Ok(id) => {
                    let l = self.doc.selected_mut().unwrap();
                    l.x = at[0].round() as i32;
                    l.y = at[1].round() as i32;
                    l.text = Some(spec.clone());
                    id
                }
                Err(e) => {
                    self.history.cancel(&mut self.doc);
                    self.error = Some(e);
                    return;
                }
            }
        };
        self.doc.selected = Some(id);
        self.text_size = spec.size;
        self.text_font = spec.font.clone();
        self.color = spec.color;
        self.text_edit = Some(TextSession {
            id,
            spec,
            focus: true,
            dirty_before,
        });
        self.tool = Tool::Text;
        self.changed();
    }
    pub(crate) fn finish_text(&mut self, commit: bool) {
        if let Some(edit) = self.text_edit.take() {
            if commit {
                if !self
                    .doc
                    .layers
                    .iter()
                    .any(|l| l.id == edit.id && l.text.as_ref() == Some(&edit.spec))
                {
                    self.error=Some("Text could not be rendered. Correct the font/text settings or cancel the edit.".into());
                    self.text_edit = Some(edit);
                    return;
                }
                self.history.commit();
                self.changed();
            } else {
                self.history.cancel(&mut self.doc);
                self.changed();
                self.dirty = edit.dirty_before;
            }
        }
    }
    fn refresh_text(&mut self, ctx: &egui::Context) {
        let Some(edit) = self.text_edit.take() else {
            return;
        };
        let result = (|| {
            let font = self.font_bytes(&edit.spec.font, ctx)?;
            render_text(&edit.spec, &font)
        })();
        match result {
            Ok(pixels) => {
                if let Some(layer) = self.doc.layers.iter_mut().find(|l| l.id == edit.id) {
                    layer.pixels = Arc::new(pixels);
                    layer.text = Some(edit.spec.clone());
                    layer.name = edit
                        .spec
                        .content
                        .lines()
                        .next()
                        .unwrap_or("Text")
                        .chars()
                        .take(35)
                        .collect();
                }
                self.changed_continuously();
            }
            Err(e) => self.error = Some(e),
        }
        self.text_edit = Some(edit);
    }
    pub(crate) fn text_options(&mut self, ui: &mut egui::Ui) {
        ui.text("Text");
        let mut changed = ui
            .add(
                crate::ui_core::NumberField::new(&mut self.text_size)
                    .range(4.0..=512.0)
                    .suffix(" px"),
            )
            .changed();
        changed |= ui
            .color_edit_button_srgba_unmultiplied(&mut self.color)
            .changed();
        egui::ComboBox::from_id_salt("text-font")
            .selected_text(
                std::path::Path::new(&self.text_font)
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy(),
            )
            .width(90.)
            .show_ui(ui, |ui| {
                for (name, file) in [
                    ("Arial", "arial.ttf"),
                    ("Segoe UI", "segoeui.ttf"),
                    ("Consolas", "consola.ttf"),
                    ("Times New Roman", "times.ttf"),
                ] {
                    let path = format!("C:/Windows/Fonts/{file}");
                    if std::path::Path::new(&path).exists() {
                        changed |= ui
                            .selectable_value(&mut self.text_font, path, name)
                            .changed();
                    }
                }
            });
        if ui.action("Font…").clicked()
            && let Some(path) = rfd::FileDialog::new()
                .add_filter("Font", &["ttf", "otf"])
                .pick_file()
        {
            self.text_font = path.to_string_lossy().into_owned();
            changed = true;
        }
        if changed && let Some(edit) = &mut self.text_edit {
            edit.spec.size = self.text_size;
            edit.spec.font = self.text_font.clone();
            edit.spec.color = self.color;
            self.refresh_text(ui.ctx());
        }
        if self.text_edit.is_some() {
            if ui.action("Done · Ctrl+Enter").clicked() {
                self.finish_text(true);
            }
            if ui.action("Cancel · Esc").clicked() {
                self.finish_text(false);
            }
        } else {
            ui.small_text("Click canvas to add; click existing text to edit");
        }
    }
    pub(crate) fn text_overlay(&mut self, ctx: &egui::Context, image_rect: Rect) {
        let Some(mut edit) = self.text_edit.take() else {
            return;
        };
        let Some(layer) = self.doc.layers.iter().find(|l| l.id == edit.id) else {
            self.text_edit = Some(edit);
            return;
        };
        let position = layer.world_point([0., 0.]);
        let position = image_rect.min + Vec2::new(position[0], position[1]) * self.zoom;
        let size = (edit.spec.size * self.zoom * layer.transform.scale[1]).clamp(4., 1024.);
        let width =
            (layer.pixels.width() as f32 * self.zoom * layer.transform.scale[0] + 30.).max(180.);
        let height =
            (layer.pixels.height() as f32 * self.zoom * layer.transform.scale[1] + size).max(70.);
        let response = egui::Area::new(egui::Id::new("canvas-text-editor"))
            .order(egui::Order::Foreground)
            .fixed_pos(Pos2::new(position.x, position.y))
            .show(ctx, |ui| {
                ui.set_clip_rect(image_rect.intersect(ctx.content_rect()));
                ui.add_sized(
                    [width, height],
                    crate::ui_core::InputField::multiline(&mut edit.spec.content)
                        .id(egui::Id::new(("text-input", edit.id)))
                        .font(egui::FontId::new(
                            size,
                            egui::FontFamily::Name("MyCutText".into()),
                        ))
                        .text_color(Color32::from_rgba_unmultiplied(
                            edit.spec.color[0],
                            edit.spec.color[1],
                            edit.spec.color[2],
                            edit.spec.color[3],
                        ))
                        .frame(egui::Frame::NONE)
                        .margin(0)
                        .clip_text(false)
                        .desired_width(f32::INFINITY),
                )
            })
            .inner;
        if edit.focus {
            response.request_focus();
            edit.focus = false;
        }
        self.text_edit = Some(edit);
        if response.changed() {
            self.refresh_text(ctx);
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn frame(ctx: &egui::Context, app: &mut App, events: Vec<egui::Event>) {
        ctx.run_ui(
            egui::RawInput {
                screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1000., 700.))),
                events,
                ..Default::default()
            },
            |ui| app.show(ui),
        )
        .drop_without_applying_deltas();
    }
    fn key(key: egui::Key, modifiers: egui::Modifiers) -> egui::Event {
        egui::Event::Key {
            key,
            physical_key: None,
            pressed: true,
            repeat: false,
            modifiers: egui::Modifiers {
                command: modifiers.ctrl,
                ..modifiers
            },
        }
    }
    #[test]
    fn canvas_text_selection_replacement_commit_and_single_undo() {
        if !std::path::Path::new("C:/Windows/Fonts/arial.ttf").exists() {
            return;
        }
        let ctx = egui::Context::default();
        let mut app = App::from_context(&ctx);
        let count = app.doc.layers.len();
        app.begin_text([200., 180.], None, &ctx);
        assert!(app.text_edit.is_some());
        frame(&ctx, &mut app, vec![]);
        frame(&ctx, &mut app, vec![]);
        frame(
            &ctx,
            &mut app,
            vec![key(egui::Key::A, egui::Modifiers::CTRL)],
        );
        frame(
            &ctx,
            &mut app,
            vec![egui::Event::Text("Привет, MyCut!".into())],
        );
        assert_eq!(
            app.text_edit.as_ref().unwrap().spec.content,
            "Привет, MyCut!"
        );
        frame(
            &ctx,
            &mut app,
            vec![key(egui::Key::Enter, egui::Modifiers::CTRL)],
        );
        assert!(app.text_edit.is_none());
        assert_eq!(
            app.doc.selected().unwrap().text.as_ref().unwrap().content,
            "Привет, MyCut!"
        );
        app.history.undo(&mut app.doc);
        assert_eq!(app.doc.layers.len(), count);
        assert!(!app.history.can_undo());
    }
    #[test]
    fn cancel_restores_document_and_font_size_refits_cache() {
        if !std::path::Path::new("C:/Windows/Fonts/arial.ttf").exists() {
            return;
        }
        let ctx = egui::Context::default();
        let mut app = App::from_context(&ctx);
        let before = app.doc.layers.len();
        app.begin_text([20., 30.], None, &ctx);
        let size = app.doc.selected().unwrap().pixels.dimensions();
        let position = app.doc.selected().unwrap().world_point([0., 0.]);
        app.text_edit.as_mut().unwrap().spec.size = 96.;
        app.refresh_text(&ctx);
        let layer = app.doc.selected().unwrap();
        assert!(layer.pixels.width() > size.0 && layer.pixels.height() > size.1);
        assert_eq!(layer.world_point([0., 0.]), position);
        app.finish_text(false);
        assert_eq!(app.doc.layers.len(), before);
        assert!(!app.dirty);
    }
}
