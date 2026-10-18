//! Reusable, code-native surfaces. Geometry and state belong to the caller.
use super::{Feature, animation_duration, animation_strength};
use crate::icons::{Icon, IconButton};
use eframe::egui::{self, Color32, Rect, Response, Stroke, Ui, Vec2};

#[derive(Clone, Copy)]
pub struct SurfaceStyle {
    pub background: Color32,
    pub panel: Color32,
    pub border: Color32,
    pub text: Color32,
    pub accent: Color32,
    pub toggle: Color32,
    pub radius: u8,
    pub border_width: f32,
}
impl Default for SurfaceStyle {
    fn default() -> Self {
        Self {
            background: Color32::from_rgb(28, 33, 40),
            panel: Color32::from_rgb(43, 49, 58),
            border: Color32::from_rgb(93, 105, 120),
            text: Color32::from_rgb(234, 237, 242),
            accent: Color32::from_rgb(0, 187, 248),
            toggle: Color32::from_rgb(76, 31, 228),
            radius: 10,
            border_width: 1.3,
        }
    }
}
pub struct Panel {
    pub style: SurfaceStyle,
    pub padding: f32,
}
impl Panel {
    pub fn new(style: SurfaceStyle) -> Self {
        Self { style, padding: 8. }
    }
    pub fn show<R>(
        &self,
        ui: &mut Ui,
        id: impl std::hash::Hash + std::fmt::Debug,
        rect: Rect,
        body: impl FnOnce(&mut Ui) -> R,
    ) -> R {
        ui.painter().rect(
            rect,
            self.style.radius,
            self.style.panel,
            Stroke::new(self.style.border_width, self.style.border),
            egui::StrokeKind::Inside,
        );
        let inner = rect.shrink(
            self.padding
                .min(rect.width().min(rect.height()) * 0.5)
                .max(0.),
        );
        let mut child = ui.new_child(egui::UiBuilder::new().id(ui.id().with(id)).max_rect(inner));
        child.set_clip_rect(inner.intersect(ui.clip_rect()));
        child.visuals_mut().override_text_color = Some(self.style.text);
        body(&mut child)
    }
}

pub struct PanelHeader<'a> {
    pub title: &'a str,
    pub style: SurfaceStyle,
}
impl PanelHeader<'_> {
    /// Menu and collapse are real buttons; the owner decides what they do.
    pub fn show(&self, ui: &mut Ui, collapsed: &mut bool) -> Response {
        let width = ui.available_width();
        let (rect, _) = ui.allocate_exact_size(Vec2::new(width, 30.), egui::Sense::hover());
        let menu = ui.interact(
            Rect::from_min_size(rect.min, Vec2::splat(28.)),
            ui.id().with("menu"),
            egui::Sense::click(),
        );
        for offset in [-7., 0., 7.] {
            let p = menu.rect.center() + egui::vec2(0., offset);
            ui.painter().line_segment(
                [p - egui::vec2(10., 0.), p + egui::vec2(10., 0.)],
                Stroke::new(1.8, self.style.text),
            );
        }
        ui.painter().text(
            rect.min + egui::vec2(34., 15.),
            egui::Align2::LEFT_CENTER,
            self.title,
            egui::FontId::proportional(17.),
            self.style.text,
        );
        let collapse = ui.interact(
            Rect::from_center_size(rect.right_center() - egui::vec2(15., 0.), Vec2::splat(28.)),
            ui.id().with("collapse"),
            egui::Sense::click(),
        );
        ui.painter().circle_stroke(
            collapse.rect.center(),
            9.,
            Stroke::new(1.6, self.style.text),
        );
        if collapse.clicked() {
            *collapsed = !*collapsed;
        }
        collapse.widget_info(|| {
            egui::WidgetInfo::labeled(
                egui::WidgetType::Button,
                ui.is_enabled(),
                "Collapse panel content",
            )
        });
        menu.widget_info(|| {
            egui::WidgetInfo::labeled(egui::WidgetType::Button, ui.is_enabled(), "Panel menu")
        });
        menu.on_hover_text("Panel menu")
    }
}

