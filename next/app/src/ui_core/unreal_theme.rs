//! UE 5.8.2 factory Starship colour roles (sRGB), not approximated screenshot colours.
//! Reference: StyleColors.cpp / USlateThemeManager::InitializeDefaults.
use eframe::egui::{self, Color32, Stroke, Ui};
pub const BACKGROUND: Color32 = Color32::from_rgb(21, 21, 21);
pub const PANEL: Color32 = Color32::from_rgb(36, 36, 36);
pub const INPUT: Color32 = Color32::from_rgb(15, 15, 15);
pub const INPUT_OUTLINE: Color32 = Color32::from_rgb(56, 56, 56);
pub const RECESSED: Color32 = Color32::from_rgb(26, 26, 26);
pub const HEADER: Color32 = Color32::from_rgb(47, 47, 47);
pub const HOVER: Color32 = Color32::from_rgb(87, 87, 87);
pub const FOREGROUND: Color32 = Color32::from_rgb(192, 192, 192);
pub const PRIMARY: Color32 = Color32::from_rgb(0, 112, 224);
pub const PRIMARY_HOVER: Color32 = Color32::from_rgb(14, 134, 255);
pub const PRIMARY_PRESS: Color32 = Color32::from_rgb(0, 80, 160);
pub const FOLDER: Color32 = Color32::from_rgb(182, 143, 85);
pub const PROPERTY_FONT_SIZE: f32 = 10.667;
pub fn axis_color(index: usize) -> Color32 {
    // SNumericEntryBox declares linear FLinearColor, not sRGB byte values.
    let rgb = [
        [0.594, 0.0197, 0.0],
        [0.1349, 0.3959, 0.0],
        [0.0251, 0.207, 0.85],
    ][index.min(2)];
    egui::Rgba::from_rgb(rgb[0], rgb[1], rgb[2]).into()
}
pub fn apply_details(ui: &mut Ui) {
    apply(ui);
    for role in [egui::TextStyle::Body, egui::TextStyle::Button] {
        ui.style_mut()
            .text_styles
            .insert(role, egui::FontId::proportional(PROPERTY_FONT_SIZE));
    }
}
pub fn apply_numeric(ui: &mut Ui) {
    let style = ui.style_mut();
    style.spacing.button_padding = egui::vec2(7., 2.5);
    style.spacing.interact_size = egui::vec2(0., 20.);
    style.drag_value_text_style = egui::TextStyle::Body;
    let v = &mut style.visuals;
    v.override_text_color = Some(Color32::WHITE);
    for (widget, border) in [
        (&mut v.widgets.inactive, INPUT_OUTLINE),
        (&mut v.widgets.hovered, HOVER),
        (&mut v.widgets.active, PRIMARY),
    ] {
        widget.bg_fill = INPUT;
        widget.weak_bg_fill = INPUT;
        widget.bg_stroke = Stroke::new(1., border);
        widget.corner_radius = 4.into();
    }
    v.text_edit_bg_color = Some(INPUT);
}
pub fn fonts(ctx: &egui::Context) {
    let mut definitions = egui::FontDefinitions::default();
    definitions.font_data.insert(
        "mycut-roboto".into(),
        egui::FontData::from_static(include_bytes!("../../assets/fonts/Roboto-Regular.ttf")).into(),
    );
    definitions
        .families
        .get_mut(&egui::FontFamily::Proportional)
        .unwrap()
        .insert(0, "mycut-roboto".into());
    ctx.set_fonts(definitions);
}
pub fn apply(ui: &mut Ui) {
    let style = ui.style_mut();
    style.spacing.item_spacing = egui::vec2(4., 3.);
    style.spacing.interact_size.y = 24.;
    for role in [egui::TextStyle::Body, egui::TextStyle::Button] {
        style
            .text_styles
            .insert(role, egui::FontId::proportional(13.333));
    }
    let v = &mut style.visuals;
    v.override_text_color = Some(FOREGROUND);
    v.panel_fill = PANEL;
    v.window_fill = PANEL;
    v.extreme_bg_color = INPUT;
    v.faint_bg_color = RECESSED;
    v.selection.bg_fill = PRIMARY;
    v.selection.stroke = Stroke::new(1., Color32::WHITE);
    v.widgets.inactive.bg_fill = INPUT;
    v.widgets.inactive.weak_bg_fill = INPUT;
    v.widgets.inactive.bg_stroke = Stroke::new(1., INPUT_OUTLINE);
    v.widgets.hovered.bg_fill = HOVER;
    v.widgets.hovered.weak_bg_fill = HOVER;
    v.widgets.hovered.bg_stroke = Stroke::new(1., PRIMARY_HOVER);
    v.widgets.active.bg_fill = PRIMARY_PRESS;
    v.widgets.active.weak_bg_fill = PRIMARY_PRESS;
    v.widgets.open.bg_fill = HEADER;
    for widget in [
        &mut v.widgets.inactive,
        &mut v.widgets.hovered,
        &mut v.widgets.active,
        &mut v.widgets.open,
        &mut v.widgets.noninteractive,
    ] {
        widget.corner_radius = 2.into();
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn numeric_states_keep_input_fill_and_use_slate_border_roles() {
        let ctx = egui::Context::default();
        let out = ctx.run_ui(Default::default(), |ui| {
            apply_details(ui);
            apply_numeric(ui);
            let v = ui.visuals();
            for widget in [&v.widgets.inactive, &v.widgets.hovered, &v.widgets.active] {
                assert_eq!(widget.bg_fill, INPUT);
                assert_eq!(widget.corner_radius, egui::CornerRadius::same(4));
            }
            assert_eq!(v.widgets.inactive.bg_stroke.color, INPUT_OUTLINE);
            assert_eq!(v.widgets.hovered.bg_stroke.color, HOVER);
            assert_eq!(v.widgets.active.bg_stroke.color, PRIMARY);
            assert_eq!(ui.style().drag_value_text_style, egui::TextStyle::Body);
        });
        out.drop_without_applying_deltas();
    }
    #[test]
    fn bundled_roboto_loads_and_renders_cyrillic() {
        let ctx = egui::Context::default();
        fonts(&ctx);
        for _ in 0..2 {
            let out = ctx.run_ui(Default::default(), |ui| {
                let response = ui.label("MyCut · Кириллица 0123");
                assert!(response.rect.width() > 0. && response.rect.height() > 0.);
            });
            out.drop_without_applying_deltas();
        }
    }
    #[test]
    fn factory_palette_retains_exact_srgb_bytes() {
        assert_eq!(BACKGROUND.to_array(), [0x15, 0x15, 0x15, 255]);
        assert_eq!(PANEL.to_array(), [0x24, 0x24, 0x24, 255]);
        assert_eq!(INPUT.to_array(), [0x0f, 0x0f, 0x0f, 255]);
        assert_eq!(PRIMARY.to_array(), [0, 0x70, 0xe0, 255]);
        let ctx = egui::Context::default();
        let out = ctx.run_ui(Default::default(), |ui| {
            let old = ui.visuals().panel_fill;
            ui.scope(|ui| {
                apply(ui);
                assert_eq!(ui.visuals().panel_fill, PANEL);
            });
            assert_eq!(ui.visuals().panel_fill, old);
        });
        out.drop_without_applying_deltas();
    }
}
