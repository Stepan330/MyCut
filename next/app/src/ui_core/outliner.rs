//! Dense tree/table presentation. IDs and scene ownership remain with the caller.
use super::unreal_theme as colors;
use crate::icons::{Icon, paint_icon};
use eframe::egui::{self, Align2, Color32, FontId, Rect, Sense, Stroke, Vec2};

pub struct OutlinerRow<'a> {
    pub id: u64,
    pub label: &'a str,
    pub kind: &'a str,
    pub icon: Icon,
    pub visible: bool,
}
#[derive(Default)]
pub struct Outliner {
    pub search: String,
    collapsed_roots: std::collections::HashSet<usize>,
    pub descending: bool,
    pub sort_by_type: bool,
    /// Layer stacks start in caller order; explicit header sorting only changes the view.
    pub preserve_order: bool,
}
pub struct OutlinerOptions<'a> {
    pub roots: &'a [(&'a str, &'a str)],
    pub max_height: f32,
    pub noun: &'a str,
}
impl Default for OutlinerOptions<'_> {
    fn default() -> Self {
        Self {
            roots: &[("Untitled (Editor)", "World")],
            max_height: f32::INFINITY,
            noun: "objects",
        }
    }
}
#[derive(Debug, PartialEq)]
pub enum Action {
    Select(u64),
    ToggleVisibility(u64),
}

