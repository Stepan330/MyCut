//! Fixed-size, centre-anchored reflow. Pure geometry, one UI evaluation per child.
use eframe::egui::{self, InnerResponse, Rect, Sense, Ui, Vec2};

#[derive(Clone, Copy, Debug)]
pub struct BoxItem {
    /// Neutral width: determines the child's anchor before expansion.
    pub basis: f32,
    pub minimum: f32,
    pub desired: f32,
}
impl BoxItem {
    pub fn new(basis: f32, minimum: f32) -> Self {
        Self {
            basis,
            minimum,
            desired: basis,
        }
    }
    pub fn desired(mut self, value: f32) -> Self {
        self.desired = value;
        self
    }
}
fn finite(v: f32) -> f32 {
    if v.is_finite() {
        v.clamp(0., 100_000.)
    } else {
        0.
    }
}
fn fit(desired: &[f32], minimum: &[f32], budget: f32) -> Vec<f32> {
    let total: f32 = desired.iter().sum();
    if total <= budget {
        return desired.to_vec();
    }
    let floor: f32 = minimum.iter().sum();
    let ratio = if total > floor {
        ((budget - floor) / (total - floor)).clamp(0., 1.)
    } else {
        0.
    };
    desired
        .iter()
        .zip(minimum)
        .map(|(v, m)| m + (v - m) * ratio)
        .collect()
}
fn fit_spacers_first(desired: &[f32], minimum: &[f32], budget: f32, spacers: &[bool]) -> Vec<f32> {
    let mut values = desired.to_vec();
    let mut deficit = (values.iter().sum::<f32>() - budget).max(0.);
    for is_spacer in [true, false] {
        let capacity: f32 = values
            .iter()
            .zip(minimum)
            .zip(spacers)
            .filter(|(_, spacer)| **spacer == is_spacer)
            .map(|((v, m), _)| (v - m).max(0.))
            .sum();
        let amount = deficit.min(capacity);
        if capacity > 0. {
            for ((v, m), spacer) in values.iter_mut().zip(minimum).zip(spacers) {
                if *spacer == is_spacer {
                    *v -= (*v - m).max(0.) * (amount / capacity);
                }
            }
        }
        deficit -= amount;
    }
    values
}
/// Rectangles are local to the fixed box. Growth consumes half its width from each
/// side of the anchor. Each side first uses free space, then shrinks its children.
/// At physical limits the growing child is capped, not the parent enlarged.
#[cfg(test)]
fn horizontal_rects(size: Vec2, gap: f32, items: &[BoxItem], focus: Option<usize>) -> Vec<Rect> {
    layout_rects(size, gap, items, focus, None)
}
fn layout_rects(
    size: Vec2,
    gap: f32,
    items: &[BoxItem],
    focus: Option<usize>,
    spacers: Option<&[bool]>,
) -> Vec<Rect> {
    let n = items.len();
    if n == 0 {
        return vec![];
    }
    let width = finite(size.x);
    let height = finite(size.y);
    let gap = finite(gap).min(if n > 1 { width / (n - 1) as f32 } else { 0. });
    let available = (width - gap * (n - 1) as f32).max(0.);
    let mut minimum: Vec<_> = items.iter().map(|s| finite(s.minimum)).collect();
    let sum: f32 = minimum.iter().sum();
    if sum > available && sum > 0. {
        for m in &mut minimum {
            *m *= available / sum;
        }
    }
    let basis: Vec<_> = items
        .iter()
        .zip(&minimum)
        .map(|(s, m)| finite(s.basis).max(*m))
        .collect();
    let desired: Vec<_> = items
        .iter()
        .zip(&minimum)
        .map(|(s, m)| finite(s.desired).max(*m))
        .collect();
    let fit_range = |desired: &[f32], minimum: &[f32], budget: f32, start: usize| {
        if let Some(spacers) = spacers {
            fit_spacers_first(
                desired,
                minimum,
                budget,
                &spacers[start..start + desired.len()],
            )
        } else {
            fit(desired, minimum, budget)
        }
    };
    let baseline = fit_range(&basis, &minimum, available, 0);
    let mut widths = fit_range(&desired, &minimum, available, 0);
    let mut start = (width - widths.iter().sum::<f32>() - gap * (n - 1) as f32) * 0.5;
    let focus = focus.filter(|k| *k < n).or_else(|| {
        (0..n)
            .filter(|i| (desired[*i] - basis[*i]).abs() > 0.001)
            .max_by(|a, b| {
                (desired[*a] - basis[*a])
                    .abs()
                    .total_cmp(&(desired[*b] - basis[*b]).abs())
            })
    });
    if let Some(k) = focus {
        let baseline_start = (width - baseline.iter().sum::<f32>() - gap * (n - 1) as f32) * 0.5;
        let center =
            baseline_start + baseline[..k].iter().sum::<f32>() + gap * k as f32 + baseline[k] * 0.5;
        let left_floor = minimum[..k].iter().sum::<f32>() + gap * k as f32;
        let right_floor = minimum[k + 1..].iter().sum::<f32>() + gap * (n - k - 1) as f32;
        let max_width =
            (2. * (center - left_floor).min(width - center - right_floor)).max(minimum[k]);
        let active = desired[k].min(max_width);
        let left_edge = center - active * 0.5;
        let right_edge = center + active * 0.5;
        let left = fit_range(
            &desired[..k],
            &minimum[..k],
            (left_edge - gap * k as f32).max(0.),
            0,
        );
        let right = fit_range(
            &desired[k + 1..],
            &minimum[k + 1..],
            (width - right_edge - gap * (n - k - 1) as f32).max(0.),
            k + 1,
        );
        start = left_edge - left.iter().sum::<f32>() - gap * k as f32;
        widths = left;
        widths.push(active);
        widths.extend(right);
    }
    let mut cursor = start.max(0.);
    widths
        .into_iter()
        .map(|w| {
            let rect = Rect::from_min_max(
                egui::pos2(cursor.min(width), 0.),
                egui::pos2((cursor + w).min(width), height),
            );
            cursor += w + gap;
            rect
        })
        .collect()
}

