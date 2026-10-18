//! Reference composition built with UI Core, not a bitmap or photo document.
use crate::{
    icons::Icon,
    ui_core::{NumberField, Panel, PanelHeader, SurfaceStyle, Toggle, Toolbar, UiComponents},
};
use eframe::egui::{self, Color32, Rect, Stroke, Vec2};

pub(super) struct Concept {
    outliner: super::SampleOutliner,
    style: SurfaceStyle,
    selected: usize,
    transform: bool,
    collapsed: bool,
    content: bool,
    position: [f32; 2],
    pub(super) rects: Option<ConceptRects>,
}
impl Default for Concept {
    fn default() -> Self {
        Self {
            outliner: Default::default(),
            style: SurfaceStyle::default(),
            selected: 0,
            transform: true,
            collapsed: false,
            content: false,
            position: [0.; 2],
            rects: None,
        }
    }
}
#[derive(Clone, Copy)]
pub(super) struct ConceptRects {
    pub toolbar: Rect,
    pub top: Rect,
    pub outliner: Rect,
    pub details: Rect,
    pub canvas: Rect,
}
impl ConceptRects {
    fn new(bounds: Rect) -> Self {
        // Reference proportions, uniformly scaled and centred for small windows.
        let scale = (bounds.width() / 1430.).min(bounds.height() / 876.).max(0.);
        let origin = bounds.center() - Vec2::new(1430., 876.) * scale * 0.5;
        let r = |x, y, w, h| {
            Rect::from_min_size(origin + Vec2::new(x, y) * scale, Vec2::new(w, h) * scale)
        };
        Self {
            toolbar: r(10., 78., 60., 780.),
            top: r(10., 78., 975., 58.),
            outliner: r(998., 78., 409., 393.),
            details: r(998., 487., 409., 372.),
            canvas: r(110., 168., 849., 624.),
        }
    }
}
impl Concept {
    pub(super) fn settings(&mut self, ui: &mut egui::Ui) {
        ui.menu_button("Concept settings", |ui| {
            ui.checkbox(&mut self.content, "Show sample panel content");
            ui.hbox(|ui| {
                ui.text("Corner radius");
                ui.add(NumberField::new(&mut self.style.radius).range(0..=24));
            });
            ui.hbox(|ui| {
                ui.text("Border width");
                ui.add(
                    NumberField::new(&mut self.style.border_width)
                        .range(0.5..=3.)
                        .speed(0.05),
                );
            });
            for (name, color) in [
                ("Background", &mut self.style.background),
                ("Panels", &mut self.style.panel),
                ("Borders", &mut self.style.border),
                ("Accent", &mut self.style.accent),
            ] {
                ui.hbox(|ui| {
                    ui.color_edit_button_srgba(color);
                    ui.text(name);
                });
            }
            ui.small_text("UI demonstration only; no photo project is modified.");
        });
    }
    pub(super) fn show(&mut self, ui: &mut egui::Ui) {
        let bounds = ui.available_rect_before_wrap();
        ui.painter().rect_filled(bounds, 0., self.style.background);
        let rects = ConceptRects::new(bounds);
        self.rects = Some(rects);
        let mut panel = Panel::new(self.style);
        panel.padding = 0.;
        panel.show(ui, "concept-top", rects.top, |_| {});
        panel.padding = 4.;
        panel.show(ui, "concept-tools", rects.toolbar, |ui| {
            Toolbar {
                style: self.style,
                button_size: (rects.toolbar.width() - 8.).clamp(24., 52.),
            }
            .show(
                ui,
                &[
                    (Icon::Pointer, "Select"),
                    (Icon::Pointer, "Direct select"),
                    (Icon::Text, "Text"),
                    (Icon::Cube, "Object"),
                    (Icon::Move, "Move"),
                ],
                &mut self.selected,
            );
        });
        panel.padding = 3.;
        panel.show(ui, "concept-outliner", rects.outliner, |ui| {
            if (PanelHeader {
                title: "Outliner",
                style: self.style,
            })
            .show(ui, &mut self.collapsed)
            .clicked()
            {
                self.content = !self.content;
            }
            ui.painter().hline(
                rects.outliner.x_range(),
                ui.cursor().top(),
                Stroke::new(self.style.border_width, self.style.border),
            );
            if self.content && !self.collapsed {
                self.outliner.show(ui, f32::INFINITY);
            }
        });
        panel.padding = 14.;
        panel.show(ui, "concept-details", rects.details, |ui| {
            ui.add(Toggle {
                value: &mut self.transform,
                label: "Transform",
                style: self.style,
            });
            if self.content {
                ui.add_enabled_ui(self.transform, |ui| {
                    ui.hbox(|ui| {
                        ui.text("Position");
                        ui.add(NumberField::new(&mut self.position[0]).prefix("X "));
                        ui.add(NumberField::new(&mut self.position[1]).prefix("Y "));
                    });
                });
            }
        });
        ui.painter().rect(
            rects.canvas,
            0.,
            Color32::from_rgb(242, 245, 248),
            Stroke::new(1.5, self.style.border),
            egui::StrokeKind::Inside,
        );
        ui.allocate_rect(bounds, egui::Sense::hover());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use egui::Pos2;
    #[test]
    fn composition_preserves_reference_proportions_and_contains_every_panel() {
        for size in [
            Vec2::new(1430., 876.),
            Vec2::new(800., 600.),
            Vec2::new(320., 240.),
        ] {
            let bounds = Rect::from_min_size(Pos2::new(25., 42.), size);
            let r = ConceptRects::new(bounds);
            for panel in [r.toolbar, r.top, r.outliner, r.details, r.canvas] {
                assert!(bounds.contains_rect(panel));
            }
            assert!(!r.canvas.intersects(r.outliner));
            assert!(!r.canvas.intersects(r.toolbar));
            assert!(!r.outliner.intersects(r.details));
            assert!((r.canvas.width() / r.canvas.height() - 849. / 624.).abs() < 0.001);
        }
    }
}