pub struct Toggle<'a> {
    pub value: &'a mut bool,
    pub label: &'a str,
    pub style: SurfaceStyle,
}
impl egui::Widget for Toggle<'_> {
    fn ui(self, ui: &mut Ui) -> Response {
        let (rect, mut response) =
            ui.allocate_exact_size(Vec2::new(145., 28.), egui::Sense::click());
        if response.clicked() {
            *self.value = !*self.value;
            response.mark_changed();
        }
        response.widget_info(|| {
            egui::WidgetInfo::selected(
                egui::WidgetType::Checkbox,
                ui.is_enabled(),
                *self.value,
                self.label,
            )
        });
        let amount = if animation_strength(ui, Feature::Inherit) > 0. {
            ui.ctx().animate_bool_with_time(
                response.id.with("toggle"),
                *self.value,
                animation_duration(ui, 0.14),
            )
        } else {
            f32::from(*self.value)
        };
        let track = Rect::from_center_size(
            rect.left_center() + egui::vec2(15., 0.),
            Vec2::new(30., 16.),
        );
        ui.painter()
            .rect_filled(track, 8., Color32::from_rgb(22, 26, 34));
        ui.painter().circle_filled(
            track.left_center() + egui::vec2(8. + 14. * amount, 0.),
            5.5,
            if *self.value {
                self.style.toggle
            } else {
                self.style.border
            },
        );
        ui.painter().text(
            rect.left_center() + egui::vec2(38., 0.),
            egui::Align2::LEFT_CENTER,
            self.label,
            egui::FontId::proportional(15.),
            self.style.text,
        );
        response
    }
}

pub struct Toolbar {
    pub style: SurfaceStyle,
    pub button_size: f32,
}
impl Toolbar {
    pub fn show(&self, ui: &mut Ui, tools: &[(Icon, &str)], selected: &mut usize) {
        ui.scope(|ui| {
            ui.visuals_mut().selection.bg_fill = self.style.panel;
            ui.visuals_mut().selection.stroke = Stroke::new(1., self.style.accent);
            ui.visuals_mut().widgets.inactive.bg_stroke = Stroke::NONE;
            ui.visuals_mut().widgets.inactive.weak_bg_fill = Color32::TRANSPARENT;
            ui.visuals_mut().widgets.inactive.corner_radius = self.style.radius.into();
            ui.visuals_mut().widgets.hovered.corner_radius = self.style.radius.into();
            ui.visuals_mut().widgets.active.corner_radius = self.style.radius.into();
            for (i, (icon, label)) in tools.iter().enumerate() {
                if IconButton::new(*icon, label)
                    .size(self.button_size)
                    .selected(*selected == i)
                    .show(ui)
                    .clicked()
                {
                    *selected = i;
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn toggle_handles_real_clicks_and_disabled_state_without_changing_layout() {
        let ctx = egui::Context::default();
        let mut value = false;
        let mut rect = Rect::NOTHING;
        let mut id = None;
        let mut run = |events, enabled, value: &mut bool| {
            let out = ctx.run_ui(
                egui::RawInput {
                    events,
                    focused: true,
                    ..Default::default()
                },
                |ui| {
                    ui.add_enabled_ui(enabled, |ui| {
                        let response = ui.add(Toggle {
                            value,
                            label: "Transform",
                            style: SurfaceStyle::default(),
                        });
                        rect = response.rect;
                        if let Some(id) = id {
                            assert_eq!(response.id, id);
                        } else {
                            id = Some(response.id);
                        }
                    });
                },
            );
            out.drop_without_applying_deltas();
            rect
        };
        let before = run(vec![], true, &mut value);
        let at = before.center();
        let click = |pressed| egui::Event::PointerButton {
            pos: at,
            button: egui::PointerButton::Primary,
            pressed,
            modifiers: egui::Modifiers::NONE,
        };
        run(
            vec![egui::Event::PointerMoved(at), click(true)],
            true,
            &mut value,
        );
        assert_eq!(run(vec![click(false)], true, &mut value), before);
        assert!(value);
        run(vec![click(true)], false, &mut value);
        run(vec![click(false)], false, &mut value);
        assert!(value);
    }
}