/// Elastic space at both edges AND between every pair. Spare width is shared
/// equally; under pressure spacers reach their minimum before buttons shrink.
fn spaced_rects(
    size: Vec2,
    preferred: f32,
    minimum: f32,
    items: &[BoxItem],
    focus: Option<usize>,
) -> Vec<Rect> {
    if items.is_empty() {
        return vec![];
    }
    let preferred = finite(preferred);
    let minimum = finite(minimum).min(preferred);
    let basis: f32 = items
        .iter()
        .map(|i| finite(i.basis).max(finite(i.minimum)))
        .sum();
    let extra = ((finite(size.x) - basis - preferred * (items.len() - 1) as f32)
        / (items.len() + 1) as f32)
        .max(0.);
    let mut expanded = Vec::with_capacity(items.len() * 2 + 1);
    expanded.push(BoxItem::new(extra, 0.));
    for (i, item) in items.iter().enumerate() {
        expanded.push(*item);
        expanded.push(if i + 1 == items.len() {
            BoxItem::new(extra, 0.)
        } else {
            BoxItem::new(preferred + extra, minimum)
        });
    }
    let mask: Vec<_> = (0..expanded.len()).map(|i| i % 2 == 0).collect();
    layout_rects(
        size,
        0.,
        &expanded,
        focus.filter(|i| *i < items.len()).map(|i| i * 2 + 1),
        Some(&mask),
    )
    .into_iter()
    .enumerate()
    .filter_map(|(i, rect)| (i % 2 == 1).then_some(rect))
    .collect()
}

