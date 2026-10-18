//! A separate development scene. Uses production components, never a photo Document.
use crate::{
    icons::{Icon, IconButton},
    interaction, theme,
    ui_core::{
        self, BoxItem, Button, ComponentPolicy, Feature, HorizontalBox, InputField, NumberField,
        ParameterSlider, TextBlock, UiComponents, Window,
    },
};
use craft_ui::{
    docking::{Action, DockArea, DockStyle, Layout, Node, PanelLimits, Permissions},
    layout::{SplitAxis, SplitSize},
};
use eframe::egui::{self, Color32, Id, Pos2, Rect, Response, Stroke, Vec2};
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    path::{Path, PathBuf},
};
mod concept;
mod unreal_study;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
enum Pane {
    Samples,
    Controls,
    Events,
}
impl Pane {
    fn title(self) -> &'static str {
        match self {
            Self::Samples => "UI Lab · Components",
            Self::Controls => "UI Lab · Properties",
            Self::Events => "UI Lab · Events & diagnostics",
        }
    }
}
fn tabs(p: Pane) -> Node<Pane> {
    Node::Tabs {
        panels: vec![p],
        active: 0,
    }
}
fn layout() -> Layout<Pane> {
    Layout {
        root: Some(Node::Split {
            axis: SplitAxis::Horizontal,
            size: SplitSize::FixedSecond(370.),
            first: Box::new(Node::Split {
                axis: SplitAxis::Vertical,
                size: SplitSize::FixedSecond(150.),
                first: Box::new(tabs(Pane::Samples)),
                second: Box::new(tabs(Pane::Events)),
            }),
            second: Box::new(tabs(Pane::Controls)),
        }),
        floating: vec![],
    }
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct LabConfig {
    pub ui_scale: f32,
    pub font_size: f32,
    pub row_height: f32,
    pub spacing: [f32; 2],
    pub padding: f32,
    pub rounding: f32,
    pub button_size: [f32; 2],
    pub input_width: f32,
    pub preview_width: f32,
    pub spacer: f32,
    pub wrap: bool,
    pub box_width: f32,
    pub box_height: f32,
    pub box_basis: f32,
    pub box_minimum: f32,
    pub box_gap: f32,
    pub box_gap_minimum: f32,
    pub box_index: usize,
    pub box_desired: f32,
    pub box_manual: bool,
    pub box_hover: bool,
    pub box_hover_growth: f32,
    pub animation: f32,
    pub duration: f32,
    pub policy: Feature,
    pub button_policy: Feature,
    pub adaptive: bool,
    pub radius: f32,
    pub expansion: f32,
    pub speed: f32,
    pub shrink: f32,
    pub text: String,
    pub text_color: [u8; 4],
    pub background: [u8; 4],
    pub accent: [u8; 4],
    pub enabled: bool,
    pub selected: bool,
    pub bounds: bool,
    pub zones: bool,
    pub ids: bool,
    pub grid: bool,
    pub grid_step: f32,
    pub pointer: bool,
    pub continuous: bool,
    pub movable: bool,
    pub resizable: bool,
    pub collapsible: bool,
    pub window_size: [f32; 2],
    pub docking_locked: bool,
}
impl Default for LabConfig {
    fn default() -> Self {
        Self {
            ui_scale: 1.,
            font_size: 15.,
            row_height: 27.,
            spacing: [7., 5.],
            padding: 10.,
            rounding: 3.,
            button_size: [120., 32.],
            input_width: 220.,
            preview_width: 720.,
            spacer: 16.,
            wrap: true,
            box_width: 600.,
            box_height: 52.,
            box_basis: 96.,
            box_minimum: 44.,
            box_gap: 8.,
            box_gap_minimum: 4.,
            box_index: 2,
            box_desired: 96.,
            box_manual: false,
            box_hover: true,
            box_hover_growth: 60.,
            animation: 1.,
            duration: 0.14,
            policy: Feature::Inherit,
            button_policy: Feature::Inherit,
            adaptive: true,
            radius: 7.,
            expansion: 24.,
            speed: 0.04,
            shrink: 88.,
            text: "MyCut · Текстовый блок\nРедактируем UI из общих компонентов".into(),
            text_color: [220, 224, 230, 255],
            background: [31, 32, 35, 255],
            accent: [65, 206, 214, 255],
            enabled: true,
            selected: false,
            bounds: false,
            zones: false,
            ids: false,
            grid: false,
            grid_step: 16.,
            pointer: false,
            continuous: false,
            movable: true,
            resizable: true,
            collapsible: true,
            window_size: [300., 150.],
            docking_locked: false,
        }
    }
}
impl LabConfig {
    pub fn sanitize(&mut self) {
        let d = Self::default();
        fn c(v: &mut f32, default: f32, min: f32, max: f32) {
            *v = if v.is_finite() {
                v.clamp(min, max)
            } else {
                default
            };
        }
        c(&mut self.ui_scale, d.ui_scale, 0.65, 2.);
        c(&mut self.font_size, d.font_size, 10., 32.);
        c(&mut self.row_height, d.row_height, 20., 64.);
        for i in 0..2 {
            c(&mut self.spacing[i], d.spacing[i], 0., 24.);
            c(
                &mut self.button_size[i],
                d.button_size[i],
                if i == 0 { 48. } else { 24. },
                if i == 0 { 300. } else { 80. },
            );
            c(&mut self.window_size[i], d.window_size[i], 140., 800.);
        }
        c(&mut self.padding, d.padding, 0., 28.);
        c(&mut self.rounding, d.rounding, 0., 24.);
        c(&mut self.input_width, d.input_width, 100., 500.);
        c(&mut self.preview_width, d.preview_width, 280., 1400.);
        c(&mut self.spacer, d.spacer, 0., 120.);
        c(&mut self.box_width, d.box_width, 280., 1200.);
        c(&mut self.box_height, d.box_height, 28., 100.);
        c(&mut self.box_basis, d.box_basis, 48., 160.);
        c(&mut self.box_minimum, d.box_minimum, 24., 80.);
        self.box_minimum = self.box_minimum.min(self.box_basis);
        c(&mut self.box_gap, d.box_gap, 0., 24.);
        c(&mut self.box_gap_minimum, d.box_gap_minimum, 0., 24.);
        self.box_gap_minimum = self.box_gap_minimum.min(self.box_gap);
        c(&mut self.box_desired, d.box_desired, 24., 800.);
        c(&mut self.box_hover_growth, d.box_hover_growth, 0., 200.);
        self.box_index = self.box_index.min(4);
        c(&mut self.animation, d.animation, 0., 2.);
        c(&mut self.duration, d.duration, 0.03, 1.2);
        c(&mut self.radius, d.radius, 0., 32.);
        c(&mut self.expansion, d.expansion, 0., 64.);
        c(&mut self.speed, d.speed, 0., 0.2);
        c(&mut self.shrink, d.shrink, 5., 400.);
        c(&mut self.grid_step, d.grid_step, 8., 64.);
        if self.text.len() > 8192 {
            let mut end = 8192;
            while !self.text.is_char_boundary(end) {
                end -= 1;
            }
            self.text.truncate(end);
        }
    }
}
#[derive(Serialize, Deserialize)]
struct Preset {
    version: u32,
    config: LabConfig,
    layout: Layout<Pane>,
}
#[derive(Clone)]
struct Sample {
    key: &'static str,
    rect: Rect,
    id: Id,
    hovered: bool,
    focused: bool,
    enabled: bool,
    interactive: bool,
    clip: Rect,
}

/// Demo data adapter only; all tree rendering and input belong to UI Core.
pub(super) struct SampleOutliner {
    view: ui_core::outliner::Outliner,
    selected: Option<u64>,
    visible: [bool; 3],
}
impl Default for SampleOutliner {
    fn default() -> Self {
        Self {
            view: Default::default(),
            selected: Some(1),
            visible: [true; 3],
        }
    }
}
impl SampleOutliner {
    fn show(&mut self, ui: &mut egui::Ui, max_height: f32) {
        use ui_core::outliner::{Action, OutlinerOptions, OutlinerRow};
        let rows: Vec<_> = [
            ("Title", "Text", Icon::Text),
            ("Image", "Raster", Icon::Image),
            ("Mask · demonstration", "Mask", Icon::Cube),
        ]
        .iter()
        .enumerate()
        .map(|(i, (label, kind, icon))| OutlinerRow {
            id: i as u64,
            label,
            kind,
            icon: *icon,
            visible: self.visible[i],
        })
        .collect();
        for action in self.view.show(
            ui,
            &rows,
            self.selected,
            OutlinerOptions {
                roots: &[("Scene · sample", "Scene")],
                max_height,
                ..Default::default()
            },
        ) {
            match action {
                Action::Select(id) => self.selected = Some(id),
                Action::ToggleVisibility(id) => {
                    self.visible[id as usize] = !self.visible[id as usize]
                }
            }
        }
    }
}
pub struct UiLab {
    sample_outliner: SampleOutliner,
    pub(crate) concept_view: bool,
    pub(crate) unreal_view: bool,
    unreal: unreal_study::UnrealStudy,
    concept: concept::Concept,
    pub config: LabConfig,
    layout: Layout<Pane>,
    samples: Vec<Sample>,
    selected: &'static str,
    logs: VecDeque<String>,
    serial: u64,
    clicks: u64,
    input: String,
    multiline: String,
    value: f32,
    position: [f32; 2],
    toggle: bool,
    choice: usize,
    color: [u8; 4],
    sample_window: bool,
    window_epoch: u64,
    motion: interaction::Motion,
    zone_extra: f32,
    trace: VecDeque<Pos2>,
    filter: String,
    pause_log: bool,
    pub(crate) message: String,
    elapsed: f32,
    last_pointer: Option<Pos2>,
    current_clip: Rect,
    window_rect: Option<Rect>,
    editor_button: Option<Rect>,
    box_slots: Vec<Rect>,
    box_rect: Option<Rect>,
    box_hover: Option<usize>,
    box_widths: Vec<f32>,
}
impl Default for UiLab {
    fn default() -> Self {
        Self {
            concept_view: false,
            sample_outliner: Default::default(),
            unreal_view: false,
            unreal: unreal_study::UnrealStudy::default(),
            concept: concept::Concept::default(),
            config: LabConfig::default(),
            layout: layout(),
            samples: vec![],
            selected: "TextBlock",
            logs: VecDeque::new(),
            serial: 0,
            clicks: 0,
            input: "Редактируемое поле".into(),
            multiline: "Выдели часть текста мышью.\nЗамени её или вставь свой текст.".into(),
            value: 0.5,
            position: [64., 32.],
            toggle: true,
            choice: 0,
            color: [65, 206, 214, 255],
            sample_window: true,
            window_epoch: 0,
            motion: interaction::Motion::default(),
            zone_extra: 0.,
            trace: VecDeque::new(),
            filter: String::new(),
            pause_log: false,
            message: "Sandbox: changes here never edit a photo project.".into(),
            elapsed: 0.,
            last_pointer: None,
            current_clip: Rect::EVERYTHING,
            window_rect: None,
            editor_button: None,
            box_slots: vec![],
            box_rect: None,
            box_hover: None,
            box_widths: vec![],
        }
    }
}
fn rgba(c: [u8; 4]) -> Color32 {
    Color32::from_rgba_unmultiplied(c[0], c[1], c[2], c[3])
}
fn preview_style(ui: &mut egui::Ui, c: &LabConfig) {
    let style = ui.style_mut();
    style.spacing.item_spacing = Vec2::from(c.spacing);
    style.spacing.interact_size.y = c.row_height;
    for text_style in [egui::TextStyle::Body, egui::TextStyle::Button] {
        style
            .text_styles
            .insert(text_style, egui::FontId::proportional(c.font_size));
    }
    style.visuals.override_text_color = Some(rgba(c.text_color));
    style.visuals.selection.bg_fill = rgba(c.accent).gamma_multiply(0.3);
    style.visuals.selection.stroke = Stroke::new(1., rgba(c.accent));
    for w in [
        &mut style.visuals.widgets.inactive,
        &mut style.visuals.widgets.hovered,
        &mut style.visuals.widgets.active,
        &mut style.visuals.widgets.open,
    ] {
        w.corner_radius = egui::CornerRadius::same(c.rounding as u8);
    }
}
fn number(ui: &mut egui::Ui, label: &str, value: &mut f32, range: std::ops::RangeInclusive<f32>) {
    let speed = ((*range.end() - *range.start()) / 500.).max(0.001);
    ui.hbox(|ui| {
        ui.add_sized([145., 24.], TextBlock::new(label));
        ui.add(
            NumberField::new(value)
                .range(range)
                .speed(speed)
                .max_decimals(3),
        );
    });
}
fn feature(ui: &mut egui::Ui, label: &str, value: &mut Feature) {
    ui.hbox(|ui| {
        ui.text(label);
        egui::ComboBox::from_id_salt(label)
            .selected_text(format!("{value:?}"))
            .show_ui(ui, |ui| {
                ui.selectable_value(value, Feature::Inherit, "Inherit");
                ui.selectable_value(value, Feature::On, "On");
                ui.selectable_value(value, Feature::Off, "Off");
            });
    });
}
impl UiLab {
    fn log(&mut self, text: impl Into<String>) {
        if !self.pause_log {
            self.serial += 1;
            self.logs
                .push_front(format!("{:04}  {}", self.serial, text.into()));
            self.logs.truncate(128);
        }
    }
    fn record(&mut self, key: &'static str, response: Response) {
        if response.clicked() {
            self.selected = key;
            self.log(format!("{key}: click"));
        }
        if response.changed() {
            self.log(format!("{key}: value changed"));
        }
        if response.gained_focus() {
            self.log(format!("{key}: focus"));
        }
        self.samples.push(Sample {
            key,
            rect: response.rect,
            id: response.id,
            hovered: response.hovered(),
            focused: response.has_focus(),
            enabled: response.enabled(),
            interactive: response.sense.interactive(),
            clip: self.current_clip,
        });
    }
    pub fn path() -> Option<PathBuf> {
        std::env::var_os("LOCALAPPDATA").map(|p| PathBuf::from(p).join("MyCutNext/ui-lab.json"))
    }
    fn validate_layout(value: &Layout<Pane>) -> Result<(), String> {
        value.validate().map_err(|e| e.to_string())?;
        let panels = value.panels();
        if !value.floating.is_empty()
            || panels.len() != 3
            || [Pane::Samples, Pane::Controls, Pane::Events]
                .iter()
                .any(|p| !value.contains(p))
        {
            return Err("UI Lab requires its three docked panels".into());
        }
        Ok(())
    }
    pub fn load(&mut self, path: &Path) -> Result<(), String> {
        if std::fs::metadata(path).map_err(|e| e.to_string())?.len() > 65536 {
            return Err("UI Lab preset exceeds 64 KiB".into());
        }
        let preset: Preset =
            serde_json::from_slice(&std::fs::read(path).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
        if preset.version != 1 {
            return Err("Unsupported UI Lab preset version".into());
        }
        Self::validate_layout(&preset.layout)?;
        let mut config = preset.config;
        config.sanitize();
        self.config = config;
        self.layout = preset.layout;
        Ok(())
    }
    pub fn save(&self, path: &Path) -> Result<(), String> {
        Self::validate_layout(&self.layout)?;
        let mut config = self.config.clone();
        config.sanitize();
        let bytes = serde_json::to_vec_pretty(&Preset {
            version: 1,
            config,
            layout: self.layout.clone(),
        })
        .map_err(|e| e.to_string())?;
        let parent = path.parent().ok_or("Missing preset directory")?;
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        use std::io::Write;
        let mut tmp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
        tmp.write_all(&bytes).map_err(|e| e.to_string())?;
        tmp.as_file().sync_all().map_err(|e| e.to_string())?;
        tmp.persist(path).map_err(|e| e.to_string())?;
        Ok(())
    }
    fn controls(&mut self, ui: &mut egui::Ui) {
        ui.text("Live controls · affect the sample area, not your editor preferences.");
        ui.add(
            InputField::singleline(&mut self.filter)
                .hint_text("Filter parameter groups…")
                .desired_width(f32::INFINITY),
        );
        let query = self.filter.to_lowercase();
        let visible = |s: &str| query.is_empty() || s.to_lowercase().contains(&query);
        if visible(
            "layout typography text font size spacing padding rounding scale color background accent wrap spacer preview width",
        ) {
            egui::CollapsingHeader::new("Layout & typography")
                .default_open(true)
                .show(ui, |ui| {
                    number(ui, "UI scale / ×", &mut self.config.ui_scale, 0.65..=2.);
                    number(
                        ui,
                        "Preview font / DIP",
                        &mut self.config.font_size,
                        10.0..=32.0,
                    );
                    number(ui, "Row height", &mut self.config.row_height, 20.0..=64.0);
                    number(
                        ui,
                        "Horizontal spacing",
                        &mut self.config.spacing[0],
                        0.0..=24.0,
                    );
                    number(
                        ui,
                        "Vertical spacing",
                        &mut self.config.spacing[1],
                        0.0..=24.0,
                    );
                    number(ui, "Panel padding", &mut self.config.padding, 0.0..=28.0);
                    number(ui, "Corner radius", &mut self.config.rounding, 0.0..=24.0);
                    number(
                        ui,
                        "Preview width",
                        &mut self.config.preview_width,
                        280.0..=1400.0,
                    );
                    number(ui, "Spacer width", &mut self.config.spacer, 0.0..=120.0);
                    ui.checkbox(&mut self.config.wrap, "FlowBox: wrap intrinsic rows");
                    ui.text("Sample text");
                    ui.add(
                        InputField::multiline(&mut self.config.text).desired_width(f32::INFINITY),
                    );
                    ui.hbox(|ui| {
                        ui.text("Text");
                        ui.color_edit_button_srgba_unmultiplied(&mut self.config.text_color);
                        ui.text("Background");
                        ui.color_edit_button_srgba_unmultiplied(&mut self.config.background);
                        ui.text("Accent");
                        ui.color_edit_button_srgba_unmultiplied(&mut self.config.accent);
                    });
                });
        }
        if visible(
            "horizontalbox fixed symmetric reflow width height basis minimum gap focus desired hover growth",
        ) {
            egui::CollapsingHeader::new("HorizontalBox · fixed & symmetric").default_open(true).show(ui,|ui|{
                number(ui,"Box width",&mut self.config.box_width,280.0..=1200.0);number(ui,"Box height",&mut self.config.box_height,28.0..=100.0);
                number(ui,"Neutral child width",&mut self.config.box_basis,48.0..=160.0);number(ui,"Minimum child width",&mut self.config.box_minimum,24.0..=80.0);number(ui,"Spacer preferred",&mut self.config.box_gap,0.0..=24.0);number(ui,"Spacer minimum",&mut self.config.box_gap_minimum,0.0..=24.0);
                ui.hbox(|ui|{ui.text("Focus item / 0–4");ui.add(NumberField::new(&mut self.config.box_index).range(0..=4));});
                ui.checkbox(&mut self.config.box_manual,"Manual resize (opt-in)");number(ui,"Requested width",&mut self.config.box_desired,24.0..=800.0);ui.checkbox(&mut self.config.box_hover,"Grow hovered child");number(ui,"Hover growth",&mut self.config.box_hover_growth,0.0..=200.0);
                ui.small_text("The box stays fixed. Growth first shifts both sides, then shrinks neighbours to their minimum. Beyond capacity the growing child is capped.");
                ui.small_text(format!("Actual widths: {:?}",self.box_widths.iter().map(|w|w.round() as u32).collect::<Vec<_>>()));
            });
        }
        if visible("button input animation enabled selected width height duration strength policy")
        {
            egui::CollapsingHeader::new("Buttons & input")
                .default_open(true)
                .show(ui, |ui| {
                    number(
                        ui,
                        "Button width",
                        &mut self.config.button_size[0],
                        48.0..=300.0,
                    );
                    number(
                        ui,
                        "Button height",
                        &mut self.config.button_size[1],
                        24.0..=80.0,
                    );
                    number(
                        ui,
                        "Input width",
                        &mut self.config.input_width,
                        100.0..=500.0,
                    );
                    ui.checkbox(&mut self.config.enabled, "Samples enabled");
                    ui.checkbox(&mut self.config.selected, "Button selected");
                    number(
                        ui,
                        "Animation strength",
                        &mut self.config.animation,
                        0.0..=2.0,
                    );
                    number(
                        ui,
                        "Animation duration / s",
                        &mut self.config.duration,
                        0.03..=1.2,
                    );
                    feature(ui, "Panel animation", &mut self.config.policy);
                    feature(ui, "Button animation", &mut self.config.button_policy);
                });
        }
        if visible(
            "interaction adaptive hit zone radius speed expansion shrink pointer coefficient",
        ) {
            egui::CollapsingHeader::new("Interaction zones").default_open(false).show(ui,|ui|{
                ui.checkbox(&mut self.config.adaptive,"Adaptive input");number(ui,"Base radius / DIP",&mut self.config.radius,0.0..=32.0);number(ui,"Maximum expansion",&mut self.config.expansion,0.0..=64.0);
                number(ui,"Speed coefficient",&mut self.config.speed,0.0..=0.2);number(ui,"Shrink / DIP/s",&mut self.config.shrink,5.0..=400.0);
                ui.small_text("Uses the editor's expansion function. Rectangles show candidate input margins; egui resolves overlaps.");
            });
        }
        if visible(
            "window docking movable resizable collapsible initial width height lock show capabilities",
        ) {
            egui::CollapsingHeader::new("Window capabilities")
                .default_open(false)
                .show(ui, |ui| {
                    ui.checkbox(&mut self.sample_window, "Show sample window");
                    ui.checkbox(&mut self.config.movable, "Movable");
                    ui.checkbox(&mut self.config.resizable, "Resizable");
                    ui.checkbox(&mut self.config.collapsible, "Collapsible");
                    ui.checkbox(&mut self.config.docking_locked, "Lock Lab docking");
                    number(
                        ui,
                        "Initial window width",
                        &mut self.config.window_size[0],
                        140.0..=800.0,
                    );
                    number(
                        ui,
                        "Initial window height",
                        &mut self.config.window_size[1],
                        140.0..=800.0,
                    );
                    if ui.action("Recreate sample window").clicked() {
                        self.window_epoch += 1;
                        self.sample_window = true;
                    }
                });
        }
        if visible("debug bounds ids grid pointer trail refresh repaint continuous") {
            egui::CollapsingHeader::new("Debug overlays")
                .default_open(false)
                .show(ui, |ui| {
                    ui.checkbox(&mut self.config.bounds, "Widget bounds");
                    ui.checkbox(&mut self.config.zones, "Candidate hit zones");
                    ui.checkbox(&mut self.config.ids, "Selected / hovered widget IDs");
                    ui.checkbox(&mut self.config.grid, "Layout grid");
                    number(ui, "Grid step", &mut self.config.grid_step, 8.0..=64.0);
                    ui.checkbox(&mut self.config.pointer, "Pointer trail & direction");
                    ui.checkbox(
                        &mut self.config.continuous,
                        "Continuous repaint (debug only)",
                    );
                });
        }
        ui.separator();
        ui.emphasis("Selected component");
        egui::ComboBox::from_id_salt("lab-component")
            .selected_text(self.selected)
            .show_ui(ui, |ui| {
                for sample in &self.samples {
                    ui.selectable_value(&mut self.selected, sample.key, sample.key);
                }
            });
        if let Some(s) = self.samples.iter().find(|s| s.key == self.selected) {
            ui.small_text(format!(
                "ID {:?}\n{:.1} × {:.1} DIP\nHover: {}  Focus: {}  Enabled: {}",
                s.id,
                s.rect.width(),
                s.rect.height(),
                s.hovered,
                s.focused,
                s.enabled
            ));
        }
        ui.separator();
        ui.flow_box(|ui| {
            if ui.action("Save preset").clicked() {
                self.message = Self::path().map_or("No settings path".into(), |p| {
                    self.save(&p)
                        .map_or_else(|e| e, |_| "UI Lab preset saved".into())
                });
            }
            if ui.action("Load preset").clicked() {
                self.message = Self::path().map_or("No settings path".into(), |p| {
                    self.load(&p)
                        .map_or_else(|e| e, |_| "UI Lab preset loaded".into())
                });
            }
            if ui.action("Reset properties").clicked() {
                self.config = LabConfig::default();
                self.log("Properties reset");
            }
            if ui.action("Reset Lab layout").clicked() {
                self.layout = layout();
                self.log("Lab layout reset");
            }
        });
        ui.small_text(&self.message);
    }
    fn samples(&mut self, ui: &mut egui::Ui) {
        self.current_clip = ui.clip_rect();
        let c = self.config.clone();
        preview_style(ui, &c);
        let max_width = (ui.available_width() - c.padding * 2.)
            .min(c.preview_width)
            .max(1.);
        egui::Frame::new().fill(rgba(c.background)).inner_margin(egui::Margin::same(c.padding as i8)).show(ui,|ui|{
            ui.set_width(max_width);
            if c.grid {
                let rect=ui.max_rect();let p=ui.painter_at(rect);let step=c.grid_step;
                for x in 0..((rect.width()/step).ceil() as usize).min(256){let x=rect.left()+x as f32*step;p.line_segment([Pos2::new(x,rect.top()),Pos2::new(x,rect.bottom())],Stroke::new(0.5,Color32::from_gray(55)));}
                for y in 0..((rect.height()/step).ceil() as usize).min(256){let y=rect.top()+y as f32*step;p.line_segment([Pos2::new(rect.left(),y),Pos2::new(rect.right(),y)],Stroke::new(0.5,Color32::from_gray(55)));}
            }
            ui_core::with_policy(ui,ComponentPolicy{animation:c.policy,adaptive_input:if c.adaptive{Feature::On}else{Feature::Off}},|ui|{
                ui.add_enabled_ui(c.enabled,|ui|{
                    ui.emphasis("01 · Text & composition");
                    let r=ui.add(TextBlock::new(c.text.clone()));self.record("TextBlock",r);
                    ui.hbox(|ui|{let r=ui.add(TextBlock::new("Text + input"));self.record("Text + field label",r);let r=ui.add(InputField::singleline(&mut self.input).desired_width(c.input_width));self.record("InputField",r);});
                    ui.separator();ui.emphasis("02 · Buttons & icons");
                    let row_items=[BoxItem::new(c.button_size[0],48.),BoxItem::new(c.button_size[1],24.),BoxItem::new(135.,60.),BoxItem::new(95.,44.)];
                    HorizontalBox::new([c.box_width,c.button_size[1]]).gap(c.box_gap+c.spacer).minimum_gap(c.box_gap_minimum).duration(c.duration).show(ui,&row_items,None,|ui,i|{
                        let size=ui.available_size();
                        match i {
                            0=>{let r=ui.add_sized(size,Button::new(format!("Button · {}",self.clicks)).min_size(size).selected(c.selected).animation(c.button_policy));if r.clicked(){self.clicks+=1;}self.record("Button",r);}
                            1=>{let r=IconButton::new(Icon::Settings,"IconButton: settings").size(size.x.min(size.y)).animation(c.button_policy).show(ui);self.record("IconButton",r);}
                            2=>{let r=ui.add_sized(size,Button::new("Animation OFF").animation(Feature::Off));self.record("Button / animation off",r);}
                            _=>{ui.add_enabled_ui(false,|ui|{let r=ui.add_sized(size,Button::new("Disabled"));self.record("Button / disabled",r);});}
                        }
                    });
                    ui.emphasis("02b · HorizontalBox · fixed size / symmetric reflow");
                    self.fixed_box(ui,&c);
                    ui.separator();ui.emphasis("03 · Input & parameters");
                    let r=ui.add(InputField::multiline(&mut self.multiline).desired_width(c.input_width));self.record("InputField / multiline",r);
                    ui.hbox(|ui|{ui.text("Value");let r=ui.add(NumberField::new(&mut self.value).range(0.0..=1.0).speed(0.01));self.record("NumberField",r);let r=ui.add(ParameterSlider::new(&mut self.value,0.0..=1.0).show_value(false));self.record("ParameterSlider",r);});
                    ui.hbox(|ui|{let r=ui.checkbox(&mut self.toggle,"Checkbox");self.record("Checkbox",r);egui::ComboBox::from_id_salt("lab-choice").selected_text(["First option","Second option","Third option"][self.choice]).show_ui(ui,|ui|{for (i,label) in ["First option","Second option","Third option"].iter().enumerate(){ui.selectable_value(&mut self.choice,i,*label);}});let r=ui.color_edit_button_srgba_unmultiplied(&mut self.color);self.record("ColorPicker",r);});
                    ui.separator();ui.emphasis("04 · Panels, hierarchy & resources");
                    egui::CollapsingHeader::new("Outliner / Layers · sample data").default_open(true).show(ui,|ui|{self.sample_outliner.show(ui,140.);});
                    egui::CollapsingHeader::new("Details · sample properties").default_open(true).show(ui,|ui|{ui.hbox(|ui|{ui.text("Position");ui.add(NumberField::new(&mut self.position[0]).prefix("X ").speed(0.1));ui.add(NumberField::new(&mut self.position[1]).prefix("Y ").speed(0.1));});ui.small_text("Compound parameter row built from NumberField components");});
                    egui::CollapsingHeader::new("Content Browser · sample cards").show(ui,|ui|{ui.flow_box(|ui|{for (icon,title,kind) in [(Icon::Open,"Images","Folder"),(Icon::Text,"Title sample","Text"),(Icon::New,"Image sample","Raster")]{egui::Frame::group(ui.style()).show(ui,|ui|{ui.set_width(110.);IconButton::new(icon,title).show(ui);ui.text(title);ui.small_text(kind);});}});});
                    ui.hbox(|ui|{if ui.action("Open sample window").clicked(){self.sample_window=true;}ui.small_text("The separate sample window uses the production Window component.");});
                });
            });
        });
    }
    fn fixed_box(&mut self, ui: &mut egui::Ui, c: &LabConfig) {
        let pointer = ui
            .ctx()
            .pointer_hover_pos()
            .filter(|p| !self.window_rect.is_some_and(|r| r.contains(*p)));
        self.box_hover = if c.box_hover {
            pointer
                .filter(|p| self.box_rect.is_some_and(|r| r.contains(*p)))
                .and_then(|p| {
                    self.box_hover
                        .filter(|i| {
                            self.box_slots
                                .get(*i)
                                .is_some_and(|r| r.expand(4.).contains(p))
                        })
                        .or_else(|| self.box_slots.iter().position(|r| r.contains(p)))
                })
        } else {
            None
        };
        let focus = self.box_hover.or(c.box_manual.then_some(c.box_index));
        let duration = if ui_core::animation_strength(ui, Feature::Inherit) > 0. {
            c.duration
        } else {
            0.
        };
        let items: Vec<_> = (0..5)
            .map(|i| {
                let target = if Some(i) == focus {
                    (if c.box_manual {
                        c.box_desired
                    } else {
                        c.box_basis
                    }) + if self.box_hover.is_some() {
                        c.box_hover_growth
                    } else {
                        0.
                    }
                } else {
                    c.box_basis
                };
                BoxItem::new(c.box_basis, c.box_minimum).desired(target)
            })
            .collect();
        let result = HorizontalBox::new([c.box_width, c.box_height])
            .gap(c.box_gap)
            .minimum_gap(c.box_gap_minimum)
            .duration(duration)
            .show(ui, &items, focus, |ui, i| {
                let size = ui.available_size();
                ui.add_sized(
                    size,
                    Button::new(["L2", "L1", "Center", "R1", "R2"][i])
                        .min_size(size)
                        .animation(Feature::Off),
                )
            });
        ui.painter().rect_stroke(
            result.rect,
            0.,
            Stroke::new(1., Color32::from_rgb(90, 135, 150)),
            egui::StrokeKind::Inside,
        );
        self.box_widths = result.slots.iter().map(|r| r.width()).collect();
        self.box_rect = Some(result.rect);
        self.box_slots = result.slots;
        ui.small_text(format!(
            "Spacer widths: {}",
            self.box_slots
                .windows(2)
                .map(|pair| format!("{:.1}", pair[1].left() - pair[0].right()))
                .collect::<Vec<_>>()
                .join(" / ")
        ));
        self.samples.push(Sample {
            key: "HorizontalBox",
            rect: result.rect,
            id: Id::new("lab-fixed-horizontal-box"),
            hovered: result.rect.contains(
                ui.ctx()
                    .pointer_hover_pos()
                    .unwrap_or(Pos2::new(-10000., -10000.)),
            ),
            focused: false,
            enabled: c.enabled,
            interactive: false,
            clip: self.current_clip,
        });
        for (i, response) in result.children.into_iter().enumerate() {
            if response.clicked() {
                self.config.box_index = i;
            }
            self.record(
                [
                    "HorizontalBox / L2",
                    "HorizontalBox / L1",
                    "HorizontalBox / Center",
                    "HorizontalBox / R1",
                    "HorizontalBox / R2",
                ][i],
                response,
            );
        }
        ui.small_text("Resize an item in Properties > HorizontalBox, or hover it. The outer border must not move.");
    }
    pub(crate) fn focus_box_demo(&mut self) {
        self.filter = "horizontalbox".into();
        self.sample_window = false;
        self.config.box_desired = 280.;
        self.config.box_manual = true;
        self.config.box_hover = false;
    }
    fn events(&mut self, ui: &mut egui::Ui) {
        ui.flow_box(|ui| {
            ui.checkbox(&mut self.pause_log, "Pause log");
            if ui.action("Clear log").clicked() {
                self.logs.clear();
            }
            ui.small_text(format!(
                "Speed {:.0} DIP/s · Extra radius {:.1} · Stable dt {:.2} ms · {} widgets",
                self.motion.speed,
                self.zone_extra,
                self.elapsed * 1000.,
                self.samples.len()
            ));
        });
        egui::ScrollArea::vertical()
            .stick_to_bottom(false)
            .show(ui, |ui| {
                for log in &self.logs {
                    ui.small_text(log);
                }
            });
    }
    pub fn show(&mut self, ui: &mut egui::Ui) -> bool {
        let ctx = ui.ctx().clone();
        if ctx.input_mut(|i| i.consume_key(egui::Modifiers::CTRL, egui::Key::Num0)) {
            self.config.ui_scale = 1.;
        }
        self.config.sanitize();
        ctx.set_zoom_factor(self.config.ui_scale);
        self.elapsed = ctx.input(|i| i.stable_dt);
        self.motion.update(ctx.pointer_hover_pos(), self.elapsed);
        let distance = ctx.pointer_hover_pos().map_or(160., |p| {
            self.samples
                .iter()
                .filter(|s| s.interactive && s.clip.intersects(s.rect))
                .map(|s| s.rect.intersect(s.clip).distance_to_pos(p))
                .fold(160., f32::min)
        });
        let settings = interaction::Settings {
            max_expansion: self.config.expansion,
            speed_coefficient: self.config.speed,
            shrink_speed: self.config.shrink,
            ..Default::default()
        };
        let desired = if self.config.adaptive {
            interaction::expansion(self.motion.speed, distance, &settings)
        } else {
            0.
        };
        self.zone_extra = desired.max(self.zone_extra - self.config.shrink * self.motion.dt);
        if self.zone_extra > 0.1 || self.config.continuous {
            ctx.request_repaint_after(std::time::Duration::from_millis(16));
        }
        ctx.data_mut(|d| {
            d.insert_temp(Id::new("mycut-animation"), self.config.animation);
            d.insert_temp(Id::new("mycut-animation-duration"), self.config.duration);
        });
        let mut editor = false;
        if self.unreal_view {
            ui_core::unreal_theme::apply(ui);
        }
        egui::Panel::top("lab-header").show(ui, |ui| {
            ui.flow_box(|ui| {
                ui.emphasis("MyCut · UI Lab");
                ui.small_text("Development scene · no project editing");
                if ui
                    .selectable_label(self.concept_view && !self.unreal_view, "Concept")
                    .clicked()
                {
                    self.concept_view = true;
                    self.unreal_view = false;
                }
                if ui
                    .selectable_label(!self.concept_view && !self.unreal_view, "Components")
                    .clicked()
                {
                    self.concept_view = false;
                    self.unreal_view = false;
                }
                if ui.selectable_label(self.unreal_view, "UE Study").clicked() {
                    self.unreal_view = true;
                }
                if self.concept_view && !self.unreal_view {
                    self.concept.settings(ui);
                }
                let response = ui.action("Photo Editor");
                self.editor_button = Some(response.rect);
                if response.clicked() {
                    editor = true;
                }
                ui.small_text(if self.concept_view || self.unreal_view {
                    "Reference composition · UI components, not a photo document"
                } else {
                    "Drag panel tabs to rearrange. Right panel controls the samples."
                });
            });
        });
        self.samples.clear();
        if self.unreal_view {
            self.window_rect = None;
            egui::CentralPanel::default().show(ui, |ui| self.unreal.show(ui));
            return editor;
        }
        if self.concept_view {
            self.window_rect = None;
            egui::CentralPanel::default()
                .frame(egui::Frame::NONE)
                .show(ui, |ui| {
                    ui_core::with_policy(
                        ui,
                        ComponentPolicy {
                            animation: self.config.policy,
                            adaptive_input: Feature::Off,
                        },
                        |ui| self.concept.show(ui),
                    );
                });
            return editor;
        }
        egui::CentralPanel::default().show(ui, |ui| {
            let snapshot = self.layout.clone();
            let locked = self.config.docking_locked;
            let mut style = DockStyle::from_ui(ui);
            style.text = Color32::from_gray(220);
            let blockers: Vec<_> = self.window_rect.into_iter().collect();
            let output = DockArea::new(Id::new("mycut-ui-lab-dock"))
                .blocked_rects(&blockers)
                .show_with_limits(
                    ui,
                    &snapshot,
                    &style,
                    |id| id.title().into(),
                    |_| Permissions {
                        movable: !locked,
                        floatable: false,
                        closable: false,
                        accepts_tabs: true,
                    },
                    |id| PanelLimits {
                        min: Vec2::new(if *id == Pane::Controls { 300. } else { 160. }, 90.),
                        ..Default::default()
                    },
                    |ui, id| {
                        egui::Frame::new()
                            .inner_margin(egui::Margin::same(7))
                            .show(ui, |ui| match id {
                                Pane::Samples => {
                                    ui.style_mut().interaction.interact_radius =
                                        if self.config.adaptive {
                                            self.config.radius + self.zone_extra
                                        } else {
                                            0.
                                        };
                                    egui::ScrollArea::both().show(ui, |ui| self.samples(ui));
                                }
                                Pane::Controls => {
                                    egui::ScrollArea::vertical().show(ui, |ui| self.controls(ui));
                                }
                                Pane::Events => self.events(ui),
                            });
                    },
                );
            if let Some(e) = output.error {
                self.message = e.to_string();
            }
            for action in output.actions {
                let mut next = self.layout.clone();
                if !matches!(
                    action,
                    Action::Float { .. } | Action::Close { .. } | Action::MoveFloating { .. }
                ) && next
                    .apply_with_permissions(action, |_| Permissions {
                        movable: !locked,
                        floatable: false,
                        closable: false,
                        accepts_tabs: true,
                    })
                    .is_ok()
                    && Self::validate_layout(&next).is_ok()
                {
                    self.layout = next;
                    self.log("Lab panel layout updated");
                }
            }
        });
        if self.sample_window {
            let mut open = true;
            let response = Window::new("Sample Window · UI Core")
                .id(Id::new(("ui-lab-window", self.window_epoch)))
                .open(&mut open)
                .movable(self.config.movable)
                .resizable(self.config.resizable)
                .collapsible(self.config.collapsible)
                .default_size(self.config.window_size)
                .default_pos([90., 430.])
                .show(&ctx, |ui| {
                    self.current_clip = ui.clip_rect();
                    let c = self.config.clone();
                    preview_style(ui, &c);
                    ui_core::with_policy(
                        ui,
                        ComponentPolicy {
                            animation: c.policy,
                            adaptive_input: if c.adaptive {
                                Feature::On
                            } else {
                                Feature::Off
                            },
                        },
                        |ui| {
                            ui.add_enabled_ui(c.enabled, |ui| {
                                ui.text("TextBlock inside Window");
                                let r = ui.add(InputField::singleline(&mut self.input));
                                self.record("Window / InputField", r);
                                let r = ui.add(
                                    Button::new("Window button")
                                        .animation(self.config.button_policy),
                                );
                                self.record("Window / Button", r);
                            })
                        },
                    );
                });
            self.window_rect = response.map(|r| r.response.rect);
            if let Some(rect) = self.window_rect {
                self.samples.push(Sample {
                    key: "Window",
                    rect,
                    id: Id::new(("ui-lab-window", self.window_epoch)),
                    hovered: ctx.pointer_hover_pos().is_some_and(|p| rect.contains(p)),
                    focused: false,
                    enabled: true,
                    interactive: false,
                    clip: ctx.content_rect(),
                });
            }
            self.sample_window = open;
        } else {
            self.window_rect = None;
        }
        self.overlays(&ctx);
        editor
    }
    fn overlays(&mut self, ctx: &egui::Context) {
        let p = ctx.layer_painter(egui::LayerId::new(
            egui::Order::Debug,
            Id::new("ui-lab-overlays"),
        ));
        for s in &self.samples {
            let p = p.with_clip_rect(s.clip);
            if self.config.bounds {
                p.rect_stroke(
                    s.rect,
                    0.,
                    Stroke::new(
                        1.,
                        if s.key == self.selected {
                            Color32::YELLOW
                        } else {
                            Color32::from_rgb(70, 180, 240)
                        },
                    ),
                    egui::StrokeKind::Inside,
                );
            }
            if self.config.zones && s.interactive {
                p.rect_stroke(
                    s.rect.expand(if self.config.adaptive {
                        self.config.radius + self.zone_extra
                    } else {
                        0.
                    }),
                    6.,
                    Stroke::new(1., Color32::from_rgba_unmultiplied(90, 225, 160, 110)),
                    egui::StrokeKind::Inside,
                );
            }
            if self.config.ids && (s.key == self.selected || s.hovered || s.focused) {
                p.text(
                    s.rect.min,
                    egui::Align2::LEFT_TOP,
                    format!("{} {:?}", s.key, s.id),
                    egui::FontId::monospace(9.),
                    Color32::YELLOW,
                );
            }
        }
        if self.config.pointer
            && let Some(pos) = ctx.pointer_hover_pos()
        {
            if self.trace.back() != Some(&pos) {
                self.trace.push_back(pos);
                while self.trace.len() > 32 {
                    self.trace.pop_front();
                }
            }
            for (a, b) in self.trace.iter().zip(self.trace.iter().skip(1)) {
                p.line_segment([*a, *b], Stroke::new(1., Color32::LIGHT_BLUE));
            }
            p.circle_stroke(pos, 5., Stroke::new(1., Color32::YELLOW));
            if let Some(old) = self.last_pointer {
                p.arrow(pos, (pos - old) * 4., Stroke::new(2., Color32::YELLOW));
            }
        }
        self.last_pointer = ctx.pointer_hover_pos();
    }
    pub fn leave(&self, ctx: &egui::Context, editor_scale: f32) {
        ctx.data_mut(|d| {
            d.remove::<f32>(Id::new("mycut-animation-duration"));
        });
        theme::apply(ctx);
        ctx.set_zoom_factor(editor_scale);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn buttons_start_equal_and_hover_returns_to_neutral() {
        let ctx = egui::Context::default();
        let mut lab = UiLab {
            sample_window: false,
            ..Default::default()
        };
        // Even an old preset's requested width must not select Center.
        lab.config.box_desired = 280.;
        for _ in 0..4 {
            frame(&ctx, &mut lab, vec![]);
        }
        assert!(
            lab.box_widths
                .iter()
                .all(|w| (*w - lab.config.box_basis).abs() < 0.01)
        );
        let center = lab.box_slots[2].center();
        for _ in 0..60 {
            frame(&ctx, &mut lab, vec![egui::Event::PointerMoved(center)]);
            for pair in lab.box_slots.windows(2) {
                assert!(pair[1].left() - pair[0].right() >= lab.config.box_gap_minimum - 0.01);
            }
        }
        assert!(lab.box_widths[2] > lab.config.box_basis + 40.);
        let neighbour = lab.box_slots[3].center();
        let before = lab.box_slots.clone();
        frame(&ctx, &mut lab, vec![egui::Event::PointerMoved(neighbour)]);
        for (old, new) in before.iter().zip(&lab.box_slots) {
            assert!(
                (old.left() - new.left()).abs() < 20.,
                "anchor switch teleported a child"
            );
        }
        for _ in 0..90 {
            frame(&ctx, &mut lab, vec![egui::Event::PointerGone]);
        }
        assert!(lab.box_hover.is_none());
        assert!(
            lab.box_widths
                .iter()
                .all(|w| (*w - lab.config.box_basis).abs() < 0.1)
        );
    }
    #[test]
    fn fixed_box_reflows_real_widgets_without_changing_parent_or_ids() {
        let ctx = egui::Context::default();
        let mut lab = UiLab {
            sample_window: false,
            ..Default::default()
        };
        lab.config.box_hover = false;
        lab.config.box_manual = true;
        lab.config.animation = 0.;
        lab.config.box_desired = 96.;
        for _ in 0..4 {
            frame(&ctx, &mut lab, vec![]);
        }
        let outer = lab.box_rect.unwrap();
        let before = lab.box_slots.clone();
        let ids: Vec<_> = lab
            .samples
            .iter()
            .filter(|s| s.key.starts_with("HorizontalBox /"))
            .map(|s| s.id)
            .collect();
        lab.config.box_desired = 280.;
        frame(&ctx, &mut lab, vec![]);
        assert_eq!(outer, lab.box_rect.unwrap());
        assert!((before[2].center().x - lab.box_slots[2].center().x).abs() < 0.001);
        for i in 0..5 {
            assert!(
                (lab.box_slots[i].left() + lab.box_slots[4 - i].right() - outer.center().x * 2.)
                    .abs()
                    < 0.002
            );
        }
        let children: Vec<_> = lab
            .samples
            .iter()
            .filter(|s| s.key.starts_with("HorizontalBox /"))
            .collect();
        assert_eq!(ids, children.iter().map(|s| s.id).collect::<Vec<_>>());
        for child in &children {
            assert!(outer.contains_rect(child.rect));
        }
        let at = children[3].rect.center();
        frame(
            &ctx,
            &mut lab,
            vec![egui::Event::PointerMoved(at), click_event(at, true)],
        );
        frame(&ctx, &mut lab, vec![click_event(at, false)]);
        assert_eq!(lab.config.box_index, 3);
    }
    fn frame(ctx: &egui::Context, lab: &mut UiLab, events: Vec<egui::Event>) -> bool {
        let mut editor = false;
        let output = ctx.run_ui(
            egui::RawInput {
                screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1280., 900.))),
                events,
                focused: true,
                ..Default::default()
            },
            |ui| editor = lab.show(ui),
        );
        output.drop_without_applying_deltas();
        editor
    }
    fn click_event(pos: Pos2, pressed: bool) -> egui::Event {
        egui::Event::PointerButton {
            pos,
            button: egui::PointerButton::Primary,
            pressed,
            modifiers: egui::Modifiers::NONE,
        }
    }
    #[test]
    fn gallery_uses_real_button_input_and_live_dimensions() {
        let ctx = egui::Context::default();
        let mut lab = UiLab {
            sample_window: false,
            ..Default::default()
        };
        for _ in 0..4 {
            frame(&ctx, &mut lab, vec![]);
        }
        let at = lab
            .samples
            .iter()
            .find(|s| s.key == "Button")
            .unwrap()
            .rect
            .center();
        frame(
            &ctx,
            &mut lab,
            vec![egui::Event::PointerMoved(at), click_event(at, true)],
        );
        frame(&ctx, &mut lab, vec![click_event(at, false)]);
        assert_eq!(lab.clicks, 1);
        assert!(lab.logs.iter().any(|s| s.contains("Button: click")));
        let field = lab
            .samples
            .iter()
            .find(|s| s.key == "InputField")
            .unwrap()
            .rect
            .center();
        frame(
            &ctx,
            &mut lab,
            vec![egui::Event::PointerMoved(field), click_event(field, true)],
        );
        frame(&ctx, &mut lab, vec![click_event(field, false)]);
        frame(
            &ctx,
            &mut lab,
            vec![
                egui::Event::Key {
                    key: egui::Key::A,
                    physical_key: None,
                    pressed: true,
                    repeat: false,
                    modifiers: egui::Modifiers {
                        ctrl: true,
                        command: true,
                        ..Default::default()
                    },
                },
                egui::Event::Text("Привет, UI Lab".into()),
            ],
        );
        assert_eq!(lab.input, "Привет, UI Lab");
        lab.config.button_size = [230., 55.];
        lab.config.bounds = true;
        lab.config.zones = true;
        lab.config.ids = true;
        frame(&ctx, &mut lab, vec![]);
        let r = lab.samples.iter().find(|s| s.key == "Button").unwrap().rect;
        assert!(r.width() >= 230. && r.height() >= 55.);
    }
    #[test]
    fn disabled_samples_are_disabled_and_event_log_is_bounded() {
        let ctx = egui::Context::default();
        let mut lab = UiLab::default();
        lab.config.enabled = false;
        for _ in 0..4 {
            frame(&ctx, &mut lab, vec![]);
        }
        assert!(
            lab.samples
                .iter()
                .filter(|s| s.interactive)
                .all(|s| !s.enabled)
        );
        for i in 0..300 {
            lab.log(format!("Event {i}"));
        }
        assert_eq!(lab.logs.len(), 128);
    }
    #[test]
    fn lab_return_button_restores_editor_without_editing_document() {
        let ctx = egui::Context::default();
        let mut app = crate::App::from_context(&ctx);
        app.doc = crate::demo_document();
        app.dirty = true;
        app.scene = crate::Scene::UiLab;
        app.ui_lab.sample_window = false;
        let original = app.doc.selected().unwrap().pixels.clone();
        let selected = app.doc.selected;
        let mut run = |events| {
            let out = ctx.run_ui(
                egui::RawInput {
                    screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1280., 900.))),
                    events,
                    focused: true,
                    ..Default::default()
                },
                |ui| app.show(ui),
            );
            out.drop_without_applying_deltas();
        };
        for _ in 0..4 {
            run(vec![]);
        }
        drop(run);
        let at = app.ui_lab.editor_button.unwrap().center();
        for events in [
            vec![egui::Event::PointerMoved(at), click_event(at, true)],
            vec![click_event(at, false)],
        ] {
            let out = ctx.run_ui(
                egui::RawInput {
                    screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1280., 900.))),
                    events,
                    focused: true,
                    ..Default::default()
                },
                |ui| app.show(ui),
            );
            out.drop_without_applying_deltas();
        }
        assert_eq!(app.scene, crate::Scene::PhotoEditor);
        assert!(app.dirty);
        assert_eq!(app.doc.selected, selected);
        assert!(std::sync::Arc::ptr_eq(
            &original,
            &app.doc.selected().unwrap().pixels
        ));
        assert!(!app.history.can_undo());
        assert_eq!(ctx.zoom_factor(), app.settings.ui_scale);
        assert!(
            ctx.data(|d| d.get_temp::<f32>(Id::new("mycut-animation-duration")))
                .is_none()
        );
    }
    #[test]
    fn config_is_bounded_and_utf8_safe() {
        let mut c = LabConfig {
            font_size: f32::NAN,
            ui_scale: 99.,
            text: "Я".repeat(10000),
            ..Default::default()
        };
        c.sanitize();
        assert_eq!(c.font_size, 15.);
        assert_eq!(c.ui_scale, 2.);
        assert!(c.text.len() <= 8192);
    }
    #[test]
    fn closing_lab_does_not_silently_discard_hidden_dirty_project() {
        let ctx = egui::Context::default();
        let mut app = crate::App::from_context(&ctx);
        app.scene = crate::Scene::UiLab;
        app.dirty = true;
        let mut input = egui::RawInput {
            screen_rect: Some(Rect::from_min_size(Pos2::ZERO, Vec2::new(1280., 900.))),
            ..Default::default()
        };
        input
            .viewports
            .entry(egui::ViewportId::ROOT)
            .or_default()
            .events
            .push(egui::ViewportEvent::Close);
        let output = ctx.run_ui(input, |ui| app.show(ui));
        assert!(app.confirm_close && app.dirty);
        assert!(
            output.viewport_output[&egui::ViewportId::ROOT]
                .commands
                .iter()
                .any(|c| matches!(c, egui::ViewportCommand::CancelClose))
        );
        output.drop_without_applying_deltas();
    }
    #[test]
    fn preset_roundtrip_is_atomic_and_rejects_missing_panels() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("lab.json");
        let mut lab = UiLab::default();
        lab.config.font_size = 21.;
        lab.save(&path).unwrap();
        lab.save(&path).unwrap();
        let mut restored = UiLab::default();
        restored.load(&path).unwrap();
        assert_eq!(restored.config.font_size, 21.);
        let original = restored.layout.clone();
        let mut invalid = UiLab::default();
        invalid.layout.root = None;
        assert!(invalid.save(&path).is_err());
        assert!(restored.load(&path).is_ok());
        std::fs::write(&path, b"{}").unwrap();
        assert!(restored.load(&path).is_err());
        assert_eq!(restored.layout, original);
    }
}
