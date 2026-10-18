//! Typed panel registry and docking policy. No document data is serialized here.
use crate::{
    App,
    ui_core::{ComponentPolicy, Feature, UiComponents, with_policy},
};
use craft_ui::{
    docking::{
        self, Action, DockArea, DockContent, DockError, DockStyle, Layout, Location, Node,
        PanelLimits, Permissions, Placement, Zone,
    },
    layout::{SplitAxis, SplitSize},
};
use eframe::egui::{self, Vec2};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum PanelId {
    Canvas,
    Details,
    Outliner,
    ContentBrowser,
    Tools,
}
pub const PANELS: [PanelId; 5] = [
    PanelId::Canvas,
    PanelId::Details,
    PanelId::Outliner,
    PanelId::ContentBrowser,
    PanelId::Tools,
];
#[derive(Clone, Copy)]
pub struct PanelDefinition {
    pub id: PanelId,
    pub title: &'static str,
    pub min_size: [f32; 2],
    pub closable: bool,
    pub movable: bool,
    pub accepts_tabs: bool,
}
impl PanelId {
    pub fn definition(self) -> PanelDefinition {
        let (title, min_size) = match self {
            Self::Canvas => ("Canvas", [180., 140.]),
            Self::Details => ("Details", [300., 180.]),
            Self::Outliner => ("Outliner / Layers", [200., 120.]),
            Self::ContentBrowser => ("Content Browser", [240., 180.]),
            Self::Tools => ("Tools", [54., 80.]),
        };
        PanelDefinition {
            id: self,
            title,
            min_size,
            closable: self != Self::Canvas,
            movable: self != Self::Canvas,
            accepts_tabs: self != Self::Canvas,
        }
    }
}
#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct PanelSettings {
    pub locked: bool,
    pub components: ComponentPolicy,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Workspace {
    version: u32,
    pub layout: Layout<PanelId>,
    pub settings: BTreeMap<PanelId, PanelSettings>,
    hidden: BTreeMap<PanelId, Location<PanelId>>,
    #[serde(skip)]
    pub dirty: bool,
    #[serde(skip)]
    pub geometry: BTreeMap<PanelId, egui::Rect>,
}
fn tabs(panel: PanelId) -> Node<PanelId> {
    Node::Tabs {
        panels: vec![panel],
        active: 0,
    }
}
fn split(
    axis: SplitAxis,
    size: SplitSize,
    first: Node<PanelId>,
    second: Node<PanelId>,
) -> Node<PanelId> {
    Node::Split {
        axis,
        size,
        first: Box::new(first),
        second: Box::new(second),
    }
}
impl Default for Workspace {
    fn default() -> Self {
        Self {
            version: 1,
            layout: Layout {
                root: Some(split(
                    SplitAxis::Horizontal,
                    SplitSize::FixedFirst(58.),
                    tabs(PanelId::Tools),
                    split(
                        SplitAxis::Horizontal,
                        SplitSize::FixedSecond(310.),
                        tabs(PanelId::Canvas),
                        split(
                            SplitAxis::Vertical,
                            SplitSize::Ratio(0.64),
                            tabs(PanelId::Details),
                            tabs(PanelId::Outliner),
                        ),
                    ),
                )),
                floating: vec![],
            },
            settings: PANELS
                .into_iter()
                .map(|id| (id, PanelSettings::default()))
                .collect(),
            hidden: BTreeMap::new(),
            dirty: false,
            geometry: BTreeMap::new(),
        }
    }
}
impl Workspace {
    pub fn permissions(&self, id: PanelId) -> Permissions {
        let d = id.definition();
        let s = self.settings.get(&id).copied().unwrap_or_default();
        debug_assert_eq!(d.id, id);
        Permissions {
            movable: d.movable && !s.locked,
            floatable: false,
            closable: d.closable && !s.locked,
            accepts_tabs: d.accepts_tabs,
        }
    }
    pub fn apply(&mut self, action: Action<PanelId>) -> Result<(), DockError> {
        // Explicitly reject floating at the command boundary as well as in the renderer.
        if matches!(action, Action::Float { .. } | Action::MoveFloating { .. }) {
            return Err(DockError::NotAllowed);
        }
        let location = if let Action::Close { panel } = &action {
            Some((*panel, self.layout.location(panel)?))
        } else {
            None
        };
        let mut candidate = self.layout.clone();
        candidate.apply_with_permissions(action, |id| self.permissions(*id))?;
        if !candidate.contains(&PanelId::Canvas) || !candidate.floating.is_empty() {
            return Err(DockError::NotAllowed);
        }
        self.layout = candidate;
        if let Some((id, location)) = location {
            self.hidden.insert(id, location);
        }
        self.dirty = true;
        Ok(())
    }
    pub fn show_panel(&mut self, id: PanelId) -> Result<(), DockError> {
        if self.layout.contains(&id) {
            return Ok(());
        }
        let mut candidate = self.layout.clone();
        if let Some(location) = self.hidden.get(&id)
            && candidate.restore(id, location).is_ok()
            && candidate.floating.is_empty()
            && candidate.contains(&PanelId::Canvas)
        {
            self.layout = candidate;
            self.hidden.remove(&id);
            self.dirty = true;
            return Ok(());
        }
        self.apply(Action::OpenAt {
            panel: id,
            anchor: PanelId::Canvas,
            placement: Placement::Split(if id == PanelId::ContentBrowser {
                Zone::Bottom
            } else {
                Zone::Right
            }),
        })
    }
    pub fn set_visible(&mut self, id: PanelId, visible: bool) -> Result<(), DockError> {
        if visible {
            self.show_panel(id)
        } else if self.layout.contains(&id) {
            self.apply(Action::Close { panel: id })
        } else {
            Ok(())
        }
    }
    pub fn validate(&self) -> Result<(), String> {
        self.layout.validate().map_err(|e| e.to_string())?;
        if self.version != 1
            || !self.layout.contains(&PanelId::Canvas)
            || !self.layout.floating.is_empty()
        {
            return Err("Unsupported workspace or missing canvas".into());
        }
        Ok(())
    }
    pub fn path() -> Option<std::path::PathBuf> {
        std::env::var_os("LOCALAPPDATA")
            .map(|p| std::path::PathBuf::from(p).join("MyCutNext/workspace.json"))
    }
    pub fn load(path: &std::path::Path) -> Result<Self, String> {
        if std::fs::metadata(path).map_err(|e| e.to_string())?.len() > 65536 {
            return Err("Workspace file exceeds 64 KiB".into());
        }
        let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
        if bytes.len() > 65536 {
            return Err("Workspace file exceeds 64 KiB".into());
        }
        // serde_json's recursion limit also bounds parsing before tree validation.
        let mut value: Self = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
        value.validate()?;
        for id in PANELS {
            value.settings.entry(id).or_default();
        }
        Ok(value)
    }
    pub fn save(&self, path: &std::path::Path) -> Result<(), String> {
        self.validate()?;
        let bytes = serde_json::to_vec_pretty(self).map_err(|e| e.to_string())?;
        if bytes.len() > 65536 {
            return Err("Workspace is too large".into());
        }
        std::fs::create_dir_all(path.parent().ok_or("Missing settings directory")?)
            .map_err(|e| e.to_string())?;
        use std::io::Write;
        let mut tmp =
            tempfile::NamedTempFile::new_in(path.parent().unwrap()).map_err(|e| e.to_string())?;
        tmp.write_all(&bytes).map_err(|e| e.to_string())?;
        tmp.as_file().sync_all().map_err(|e| e.to_string())?;
        tmp.persist(path).map_err(|e| e.to_string())?;
        Ok(())
    }
}