pub struct HorizontalBox {
    pub size: Vec2,
    pub gap: f32,
    pub minimum_gap: f32,
    pub duration: f32,
}
#[derive(Clone)]
struct LayoutMotion {
    size: Vec2,
    slots: Vec<Rect>,
    time: f64,
}
pub struct BoxOutput<R> {
    pub rect: Rect,
    pub slots: Vec<Rect>,
    pub children: Vec<R>,
}
impl HorizontalBox {
    pub fn new(size: impl Into<Vec2>) -> Self {
        Self {
            size: size.into(),
            gap: 6.,
            minimum_gap: 4.,
            duration: 0.14,
        }
    }
    pub fn gap(mut self, gap: f32) -> Self {
        self.gap = gap;
        self
    }
    pub fn duration(mut self, duration: f32) -> Self {
        self.duration = finite(duration);
        self
    }
    pub fn minimum_gap(mut self, minimum: f32) -> Self {
        self.minimum_gap = finite(minimum);
        self
    }
    pub fn show<R>(
        self,
        ui: &mut Ui,
        items: &[BoxItem],
        focus: Option<usize>,
        mut body: impl FnMut(&mut Ui, usize) -> R,
    ) -> BoxOutput<R> {
        let size = Vec2::new(finite(self.size.x), finite(self.size.y));
        let (rect, response) = ui.allocate_exact_size(size, Sense::hover());
        let target = spaced_rects(size, self.gap, self.minimum_gap, items, focus);
        let time = ui.input(|i| i.time);
        let key = response.id.with("layout-motion");
        let duration = if super::animation_strength(ui, super::Feature::Inherit) > 0. {
            self.duration
        } else {
            0.
        };
        let previous = ui.ctx().data_mut(|d| d.get_temp::<LayoutMotion>(key));
        let mut local = target.clone();
        if let Some(previous) = previous
            && previous.size == size
            && previous.slots.len() == target.len()
            && duration > 0.
        {
            // Interpolate the complete layout, not just widths: changing the
            // anchor must not teleport neighbours. A shared blend preserves
            // ordering, containment and gaps between valid layouts.
            let dt = (time - previous.time).clamp(0., 0.05) as f32;
            let moving = previous.slots.iter().zip(&target).any(|(old, target)| {
                (old.min - target.min)
                    .length()
                    .max((old.max - target.max).length())
                    > 0.05
            });
            if moving {
                let blend = 1. - (-2. * dt / duration).exp();
                for ((slot, old), target) in local.iter_mut().zip(previous.slots).zip(&target) {
                    *slot = Rect::from_min_max(
                        old.min.lerp(target.min, blend),
                        old.max.lerp(target.max, blend),
                    );
                }
                ui.ctx().request_repaint();
            }
        }
        ui.ctx().data_mut(|d| {
            d.insert_temp(
                key,
                LayoutMotion {
                    size,
                    slots: local.clone(),
                    time,
                },
            )
        });
        let slots: Vec<_> = local
            .into_iter()
            .map(|r| r.translate(rect.min.to_vec2()))
            .collect();
        let mut children = Vec::with_capacity(slots.len());
        for (i, slot) in slots.iter().enumerate() {
            let mut child = ui.new_child(
                egui::UiBuilder::new()
                    .id(response.id.with(i))
                    .max_rect(*slot)
                    .layout(egui::Layout::top_down(egui::Align::Min)),
            );
            child.set_clip_rect(slot.intersect(ui.clip_rect()));
            child.style_mut().wrap_mode = Some(egui::TextWrapMode::Truncate);
            children.push(body(&mut child, i));
        }
        BoxOutput {
            rect,
            slots,
            children,
        }
    }
}

