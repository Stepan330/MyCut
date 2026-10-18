//! MyCut's adaptive-zone law and anchored manipulator, independent of widgets.
use eframe::egui::{self, Color32, Pos2, Stroke, Vec2};
use mycut_photo_core::Layer;
use serde::{Deserialize, Serialize};
#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub ui_scale: f32,
    pub animation: f32,
    pub base_radius: f32,
    pub max_expansion: f32,
    pub speed_coefficient: f32,
    pub influence: f32,
    pub shrink_speed: f32,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            ui_scale: 1.,
            animation: 1.,
            base_radius: 16.,
            max_expansion: 28.,
            speed_coefficient: 0.04,
            influence: 160.,
            shrink_speed: 88.,
        }
    }
}
impl Settings {
    pub fn sanitize(&mut self) {
        let d = Self::default();
        fn clamp(v: f32, default: f32, min: f32, max: f32) -> f32 {
            if v.is_finite() {
                v.clamp(min, max)
            } else {
                default
            }
        }
        self.ui_scale = clamp(self.ui_scale, d.ui_scale, 0.65, 2.);
        self.animation = clamp(self.animation, d.animation, 0., 2.);
        self.base_radius = clamp(self.base_radius, d.base_radius, 8., 32.);
        self.max_expansion = clamp(self.max_expansion, d.max_expansion, 0., 64.);
        self.speed_coefficient = clamp(self.speed_coefficient, d.speed_coefficient, 0., 0.2);
        self.influence = clamp(self.influence, d.influence, 40., 400.);
        self.shrink_speed = clamp(self.shrink_speed, d.shrink_speed, 10., 400.);
    }
}
pub fn expansion(speed: f32, distance: f32, s: &Settings) -> f32 {
    let p = (1. - distance.max(0.) / s.influence).clamp(0., 1.);
    ((speed - 260.).max(0.) * s.speed_coefficient * p * p).min(s.max_expansion)
}
#[derive(Default)]
pub struct Motion {
    last: Option<Pos2>,
    pub speed: f32,
    pub dt: f32,
}
impl Motion {
    pub fn update(&mut self, pos: Option<Pos2>, dt: f32) {
        self.dt = dt.clamp(0.001, 0.1);
        let speed = match (pos, self.last) {
            (Some(a), Some(b)) => a.distance(b) / self.dt,
            _ => 0.,
        };
        self.speed = speed.min(10000.);
        self.last = pos;
    }
}
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Handle {
    Corner(usize),
    Edge(usize),
    Rotate,
}
#[derive(Default)]
pub struct Gizmo {
    owner: Option<u64>,
    last_point: Option<Pos2>,
    radii: [f32; 9],
    visual_radius: f32,
    opacity: f32,
    pub hover: Option<Handle>,
}
fn screen(p: [f32; 2], origin: Pos2, zoom: f32) -> Pos2 {
    origin + Vec2::new(p[0], p[1]) * zoom
}
fn local_handle(layer: &Layer, h: Handle) -> [f32; 2] {
    let w = layer.pixels.width() as f32;
    let hgt = layer.pixels.height() as f32;
    match h {
        Handle::Corner(i) => [[0., 0.], [w, 0.], [w, hgt], [0., hgt]][i],
        Handle::Edge(i) => [[w / 2., 0.], [w, hgt / 2.], [w / 2., hgt], [0., hgt / 2.]][i],
        Handle::Rotate => [w / 2., hgt / 2.],
    }
}
pub struct GizmoInput<'a> {
    pub pointer: Option<Pos2>,
    pub origin: Pos2,
    pub zoom: f32,
    pub motion: &'a Motion,
    pub settings: &'a Settings,
    pub painter: &'a egui::Painter,
    pub active: Option<Handle>,
}
impl Gizmo {
    pub fn update_draw(&mut self, layer: &Layer, input: GizmoInput<'_>) -> Option<Handle> {
        let GizmoInput {
            pointer,
            origin,
            zoom,
            motion,
            settings,
            painter,
            active,
        } = input;
        if self.owner != Some(layer.id) {
            *self = Self::default();
            self.owner = Some(layer.id);
        }
        let corners = layer.corners().map(|p| screen(p, origin, zoom));
        let center = screen(
            layer.world_point(local_handle(layer, Handle::Rotate)),
            origin,
            zoom,
        );
        let ring = corners[0].distance(center) + 28.;
        let mut best: Option<(Handle, f32, Pos2, f32)> = None;
        let base = settings.base_radius;
        let dt = motion.dt;
        for (index, handle) in (0..4)
            .map(Handle::Corner)
            .chain((0..4).map(Handle::Edge))
            .enumerate()
        {
            let p = screen(layer.world_point(local_handle(layer, handle)), origin, zoom);
            let distance = pointer.map_or(f32::INFINITY, |mouse| mouse.distance(p));
            let wanted = expansion(motion.speed, distance, settings);
            self.radii[index] = wanted.max(self.radii[index] - settings.shrink_speed * dt);
            let radius = base + self.radii[index];
            if distance <= radius && best.as_ref().is_none_or(|b| distance < b.1) {
                best = Some((handle, distance, p, radius));
            }
        }
        if let Some(mouse) = pointer {
            let delta = mouse - center;
            let nearest = center + delta.normalized() * ring;
            let available = corners
                .iter()
                .all(|p| p.distance(nearest) > base + settings.max_expansion + 8.);
            let distance = (delta.length() - ring).abs();
            let wanted = expansion(motion.speed, distance, settings);
            self.radii[8] = wanted.max(self.radii[8] - settings.shrink_speed * dt);
            if available && best.is_none() && distance <= base + self.radii[8] {
                best = Some((Handle::Rotate, distance, nearest, base + self.radii[8]));
            }
        } else {
            self.radii[8] = (self.radii[8] - settings.shrink_speed * dt).max(0.);
        }
        self.hover = active.or(best.map(|b| b.0));
        if let Some(b) = best {
            self.last_point = Some(b.2);
        }
        for i in 0..4 {
            painter.line_segment(
                [corners[i], corners[(i + 1) % 4]],
                Stroke::new(1.3, Color32::from_rgb(50, 215, 220)),
            );
        }
        for h in (0..4).map(Handle::Corner).chain((0..4).map(Handle::Edge)) {
            let p = screen(layer.world_point(local_handle(layer, h)), origin, zoom);
            let size = if matches!(h, Handle::Corner(_)) {
                13.
            } else {
                10.
            };
            let color = if Some(h) == self.hover {
                Color32::WHITE
            } else {
                Color32::from_rgb(50, 215, 220)
            };
            painter.rect_filled(
                egui::Rect::from_center_size(p, Vec2::splat(size)),
                1.,
                color,
            );
        }
        for i in 0..160 {
            let angle = i as f32 * std::f32::consts::TAU / 160.;
            let next = (i + 1) as f32 * std::f32::consts::TAU / 160.;
            let a = center + Vec2::angled(angle) * ring;
            let b = center + Vec2::angled(next) * ring;
            if corners.iter().any(|c| {
                c.distance(a) < base + settings.max_expansion + 8.
                    || c.distance(b) < base + settings.max_expansion + 8.
            }) {
                continue;
            }
            let fade = pointer.map_or(0., |p| {
                (1. - p.distance((a + b.to_vec2()) / 2.) / 150.).clamp(0., 1.)
            });
            painter.line_segment(
                [a, b],
                Stroke::new(1.2, Color32::from_white_alpha((35. + 190. * fade) as u8)),
            );
        }
        let target = best.map_or(base, |b| b.3);
        let opacity = if self.hover.is_some() { 1. } else { 0. };
        let t = if settings.animation == 0. {
            1.
        } else {
            1. - (-dt / (0.12 * settings.animation)).exp()
        };
        self.visual_radius += (target - self.visual_radius) * t;
        self.opacity += (opacity - self.opacity) * t;
        if self.opacity > 0.01
            && let Some(point) = self.last_point
        {
            let color = Color32::from_rgba_unmultiplied(45, 210, 220, (35. * self.opacity) as u8);
            painter.circle_filled(point, self.visual_radius, color);
            painter.circle_stroke(
                point,
                self.visual_radius,
                Stroke::new(
                    1.,
                    Color32::from_rgba_unmultiplied(45, 210, 220, (120. * self.opacity) as u8),
                ),
            );
        }
        if self.radii.iter().any(|v| *v > 0.1)
            || (self.opacity - opacity).abs() > 0.01
            || (self.visual_radius - target).abs() > 0.1
        {
            painter
                .ctx()
                .request_repaint_after(std::time::Duration::from_millis(16));
        }
        self.hover
    }
}
pub struct TransformDrag {
    pub original: Layer,
    pub handle: Handle,
    start: [f32; 2],
}
impl TransformDrag {
    pub fn new(original: Layer, handle: Handle, start: [f32; 2]) -> Self {
        Self {
            original,
            handle,
            start,
        }
    }
    pub fn update(&self, layer: &mut Layer, pointer: [f32; 2], shift: bool, alt: bool, ctrl: bool) {
        let original = &self.original;
        let w = original.pixels.width() as f32;
        let h = original.pixels.height() as f32;
        layer.transform = original.transform;
        layer.x = original.x;
        layer.y = original.y;
        if self.handle == Handle::Rotate {
            let center = original.world_point([w / 2., h / 2.]);
            let a = (self.start[1] - center[1]).atan2(self.start[0] - center[0]);
            let b = (pointer[1] - center[1]).atan2(pointer[0] - center[0]);
            let delta = (b - a).sin().atan2((b - a).cos());
            let mut angle = original.transform.rotation + delta * if ctrl { 0.1 } else { 1. };
            if shift {
                let step = std::f32::consts::PI / 12.;
                angle = (angle / step).round() * step;
            }
            layer.transform.rotation = angle;
            layer.place_anchor([w / 2., h / 2.], center);
            return;
        }
        let moving = local_handle(original, self.handle);
        let anchor = if alt {
            [w / 2., h / 2.]
        } else {
            [w - moving[0], h - moving[1]]
        };
        let current = original.local_point(pointer);
        let start = original.local_point(self.start);
        let d = [moving[0] - anchor[0], moving[1] - anchor[1]];
        let mut ratio = [1., 1.];
        for i in 0..2 {
            if d[i].abs() > 0.001 {
                ratio[i] = 1. + (current[i] - start[i]) / d[i] * if ctrl { 0.1 } else { 1. };
            }
        }
        let proportional = matches!(self.handle, Handle::Corner(_)) != shift;
        if proportional {
            let value = if matches!(self.handle, Handle::Corner(_)) {
                (ratio[0] * d[0] * d[0] + ratio[1] * d[1] * d[1]) / (d[0] * d[0] + d[1] * d[1])
            } else if d[0].abs() > 0.001 {
                ratio[0]
            } else {
                ratio[1]
            };
            let minimum =
                (0.02 / original.transform.scale[0]).max(0.02 / original.transform.scale[1]);
            let maximum =
                (100. / original.transform.scale[0]).min(100. / original.transform.scale[1]);
            ratio = [value.clamp(minimum, maximum); 2];
        }
        for (i, r) in ratio.iter().enumerate() {
            layer.transform.scale[i] = (original.transform.scale[i] * r).clamp(0.02, 100.);
        }
        layer.place_anchor(anchor, original.world_point(anchor));
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use mycut_photo_core::Document;
    #[test]
    fn growth_and_distance() {
        let s = Settings::default();
        assert_eq!(expansion(200., 0., &s), 0.);
        assert!(expansion(1000., 0., &s) > expansion(1000., 100., &s));
    }
    #[test]
    fn corner_keeps_opposite_anchor_and_source() {
        let mut d = Document::new(100, 100).unwrap();
        d.add_image("test".into(), image::RgbaImage::new(20, 10))
            .unwrap();
        let mut l = d.selected().unwrap().clone();
        let drag = TransformDrag::new(l.clone(), Handle::Corner(2), [20., 10.]);
        drag.update(&mut l, [40., 20.], false, false, false);
        assert_eq!(l.transform.scale, [2., 2.]);
        assert_eq!(l.world_point([0., 0.]), [0., 0.]);
        assert_eq!(l.pixels.dimensions(), (20, 10));
    }
    #[test]
    fn edge_free_and_alt_center() {
        let mut d = Document::new(100, 100).unwrap();
        d.add_image("test".into(), image::RgbaImage::new(20, 10))
            .unwrap();
        let mut l = d.selected().unwrap().clone();
        let drag = TransformDrag::new(l.clone(), Handle::Edge(1), [20., 5.]);
        drag.update(&mut l, [30., 5.], false, true, false);
        assert_eq!(l.transform.scale, [2., 1.]);
        assert_eq!(l.world_point([10., 5.]), [10., 5.]);
    }
}
