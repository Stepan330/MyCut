use crate::ui_core::UiComponents;
use eframe::egui::{self, Color32, CornerRadius, Stroke};
pub const SECONDARY_TEXT: Color32 = Color32::from_gray(190);
pub fn apply(ctx: &egui::Context) {
    ctx.set_visuals(egui::Visuals::dark());
    ctx.style_mut_of(egui::Theme::Dark, |s| {
        s.spacing.item_spacing = egui::vec2(5., 3.);
        s.spacing.interact_size.y = 22.;
        s.spacing.window_margin = egui::Margin::same(8);
        s.visuals.panel_fill = Color32::from_rgb(31, 32, 35);
        s.visuals.window_fill = Color32::from_rgb(37, 38, 42);
        s.visuals.extreme_bg_color = Color32::from_rgb(16, 17, 19);
        s.visuals.faint_bg_color = Color32::from_rgb(39, 40, 43);
        s.visuals.weak_text_color = Some(SECONDARY_TEXT);
        s.visuals.selection.bg_fill = Color32::from_rgb(32, 76, 88);
        s.visuals.selection.stroke = Stroke::new(1., Color32::from_rgb(79, 206, 214));
        for w in [
            &mut s.visuals.widgets.noninteractive,
            &mut s.visuals.widgets.inactive,
            &mut s.visuals.widgets.hovered,
            &mut s.visuals.widgets.active,
            &mut s.visuals.widgets.open,
        ] {
            w.corner_radius = CornerRadius::same(2);
        }
        s.visuals.widgets.inactive.bg_fill = Color32::from_rgb(45, 46, 50);
        s.visuals.widgets.inactive.weak_bg_fill = Color32::from_rgb(39, 40, 43);
        s.visuals.widgets.inactive.bg_stroke = Stroke::new(1., Color32::from_gray(18));
        s.visuals.widgets.hovered.bg_fill = Color32::from_rgb(58, 64, 70);
        s.visuals.widgets.active.bg_fill = Color32::from_rgb(36, 84, 95);
    });
}

pub fn heading(ui: &mut egui::Ui, title: &str) {
    egui::Frame::new()
        .fill(Color32::from_rgb(47, 48, 52))
        .inner_margin(egui::Margin::symmetric(7, 5))
        .show(ui, |ui| {
            ui.set_min_width((ui.available_width() - 14.).max(0.));
            ui.text(egui::RichText::new(title).size(12.).strong());
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    fn luminance(color: Color32) -> f32 {
        let [r, g, b, _] = color.to_array();
        let linear = |v: u8| {
            let v = v as f32 / 255.;
            if v <= 0.04045 {
                v / 12.92
            } else {
                ((v + 0.055) / 1.055).powf(2.4)
            }
        };
        0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
    }
    #[test]
    fn secondary_labels_are_readable_on_panel_and_selected_card() {
        for background in [Color32::from_rgb(31, 32, 35), Color32::from_rgb(48, 73, 81)] {
            assert!((luminance(SECONDARY_TEXT) + 0.05) / (luminance(background) + 0.05) >= 4.5);
        }
    }
}
