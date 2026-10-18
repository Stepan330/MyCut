//! Shared MyCut components, composed over egui rather than reimplementing its input/layout.
//! Panels choose policies; document state never belongs to a widget.
use eframe::egui::{self, InnerResponse, Response, Ui, Widget, WidgetText};
mod horizontal_box;
pub use horizontal_box::{BoxItem, FlowBox, HorizontalBox};
mod surface;
pub use surface::{Panel, PanelHeader, SurfaceStyle, Toggle, Toolbar};
mod property_row;
pub use property_row::PropertyRow;
mod timeline;
pub use timeline::Timeline;
pub mod outliner;
pub mod unreal_theme;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum Feature {
    #[default]
    Inherit,
    On,
    Off,
}
impl Feature {
    pub fn resolve(self, inherited: bool) -> bool {
        match self {
            Self::Inherit => inherited,
            Self::On => true,
            Self::Off => false,
        }
    }
}

#[derive(Clone, Copy, Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct ComponentPolicy {
    pub animation: Feature,
    pub adaptive_input: Feature,
}
pub fn policy(ui: &Ui) -> ComponentPolicy {
    ui.ctx()
        .data(|d| d.get_temp(egui::Id::new("mycut-component-policy")))
        .unwrap_or_default()
}
pub fn with_policy<R>(ui: &mut Ui, value: ComponentPolicy, body: impl FnOnce(&mut Ui) -> R) -> R {
    let old = policy(ui);
    let inherit = |local, parent| {
        if local == Feature::Inherit {
            parent
        } else {
            local
        }
    };
    let value = ComponentPolicy {
        animation: inherit(value.animation, old.animation),
        adaptive_input: inherit(value.adaptive_input, old.adaptive_input),
    };
    ui.ctx()
        .data_mut(|d| d.insert_temp(egui::Id::new("mycut-component-policy"), value));
    let result = ui
        .scope(|ui| {
            if !value.animation.resolve(true) {
                ui.style_mut().animation_time = 0.;
            }
            if !value.adaptive_input.resolve(true) {
                ui.style_mut().interaction.interact_radius = 0.;
            }
            body(ui)
        })
        .inner;
    ui.ctx()
        .data_mut(|d| d.insert_temp(egui::Id::new("mycut-component-policy"), old));
    result
}
pub fn animation_strength(ui: &Ui, local: Feature) -> f32 {
    let strength = ui
        .ctx()
        .data(|d| d.get_temp::<f32>(egui::Id::new("mycut-animation")))
        .unwrap_or(1.);
    if local.resolve(policy(ui).animation.resolve(strength > 0.)) {
        strength
    } else {
        0.
    }
}

pub fn animation_duration(ui: &Ui, default: f32) -> f32 {
    ui.ctx()
        .data(|d| d.get_temp::<f32>(egui::Id::new("mycut-animation-duration")))
        .filter(|v| v.is_finite())
        .map_or(default, |v| v.clamp(0.03, 1.2))
}

pub struct TextBlock {
    text: WidgetText,
}
impl TextBlock {
    pub fn new(text: impl Into<WidgetText>) -> Self {
        Self { text: text.into() }
    }
}
impl Widget for TextBlock {
    fn ui(self, ui: &mut Ui) -> Response {
        egui::Label::new(self.text).ui(ui)
    }
}