impl Outliner {
    pub fn in_scene_order() -> Self {
        Self {
            preserve_order: true,
            ..Default::default()
        }
    }
    fn ordered<'a>(&self, rows: &'a [OutlinerRow<'a>]) -> Vec<&'a OutlinerRow<'a>> {
        let query = self.search.trim().to_lowercase();
        let mut result: Vec<_> = rows
            .iter()
            .filter(|r| {
                query.is_empty()
                    || r.label.to_lowercase().contains(&query)
                    || r.kind.to_lowercase().contains(&query)
            })
            .collect();
        if !self.preserve_order {
            result.sort_by_cached_key(|r| {
                let primary = if self.sort_by_type { r.kind } else { r.label };
                (primary.to_lowercase(), r.label.to_lowercase(), r.id)
            });
        }
        if self.descending && !self.preserve_order {
            result.reverse();
        }
        result
    }
    pub fn show(
        &mut self,
        ui: &mut egui::Ui,
        rows: &[OutlinerRow<'_>],
        selected: Option<u64>,
        options: OutlinerOptions<'_>,
    ) -> Vec<Action> {
        // Common styling must not leak into other panels or depend on the host's skin.
        ui.scope(|ui| {
            colors::apply(ui);
            self.show_inner(ui, rows, selected, options)
        })
        .inner
    }
    fn show_inner(
        &mut self,
        ui: &mut egui::Ui,
        rows: &[OutlinerRow<'_>],
        selected: Option<u64>,
        options: OutlinerOptions<'_>,
    ) -> Vec<Action> {
        let mut actions = Vec::new();
        ui.spacing_mut().item_spacing.y = 0.;
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = 4.;
            let (search_icon, _) = ui.allocate_exact_size(Vec2::splat(16.), Sense::hover());
            paint_icon(
                ui.painter(),
                search_icon.shrink(2.),
                Icon::Search,
                colors::FOREGROUND,
            );
            let clear_width = 22.;
            ui.add(
                egui::TextEdit::singleline(&mut self.search)
                    .hint_text("Search…")
                    .desired_width((ui.available_width() - clear_width - 4.).max(20.)),
            );
            if ui
                .add_enabled(!self.search.is_empty(), egui::Button::new("×").frame(false))
                .on_hover_text("Clear search")
                .clicked()
            {
                self.search.clear();
            }
        });
        ui.add_space(5.);
        let width = ui.available_width();
        let (header, _) = ui.allocate_exact_size(Vec2::new(width, 22.), Sense::hover());
        // Shrink the type column with the panel; never push labels outside the clip.
        let type_x = header.right() - (width * 0.32).clamp(38., 110.);
        ui.painter().rect_filled(header, 0., colors::HEADER);
        for x in [header.left() + 24., type_x] {
            ui.painter().line_segment(
                [egui::pos2(x, header.top()), egui::pos2(x, header.bottom())],
                Stroke::new(1., colors::INPUT),
            );
        }
        eye(
            ui.painter(),
            Rect::from_center_size(
                egui::pos2(header.left() + 12., header.center().y),
                Vec2::splat(12.),
            ),
            true,
            colors::FOREGROUND,
        );
        for (is_type, title, rect) in [
            (
                false,
                "Item Label",
                Rect::from_min_max(
                    header.min + egui::vec2(26., 0.),
                    egui::pos2(type_x, header.bottom()),
                ),
            ),
            (
                true,
                "Type",
                Rect::from_min_max(egui::pos2(type_x + 3., header.top()), header.max),
            ),
        ] {
            text(ui, rect, title, colors::FOREGROUND);
            if !self.preserve_order && self.sort_by_type == is_type && rect.width() > 74. {
                let c = rect.left_center() + egui::vec2(if is_type { 36. } else { 69. }, 0.);
                let direction = if self.descending { -1. } else { 1. };
                ui.painter().add(egui::Shape::convex_polygon(
                    vec![
                        c + egui::vec2(-3., 2. * direction),
                        c + egui::vec2(3., 2. * direction),
                        c + egui::vec2(0., -2. * direction),
                    ],
                    colors::FOREGROUND,
                    Stroke::NONE,
                ));
            }
            if ui
                .interact(rect, ui.id().with(("sort", is_type)), Sense::click())
                .on_hover_text("Sort objects; scene order is unchanged")
                .clicked()
            {
                if self.preserve_order {
                    self.sort_by_type = is_type;
                    self.descending = false;
                    self.preserve_order = false;
                } else if self.sort_by_type == is_type {
                    self.descending = !self.descending;
                } else {
                    self.sort_by_type = is_type;
                    self.descending = false;
                }
            }
        }
        let ordered = self.ordered(rows);
        let count = ordered.len();
        let height = (ui.available_height() - 23.)
            .min(options.max_height)
            .max(0.);
        egui::ScrollArea::vertical()
            .auto_shrink([false, false])
            .max_height(height)
            .show(ui, |ui| {
                ui.set_min_height(height);
                let mut open = true;
                for (depth, (label, kind)) in options.roots.iter().enumerate() {
                    open = self.root_open(depth);
                    let (root, response) = ui
                        .allocate_exact_size(Vec2::new(ui.available_width(), 20.), Sense::click());
                    ui.painter().rect_filled(root, 0., colors::RECESSED);
                    let x = root.left() + 34. + depth as f32 * 12.;
                    let y = root.center().y;
                    let points = if open {
                        vec![
                            egui::pos2(x - 4., y - 3.),
                            egui::pos2(x + 4., y - 3.),
                            egui::pos2(x, y + 3.),
                        ]
                    } else {
                        vec![
                            egui::pos2(x - 3., y - 4.),
                            egui::pos2(x - 3., y + 4.),
                            egui::pos2(x + 3., y),
                        ]
                    };
                    ui.painter().add(egui::Shape::convex_polygon(
                        points,
                        colors::FOREGROUND,
                        Stroke::NONE,
                    ));
                    paint_icon(
                        ui.painter(),
                        Rect::from_center_size(egui::pos2(x + 17., y), Vec2::splat(12.)),
                        Icon::Cube,
                        colors::FOREGROUND,
                    );
                    text(
                        ui,
                        Rect::from_min_max(
                            root.min + egui::vec2(64. + depth as f32 * 12., 0.),
                            egui::pos2(type_x, root.bottom()),
                        ),
                        label,
                        colors::FOREGROUND,
                    );
                    text(
                        ui,
                        Rect::from_min_max(egui::pos2(type_x + 3., root.top()), root.max),
                        kind,
                        colors::FOREGROUND,
                    );
                    if response.clicked() {
                        if !self.collapsed_roots.remove(&depth) {
                            self.collapsed_roots.insert(depth);
                        }
                        open = self.root_open(depth);
                    }
                    if !open {
                        break;
                    }
                }
                if open {
                    for (index, row) in ordered.iter().enumerate() {
                        let (rect, _) = ui.allocate_exact_size(
                            Vec2::new(ui.available_width(), 20.),
                            Sense::hover(),
                        );
                        if let Some(action) =
                            show_row(ui, rect, type_x, row, selected == Some(row.id), index)
                        {
                            actions.push(action);
                        }
                    }
                    if count == 0 {
                        ui.add_space(8.);
                        ui.weak("No matching objects");
                    }
                }
            });
        ui.separator();
        ui.add_space(3.);
        ui.label(
            egui::RichText::new(format!(
                "{count} of {} {} · {} selected",
                rows.len(),
                options.noun,
                usize::from(rows.iter().any(|r| Some(r.id) == selected))
            ))
            .size(11.)
            .color(colors::FOREGROUND),
        );
        actions
    }
    fn root_open(&self, depth: usize) -> bool {
        !self.collapsed_roots.contains(&depth) || !self.search.trim().is_empty()
    }
}

