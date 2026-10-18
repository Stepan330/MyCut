//! Small code-native icon set: independent of installed fonts and DPI.
use eframe::egui::{self, Color32, Pos2, Rect, Response, Stroke, Vec2};
#[derive(Clone, Copy)]
pub enum Icon {
    Pointer,
    Cube,
    Move,
    Brush,
    Eraser,
    Crop,
    Pan,
    Add,
    Duplicate,
    Delete,
    Up,
    Down,
    Undo,
    Redo,
    New,
    Open,
    Save,
    Export,
    Resize,
    Text,
    Settings,
    FlipX,
    FlipY,
    Link,
    Reset,
    Search,
    Image,
}
pub fn button(ui: &mut egui::Ui, icon: Icon, selected: bool, hint: &str) -> Response {
    IconButton::new(icon, hint).selected(selected).show(ui)
}
pub fn compact(ui: &mut egui::Ui, icon: Icon, selected: bool, hint: &str) -> Response {
    IconButton::new(icon, hint)
        .selected(selected)
        .size(24.)
        .animation(crate::ui_core::Feature::Inherit)
        .show(ui)
}
pub struct IconButton<'a> {
    icon: Icon,
    selected: bool,
    hint: &'a str,
    side: f32,
    animation: crate::ui_core::Feature,
}
impl<'a> IconButton<'a> {
    pub fn new(icon: Icon, hint: &'a str) -> Self {
        Self {
            icon,
            selected: false,
            hint,
            side: 27.,
            animation: crate::ui_core::Feature::Inherit,
        }
    }
    pub fn selected(mut self, b: bool) -> Self {
        self.selected = b;
        self
    }
    pub fn size(mut self, side: f32) -> Self {
        self.side = side.clamp(24., 64.);
        self
    }
    pub fn animation(mut self, value: crate::ui_core::Feature) -> Self {
        self.animation = value;
        self
    }
    pub fn show(self, ui: &mut egui::Ui) -> Response {
        sized_button(
            ui,
            self.icon,
            self.selected,
            self.hint,
            self.side,
            self.animation,
        )
    }
}
fn sized_button(
    ui: &mut egui::Ui,
    icon: Icon,
    selected: bool,
    hint: &str,
    side: f32,
    animation: crate::ui_core::Feature,
) -> Response {
    let key = ui.next_auto_id().with("mycut-button-motion");
    let strength = crate::ui_core::animation_strength(ui, animation);
    let hovered = ui.ctx().data(|d| d.get_temp::<bool>(key)).unwrap_or(false);
    let amount = if strength > 0. {
        ui.ctx().animate_bool_with_time(
            key.with("spring"),
            hovered,
            crate::ui_core::animation_duration(ui, 0.14 * strength),
        )
    } else {
        0.
    };
    let response = ui
        .add(
            crate::ui_core::Button::new("")
                .animation(crate::ui_core::Feature::Off)
                .min_size(Vec2::new(side + 3. * amount * strength, side))
                .selected(selected),
        )
        .on_hover_text(hint);
    response
        .widget_info(|| egui::WidgetInfo::labeled(egui::WidgetType::Button, ui.is_enabled(), hint));
    ui.ctx()
        .data_mut(|d| d.insert_temp(key, response.hovered()));
    if hovered != response.hovered() {
        ui.ctx().request_repaint();
    }
    let p = ui.painter_at(response.rect);
    let r = response.rect.shrink(side * 0.22 - amount * strength * 0.5);
    let color = if selected {
        Color32::from_rgb(65, 223, 225)
    } else {
        ui.visuals().text_color()
    };
    paint_icon(&p, r, icon, color);
    response
}
/// Shared code-native glyph, also usable in dense tree rows without a button frame.
pub fn paint_icon(p: &egui::Painter, r: Rect, icon: Icon, color: Color32) {
    let s = Stroke::new(1.5, color);
    let point = |x: f32, y: f32| Pos2::new(r.min.x + x * r.width(), r.min.y + y * r.height());
    let line = |a: [f32; 2], b: [f32; 2]| {
        p.line_segment([point(a[0], a[1]), point(b[0], b[1])], s);
    };
    let arrow = |from: [f32; 2], to: [f32; 2]| {
        p.arrow(
            point(from[0], from[1]),
            point(to[0], to[1]) - point(from[0], from[1]),
            s,
        );
    };
    let box_at = |a: [f32; 2], b: [f32; 2]| {
        p.rect_stroke(
            Rect::from_two_pos(point(a[0], a[1]), point(b[0], b[1])),
            1.,
            s,
            egui::StrokeKind::Inside,
        );
    };
    match icon {
        Icon::Search => {
            p.circle_stroke(point(0.4, 0.4), r.width() * 0.3, s);
            line([0.62, 0.62], [0.95, 0.95]);
        }
        Icon::Image => {
            box_at([0., 0.], [1., 1.]);
            p.circle_filled(point(0.72, 0.28), r.width() * 0.09, color);
            line([0.1, 0.85], [0.4, 0.48]);
            line([0.4, 0.48], [0.65, 0.75]);
            line([0.65, 0.75], [0.8, 0.6]);
            line([0.8, 0.6], [0.95, 0.82]);
        }
        Icon::Pointer => {
            p.add(egui::Shape::closed_line(
                vec![
                    point(0.1, 0.),
                    point(0.35, 0.95),
                    point(0.52, 0.58),
                    point(0.93, 0.45),
                ],
                s,
            ));
            line([0.52, 0.58], [0.78, 1.]);
        }
        Icon::Cube => {
            p.add(egui::Shape::closed_line(
                vec![
                    point(0.5, 0.),
                    point(1., 0.25),
                    point(1., 0.75),
                    point(0.5, 1.),
                    point(0., 0.75),
                    point(0., 0.25),
                ],
                s,
            ));
            line([0., 0.25], [0.5, 0.5]);
            line([1., 0.25], [0.5, 0.5]);
            line([0.5, 0.5], [0.5, 1.]);
        }
        Icon::FlipX => {
            line([0.5, 0.], [0.5, 1.]);
            p.add(egui::Shape::closed_line(
                vec![point(0., 0.2), point(0.35, 0.5), point(0., 0.8)],
                s,
            ));
            p.add(egui::Shape::closed_line(
                vec![point(1., 0.2), point(0.65, 0.5), point(1., 0.8)],
                s,
            ));
        }
        Icon::FlipY => {
            line([0., 0.5], [1., 0.5]);
            p.add(egui::Shape::closed_line(
                vec![point(0.2, 0.), point(0.5, 0.35), point(0.8, 0.)],
                s,
            ));
            p.add(egui::Shape::closed_line(
                vec![point(0.2, 1.), point(0.5, 0.65), point(0.8, 1.)],
                s,
            ));
        }
        Icon::Link => {
            p.circle_stroke(point(0.3, 0.65), r.width() * 0.22, s);
            p.circle_stroke(point(0.7, 0.3), r.width() * 0.22, s);
            line([0.3, 0.65], [0.7, 0.3]);
        }
        Icon::Reset => {
            let points: Vec<_> = (0..=20)
                .map(|i| {
                    let a = i as f32 / 20. * std::f32::consts::PI * 1.6 - 0.8;
                    r.center() + Vec2::angled(a) * r.width() * 0.42
                })
                .collect();
            let last = points[points.len() - 1];
            p.add(egui::Shape::line(points, s));
            p.arrow(last - Vec2::new(0., 3.), Vec2::new(0., 3.), s);
        }
        Icon::Move => {
            arrow([0.5, 0.5], [0.5, 0.]);
            arrow([0.5, 0.5], [0.5, 1.]);
            arrow([0.5, 0.5], [0., 0.5]);
            arrow([0.5, 0.5], [1., 0.5]);
        }
        Icon::Brush => {
            line([0.2, 0.75], [0.85, 0.1]);
            line([0.3, 0.85], [0.95, 0.2]);
            p.circle_filled(point(0.15, 0.9), 2.5, color);
        }
        Icon::Eraser => {
            p.add(egui::Shape::closed_line(
                vec![
                    point(0.05, 0.65),
                    point(0.65, 0.05),
                    point(1., 0.4),
                    point(0.4, 1.),
                ],
                s,
            ));
            line([0.25, 0.45], [0.6, 0.8]);
        }
        Icon::Crop => {
            line([0.2, 0.], [0.2, 0.8]);
            line([0.2, 0.8], [1., 0.8]);
            line([0., 0.2], [0.8, 0.2]);
            line([0.8, 0.2], [0.8, 1.]);
        }
        Icon::Pan => {
            box_at([0.2, 0.35], [0.8, 0.9]);
            for x in [0.25, 0.43, 0.61, 0.79] {
                line([x, 0.4], [x, 0.05]);
            }
        }
        Icon::Add => {
            line([0., 0.5], [1., 0.5]);
            line([0.5, 0.], [0.5, 1.]);
        }
        Icon::Duplicate => {
            box_at([0., 0.], [0.7, 0.7]);
            box_at([0.3, 0.3], [1., 1.]);
        }
        Icon::Delete => {
            box_at([0.2, 0.25], [0.8, 1.]);
            line([0.05, 0.2], [0.95, 0.2]);
            line([0.35, 0.], [0.65, 0.]);
            line([0.4, 0.4], [0.4, 0.8]);
            line([0.6, 0.4], [0.6, 0.8]);
        }
        Icon::Up => arrow([0.5, 1.], [0.5, 0.]),
        Icon::Down => arrow([0.5, 0.], [0.5, 1.]),
        Icon::Undo | Icon::Redo => {
            let flip = matches!(icon, Icon::Redo);
            let x = |v: f32| if flip { 1. - v } else { v };
            line([x(0.9), 0.9], [x(0.9), 0.5]);
            line([x(0.9), 0.5], [x(0.1), 0.5]);
            arrow([x(0.5), 0.5], [x(0.1), 0.15]);
        }
        Icon::New => {
            box_at([0.15, 0.], [0.85, 1.]);
            line([0.5, 0.3], [0.5, 0.75]);
            line([0.3, 0.52], [0.7, 0.52]);
        }
        Icon::Open => {
            box_at([0., 0.3], [1., 1.]);
            line([0., 0.3], [0., 0.05]);
            line([0., 0.05], [0.45, 0.05]);
            line([0.45, 0.05], [0.6, 0.3]);
        }
        Icon::Save => {
            box_at([0., 0.], [1., 1.]);
            box_at([0.2, 0.], [0.8, 0.35]);
            box_at([0.2, 0.6], [0.8, 1.]);
        }
        Icon::Export => {
            line([0., 0.4], [0., 1.]);
            line([0., 1.], [1., 1.]);
            line([1., 1.], [1., 0.4]);
            arrow([0.5, 0.7], [0.5, 0.]);
        }
        Icon::Resize => {
            box_at([0.1, 0.1], [0.9, 0.9]);
            arrow([0.5, 0.5], [1., 0.]);
            arrow([0.5, 0.5], [0., 1.]);
        }
        Icon::Text => {
            line([0., 0.1], [1., 0.1]);
            line([0.5, 0.1], [0.5, 1.]);
            line([0.2, 1.], [0.8, 1.]);
        }
        Icon::Settings => {
            p.circle_stroke(point(0.5, 0.5), r.width() * 0.22, s);
            for i in 0..8 {
                let v = Vec2::angled(i as f32 * std::f32::consts::TAU / 8.);
                p.line_segment(
                    [
                        r.center() + v * r.width() * 0.34,
                        r.center() + v * r.width() * 0.5,
                    ],
                    s,
                );
            }
        }
    }
}