/// Native TextEdit already composes its text layout, frame, selection and accessibility.
/// Keeping construction here gives every input one shared customization point.
pub struct InputField<'a> {
    native: egui::TextEdit<'a>,
}
impl<'a> InputField<'a> {
    pub fn singleline(text: &'a mut dyn egui::TextBuffer) -> Self {
        Self {
            native: egui::TextEdit::singleline(text),
        }
    }
    pub fn multiline(text: &'a mut dyn egui::TextBuffer) -> Self {
        Self {
            native: egui::TextEdit::multiline(text),
        }
    }
    pub fn hint_text(mut self, text: impl egui::IntoAtoms<'static>) -> Self {
        self.native = self.native.hint_text(text);
        self
    }
    pub fn desired_width(mut self, width: f32) -> Self {
        self.native = self.native.desired_width(width);
        self
    }
    pub fn id(mut self, id: egui::Id) -> Self {
        self.native = self.native.id(id);
        self
    }
    pub fn font(mut self, font: impl Into<egui::FontSelection>) -> Self {
        self.native = self.native.font(font);
        self
    }
    pub fn text_color(mut self, color: egui::Color32) -> Self {
        self.native = self.native.text_color(color);
        self
    }
    pub fn frame(mut self, frame: egui::Frame) -> Self {
        self.native = self.native.frame(frame);
        self
    }
    pub fn margin(mut self, margin: impl Into<egui::Margin>) -> Self {
        self.native = self.native.margin(margin);
        self
    }
    pub fn clip_text(mut self, clip: bool) -> Self {
        self.native = self.native.clip_text(clip);
        self
    }
}
impl Widget for InputField<'_> {
    fn ui(self, ui: &mut Ui) -> Response {
        self.native.ui(ui)
    }
}
pub struct NumberField<'a> {
    native: egui::DragValue<'a>,
    starship: bool,
}
impl<'a> NumberField<'a> {
    pub fn new<Num: egui::emath::Numeric>(value: &'a mut Num) -> Self {
        Self {
            native: egui::DragValue::new(value),
            starship: false,
        }
    }
    pub fn speed(mut self, speed: impl Into<f64>) -> Self {
        self.native = self.native.speed(speed);
        self
    }
    pub fn starship(mut self) -> Self {
        self.starship = true;
        self
    }
    pub fn range<Num: egui::emath::Numeric>(
        mut self,
        range: std::ops::RangeInclusive<Num>,
    ) -> Self {
        self.native = self.native.range(range);
        self
    }
    pub fn prefix(mut self, text: impl egui::IntoAtoms<'a>) -> Self {
        self.native = self.native.prefix(text);
        self
    }
    pub fn suffix(mut self, text: impl egui::IntoAtoms<'a>) -> Self {
        self.native = self.native.suffix(text);
        self
    }
    pub fn max_decimals(mut self, n: usize) -> Self {
        self.native = self.native.max_decimals(n);
        self
    }
    pub fn fixed_decimals(mut self, n: usize) -> Self {
        self.native = self.native.fixed_decimals(n);
        self
    }
    pub fn clamp_existing_to_range(mut self, b: bool) -> Self {
        self.native = self.native.clamp_existing_to_range(b);
        self
    }
}
impl Widget for NumberField<'_> {
    fn ui(self, ui: &mut Ui) -> Response {
        if !self.starship {
            return self.native.ui(ui);
        }
        ui.scope(|ui| {
            unreal_theme::apply_numeric(ui);
            self.native.ui(ui)
        })
        .inner
    }
}
pub struct ParameterSlider<'a> {
    native: egui::Slider<'a>,
}
impl<'a> ParameterSlider<'a> {
    pub fn new<Num: egui::emath::Numeric>(
        value: &'a mut Num,
        range: std::ops::RangeInclusive<Num>,
    ) -> Self {
        Self {
            native: egui::Slider::new(value, range),
        }
    }
    pub fn show_value(mut self, b: bool) -> Self {
        self.native = self.native.show_value(b);
        self
    }
    pub fn clamping(mut self, c: egui::SliderClamping) -> Self {
        self.native = self.native.clamping(c);
        self
    }
}
impl Widget for ParameterSlider<'_> {
    fn ui(self, ui: &mut Ui) -> Response {
        self.native.ui(ui)
    }
}

pub struct Button<'a> {
    native: egui::Button<'a>,
    animation: Feature,
}
impl<'a> Button<'a> {
    pub fn new(text: impl egui::IntoAtoms<'a>) -> Self {
        Self {
            native: egui::Button::new(text),
            animation: Feature::Inherit,
        }
    }
    pub fn selected(mut self, selected: bool) -> Self {
        self.native = self.native.selected(selected);
        self
    }
    pub fn min_size(mut self, size: egui::Vec2) -> Self {
        self.native = self.native.min_size(size);
        self
    }
    pub fn animation(mut self, animation: Feature) -> Self {
        self.animation = animation;
        self
    }
}
impl Widget for Button<'_> {
    fn ui(self, ui: &mut Ui) -> Response {
        let strength = animation_strength(ui, self.animation);
        let response = self.native.ui(ui);
        // Off does not schedule frames or advance a hidden animation.
        if strength > 0. && response.enabled() {
            let amount = ui.ctx().animate_bool_with_time(
                response.id.with("base-button-hover"),
                response.hovered(),
                animation_duration(ui, 0.12),
            );
            if amount > 0. {
                ui.painter().rect_stroke(
                    response.rect.shrink(0.5),
                    2.,
                    egui::Stroke::new(
                        1.,
                        ui.visuals()
                            .selection
                            .stroke
                            .color
                            .gamma_multiply(amount * strength.min(1.)),
                    ),
                    egui::StrokeKind::Inside,
                );
            }
        }
        response
    }
}

pub struct Spacer;
impl Spacer {
    pub fn fixed(ui: &mut Ui, width: f32) {
        ui.add_space(width.max(0.));
    }
}

