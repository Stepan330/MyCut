//! Reconstruction workspace: factory palette/font, own UI, isolated sample state.
use crate::{
    icons::{Icon, IconButton},
    ui_core::{InputField, PropertyRow, TextBlock, Timeline, UiComponents, unreal_theme as colors},
};
use craft_ui::{
    docking::{DockArea, DockStyle, Layout, Node, PanelLimits, Permissions},
    layout::{SplitAxis, SplitSize},
};
use eframe::egui::{self, Color32, Stroke, Vec2};
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
enum Pane {
    Viewport,
    Outliner,
    Details,
    Content,
    Sequencer,
}
impl Pane {
    fn title(self) -> &'static str {
        match self {
            Self::Viewport => "Viewport",
            Self::Outliner => "Outliner",
            Self::Details => "Details",
            Self::Content => "Content Browser",
            Self::Sequencer => "Sequencer",
        }
    }
}
fn tab(p: Pane) -> Node<Pane> {
    Node::Tabs {
        panels: vec![p],
        active: 0,
    }
}
fn layout() -> Layout<Pane> {
    Layout {
        root: Some(Node::Split {
            axis: SplitAxis::Horizontal,
            size: SplitSize::Ratio(0.8),
            first: Box::new(tab(Pane::Viewport)),
            second: Box::new(Node::Split {
                axis: SplitAxis::Vertical,
                size: SplitSize::Ratio(0.4 / 1.4),
                first: Box::new(tab(Pane::Outliner)),
                second: Box::new(tab(Pane::Details)),
            }),
        }),
        floating: vec![],
    }
}
fn activate(node: &mut Node<Pane>, pane: Pane) {
    match node {
        Node::Tabs { panels, active } => {
            if let Some(index) = panels.iter().position(|p| *p == pane) {
                *active = index;
            }
        }
        Node::Split { first, second, .. } => {
            activate(first, pane);
            activate(second, pane);
        }
        Node::Stack { .. } => {}
    }
}
fn append_bottom_tab(node: &mut Node<Pane>, pane: Pane) -> bool {
    match node {
        Node::Tabs { panels, active }
            if panels
                .iter()
                .any(|p| matches!(p, Pane::Content | Pane::Sequencer)) =>
        {
            panels.push(pane);
            *active = panels.len() - 1;
            true
        }
        Node::Split { first, second, .. } => {
            append_bottom_tab(first, pane) || append_bottom_tab(second, pane)
        }
        _ => false,
    }
}
struct Item {
    name: String,
    position: [f32; 3],
    rotation: [f32; 3],
    scale: [f32; 3],
    visible: bool,
}
impl Item {
    fn new(name: &str) -> Self {
        Self {
            name: name.into(),
            position: [0.; 3],
            rotation: [0.; 3],
            scale: [1.; 3],
            visible: true,
        }
    }
}
pub(super) struct UnrealStudy {
    layout: Layout<Pane>,
    items: Vec<Item>,
    selected: usize,
    text: String,
    font_size: f32,
    timeline: Timeline,
    outliner: crate::ui_core::outliner::Outliner,
    asset_search: String,
    message: String,
    folder: usize,
}
impl Default for UnrealStudy {
    fn default() -> Self {
        Self {
            layout: layout(),
            items: vec![
                Item::new("Title"),
                Item::new("Studio image"),
                Item::new("Background"),
            ],
            selected: 0,
            text: "MyCut\nCreate. Shape. Color.".into(),
            font_size: 32.,
            timeline: Timeline::default(),
            outliner: Default::default(),
            asset_search: String::new(),
            message: "UI reconstruction in progress · sample scene, not the photo document".into(),
            folder: 0,
        }
    }
}
impl UnrealStudy {
    fn activate(&mut self, pane: Pane) {
        if !self.layout.contains(&pane)
            && let Some(root) = &mut self.layout.root
            && !append_bottom_tab(root, pane)
            && let Node::Split { first, .. } = root
        {
            let old = Box::new(std::mem::replace(first.as_mut(), tab(Pane::Viewport)));
            **first = Node::Split {
                axis: SplitAxis::Vertical,
                size: SplitSize::FixedSecond(260.),
                first: old,
                second: Box::new(tab(pane)),
            };
        }
        if let Some(root) = &mut self.layout.root {
            activate(root, pane);
        }
    }
    pub(super) fn show(&mut self, ui: &mut egui::Ui) {
        colors::apply(ui);
        ui.hbox(|ui| {
            ui.emphasis("MyCut");
            ui.menu_button("File", |ui| {
                ui.small_text("Photo projects remain in Photo Editor.");
                ui.add_enabled(false, egui::Button::new("Save scene (not implemented)"));
            });
            ui.menu_button("Edit", |ui| {
                ui.add_enabled(false, egui::Button::new("Undo scene (not implemented)"));
            });
            ui.menu_button("Window", |ui| {
                for pane in [
                    Pane::Viewport,
                    Pane::Outliner,
                    Pane::Details,
                    Pane::Content,
                    Pane::Sequencer,
                ] {
                    if ui.action(pane.title()).clicked() {
                        self.activate(pane);
                        ui.close();
                    }
                }
                if ui.action("Load default layout").clicked() {
                    self.layout = layout();
                    ui.close();
                }
            });
            ui.menu_button("Tools", |ui| {
                if ui.action("Reset selected transform").clicked() {
                    let item = &mut self.items[self.selected];
                    item.position = [0.; 3];
                    item.rotation = [0.; 3];
                    item.scale = [1.; 3];
                }
            });
            ui.menu_button("Help", |ui| {
                ui.text("UE 5.8.2 factory-theme reconstruction");
                ui.small_text(
                    "Not a complete Unreal Editor clone. No Epic engine code is embedded.",
                );
            });
        });
        ui.separator();
        ui.hbox(|ui| {
            ui.add_enabled(false, egui::Button::new("Save"))
                .on_hover_text("Use Photo Editor for real projects");
            ui.menu_button("+ Add", |ui| {
                if ui.action("Sample object").clicked() {
                    let name = format!("Object {}", self.items.len() + 1);
                    self.items.push(Item::new(&name));
                    self.selected = self.items.len() - 1;
                    ui.close();
                }
            });
            if ui.action("Content").clicked() {
                self.activate(Pane::Content);
            }
            if ui.action("Cinematics").clicked() {
                self.activate(Pane::Sequencer);
            }
            ui.separator();
            ui.small_text("Selection Mode");
            ui.add_enabled(false, egui::Button::new("Play world"))
                .on_hover_text("3D world execution is not part of the UI reconstruction");
            ui.small_text("Untitled · UI sample");
        });
        ui.separator();
        let snapshot = self.layout.clone();
        let mut style = DockStyle::from_ui(ui);
        style.background = colors::PANEL;
        style.tab_background = colors::BACKGROUND;
        style.active_background = colors::PANEL;
        style.border = Stroke::new(1., colors::INPUT);
        style.accent = colors::PRIMARY;
        style.text = colors::FOREGROUND;
        style.font = egui::FontId::proportional(13.333);
        style.tab_height = 26.;
        style.gap = 5.;
        let output = DockArea::new(egui::Id::new("unreal-reconstruction-dock")).show_with_limits(
            ui,
            &snapshot,
            &style,
            |p| p.title().into(),
            |_| Permissions {
                movable: true,
                floatable: false,
                closable: false,
                accepts_tabs: true,
            },
            |_| PanelLimits {
                min: Vec2::new(110., 75.),
                ..Default::default()
            },
            |ui, p| {
                egui::Frame::new()
                    .inner_margin(if *p == Pane::Outliner { 2 } else { 6 })
                    .show(ui, |ui| match p {
                        Pane::Viewport => self.viewport(ui),
                        Pane::Outliner => self.outliner(ui),
                        Pane::Details => self.details(ui),
                        Pane::Content => self.content(ui),
                        Pane::Sequencer => self.timeline.show(ui),
                    });
            },
        );
        if let Some(error) = output.error {
            self.message = error.to_string();
        }
        for action in output.actions {
            let mut next = self.layout.clone();
            if next
                .apply_with_permissions(action, |_| Permissions {
                    movable: true,
                    floatable: false,
                    closable: false,
                    accepts_tabs: true,
                })
                .is_ok()
            {
                self.layout = next;
            }
        }
    }
    fn viewport(&mut self, ui: &mut egui::Ui) {
        ui.hbox(|ui| {
            ui.text("Perspective");
            ui.separator();
            ui.text("Lit");
            ui.separator();
            ui.small_text("Preview only · no 3D camera or scene renderer");
        });
        let size = ui.available_size();
        let (rect, _) = ui.allocate_exact_size(size, egui::Sense::hover());
        let painter = ui.painter_at(rect.intersect(ui.clip_rect()));
        painter.rect_filled(rect, 0., colors::RECESSED);
        let center = rect.center();
        for i in -10..=10 {
            let offset = i as f32 * 36.;
            painter.line_segment(
                [
                    egui::pos2(rect.left(), center.y + offset),
                    egui::pos2(rect.right(), center.y + offset),
                ],
                Stroke::new(0.5, colors::INPUT_OUTLINE),
            );
            painter.line_segment(
                [
                    egui::pos2(center.x + offset, rect.top()),
                    egui::pos2(center.x + offset, rect.bottom()),
                ],
                Stroke::new(0.5, colors::INPUT_OUTLINE),
            );
        }
        let item = &self.items[self.selected];
        if item.visible {
            let pos = center + egui::vec2(item.position[0], item.position[1]);
            let scale = item.scale[0].abs().clamp(0.1, 5.);
            painter.text(
                pos,
                egui::Align2::CENTER_CENTER,
                &self.text,
                egui::FontId::proportional(self.font_size * scale),
                Color32::WHITE,
            );
        }
        painter.text(
            rect.left_bottom() + egui::vec2(8., -8.),
            egui::Align2::LEFT_BOTTOM,
            &self.message,
            egui::FontId::proportional(11.),
            colors::FOREGROUND,
        );
    }
    fn outliner(&mut self, ui: &mut egui::Ui) {
        use crate::ui_core::outliner::{Action, OutlinerOptions, OutlinerRow};
        let rows: Vec<_> = self
            .items
            .iter()
            .enumerate()
            .map(|(id, item)| {
                let (kind, icon) = match id {
                    0 => ("Text", Icon::Text),
                    1 | 2 => ("Image", Icon::Image),
                    _ => ("Object", Icon::Cube),
                };
                OutlinerRow {
                    id: id as u64,
                    label: &item.name,
                    kind,
                    icon,
                    visible: item.visible,
                }
            })
            .collect();
        for action in self.outliner.show(
            ui,
            &rows,
            Some(self.selected as u64),
            OutlinerOptions::default(),
        ) {
            match action {
                Action::Select(id) => self.selected = id as usize,
                Action::ToggleVisibility(id) => {
                    self.items[id as usize].visible = !self.items[id as usize].visible
                }
            }
        }
    }
    fn details(&mut self, ui: &mut egui::Ui) {
        colors::apply_details(ui);
        ui.push_id(self.selected,|ui| {
        egui::ScrollArea::vertical().show(ui,|ui|{
            let item=&mut self.items[self.selected];
            ui.add(InputField::singleline(&mut item.name).desired_width(f32::INFINITY));ui.separator();
            egui::CollapsingHeader::new("Transform").default_open(true).show(ui,|ui|{
                ui.spacing_mut().item_spacing.y=0.;
                for (label,values,defaults,speed) in [("Location",&mut item.position,[0.;3],0.1),("Rotation",&mut item.rotation,[0.;3],0.2),("Scale",&mut item.scale,[1.;3],0.01)]{
                    let edit=PropertyRow{label,defaults:&defaults,speed}.show(ui,values);
                    if edit.cancelled {self.message=format!("{} · {label}: cancelled",item.name);}
                    else if edit.committed {self.message=format!("{} · {label}: committed (UI sample)",item.name);}
                    else if edit.invalid {self.message="Non-finite input rejected".into();}
                    else if edit.changed{self.message=format!("{} · {label} changed (UI sample)",item.name);}
                }
            });
            egui::CollapsingHeader::new("Text · typography study").default_open(true).show(ui,|ui|{ui.add(InputField::multiline(&mut self.text).desired_width(ui.available_width()));ui.add(egui::Slider::new(&mut self.font_size,10.0..=64.0).text("Font size"));ui.add(TextBlock::new(egui::RichText::new("Аа Bb 0123 AV fi").size(15.)));});
            ui.small_text("Only X/Y location and X scale affect the flat sample preview; rotation/Z and timeline are not connected to a scene engine.");
        });
        });
    }
    fn content(&mut self, ui: &mut egui::Ui) {
        ui.hbox(|ui| {
            ui.small_text("All > Content");
            ui.add(
                InputField::singleline(&mut self.asset_search)
                    .hint_text("Search sample assets")
                    .desired_width(230.),
            );
        });
        ui.separator();
        ui.horizontal_top(|ui| {
            ui.vertical(|ui| {
                ui.set_width(140.);
                for (i, name) in ["Content", "Images", "Text", "Sequences"]
                    .iter()
                    .enumerate()
                {
                    ui.hbox(|ui| {
                        IconButton::new(Icon::Open, "Folder").size(24.).show(ui);
                        if ui.selectable_label(self.folder == i, *name).clicked() {
                            self.folder = i;
                        }
                    });
                }
            });
            ui.separator();
            ui.flow_box(|ui| {
                for (index, item) in self.items.iter().enumerate() {
                    if !item
                        .name
                        .to_lowercase()
                        .contains(&self.asset_search.to_lowercase())
                        || (self.folder == 1 && index == 0)
                        || (self.folder == 2 && index != 0)
                        || self.folder == 3
                    {
                        continue;
                    }
                    egui::Frame::new()
                        .fill(colors::RECESSED)
                        .inner_margin(6)
                        .show(ui, |ui| {
                            ui.set_width(110.);
                            let (rect, response) =
                                ui.allocate_exact_size(Vec2::new(110., 65.), egui::Sense::click());
                            ui.painter().rect_filled(rect, 2., colors::INPUT);
                            ui.painter().text(
                                rect.center(),
                                egui::Align2::CENTER_CENTER,
                                "Sample",
                                egui::FontId::proportional(14.),
                                colors::FOLDER,
                            );
                            if response.clicked() {
                                self.selected = index;
                            }
                            if ui
                                .selectable_label(self.selected == index, &item.name)
                                .clicked()
                            {
                                self.selected = index;
                            }
                            ui.small_text("UI sample asset");
                        });
                }
            });
        });
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn factory_workspace_starts_with_three_panes_and_opens_bottom_tabs_without_duplicates() {
        let mut study = UnrealStudy::default();
        assert!(study.layout.validate().is_ok());
        assert!(!study.layout.contains(&Pane::Content));
        assert!(!study.layout.contains(&Pane::Sequencer));
        for pane in [
            Pane::Viewport,
            Pane::Outliner,
            Pane::Details,
            Pane::Content,
            Pane::Sequencer,
        ] {
            study.activate(pane);
            study.activate(pane);
            assert!(study.layout.contains(&pane));
            assert!(study.layout.validate().is_ok());
        }
        assert!(study.selected < study.items.len());
        study.items[0].position[0] = 42.;
        assert_eq!(study.items[1].position[0], 0.);
    }
    #[test]
    fn workspace_renders_in_small_and_large_windows_without_mutating_model() {
        let ctx = egui::Context::default();
        let mut study = UnrealStudy::default();
        for size in [Vec2::new(1280., 900.), Vec2::new(640., 480.)] {
            let out = ctx.run_ui(
                egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(egui::Pos2::ZERO, size)),
                    ..Default::default()
                },
                |ui| study.show(ui),
            );
            out.drop_without_applying_deltas();
        }
        assert_eq!(study.items.len(), 3);
        assert_eq!(study.items[0].position, [0.; 3]);
        assert!(study.layout.validate().is_ok());
    }
}
