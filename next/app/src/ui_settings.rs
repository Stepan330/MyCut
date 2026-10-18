use crate::ui_core::UiComponents;
use crate::{App, interaction::Settings};
use eframe::egui;
fn row(
    ui: &mut egui::Ui,
    label: &str,
    value: &mut f32,
    range: std::ops::RangeInclusive<f32>,
    default: f32,
) {
    ui.push_id(label, |ui| {
        ui.hbox(|ui| {
            ui.add_sized([135., 22.], crate::ui_core::TextBlock::new(label));
            ui.add_sized(
                [100., 22.],
                crate::ui_core::ParameterSlider::new(value, range.clone()).show_value(false),
            );
            ui.add_sized(
                [65., 22.],
                crate::ui_core::NumberField::new(value)
                    .speed(0.01)
                    .range(range)
                    .max_decimals(3),
            );
            if crate::icons::compact(ui, crate::icons::Icon::Reset, false, "Reset this setting")
                .clicked()
            {
                *value = default;
            }
        });
    });
}
fn path() -> Option<std::path::PathBuf> {
    std::env::var_os("LOCALAPPDATA")
        .map(|p| std::path::PathBuf::from(p).join("MyCutNext/interface.json"))
}
impl App {
    pub(crate) fn load_interface(&mut self, ctx: &egui::Context) {
        if let Some(path) = path()
            && let Ok(bytes) = std::fs::read(&path)
            && bytes.len() < 65536
            && let Ok(mut settings) = serde_json::from_slice::<Settings>(&bytes)
        {
            settings.sanitize();
            self.settings = settings;
        }
        ctx.set_zoom_factor(self.settings.ui_scale);
    }
    pub(crate) fn save_interface(&mut self) {
        if let Some(path) = path() {
            let result = (|| -> std::io::Result<()> {
                std::fs::create_dir_all(path.parent().unwrap())?;
                let bytes = serde_json::to_vec_pretty(&self.settings)?;
                std::fs::write(path, bytes)
            })();
            if let Err(e) = result {
                self.error = Some(format!("Cannot save interface settings: {e}"));
            }
        }
    }
    pub(crate) fn interface_controls(&mut self, ctx: &egui::Context) {
        if !self.settings_open {
            return;
        }
        let before = serde_json::to_string(&self.settings).unwrap();
        let mut open = true;
        crate::ui_core::Window::new("Settings").open(&mut open).movable(true).resizable(true).default_size([460.,440.]).min_size([400.,230.]).show(ctx,|ui|{
            ui.hbox(|ui|{ui.selectable_value(&mut self.settings_tab,0,"Interface");ui.selectable_value(&mut self.settings_tab,1,"Interaction");ui.selectable_value(&mut self.settings_tab,2,"Panels");});
            ui.add(crate::ui_core::InputField::singleline(&mut self.settings_search).hint_text("Search settings…").desired_width(f32::INFINITY));
            let search=self.settings_search.to_lowercase();let visible=|label:&str|search.is_empty() || label.to_lowercase().contains(&search);
            egui::ScrollArea::vertical().show(ui,|ui|{
                if self.settings_tab==0 || !search.is_empty(){
                    crate::theme::heading(ui,"INTERFACE");
                    egui::CollapsingHeader::new("Display & panels").default_open(true).show(ui,|ui|{
                        if visible("interface scale"){let mut percent=self.settings.ui_scale*100.;row(ui,"UI scale / %",&mut percent,65.0..=200.0,100.);self.settings.ui_scale=percent/100.;}
                        if visible("animation strength"){row(ui,"Animation strength",&mut self.settings.animation,0.0..=2.0,1.);}
                        ui.small_text("Ctrl + wheel: scale UI · Ctrl+0: reset. Canvas zoom is separate.");
                    });
                }
                if self.settings_tab==2 || !search.is_empty(){
                    crate::theme::heading(ui,"WORKSPACE PANELS");
                    ui.text("Drag a panel tab to an edge or another tab group. Release on the highlighted target to dock. Escape cancels; release outside cancels too.");
                    for id in crate::workspace::PANELS {
                        if !visible(id.definition().title) {continue;}
                        ui.push_id(id,|ui| {
                            let mut shown=self.workspace.layout.contains(&id);
                            if ui.add_enabled(id.definition().closable,egui::Checkbox::new(&mut shown,id.definition().title)).changed(){
                                if let Err(e)=self.workspace.set_visible(id,shown){self.error=Some(e.to_string());}
                                self.browser.open=self.workspace.layout.contains(&crate::workspace::PanelId::ContentBrowser);
                            }
                            let settings=self.workspace.settings.entry(id).or_default();
                            ui.hbox(|ui| {
                                if ui.add_enabled(id.definition().movable,egui::Checkbox::new(&mut settings.locked,"Lock position")).changed(){self.workspace.dirty=true;}
                                egui::ComboBox::from_id_salt("animation-policy").selected_text(format!("Animation: {:?}",settings.components.animation)).show_ui(ui,|ui|{
                                    for (value,label) in [(crate::ui_core::Feature::Inherit,"Use global"),(crate::ui_core::Feature::On,"On"),(crate::ui_core::Feature::Off,"Off")] {
                                        if ui.selectable_value(&mut settings.components.animation,value,label).changed(){self.workspace.dirty=true;}
                                    }
                                });
                            });
                        });
                    }
                    if ui.action("Reset workspace layout").clicked(){self.workspace=crate::workspace::Workspace::default();self.workspace.dirty=true;self.browser.open=false;}
                }
                if self.settings_tab==1 || !search.is_empty(){
                    crate::theme::heading(ui,"INTERACTION");
                    egui::CollapsingHeader::new("Adaptive zones").default_open(true).show(ui,|ui|{
                        if visible("base radius"){row(ui,"Base radius / DIP",&mut self.settings.base_radius,8.0..=32.0,16.);}
                        if visible("fast motion expansion"){row(ui,"Motion expansion",&mut self.settings.max_expansion,0.0..=64.0,28.);}
                        if visible("speed coefficient"){row(ui,"Speed coefficient",&mut self.settings.speed_coefficient,0.0..=0.2,0.04);}
                        if visible("distance influence"){row(ui,"Distance influence",&mut self.settings.influence,40.0..=400.0,160.);}
                        if visible("zone shrink"){row(ui,"Zone shrink / s",&mut self.settings.shrink_speed,10.0..=400.0,88.);}
                    });
                    egui::CollapsingHeader::new("Transform shortcuts").default_open(true).show(ui,|ui|ui.small_text("Corners: proportional; Shift: free. Edges: one axis; Shift: proportional. Alt: center. Ctrl: precision. Ring + Shift: 15° snap. Esc: cancel."));
                }
            });
        });
        self.settings_open = open;
        self.settings.sanitize();
        if serde_json::to_string(&self.settings).unwrap() != before {
            ctx.set_zoom_factor(self.settings.ui_scale);
            self.save_interface();
        }
    }
}