fn text(ui: &egui::Ui, rect: Rect, label: &str, color: Color32) {
    if rect.width() <= 0. {
        return;
    }
    ui.painter()
        .with_clip_rect(rect.intersect(ui.clip_rect()))
        .text(
            rect.left_center(),
            Align2::LEFT_CENTER,
            label,
            FontId::proportional(12.),
            color,
        );
}
fn eye(p: &egui::Painter, r: Rect, visible: bool, color: Color32) {
    let c = r.center();
    let s = Stroke::new(1., color);
    p.add(egui::Shape::closed_line(
        vec![
            egui::pos2(r.left(), c.y),
            c + egui::vec2(-2., -3.),
            c + egui::vec2(2., -3.),
            egui::pos2(r.right(), c.y),
            c + egui::vec2(2., 3.),
            c + egui::vec2(-2., 3.),
        ],
        s,
    ));
    p.circle_filled(c, 1.7, color);
    if !visible {
        p.line_segment([r.left_bottom(), r.right_top()], s);
    }
}
fn show_row(
    ui: &mut egui::Ui,
    rect: Rect,
    type_x: f32,
    row: &OutlinerRow<'_>,
    selected: bool,
    index: usize,
) -> Option<Action> {
    // Disjoint hit rectangles: clicking the eye must not change selection.
    let eye_rect = Rect::from_min_max(rect.min, egui::pos2(rect.left() + 24., rect.bottom()));
    let label_rect = Rect::from_min_max(egui::pos2(eye_rect.right(), rect.top()), rect.max);
    let response = ui.interact(
        label_rect,
        ui.id().with(("outliner-select", row.id)),
        Sense::click(),
    );
    let eye_response = ui.interact(
        eye_rect,
        ui.id().with(("outliner-eye", row.id)),
        Sense::click(),
    );
    let background = if selected {
        colors::PRIMARY
    } else if response.hovered() || eye_response.hovered() {
        colors::PANEL
    } else if index.is_multiple_of(2) {
        colors::RECESSED
    } else {
        colors::BACKGROUND
    };
    ui.painter().rect_filled(rect, 0., background);
    let color = if selected {
        Color32::WHITE
    } else if row.visible {
        colors::FOREGROUND
    } else {
        colors::HOVER
    };
    eye(
        ui.painter(),
        eye_rect.shrink2(egui::vec2(6., 4.)),
        row.visible,
        color,
    );
    paint_icon(
        ui.painter(),
        Rect::from_center_size(rect.left_center() + egui::vec2(52., 0.), Vec2::splat(12.)),
        row.icon,
        color,
    );
    text(
        ui,
        Rect::from_min_max(
            rect.min + egui::vec2(64., 0.),
            egui::pos2(type_x, rect.bottom()),
        ),
        row.label,
        color,
    );
    text(
        ui,
        Rect::from_min_max(egui::pos2(type_x + 3., rect.top()), rect.max),
        row.kind,
        color,
    );
    response
        .clone()
        .on_hover_text(format!("{} · {}", row.label, row.kind));
    eye_response.clone().on_hover_text(if row.visible {
        "Hide object"
    } else {
        "Show object"
    });
    if eye_response.clicked() {
        Some(Action::ToggleVisibility(row.id))
    } else if response.clicked() {
        Some(Action::Select(row.id))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn layer_order_and_large_document_ids_survive_filtering() {
        let rows = [
            OutlinerRow {
                id: u64::MAX,
                label: "Z top",
                kind: "Raster",
                icon: Icon::Image,
                visible: true,
            },
            OutlinerRow {
                id: 1,
                label: "A bottom",
                kind: "Text",
                icon: Icon::Text,
                visible: true,
            },
        ];
        let mut view = Outliner::in_scene_order();
        assert_eq!(
            view.ordered(&rows).iter().map(|r| r.id).collect::<Vec<_>>(),
            [u64::MAX, 1]
        );
        view.search = "text".into();
        assert_eq!(view.ordered(&rows)[0].id, 1);
        view.search.clear();
        assert_eq!(view.ordered(&rows)[0].id, u64::MAX);
    }
    #[test]
    fn roots_collapse_independently_and_search_does_not_destroy_state() {
        let mut view = Outliner::default();
        view.collapsed_roots.insert(0);
        assert!(!view.root_open(0));
        assert!(view.root_open(1));
        view.search = "Title".into();
        assert!(view.root_open(0));
        view.search.clear();
        assert!(!view.root_open(0));
    }
    #[test]
    fn search_and_sort_keep_scene_ids_and_order() {
        let rows = [
            OutlinerRow {
                id: 8,
                label: "Zebra",
                kind: "Image",
                icon: Icon::Cube,
                visible: true,
            },
            OutlinerRow {
                id: 3,
                label: "Alpha",
                kind: "Text",
                icon: Icon::Text,
                visible: false,
            },
        ];
        let mut tree = Outliner::default();
        assert_eq!(
            tree.ordered(&rows).iter().map(|r| r.id).collect::<Vec<_>>(),
            [3, 8]
        );
        tree.search = " IMAGE ".into();
        assert_eq!(tree.ordered(&rows)[0].id, 8);
        tree.search.clear();
        tree.descending = true;
        assert_eq!(tree.ordered(&rows)[0].id, 8);
        assert_eq!(rows[0].id, 8);
        assert!(!rows[1].visible);
    }
    #[test]
    fn full_row_and_eye_have_independent_click_targets() {
        let ctx = egui::Context::default();
        let row = OutlinerRow {
            id: 7,
            label: "Title",
            kind: "Text",
            icon: Icon::Text,
            visible: true,
        };
        let mut action = None;
        let mut frame = |events| {
            let mut output = ctx.run_ui(
                egui::RawInput {
                    events,
                    ..Default::default()
                },
                |ui| {
                    action = show_row(
                        ui,
                        Rect::from_min_size(egui::pos2(10., 10.), egui::vec2(300., 20.)),
                        220.,
                        &row,
                        false,
                        0,
                    );
                },
            );
            output.textures_delta.clear();
            action.take()
        };
        for (x, expected) in [
            (285., Action::Select(7)),
            (20., Action::ToggleVisibility(7)),
        ] {
            let pos = egui::pos2(x, 20.);
            frame(vec![egui::Event::PointerMoved(pos)]);
            frame(vec![egui::Event::PointerButton {
                pos,
                button: egui::PointerButton::Primary,
                pressed: true,
                modifiers: egui::Modifiers::NONE,
            }]);
            assert_eq!(
                frame(vec![egui::Event::PointerButton {
                    pos,
                    button: egui::PointerButton::Primary,
                    pressed: false,
                    modifiers: egui::Modifiers::NONE
                }]),
                Some(expected)
            );
        }
    }
}