/// Shared dialog defaults. Docked workspace panels use PanelDefinition instead.
pub struct Window<'a> {
    native: egui::Window<'a>,
}
impl<'a> Window<'a> {
    pub fn new(title: impl Into<WidgetText>) -> Self {
        Self {
            native: egui::Window::new(title).resizable(true).collapsible(false),
        }
    }
    pub fn open(mut self, open: &'a mut bool) -> Self {
        self.native = self.native.open(open);
        self
    }
    pub fn resizable(mut self, b: bool) -> Self {
        self.native = self.native.resizable(b);
        self
    }
    pub fn movable(mut self, b: bool) -> Self {
        self.native = self.native.movable(b);
        self
    }
    pub fn collapsible(mut self, b: bool) -> Self {
        self.native = self.native.collapsible(b);
        self
    }
    pub fn default_size(mut self, size: impl Into<egui::Vec2>) -> Self {
        self.native = self.native.default_size(size);
        self
    }
    pub fn min_size(mut self, size: impl Into<egui::Vec2>) -> Self {
        self.native = self.native.min_size(size);
        self
    }
    pub fn id(mut self, id: egui::Id) -> Self {
        self.native = self.native.id(id);
        self
    }
    pub fn default_pos(mut self, pos: impl Into<egui::Pos2>) -> Self {
        self.native = self.native.default_pos(pos);
        self
    }
    pub fn show<R>(
        self,
        ctx: &egui::Context,
        body: impl FnOnce(&mut Ui) -> R,
    ) -> Option<InnerResponse<Option<R>>> {
        self.native.show(ctx, body)
    }
}

pub trait UiComponents {
    fn text(&mut self, text: impl Into<WidgetText>) -> Response;
    fn action<'a>(&mut self, text: impl egui::IntoAtoms<'a>) -> Response;
    fn hbox<R>(&mut self, body: impl FnOnce(&mut Ui) -> R) -> InnerResponse<R>;
    fn flow_box<R>(&mut self, body: impl FnOnce(&mut Ui) -> R) -> InnerResponse<R>;
    fn small_text(&mut self, text: impl Into<egui::RichText>) -> Response;
    fn emphasis(&mut self, text: impl Into<egui::RichText>) -> Response;
    fn colored_text(&mut self, color: egui::Color32, text: impl Into<egui::RichText>) -> Response;
    fn input(&mut self, text: &mut dyn egui::TextBuffer) -> Response;
}
impl UiComponents for Ui {
    fn text(&mut self, text: impl Into<WidgetText>) -> Response {
        self.add(TextBlock::new(text))
    }
    fn action<'a>(&mut self, text: impl egui::IntoAtoms<'a>) -> Response {
        self.add(Button::new(text))
    }
    fn hbox<R>(&mut self, body: impl FnOnce(&mut Ui) -> R) -> InnerResponse<R> {
        FlowBox::default().show(self, body)
    }
    fn flow_box<R>(&mut self, body: impl FnOnce(&mut Ui) -> R) -> InnerResponse<R> {
        FlowBox { wrap: true }.show(self, body)
    }
    fn small_text(&mut self, text: impl Into<egui::RichText>) -> Response {
        self.text(text.into().small())
    }
    fn emphasis(&mut self, text: impl Into<egui::RichText>) -> Response {
        self.text(text.into().strong())
    }
    fn colored_text(&mut self, color: egui::Color32, text: impl Into<egui::RichText>) -> Response {
        self.text(text.into().color(color))
    }
    fn input(&mut self, text: &mut dyn egui::TextBuffer) -> Response {
        self.add(InputField::singleline(text))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn feature_override_and_inheritance() {
        assert!(!Feature::Inherit.resolve(false));
        assert!(Feature::On.resolve(false));
        assert!(!Feature::Off.resolve(true));
    }
    #[test]
    fn panel_policy_is_scoped_and_button_can_override_it() {
        let ctx = egui::Context::default();
        let out = ctx.run_ui(egui::RawInput::default(), |ui| {
            with_policy(
                ui,
                ComponentPolicy {
                    animation: Feature::Off,
                    adaptive_input: Feature::Off,
                },
                |ui| {
                    assert_eq!(animation_strength(ui, Feature::Inherit), 0.);
                    assert!(animation_strength(ui, Feature::On) > 0.);
                    assert_eq!(ui.style().interaction.interact_radius, 0.);
                    assert_eq!(ui.style().animation_time, 0.);
                    with_policy(ui, ComponentPolicy::default(), |ui| {
                        assert_eq!(animation_strength(ui, Feature::Inherit), 0.)
                    });
                },
            );
            assert!(animation_strength(ui, Feature::Inherit) > 0.);
        });
        out.drop_without_applying_deltas();
    }
}
