//! Standalone UI study. No document animation, evaluation graph or media engine.
use super::UiComponents;
use eframe::egui::{self, Color32, Pos2, Rect, Stroke, Vec2};
const TICKS_PER_SECOND: f64 = 24_000.;
#[derive(Clone, Copy, Debug)]
struct TimeView {
    start: f64,
    end: f64,
}
impl TimeView {
    fn time_at(self, fraction: f64) -> f64 {
        self.start + (self.end - self.start) * fraction
    }
    fn zoom(&mut self, factor: f64, anchor: f64) {
        if !factor.is_finite() || factor <= 0. {
            return;
        }
        let anchor = anchor.clamp(0., 1.);
        let at = self.time_at(anchor);
        let span = ((self.end - self.start) * factor).clamp(0.05, 3600.);
        self.start = at - span * anchor;
        self.end = self.start + span;
    }
    fn pan(&mut self, seconds: f64) {
        if seconds.is_finite() {
            self.start += seconds;
            self.end += seconds;
        }
    }
}
pub struct Timeline {
    view: TimeView,
    ticks: i64,
    playing: bool,
    snap: bool,
    fractional_ticks: f64,
    pub selected: usize,
    pub rect: Option<Rect>,
}
impl Default for Timeline {
    fn default() -> Self {
        Self {
            view: TimeView { start: 0., end: 8. },
            ticks: 0,
            playing: false,
            snap: true,
            fractional_ticks: 0.,
            selected: 0,
            rect: None,
        }
    }
}
impl Timeline {
    fn seek(&mut self, seconds: f64) {
        if !seconds.is_finite() {
            return;
        }
        let seconds = seconds.clamp(0., 8.);
        self.ticks = if self.snap {
            (seconds * 30.).round() as i64 * 800
        } else {
            (seconds * TICKS_PER_SECOND).round() as i64
        };
        self.fractional_ticks = 0.;
    }
    pub fn show(&mut self, ui: &mut egui::Ui) {
        ui.hbox(|ui| {
            ui.emphasis("Sequencer study");
            if ui
                .action(if self.playing { "Pause" } else { "Play" })
                .clicked()
            {
                self.playing = !self.playing;
            }
            if ui.action("Stop").clicked() {
                self.playing = false;
                self.seek(0.);
            }
            ui.checkbox(&mut self.snap, "Snap");
            if ui.action("Fit").clicked() {
                self.view = TimeView { start: 0., end: 8. };
            }
            ui.small_text(format!(
                "30 fps · frame {:03} · Ctrl+wheel: zoom · Shift+wheel / RMB: pan",
                self.ticks / 800
            ));
        });
        if self.playing {
            self.fractional_ticks +=
                f64::from(ui.ctx().input(|i| i.stable_dt).clamp(0., 0.1)) * TICKS_PER_SECOND;
            let whole = self.fractional_ticks.floor() as i64;
            self.fractional_ticks -= whole as f64;
            self.ticks = (self.ticks + whole) % 192_000;
            ui.ctx().request_repaint();
        }
        let size = Vec2::new(
            ui.available_width().max(1.),
            ui.available_height().max(110.),
        );
        let (whole, _) = ui.allocate_exact_size(size, egui::Sense::hover());
        let label_width = (whole.width() * 0.2)
            .clamp(60., 180.)
            .min((whole.width() - 1.).max(0.));
        let rect = Rect::from_min_max(whole.min + egui::vec2(label_width, 0.), whole.max);
        self.rect = Some(rect);
        let response = ui.interact(
            rect,
            ui.id().with("timeline-grid"),
            egui::Sense::click_and_drag(),
        );
        let input = ui.ctx().input(|i| {
            (
                i.smooth_scroll_delta.y,
                i.modifiers.ctrl,
                i.modifiers.shift,
                i.pointer.delta().x,
            )
        });
        if response.hovered() && input.0 != 0. {
            if input.1 {
                let fraction = response
                    .hover_pos()
                    .map_or(0.5, |p| f64::from((p.x - rect.left()) / rect.width()));
                self.view.zoom((-f64::from(input.0) * 0.01).exp(), fraction);
            } else if input.2 {
                self.view
                    .pan(-f64::from(input.0) * 0.003 * (self.view.end - self.view.start));
            }
        }
        if response.dragged_by(egui::PointerButton::Secondary) {
            self.view
                .pan(-f64::from(input.3 / rect.width()) * (self.view.end - self.view.start));
        }
        if (response.clicked_by(egui::PointerButton::Primary)
            || response.dragged_by(egui::PointerButton::Primary))
            && let Some(pos) = response.interact_pointer_pos()
        {
            self.playing = false;
            self.seek(
                self.view
                    .time_at(f64::from((pos.x - rect.left()) / rect.width())),
            );
        }
        let painter = ui.painter_at(rect.intersect(ui.clip_rect()));
        painter.rect_filled(rect, 0., Color32::from_rgb(24, 25, 28));
        let to_x = |time: f64| {
            rect.left()
                + ((time - self.view.start) / (self.view.end - self.view.start)) as f32
                    * rect.width()
        };
        let step = 10_f64.powf(((self.view.end - self.view.start) / 8.).log10().ceil());
        let first = (self.view.start / step).floor();
        for index in 0..=12 {
            let time = (first + f64::from(index)) * step;
            let x = to_x(time);
            painter.line_segment(
                [Pos2::new(x, rect.top()), Pos2::new(x, rect.bottom())],
                Stroke::new(1., Color32::from_gray(55)),
            );
            painter.text(
                Pos2::new(x + 4., rect.top() + 4.),
                egui::Align2::LEFT_TOP,
                format!("{:.0}", time * 30.),
                egui::FontId::monospace(11.),
                Color32::LIGHT_GRAY,
            );
        }
        for (index, label) in ["Position", "Rotation", "Scale"].iter().enumerate() {
            let y = rect.top() + 26. + index as f32 * 27.;
            let row = Rect::from_min_size(Pos2::new(whole.left(), y), Vec2::new(label_width, 27.));
            let selection = ui.interact(row, ui.id().with(("track", index)), egui::Sense::click());
            if selection.clicked() {
                self.selected = index;
            }
            ui.painter().rect_filled(
                row,
                0.,
                if self.selected == index {
                    Color32::from_rgb(49, 71, 88)
                } else {
                    Color32::from_rgb(36, 37, 40)
                },
            );
            ui.painter().text(
                row.left_center() + egui::vec2(8., 0.),
                egui::Align2::LEFT_CENTER,
                label,
                egui::FontId::proportional(12.),
                Color32::LIGHT_GRAY,
            );
            for seconds in [0.5 + index as f64 * 0.25, 2., 4.5, 7.] {
                let center = Pos2::new(to_x(seconds), y + 13.);
                painter.add(egui::Shape::convex_polygon(
                    vec![
                        center + egui::vec2(0., -4.),
                        center + egui::vec2(4., 0.),
                        center + egui::vec2(0., 4.),
                        center + egui::vec2(-4., 0.),
                    ],
                    Color32::from_rgb(115, 164, 208),
                    Stroke::NONE,
                ));
            }
        }
        let x = to_x(self.ticks as f64 / TICKS_PER_SECOND);
        painter.line_segment(
            [Pos2::new(x, rect.top()), Pos2::new(x, rect.bottom())],
            Stroke::new(2., Color32::from_rgb(236, 72, 73)),
        );
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn real_pointer_scrubs_and_playback_advances_without_mouse_events() {
        let ctx = egui::Context::default();
        let mut timeline = Timeline::default();
        let run = |timeline: &mut Timeline, events| {
            let out = ctx.run_ui(
                egui::RawInput {
                    screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(900., 240.))),
                    events,
                    focused: true,
                    ..Default::default()
                },
                |ui| timeline.show(ui),
            );
            out.drop_without_applying_deltas();
        };
        for _ in 0..3 {
            run(&mut timeline, vec![]);
        }
        let point = timeline.rect.unwrap().center();
        let click = |pressed| egui::Event::PointerButton {
            pos: point,
            button: egui::PointerButton::Primary,
            pressed,
            modifiers: egui::Modifiers::NONE,
        };
        run(
            &mut timeline,
            vec![egui::Event::PointerMoved(point), click(true)],
        );
        run(&mut timeline, vec![click(false)]);
        assert!((timeline.ticks - 96000).abs() <= 800);
        let before = timeline.ticks;
        timeline.playing = true;
        for _ in 0..10 {
            run(&mut timeline, vec![]);
        }
        assert!(timeline.ticks > before);
    }
    #[test]
    fn zoom_preserves_cursor_time_and_pan_preserves_duration() {
        let mut view = TimeView {
            start: -2.,
            end: 8.,
        };
        let at = view.time_at(0.3);
        view.zoom(0.5, 0.3);
        assert!((view.time_at(0.3) - at).abs() < 1e-9);
        view.pan(3.);
        assert!((view.end - view.start - 5.).abs() < 1e-9);
        view.zoom(f64::NAN, 0.5);
        assert!(view.start.is_finite());
    }
    #[test]
    fn snapping_and_playback_bounds_are_separate_from_view() {
        let mut timeline = Timeline::default();
        timeline.view.pan(-100.);
        timeline.seek(1.021);
        assert_eq!(timeline.ticks, 31 * 800);
        timeline.snap = false;
        timeline.seek(1.021);
        assert_eq!(timeline.ticks, 24504);
        timeline.seek(-20.);
        assert_eq!(timeline.ticks, 0);
        timeline.seek(90.);
        assert_eq!(timeline.ticks, 192000);
        timeline.seek(f64::NAN);
        assert_eq!(timeline.ticks, 192000);
    }
}