/// Intrinsic/wrapped rows are a different container, used by existing toolbars.
#[derive(Clone, Copy, Default)]
pub struct FlowBox {
    pub wrap: bool,
}
impl FlowBox {
    pub fn show<R>(self, ui: &mut Ui, body: impl FnOnce(&mut Ui) -> R) -> InnerResponse<R> {
        if self.wrap {
            ui.horizontal_wrapped(body)
        } else {
            ui.horizontal(body)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn internal_spacers_share_space_and_compress_before_buttons() {
        let size = Vec2::new(600., 50.);
        let mut items = equal();
        let before = spaced_rects(size, 8., 4., &items, None);
        let free = before[0].left();
        assert!(free > 0.);
        for pair in before.windows(2) {
            assert!((pair[1].left() - pair[0].right() - free - 8.).abs() < 0.002);
        }
        items[2].desired = 144.;
        let after = spaced_rects(size, 8., 4., &items, Some(2));
        assert!((before[2].center().x - after[2].center().x).abs() < 0.002);
        for pair in after.windows(2) {
            let gap = pair[1].left() - pair[0].right();
            assert!(gap < free + 8. && gap >= 4. - 0.002);
        }
        for i in [0, 1, 3, 4] {
            assert!((after[i].width() - 96.).abs() < 0.002);
        }
        items[2].desired = 280.;
        let squeezed = spaced_rects(size, 8., 4., &items, Some(2));
        valid(size, &squeezed);
        for pair in squeezed.windows(2) {
            assert!((pair[1].left() - pair[0].right() - 4.).abs() < 0.002);
        }
        for i in 0..5 {
            assert!((squeezed[i].left() + squeezed[4 - i].right() - size.x).abs() < 0.002);
        }
        items[2].desired = 96.;
        assert_eq!(before, spaced_rects(size, 8., 4., &items, None));
    }
    #[test]
    fn elastic_layout_is_contained_for_every_anchor_and_tiny_parent() {
        for width in [0., 1., 20., 100., 350., 600.] {
            for focus in 0..5 {
                let size = Vec2::new(width, 40.);
                let mut items = equal();
                let before = spaced_rects(size, 8., 4., &items, None);
                items[focus].desired = 10000.;
                let after = spaced_rects(size, 8., 4., &items, Some(focus));
                valid(size, &after);
                assert!((before[focus].center().x - after[focus].center().x).abs() < 0.003);
                if width >= 350. {
                    for pair in after.windows(2) {
                        assert!(pair[1].left() - pair[0].right() >= 4. - 0.003);
                    }
                }
            }
        }
        assert!(spaced_rects(Vec2::ZERO, f32::NAN, f32::INFINITY, &[], None).is_empty());
        valid(
            Vec2::new(200., 40.),
            &spaced_rects(
                Vec2::new(200., 40.),
                f32::NAN,
                f32::INFINITY,
                &equal(),
                Some(40),
            ),
        );
    }
    fn equal() -> Vec<BoxItem> {
        vec![BoxItem::new(96., 44.); 5]
    }
    fn valid(size: Vec2, slots: &[Rect]) {
        for r in slots {
            assert!(
                r.is_finite()
                    && r.width() >= -0.001
                    && r.left() >= -0.001
                    && r.right() <= size.x + 0.001
            );
        }
        for pair in slots.windows(2) {
            assert!(pair[0].right() <= pair[1].left() + 0.001);
        }
    }
    #[test]
    fn center_growth_displaces_and_then_shrinks_both_sides_symmetrically() {
        let size = Vec2::new(600., 50.);
        let mut items = equal();
        let before = horizontal_rects(size, 8., &items, Some(2));
        items[2].desired = 144.;
        let shifted = horizontal_rects(size, 8., &items, Some(2));
        assert_eq!(shifted[2].center().x, before[2].center().x);
        assert!((shifted[1].left() - before[1].left() + 24.).abs() < 0.001);
        assert!((shifted[3].left() - before[3].left() - 24.).abs() < 0.001);
        assert_eq!(shifted[1].width(), 96.);
        items[2].desired = 280.;
        let squeezed = horizontal_rects(size, 8., &items, Some(2));
        valid(size, &squeezed);
        for i in 0..5 {
            assert!((squeezed[i].left() + squeezed[4 - i].right() - size.x).abs() < 0.001);
        }
        assert!(squeezed[1].width() < 96. && squeezed[1].width() >= 44.);
    }
    #[test]
    fn every_anchor_stays_fixed_and_impossible_sizes_are_contained() {
        for width in [0., 20., 100., 350., 600.] {
            for k in 0..5 {
                let size = Vec2::new(width, 40.);
                let mut items = equal();
                let before = horizontal_rects(size, 8., &items, Some(k));
                items[k].desired = 10000.;
                let after = horizontal_rects(size, 8., &items, Some(k));
                valid(size, &after);
                assert!((before[k].center().x - after[k].center().x).abs() < 0.002);
            }
        }
    }
    #[test]
    fn shrinking_returns_to_baseline_without_drift_and_mirrors_unequal_sides() {
        let size = Vec2::new(650., 44.);
        let mut items = vec![
            BoxItem::new(65., 30.),
            BoxItem::new(110., 40.),
            BoxItem::new(90., 44.),
            BoxItem::new(80., 35.),
        ];
        let before = horizontal_rects(size, 7., &items, Some(1));
        items[1].desired = 290.;
        let after = horizontal_rects(size, 7., &items, Some(1));
        valid(size, &after);
        let mut reversed = items.clone();
        reversed.reverse();
        let mirror = horizontal_rects(size, 7., &reversed, Some(2));
        for i in 0..items.len() {
            assert!((after[i].left() + mirror[items.len() - 1 - i].right() - size.x).abs() < 0.002);
        }
        items[1].desired = 110.;
        assert_eq!(before, horizontal_rects(size, 7., &items, Some(1)));
        assert!(horizontal_rects(size, 7., &[], None).is_empty());
    }
    #[test]
    fn a_single_resized_child_is_detected_without_explicit_focus() {
        let size = Vec2::new(600., 45.);
        let mut items = equal();
        let before = horizontal_rects(size, 8., &items, None);
        items[1].desired = 240.;
        let after = horizontal_rects(size, 8., &items, None);
        assert!((before[1].center().x - after[1].center().x).abs() < 0.001);
        valid(size, &after);
    }
}
