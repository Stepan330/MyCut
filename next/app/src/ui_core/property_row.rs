//! Original adapter around ready-made numeric input. A row emits one commit
//! per gesture; it does not own document history or a second parameter model.
use super::{NumberField, TextBlock, unreal_theme};
use crate::icons::{Icon, IconButton};
use eframe::egui::{self, Response, Ui};
pub struct PropertyRow<'a> {
    pub label: &'a str,
    pub defaults: &'a [f32],
    pub speed: f64,
}
#[derive(Default)]
pub struct PropertyEdit {
    pub rect: Option<egui::Rect>,
    pub changed: bool,
    pub began: bool,
    pub ended: bool,
    pub reset: bool,
    pub committed: bool,
    pub cancelled: bool,
    pub invalid: bool,
    pub before: Option<Vec<f32>>,
    pub fields: Vec<Response>,
    pub reset_button: Option<Response>,
}

#[derive(Clone)]
struct Session {
    before: Vec<f32>,
    field: usize,
    frame: u64,
    precise: f64,
}
impl PropertyRow<'_> {
    pub fn show(&self, ui: &mut Ui, values: &mut [f32]) -> PropertyEdit {
        let mut edit = PropertyEdit::default();
        ui.push_id(self.label, |ui| {
            let key = ui.id().with("edit-session");
            let frame = ui.ctx().cumulative_frame_nr();
            let mut session = ui
                .ctx()
                .data_mut(|d| d.get_temp::<Session>(key))
                .filter(|s| s.before.len() == values.len() && s.frame + 1 >= frame);
            let before_frame = values.to_vec();
            let stacked = ui.available_width() < 220. && values.len() > 1;
            if stacked {
                ui.add(TextBlock::new(self.label));
            }
            let row = ui.scope_builder(
                egui::UiBuilder::new()
                    .id(ui.id().with("property-controls"))
                    .max_rect(egui::Rect::from_min_size(
                        ui.next_widget_position(),
                        egui::vec2(ui.available_width(), 26.),
                    ))
                    .layout(egui::Layout::left_to_right(egui::Align::Center)),
                |ui| {
                    ui.spacing_mut().item_spacing.x = 3.;
                    let label_width = if stacked {
                        0.
                    } else {
                        (ui.available_width() * 0.22).min(80.)
                    };
                    let width =
                        ((ui.available_width() - label_width - 28. - 3. * values.len() as f32)
                            / values.len().max(1) as f32)
                            .max(1.);
                    if !stacked {
                        ui.add_sized([label_width, 26.], TextBlock::new(self.label));
                    }
                    for (i, before_value) in before_frame.iter().copied().enumerate() {
                        let response = ui
                            .scope_builder(
                                egui::UiBuilder::new().id(ui.id().with(("field", i))),
                                |ui| {
                                    ui.add_sized(
                                        [width, 22.],
                                        NumberField::new(&mut values[i])
                                            .starship()
                                            .speed(self.speed)
                                            .max_decimals(3),
                                    )
                                },
                            )
                            .inner;
                        let stripe = egui::Rect::from_min_size(
                            response.rect.min + egui::vec2(3., 3.),
                            egui::vec2(2., (response.rect.height() - 6.).max(0.)),
                        );
                        ui.painter_at(response.rect.intersect(ui.clip_rect()))
                            .rect_filled(stripe, 1., unreal_theme::axis_color(i));
                        if session.is_none()
                            && (response.clicked()
                                || response.gained_focus()
                                || response.drag_started())
                        {
                            session = Some(Session {
                                before: before_frame.clone(),
                                field: i,
                                frame,
                                precise: f64::from(before_value),
                            });
                            edit.began = true;
                        }
                        if response.dragged()
                            && let Some(origin) = session.as_mut().filter(|s| s.field == i)
                        {
                            // Keep egui input/focus/accessibility, but not its
                            // smart-aim rounding or Shift-to-slow convention.
                            let modifiers = ui.ctx().input(|input| input.modifiers);
                            let multiplier = if modifiers.shift { 10. } else { 1. }
                                * if modifiers.ctrl { 0.1 } else { 1. };
                            origin.precise +=
                                f64::from(response.drag_delta().x) * self.speed * multiplier;
                            values[i] = origin.precise as f32;
                        }
                        if !values[i].is_finite() && before_value.is_finite() {
                            values[i] = before_value;
                            edit.invalid = true;
                        }
                        if session.as_ref().is_some_and(|s| s.field == i) {
                            if ui.ctx().input(|input| input.key_pressed(egui::Key::Escape)) {
                                let origin = session.take().unwrap();
                                values.copy_from_slice(&origin.before);
                                edit.before = Some(origin.before);
                                edit.cancelled = true;
                                edit.ended = true;
                                ui.ctx().memory_mut(|m| m.surrender_focus(response.id));
                                ui.ctx().stop_dragging();
                            } else if response.drag_stopped() || response.lost_focus() {
                                let origin = session.take().unwrap();
                                edit.committed = origin.before != values;
                                edit.before = Some(origin.before);
                                edit.ended = true;
                            }
                        }
                        edit.fields.push(response);
                    }
                    let differs = values.iter().zip(self.defaults).any(|(v, d)| v != d);
                    if differs {
                        let response = IconButton::new(Icon::Reset, "Reset to default")
                            .size(24.)
                            .animation(super::Feature::Off)
                            .show(ui);
                        if response.clicked() {
                            let before =
                                session.take().map_or_else(|| values.to_vec(), |s| s.before);
                            for (value, default) in values.iter_mut().zip(self.defaults) {
                                *value = *default;
                            }
                            edit.committed = before != values;
                            edit.before = Some(before);
                            edit.began = true;
                            edit.reset = true;
                            edit.ended = true;
                        }
                        edit.reset_button = Some(response);
                    } else {
                        ui.allocate_space(egui::vec2(24., 24.));
                    }
                },
            );
            ui.painter().hline(
                row.response.rect.x_range(),
                row.response.rect.bottom(),
                egui::Stroke::new(1., unreal_theme::INPUT),
            );
            edit.rect = Some(row.response.rect);
            edit.changed = before_frame != values;
            ui.ctx().data_mut(|d| {
                if let Some(mut s) = session {
                    s.frame = frame;
                    d.insert_temp(key, s);
                } else {
                    d.remove::<Session>(key);
                }
            });
        });
        edit
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn frame(ctx: &egui::Context, values: &mut [f32], events: Vec<egui::Event>) -> PropertyEdit {
        frame_with_modifiers(ctx, values, events, egui::Modifiers::NONE)
    }
    fn frame_with_modifiers(
        ctx: &egui::Context,
        values: &mut [f32],
        events: Vec<egui::Event>,
        modifiers: egui::Modifiers,
    ) -> PropertyEdit {
        let mut result = PropertyEdit::default();
        let out = ctx.run_ui(
            egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::vec2(450., 160.),
                )),
                events: events
                    .into_iter()
                    .chain(std::iter::once(egui::Event::ModifiersChanged(modifiers)))
                    .collect(),
                focused: true,
                ..Default::default()
            },
            |ui| {
                super::unreal_theme::apply_details(ui);
                ui.set_width(380.);
                result = PropertyRow {
                    label: "Location",
                    defaults: &[0.; 3],
                    speed: 0.1,
                }
                .show(ui, values);
            },
        );
        out.drop_without_applying_deltas();
        result
    }
    fn click(pos: egui::Pos2, pressed: bool) -> egui::Event {
        egui::Event::PointerButton {
            pos,
            button: egui::PointerButton::Primary,
            pressed,
            modifiers: egui::Modifiers::NONE,
        }
    }
    fn key(key: egui::Key) -> egui::Event {
        egui::Event::Key {
            key,
            physical_key: None,
            pressed: true,
            repeat: false,
            modifiers: egui::Modifiers::NONE,
        }
    }
    fn focus(ctx: &egui::Context, values: &mut [f32]) -> egui::Id {
        let initial = frame(ctx, values, vec![]);
        let id = initial.fields[0].id;
        let at = initial.fields[0].rect.center();
        frame(
            ctx,
            values,
            vec![egui::Event::PointerMoved(at), click(at, true)],
        );
        frame(ctx, values, vec![click(at, false)]);
        frame(ctx, values, vec![]);
        id
    }
    #[test]
    fn text_edit_updates_live_escape_restores_and_enter_commits_once() {
        let ctx = egui::Context::default();
        let mut values = [10., 20., 30.];
        focus(&ctx, &mut values);
        let changed = frame(&ctx, &mut values, vec![egui::Event::Text("12.5".into())]);
        assert!(changed.changed);
        assert_eq!(values[0], 12.5);
        let cancelled = frame(&ctx, &mut values, vec![key(egui::Key::Escape)]);
        assert!(cancelled.cancelled && !cancelled.committed);
        assert_eq!(values, [10., 20., 30.]);
        focus(&ctx, &mut values);
        frame(&ctx, &mut values, vec![egui::Event::Text("42".into())]);
        let committed = frame(&ctx, &mut values, vec![key(egui::Key::Enter)]);
        assert!(committed.committed && committed.ended);
        assert_eq!(committed.before, Some(vec![10., 20., 30.]));
        assert_eq!(values[0], 42.);
        assert!(!frame(&ctx, &mut values, vec![]).committed);
    }
    #[test]
    fn reset_is_hidden_at_default_and_is_one_atomic_commit() {
        let ctx = egui::Context::default();
        let mut values = [0.; 3];
        assert!(frame(&ctx, &mut values, vec![]).reset_button.is_none());
        values = [4., 5., 6.];
        let initial = frame(&ctx, &mut values, vec![]);
        let at = initial.reset_button.unwrap().rect.center();
        frame(
            &ctx,
            &mut values,
            vec![egui::Event::PointerMoved(at), click(at, true)],
        );
        let result = frame(&ctx, &mut values, vec![click(at, false)]);
        assert!(result.reset && result.committed);
        assert_eq!(result.before, Some(vec![4., 5., 6.]));
        assert_eq!(values, [0.; 3]);
        assert!(frame(&ctx, &mut values, vec![]).reset_button.is_none());
    }
    #[test]
    fn invalid_nonfinite_input_does_not_enter_model_or_clamp_legacy_values() {
        let ctx = egui::Context::default();
        let mut values = [25., 0., 0.];
        focus(&ctx, &mut values);
        let result = frame(&ctx, &mut values, vec![egui::Event::Text("inf".into())]);
        assert_eq!(values[0], 25.);
        assert!(result.invalid || !result.changed);
        frame(&ctx, &mut values, vec![key(egui::Key::Escape)]);
        assert_eq!(values[0], 25.);
    }
    #[test]
    fn field_ids_survive_responsive_layout_and_hidden_reset_button() {
        let ctx = egui::Context::default();
        let mut values = [0.; 3];
        let mut first = None;
        for width in [380., 180., 380.] {
            let out = ctx.run_ui(Default::default(), |ui| {
                ui.set_width(width);
                unreal_theme::apply_details(ui);
                let edit = PropertyRow {
                    label: "Location",
                    defaults: &[0.; 3],
                    speed: 0.1,
                }
                .show(ui, &mut values);
                let ids = edit.fields.iter().map(|r| r.id).collect::<Vec<_>>();
                if let Some(first) = &first {
                    assert_eq!(first, &ids);
                } else {
                    first = Some(ids);
                }
            });
            out.drop_without_applying_deltas();
            values[2] = 1.;
        }
    }
    #[test]
    fn rows_remain_compact_in_tall_details_panels() {
        let ctx = egui::Context::default();
        let out = ctx.run_ui(
            egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::vec2(380., 900.),
                )),
                ..Default::default()
            },
            |ui| {
                unreal_theme::apply_details(ui);
                ui.spacing_mut().item_spacing.y = 0.;
                let mut previous = None;
                for label in ["Location", "Rotation", "Scale"] {
                    let mut values = [0.; 3];
                    let edit = PropertyRow {
                        label,
                        defaults: &[0.; 3],
                        speed: 0.1,
                    }
                    .show(ui, &mut values);
                    let rect = edit.rect.unwrap();
                    assert!(rect.height() <= 27., "row expanded to {}", rect.height());
                    if let Some(bottom) = previous {
                        assert!(rect.top() >= bottom);
                        assert!(rect.top() - bottom < 2.);
                    }
                    for field in edit.fields {
                        assert!(rect.expand(0.01).contains_rect(field.rect));
                    }
                    previous = Some(rect.bottom());
                }
            },
        );
        out.drop_without_applying_deltas();
    }
    #[test]
    fn real_drag_emits_one_commit_and_matches_slate_modifier_multipliers() {
        let drag = |modifiers: egui::Modifiers| {
            let ctx = egui::Context::default();
            let mut values = [0.; 3];
            let at = frame(&ctx, &mut values, vec![]).fields[0].rect.center();
            frame_with_modifiers(
                &ctx,
                &mut values,
                vec![egui::Event::PointerMoved(at), click(at, true)],
                modifiers,
            );
            let mut began = 0;
            for dx in [12., 24., 36.] {
                let out = frame_with_modifiers(
                    &ctx,
                    &mut values,
                    vec![egui::Event::PointerMoved(at + egui::vec2(dx, 0.))],
                    modifiers,
                );
                began += usize::from(out.began);
                assert!(!out.committed);
            }
            let out = frame_with_modifiers(
                &ctx,
                &mut values,
                vec![click(at + egui::vec2(36., 0.), false)],
                modifiers,
            );
            assert_eq!(began, 1);
            assert!(out.committed);
            assert_eq!(out.before, Some(vec![0.; 3]));
            assert!(!frame(&ctx, &mut values, vec![]).committed);
            values[0]
        };
        let normal = drag(egui::Modifiers::NONE);
        let fast = drag(egui::Modifiers {
            shift: true,
            ..Default::default()
        });
        let fine = drag(egui::Modifiers {
            ctrl: true,
            ..Default::default()
        });
        assert!(normal > 0.);
        assert!(
            (fast / normal - 10.).abs() < 0.2,
            "normal={normal}, fast={fast}"
        );
        assert!(
            (fine / normal - 0.1).abs() < 0.03,
            "normal={normal}, fine={fine}"
        );
    }
}
