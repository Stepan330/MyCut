//! Compact Details rows ordered by editing frequency, shared across layer kinds.
use crate::ui_core::UiComponents;
use crate::{
    App,
    icons::{self, Icon},
};
use eframe::egui;
use mycut_photo_core::Layer;
fn finish(responses: &[egui::Response]) -> bool {
    responses.iter().any(|r| {
        r.drag_stopped() || r.lost_focus() || (r.changed() && !r.dragged() && !r.has_focus())
    })
}
impl App {
    pub(crate) fn transform_details(&mut self, ui: &mut egui::Ui, layer: &Layer) {
        egui::CollapsingHeader::new("Transform")
            .default_open(true)
            .show(ui, |ui| {
                egui::Grid::new("transform-parameters")
                    .num_columns(2)
                    .spacing([7., 4.])
                    .show(ui, |ui| {
                        ui.add_sized([58., 22.], crate::ui_core::TextBlock::new("Scale"));
                        ui.hbox(|ui| {
                            let mut values = layer.transform.scale;
                            let mut responses = vec![];
                            for i in 0..2 {
                                if i == 1
                                    && icons::compact(
                                        ui,
                                        Icon::Link,
                                        self.transform_linked,
                                        "Link X/Y scale",
                                    )
                                    .clicked()
                                {
                                    self.transform_linked = !self.transform_linked;
                                }
                                ui.small_text(if i == 0 { "X" } else { "Y" });
                                let r = ui.add_sized(
                                    [42., 22.],
                                    crate::ui_core::NumberField::new(&mut values[i])
                                        .speed(0.01)
                                        .range(0.02..=100.)
                                        .fixed_decimals(3),
                                );
                                if r.changed() {
                                    if self.transform_linked {
                                        let ratio = (values[i] / layer.transform.scale[i]).clamp(
                                            (0.02 / layer.transform.scale[0])
                                                .max(0.02 / layer.transform.scale[1]),
                                            (100. / layer.transform.scale[0])
                                                .min(100. / layer.transform.scale[1]),
                                        );
                                        values = layer.transform.scale.map(|v| v * ratio);
                                    }
                                    self.history.begin(&self.doc);
                                    self.doc.selected_mut().unwrap().transform.scale = values;
                                    self.changed_continuously();
                                }
                                responses.push(r);
                            }
                            if icons::compact(ui, Icon::Reset, false, "Reset scale").clicked() {
                                self.command(|d| {
                                    d.selected_mut().unwrap().transform.scale = [1., 1.];
                                    Ok(())
                                });
                            }
                            if finish(&responses) {
                                self.history.commit();
                            }
                        });
                        ui.end_row();
                        ui.text("Position");
                        ui.hbox(|ui| {
                            let mut pos = [
                                layer.x as f32 + layer.transform.offset[0],
                                layer.y as f32 + layer.transform.offset[1],
                            ];
                            let mut responses = vec![];
                            for i in 0..2 {
                                ui.small_text(if i == 0 { "X" } else { "Y" });
                                let r = ui.add_sized(
                                    [57., 22.],
                                    crate::ui_core::NumberField::new(&mut pos[i])
                                        .speed(0.5)
                                        .range(-1000000.0..=1000000.0)
                                        .clamp_existing_to_range(false)
                                        .max_decimals(2),
                                );
                                if r.changed() {
                                    self.history.begin(&self.doc);
                                    let l = self.doc.selected_mut().unwrap();
                                    l.x = pos[0].round() as i32;
                                    l.y = pos[1].round() as i32;
                                    l.transform.offset = [pos[0] - l.x as f32, pos[1] - l.y as f32];
                                    self.changed_continuously();
                                }
                                responses.push(r);
                            }
                            if icons::compact(ui, Icon::Reset, false, "Reset position").clicked() {
                                self.command(|d| {
                                    let l = d.selected_mut().unwrap();
                                    l.x = 0;
                                    l.y = 0;
                                    l.transform.offset = [0., 0.];
                                    Ok(())
                                });
                            }
                            if finish(&responses) {
                                self.history.commit();
                            }
                        });
                        ui.end_row();
                        ui.text("Rotation");
                        ui.hbox(|ui| {
                            let mut degrees = layer.transform.rotation.to_degrees();
                            let slider = ui.add_sized(
                                [90., 22.],
                                crate::ui_core::ParameterSlider::new(&mut degrees, -180.0..=180.0)
                                    .clamping(egui::SliderClamping::Never)
                                    .show_value(false),
                            );
                            let field = ui.add_sized(
                                [65., 22.],
                                crate::ui_core::NumberField::new(&mut degrees)
                                    .speed(0.5)
                                    .range(-3600.0..=3600.0)
                                    .clamp_existing_to_range(false)
                                    .fixed_decimals(2),
                            );
                            if slider.changed() || field.changed() {
                                self.history.begin(&self.doc);
                                self.doc.selected_mut().unwrap().transform.rotation =
                                    degrees.to_radians();
                                self.changed_continuously();
                            }
                            if icons::compact(ui, Icon::Reset, false, "Reset rotation").clicked() {
                                self.command(|d| {
                                    d.selected_mut().unwrap().transform.rotation = 0.;
                                    Ok(())
                                });
                            }
                            if finish(&[slider, field]) {
                                self.history.commit();
                            }
                        });
                        ui.end_row();
                        ui.text("Opacity");
                        ui.hbox(|ui| {
                            let mut percent = layer.opacity * 100.;
                            let slider = ui.add_sized(
                                [90., 22.],
                                crate::ui_core::ParameterSlider::new(&mut percent, 0.0..=100.0)
                                    .show_value(false),
                            );
                            let field = ui.add_sized(
                                [65., 22.],
                                crate::ui_core::NumberField::new(&mut percent)
                                    .range(0.0..=100.0)
                                    .speed(0.5)
                                    .max_decimals(1)
                                    .suffix("%"),
                            );
                            if slider.changed() || field.changed() {
                                self.history.begin(&self.doc);
                                self.doc.selected_mut().unwrap().opacity = percent / 100.;
                                self.changed_continuously();
                            }
                            if icons::compact(ui, Icon::Reset, false, "Reset opacity").clicked() {
                                self.command(|d| {
                                    d.selected_mut().unwrap().opacity = 1.;
                                    Ok(())
                                });
                            }
                            if finish(&[slider, field]) {
                                self.history.commit();
                            }
                        });
                        ui.end_row();
                        ui.text("Flip");
                        ui.hbox(|ui| {
                            if icons::compact(
                                ui,
                                Icon::FlipX,
                                layer.transform.flip_x,
                                "Flip horizontally",
                            )
                            .clicked()
                            {
                                self.command(|d| {
                                    let t = &mut d.selected_mut().unwrap().transform;
                                    t.flip_x = !t.flip_x;
                                    Ok(())
                                });
                            }
                            if icons::compact(
                                ui,
                                Icon::FlipY,
                                layer.transform.flip_y,
                                "Flip vertically",
                            )
                            .clicked()
                            {
                                self.command(|d| {
                                    let t = &mut d.selected_mut().unwrap().transform;
                                    t.flip_y = !t.flip_y;
                                    Ok(())
                                });
                            }
                            if icons::compact(ui, Icon::Reset, false, "Reset flips").clicked() {
                                self.command(|d| {
                                    let t = &mut d.selected_mut().unwrap().transform;
                                    t.flip_x = false;
                                    t.flip_y = false;
                                    Ok(())
                                });
                            }
                        });
                        ui.end_row();
                    });
            });
    }
}