struct Content<'a> {
    app: &'a mut App,
    workspace: &'a mut Workspace,
}
impl DockContent<PanelId> for Content<'_> {
    fn body(&mut self, ui: &mut egui::Ui, id: &PanelId) {
        self.workspace.geometry.insert(*id, ui.max_rect());
        let policy = self
            .workspace
            .settings
            .get(id)
            .copied()
            .unwrap_or_default()
            .components;
        egui::Frame::new()
            .inner_margin(egui::Margin::same(6))
            .show(ui, |ui| {
                with_policy(ui, policy, |ui| {
                    let enabled = self.app.pending.is_none()
                        && (*id == PanelId::Canvas
                            || (!self.app.gesture && self.app.text_edit.is_none()));
                    ui.add_enabled_ui(enabled, |ui| match id {
                        PanelId::Canvas => self.app.canvas(ui),
                        PanelId::Details => {
                            egui::ScrollArea::both()
                                .id_salt("details-content")
                                .show(ui, |ui| self.app.details(ui));
                        }
                        PanelId::Outliner => self.app.outliner_panel(ui),
                        PanelId::ContentBrowser => self.app.content_browser(ui),
                        PanelId::Tools => self.app.tools_panel(ui),
                    });
                })
            });
    }
    fn panel_menu(&mut self, ui: &mut egui::Ui, id: &PanelId) {
        let settings = self.workspace.settings.entry(*id).or_default();
        if id.definition().movable && ui.checkbox(&mut settings.locked, "Lock position").changed() {
            self.workspace.dirty = true;
        }
        ui.text("Button animations");
        for (value, label) in [
            (Feature::Inherit, "Use global setting"),
            (Feature::On, "On"),
            (Feature::Off, "Off"),
        ] {
            if ui
                .radio_value(&mut settings.components.animation, value, label)
                .changed()
            {
                self.workspace.dirty = true;
            }
        }
    }
}
impl App {
    pub(crate) fn workspace(&mut self, ui: &mut egui::Ui) {
        let mut workspace = std::mem::take(&mut self.workspace);
        // The existing folder shortcut controls the registered browser panel.
        let visible = workspace.layout.contains(&PanelId::ContentBrowser);
        if self.browser.open != visible
            && let Err(e) = workspace.set_visible(PanelId::ContentBrowser, self.browser.open)
        {
            self.error = Some(e.to_string());
            self.browser.open = visible;
        }
        let layout = workspace.layout.clone();
        let permissions: BTreeMap<_, _> = PANELS
            .into_iter()
            .map(|id| (id, workspace.permissions(id)))
            .collect();
        let mut style = DockStyle::from_ui(ui);
        style.text = egui::Color32::from_gray(220);
        style.inactive_text = crate::theme::SECONDARY_TEXT;
        style.gap = 3.;
        style.tab_height = 26.;
        let blocked = self.pending.is_some()
            || self.gesture
            || self.text_edit.is_some()
            || self.settings_open
            || self.resize_open
            || self.confirm.is_some()
            || self.confirm_new
            || self.confirm_close;
        let area_id = egui::Id::new("mycut-workspace");
        if blocked {
            docking::cancel_drag::<PanelId>(ui.ctx(), area_id);
        }
        let output = DockArea::new(area_id).show_customized(
            ui,
            &layout,
            &style,
            |id| id.definition().title.into(),
            |id| {
                let mut p = permissions[id];
                if blocked {
                    p.movable = false;
                    p.closable = false;
                }
                p
            },
            |id| PanelLimits {
                min: Vec2::from(id.definition().min_size),
                ..Default::default()
            },
            &mut Content {
                app: self,
                workspace: &mut workspace,
            },
        );
        if let Some(e) = output.error {
            self.error = Some(e.to_string());
        }
        if !blocked {
            for action in output.actions {
                if let Err(e) = workspace.apply(action) {
                    self.error = Some(e.to_string());
                }
            }
        }
        self.browser.open = workspace.layout.contains(&PanelId::ContentBrowser);
        if workspace.dirty
            && self.persist_ui
            && self.capture.is_none()
            && !self.capture_requested
            && !ui.ctx().input(|i| i.pointer.any_down())
        {
            if let Some(path) = Workspace::path()
                && let Err(e) = workspace.save(&path)
            {
                self.error = Some(format!("Cannot save workspace: {e}"));
            }
            workspace.dirty = false;
        }
        self.workspace = workspace;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn move_panel(panel: PanelId, anchor: PanelId, zone: Zone) -> Action<PanelId> {
        Action::Move {
            panel,
            anchor,
            placement: Placement::Split(zone),
        }
    }
    #[test]
    fn docking_commands_are_atomic_and_canvas_and_float_are_protected() {
        let mut w = Workspace::default();
        let original = w.layout.clone();
        assert!(
            w.apply(move_panel(
                PanelId::Details,
                PanelId::ContentBrowser,
                Zone::Left
            ))
            .is_err()
        );
        assert_eq!(w.layout, original);
        assert!(
            w.apply(Action::Close {
                panel: PanelId::Canvas
            })
            .is_err()
        );
        assert!(
            w.apply(move_panel(PanelId::Canvas, PanelId::Details, Zone::Center))
                .is_err()
        );
        assert!(
            w.apply(Action::Float {
                panel: PanelId::Details,
                rect: [0., 0., 300., 300.]
            })
            .is_err()
        );
        assert_eq!(w.layout, original);
        w.settings.get_mut(&PanelId::Details).unwrap().locked = true;
        assert!(
            w.apply(move_panel(PanelId::Details, PanelId::Canvas, Zone::Left))
                .is_err()
        );
        assert_eq!(w.layout, original);
    }
    #[test]
    fn hide_restore_preserves_placement_and_policy_and_atomic_reload() {
        let mut w = Workspace::default();
        w.apply(move_panel(PanelId::Outliner, PanelId::Canvas, Zone::Left))
            .unwrap();
        w.settings
            .get_mut(&PanelId::Outliner)
            .unwrap()
            .components
            .animation = Feature::Off;
        let layout = w.layout.clone();
        w.set_visible(PanelId::Outliner, false).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("workspace.json");
        w.save(&path).unwrap();
        w.save(&path).unwrap();
        let mut loaded = Workspace::load(&path).unwrap();
        loaded.set_visible(PanelId::Outliner, true).unwrap();
        assert_eq!(loaded.layout, layout);
        assert_eq!(
            loaded.settings[&PanelId::Outliner].components.animation,
            Feature::Off
        );
        let mut bad = loaded.clone();
        bad.layout.root = None;
        assert!(bad.save(&path).is_err());
        assert!(Workspace::load(&path).is_ok());
        std::fs::write(&path, b"{bad json}").unwrap();
        assert!(Workspace::load(&path).is_err());
    }
    fn frame(ctx: &egui::Context, app: &mut App, events: Vec<egui::Event>) {
        let output = ctx.run_ui(
            egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    Vec2::new(1280., 850.),
                )),
                events,
                focused: true,
                ..Default::default()
            },
            |ui| app.show(ui),
        );
        output.drop_without_applying_deltas();
    }
    fn pointer(pos: egui::Pos2, pressed: bool) -> egui::Event {
        egui::Event::PointerButton {
            pos,
            button: egui::PointerButton::Primary,
            pressed,
            modifiers: egui::Modifiers::NONE,
        }
    }
    fn start_drag(ctx: &egui::Context, app: &mut App, id: PanelId) {
        let at = ctx
            .read_response(egui::Id::new("mycut-workspace").with(("tab", &id)))
            .unwrap()
            .rect
            .center();
        frame(
            ctx,
            app,
            vec![egui::Event::PointerMoved(at), pointer(at, true)],
        );
        frame(
            ctx,
            app,
            vec![egui::Event::PointerMoved(at + Vec2::new(12., 8.))],
        );
    }
    #[test]
    fn actual_tab_drag_docks_panel_and_preserves_document_and_widget_identity() {
        let ctx = egui::Context::default();
        let mut app = App::from_context(&ctx);
        app.doc = crate::demo_document();
        app.outliner_view.search = "Paint".into();
        let selected = app.doc.selected;
        let pixels = app.doc.selected().unwrap().pixels.clone();
        for _ in 0..4 {
            frame(&ctx, &mut app, vec![]);
        }
        let original = app.workspace.layout.clone();
        start_drag(&ctx, &mut app, PanelId::Outliner);
        let canvas = app.workspace.geometry[&PanelId::Canvas];
        let target = egui::pos2(canvas.left() + 8., canvas.center().y);
        frame(&ctx, &mut app, vec![egui::Event::PointerMoved(target)]);
        frame(&ctx, &mut app, vec![pointer(target, false)]);
        frame(&ctx, &mut app, vec![]);
        assert_ne!(app.workspace.layout, original);
        assert!(
            app.workspace.geometry[&PanelId::Outliner].right()
                <= app.workspace.geometry[&PanelId::Canvas].left()
        );
        assert_eq!(app.workspace.layout.panels().len(), 4);
        assert!(app.workspace.layout.floating.is_empty());
        assert_eq!(app.outliner_view.search, "Paint");
        assert_eq!(app.doc.selected, selected);
        assert!(std::sync::Arc::ptr_eq(
            &pixels,
            &app.doc.selected().unwrap().pixels
        ));
        assert!(!app.history.can_undo());
    }
    #[test]
    fn invalid_drop_escape_and_focus_loss_do_not_detach_or_lose_panel() {
        for cancel in 0..3 {
            let ctx = egui::Context::default();
            let mut app = App::from_context(&ctx);
            for _ in 0..4 {
                frame(&ctx, &mut app, vec![]);
            }
            let original = app.workspace.layout.clone();
            start_drag(&ctx, &mut app, PanelId::Details);
            let at = egui::pos2(-20., -20.);
            let mut events = vec![egui::Event::PointerMoved(at)];
            if cancel == 1 {
                events.push(egui::Event::Key {
                    key: egui::Key::Escape,
                    physical_key: None,
                    pressed: true,
                    repeat: false,
                    modifiers: egui::Modifiers::NONE,
                });
            }
            if cancel == 2 {
                events.push(egui::Event::WindowFocused(false));
            }
            frame(&ctx, &mut app, events);
            frame(&ctx, &mut app, vec![pointer(at, false)]);
            assert_eq!(app.workspace.layout, original);
            assert!(app.workspace.layout.floating.is_empty());
        }
    }
    #[test]
    fn tab_merge_and_split_resize_keep_unique_panels() {
        let mut w = Workspace::default();
        w.apply(Action::Move {
            panel: PanelId::Outliner,
            anchor: PanelId::Details,
            placement: Placement::Tab { before: None },
        })
        .unwrap();
        assert_eq!(w.layout.panels().len(), 4);
        w.apply(Action::ResizeSplit {
            path: vec![],
            size: SplitSize::FixedFirst(80.),
        })
        .unwrap();
        w.validate().unwrap();
    }
    #[test]
    fn fit_uses_real_canvas_pane_instead_of_whole_workspace() {
        let ctx = egui::Context::default();
        let mut app = App::from_context(&ctx);
        app.doc = crate::demo_document();
        app.browser.open = true;
        app.fit_pending = true;
        for _ in 0..5 {
            frame(&ctx, &mut app, vec![]);
        }
        let rect = app.workspace.geometry[&PanelId::Canvas];
        assert!(app.zoom * app.doc.width as f32 <= rect.width());
        assert!(app.zoom * app.doc.height as f32 <= rect.height());
        assert!(!app.fit_pending);
    }
    #[test]
    fn actual_center_drop_merges_tabs_and_keeps_selection() {
        let ctx = egui::Context::default();
        let mut app = App::from_context(&ctx);
        app.doc = crate::demo_document();
        let selected = app.doc.selected;
        for _ in 0..4 {
            frame(&ctx, &mut app, vec![]);
        }
        start_drag(&ctx, &mut app, PanelId::Outliner);
        let at = app.workspace.geometry[&PanelId::Details].center();
        frame(&ctx, &mut app, vec![egui::Event::PointerMoved(at)]);
        frame(&ctx, &mut app, vec![pointer(at, false)]);
        let location = app.workspace.layout.location(&PanelId::Outliner).unwrap();
        assert_eq!(location.anchor, Some(PanelId::Details));
        assert!(matches!(location.placement, Placement::Tab { .. }));
        assert_eq!(app.doc.selected, selected);
    }
}
