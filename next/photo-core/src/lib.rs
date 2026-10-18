//! Independent raster photo slice. No GUI, GPU, scene or animation dependency.
//! Raster actions are destructive edits, NOT a second parameter/effect system.
use base64::{Engine, engine::general_purpose::STANDARD};
use image::{DynamicImage, ImageFormat, Rgba, RgbaImage, imageops};
use serde::{Deserialize, Serialize};
use std::{
    io::{Cursor, Read, Write},
    path::Path,
    sync::Arc,
};
mod text;
mod transform;
pub use text::{TextSpec, render_text};
pub use transform::Transform;

pub type Result<T> = std::result::Result<T, String>;
pub const MAX_PIXELS: u64 = 16_777_216;
pub const MAX_LAYERS: usize = 32;
const MAX_DOCUMENT_BYTES: usize = 256 * 1024 * 1024;
const MAX_FILE_BYTES: u64 = 192 * 1024 * 1024;

fn dimensions(w: u32, h: u32) -> Result<()> {
    if w == 0 || h == 0 || w > 16384 || h > 16384 || u64::from(w) * u64::from(h) > MAX_PIXELS {
        return Err("Image size must be 1–16384 per axis and at most 16 megapixels".into());
    }
    Ok(())
}

pub fn decode(bytes: &[u8]) -> Result<RgbaImage> {
    let mut reader = image::ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .map_err(|e| e.to_string())?;
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(16384);
    limits.max_image_height = Some(16384);
    limits.max_alloc = Some(MAX_PIXELS * 8);
    reader.limits(limits);
    use image::ImageDecoder;
    let decoder = reader.into_decoder().map_err(|e| e.to_string())?;
    let (w, h) = decoder.dimensions();
    dimensions(w, h)?;
    let decoded = DynamicImage::from_decoder(decoder).map_err(|e| e.to_string())?;
    Ok(decoded.into_rgba8())
}

fn read_bounded(path: &Path) -> Result<Vec<u8>> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    if file.metadata().map_err(|e| e.to_string())?.len() > MAX_FILE_BYTES {
        return Err("File exceeds 192 MiB safety limit".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_FILE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err("File exceeds safety limit".into());
    }
    Ok(bytes)
}

#[derive(Clone)]
pub struct Layer {
    pub id: u64,
    pub name: String,
    pub visible: bool,
    pub locked: bool,
    pub opacity: f32,
    pub x: i32,
    pub y: i32,
    pub pixels: Arc<RgbaImage>,
    pub transform: Transform,
    pub text: Option<TextSpec>,
}

#[derive(Clone)]
pub struct Document {
    pub width: u32,
    pub height: u32,
    pub layers: Vec<Layer>,
    pub selected: Option<u64>,
    next_id: u64,
}

#[derive(Clone, Copy)]
pub enum RasterAction {
    FlipX,
    FlipY,
    RotateRight,
    Grayscale,
    Invert,
    Blur(f32),
    Brightness(i32),
    Contrast(f32),
}

impl Document {
    pub fn new(width: u32, height: u32) -> Result<Self> {
        dimensions(width, height)?;
        Ok(Self {
            width,
            height,
            layers: vec![],
            selected: None,
            next_id: 1,
        })
    }
    pub fn from_image(path: &Path) -> Result<Self> {
        let pixels = decode(&read_bounded(path)?)?;
        let mut doc = Self::new(pixels.width(), pixels.height())?;
        doc.add_image(
            path.file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
            pixels,
        )?;
        Ok(doc)
    }
    pub fn add_image(&mut self, name: String, pixels: RgbaImage) -> Result<u64> {
        dimensions(pixels.width(), pixels.height())?;
        if self.layers.len() >= MAX_LAYERS
            || self.byte_size() + pixels.as_raw().len() > MAX_DOCUMENT_BYTES
        {
            return Err("Document layer/memory limit reached (32 layers / 256 MiB)".into());
        }
        let id = self.next_id;
        self.next_id = self
            .next_id
            .checked_add(1)
            .ok_or("Layer ID space exhausted")?;
        self.layers.push(Layer {
            id,
            name,
            visible: true,
            locked: false,
            opacity: 1.0,
            x: 0,
            y: 0,
            pixels: Arc::new(pixels),
            transform: Transform::default(),
            text: None,
        });
        self.selected = Some(id);
        Ok(id)
    }
    pub fn import_layer(&mut self, path: &Path) -> Result<u64> {
        let image = decode(&read_bounded(path)?)?;
        self.add_image(
            path.file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned(),
            image,
        )
    }
    pub fn byte_size(&self) -> usize {
        self.layers.iter().map(|l| l.pixels.as_raw().len()).sum()
    }
    pub fn selected(&self) -> Option<&Layer> {
        self.layers.iter().find(|l| Some(l.id) == self.selected)
    }
    pub fn selected_mut(&mut self) -> Option<&mut Layer> {
        self.layers.iter_mut().find(|l| Some(l.id) == self.selected)
    }
    pub fn hit_test(&self, x: i32, y: i32) -> Option<u64> {
        self.layers
            .iter()
            .rev()
            .find(|l| {
                let local = l.local_point([x as f32 + 0.5, y as f32 + 0.5]);
                let lx = local[0].floor() as i64;
                let ly = local[1].floor() as i64;
                l.visible
                    && l.opacity > 0.0
                    && lx >= 0
                    && ly >= 0
                    && lx < i64::from(l.pixels.width())
                    && ly < i64::from(l.pixels.height())
                    && l.pixels.get_pixel(lx as u32, ly as u32)[3] > 0
            })
            .map(|l| l.id)
    }
    pub fn composite(&self) -> RgbaImage {
        let mut output = RgbaImage::new(self.width, self.height);
        for layer in self.layers.iter().filter(|l| l.visible && l.opacity > 0.0) {
            if layer.transform != Transform::default() {
                if let Some((mut raster, x, y)) = layer.transformed_raster(self.width, self.height)
                {
                    if layer.opacity < 1.0 {
                        for p in raster.pixels_mut() {
                            p[3] = (p[3] as f32 * layer.opacity).round() as u8;
                        }
                    }
                    imageops::overlay(&mut output, &raster, x, y);
                }
                continue;
            }
            if layer.opacity >= 1.0 {
                imageops::overlay(
                    &mut output,
                    layer.pixels.as_ref(),
                    i64::from(layer.x),
                    i64::from(layer.y),
                );
            } else {
                let mut faded = layer.pixels.as_ref().clone();
                for p in faded.pixels_mut() {
                    p[3] = (f32::from(p[3]) * layer.opacity.clamp(0.0, 1.0)).round() as u8;
                }
                imageops::overlay(&mut output, &faded, i64::from(layer.x), i64::from(layer.y));
            }
        }
        output
    }
    pub fn apply(&mut self, action: RasterAction) -> Result<()> {
        let layer = self.selected_mut().ok_or("Select a layer first")?;
        if layer.locked || layer.text.is_some() {
            return Err(
                "Layer is locked or editable text; rasterize text before applying raster filters"
                    .into(),
            );
        }
        let p = layer.pixels.as_ref();
        let output = match action {
            RasterAction::FlipX => imageops::flip_horizontal(p),
            RasterAction::FlipY => imageops::flip_vertical(p),
            RasterAction::RotateRight => imageops::rotate90(p),
            RasterAction::Grayscale => DynamicImage::ImageRgba8(p.clone()).grayscale().into_rgba8(),
            RasterAction::Invert => {
                let mut q = p.clone();
                imageops::invert(&mut q);
                q
            }
            RasterAction::Blur(s) if s.is_finite() && (0.1..=30.0).contains(&s) => {
                imageops::blur(p, s)
            }
            RasterAction::Brightness(v) => imageops::brighten(p, v.clamp(-255, 255)),
            RasterAction::Contrast(v) if v.is_finite() => {
                imageops::contrast(p, v.clamp(-99.0, 99.0))
            }
            _ => return Err("Invalid filter value".into()),
        };
        layer.pixels = Arc::new(output);
        Ok(())
    }
    pub fn resize(&mut self, w: u32, h: u32) -> Result<()> {
        dimensions(w, h)?;
        // Whole-canvas resampling intentionally flattens this destructive operation.
        let resized = imageops::resize(&self.composite(), w, h, imageops::FilterType::Lanczos3);
        *self = Self::new(w, h)?;
        self.add_image("Resized image".into(), resized)?;
        Ok(())
    }
    pub fn crop(&mut self, x: u32, y: u32, w: u32, h: u32) -> Result<()> {
        dimensions(w, h)?;
        if x.checked_add(w).is_none_or(|v| v > self.width)
            || y.checked_add(h).is_none_or(|v| v > self.height)
        {
            return Err("Crop outside canvas".into());
        }
        // Preserve layers and their original raster data; only change canvas and offsets.
        for l in &mut self.layers {
            l.x = l.x.saturating_sub(x as i32);
            l.y = l.y.saturating_sub(y as i32);
        }
        self.width = w;
        self.height = h;
        Ok(())
    }
    pub fn stroke(
        &mut self,
        from: [f32; 2],
        to: [f32; 2],
        radius: f32,
        color: [u8; 4],
        erase: bool,
    ) -> bool {
        if !radius.is_finite()
            || !(0.5..=256.0).contains(&radius)
            || from.into_iter().chain(to).any(|v| !v.is_finite())
        {
            return false;
        }
        let Some(layer) = self
            .selected_mut()
            .filter(|l| !l.locked && l.visible && l.text.is_none())
        else {
            return false;
        };
        let a = layer.local_point(from);
        let b = layer.local_point(to);
        let local_radius = radius / layer.transform.scale[0].min(layer.transform.scale[1]);
        let transform = layer.transform;
        let origin = layer.world_point([0., 0.]);
        let (sine, cosine) = transform.rotation.sin_cos();
        let image = Arc::make_mut(&mut layer.pixels);
        let minx = (a[0].min(b[0]) - local_radius).floor().max(0.0) as u32;
        let miny = (a[1].min(b[1]) - local_radius).floor().max(0.0) as u32;
        let maxx = (a[0].max(b[0]) + local_radius)
            .ceil()
            .clamp(0.0, image.width() as f32) as u32;
        let maxy = (a[1].max(b[1]) + local_radius)
            .ceil()
            .clamp(0.0, image.height() as f32) as u32;
        let dx = to[0] - from[0];
        let dy = to[1] - from[1];
        let len = dx * dx + dy * dy;
        let mut changed = false;
        for y in miny..maxy {
            for x in minx..maxx {
                let px =
                    (x as f32 + 0.5) * transform.scale[0] * if transform.flip_x { -1. } else { 1. };
                let py =
                    (y as f32 + 0.5) * transform.scale[1] * if transform.flip_y { -1. } else { 1. };
                let world = [
                    origin[0] + px * cosine - py * sine,
                    origin[1] + px * sine + py * cosine,
                ];
                let q = [world[0] - from[0], world[1] - from[1]];
                let t = if len > 0.0 {
                    ((q[0] * dx + q[1] * dy) / len).clamp(0.0, 1.0)
                } else {
                    0.0
                };
                if (q[0] - t * dx).powi(2) + (q[1] - t * dy).powi(2) <= radius * radius {
                    let p = image.get_pixel_mut(x, y);
                    if erase {
                        p[3] = 0;
                    } else {
                        use image::Pixel;
                        p.blend(&Rgba(color));
                    }
                    changed = true;
                }
            }
        }
        changed
    }
    pub fn export(&self, path: &Path) -> Result<()> {
        let extension = path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_ascii_lowercase();
        let image = if extension == "jpg" || extension == "jpeg" {
            let mut white =
                RgbaImage::from_pixel(self.width, self.height, Rgba([255, 255, 255, 255]));
            imageops::overlay(&mut white, &self.composite(), 0, 0);
            DynamicImage::ImageRgba8(white).into_rgb8().into()
        } else {
            DynamicImage::ImageRgba8(self.composite())
        };
        let format =
            ImageFormat::from_extension(&extension).ok_or("Choose PNG, JPEG, TIFF, BMP or WebP")?;
        let mut bytes = Cursor::new(Vec::new());
        image
            .write_to(&mut bytes, format)
            .map_err(|e| e.to_string())?;
        atomic_write(path, &bytes.into_inner())
    }
    pub fn save(&self, path: &Path) -> Result<()> {
        if self
            .layers
            .iter()
            .any(|l| !l.transform.valid() || l.text.as_ref().is_some_and(|s| !s.valid()))
        {
            return Err("Invalid transform or text metadata".into());
        }
        if !path
            .extension()
            .is_some_and(|e| e.eq_ignore_ascii_case("mycutnext"))
        {
            return Err("Use .mycutnext; legacy .mycut files are not overwritten".into());
        }
        let layers = self
            .layers
            .iter()
            .map(|l| {
                let mut png = Cursor::new(Vec::new());
                l.pixels
                    .write_to(&mut png, ImageFormat::Png)
                    .map_err(|e| e.to_string())?;
                Ok(SavedLayer {
                    id: l.id,
                    name: l.name.clone(),
                    visible: l.visible,
                    locked: l.locked,
                    opacity: l.opacity,
                    x: l.x,
                    y: l.y,
                    png: STANDARD.encode(png.into_inner()),
                    transform: l.transform,
                    text: l.text.clone(),
                })
            })
            .collect::<Result<Vec<_>>>()?;
        let saved = SavedDocument {
            format: "MyCutNextRaster".into(),
            version: 2,
            width: self.width,
            height: self.height,
            selected: self.selected,
            layers,
        };
        let bytes = serde_json::to_vec(&saved).map_err(|e| e.to_string())?;
        if bytes.len() as u64 > MAX_FILE_BYTES {
            return Err("Encoded project exceeds safety limit".into());
        }
        atomic_write(path, &bytes)
    }
    pub fn open(path: &Path) -> Result<Self> {
        let saved: SavedDocument =
            serde_json::from_slice(&read_bounded(path)?).map_err(|e| e.to_string())?;
        if saved.format != "MyCutNextRaster"
            || !(1..=2).contains(&saved.version)
            || saved.layers.len() > MAX_LAYERS
        {
            return Err("Unsupported project format/version".into());
        }
        let mut doc = Self::new(saved.width, saved.height)?;
        for layer in saved.layers {
            if layer.id == 0
                || layer.id == u64::MAX
                || doc.layers.iter().any(|l| l.id == layer.id)
                || !layer.opacity.is_finite()
                || !(0.0..=1.0).contains(&layer.opacity)
                || layer.x.unsigned_abs() > 1_000_000
                || layer.y.unsigned_abs() > 1_000_000
                || !layer.transform.valid()
                || layer.text.as_ref().is_some_and(|s| !s.valid())
            {
                return Err("Invalid layer metadata".into());
            }
            let pixels = decode(&STANDARD.decode(layer.png).map_err(|e| e.to_string())?)?;
            if doc.byte_size() + pixels.as_raw().len() > MAX_DOCUMENT_BYTES {
                return Err("Document memory limit exceeded".into());
            }
            doc.next_id = doc.next_id.max(layer.id + 1);
            doc.layers.push(Layer {
                id: layer.id,
                name: layer.name,
                visible: layer.visible,
                locked: layer.locked,
                opacity: layer.opacity,
                x: layer.x,
                y: layer.y,
                pixels: Arc::new(pixels),
                transform: layer.transform,
                text: layer.text,
            });
        }
        doc.selected = saved
            .selected
            .filter(|id| doc.layers.iter().any(|l| l.id == *id));
        Ok(doc)
    }
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let mut file = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    file.write_all(bytes).map_err(|e| e.to_string())?;
    file.as_file().sync_all().map_err(|e| e.to_string())?;
    file.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}
#[derive(Serialize, Deserialize)]
struct SavedDocument {
    format: String,
    version: u32,
    width: u32,
    height: u32,
    selected: Option<u64>,
    layers: Vec<SavedLayer>,
}
#[derive(Serialize, Deserialize)]
struct SavedLayer {
    id: u64,
    name: String,
    visible: bool,
    locked: bool,
    opacity: f32,
    x: i32,
    y: i32,
    png: String,
    #[serde(default)]
    transform: Transform,
    #[serde(default)]
    text: Option<TextSpec>,
}

/// Snapshot/COW transaction history. One brush gesture creates one undo entry.
#[derive(Default)]
pub struct History {
    undo: Vec<Document>,
    redo: Vec<Document>,
    pending: Option<Document>,
}
impl History {
    pub fn begin(&mut self, doc: &Document) {
        if self.pending.is_none() {
            self.pending = Some(doc.clone());
        }
    }
    pub fn commit(&mut self) {
        if let Some(doc) = self.pending.take() {
            self.undo.push(doc);
            self.redo.clear();
            self.trim();
        }
    }
    fn trim(&mut self) {
        while self.undo.len() > 1
            && (self.undo.len() > 40
                || self.undo.iter().map(Document::byte_size).sum::<usize>() > 256 * 1024 * 1024)
        {
            self.undo.remove(0);
        }
    }
    pub fn cancel(&mut self, doc: &mut Document) {
        if let Some(old) = self.pending.take() {
            *doc = old;
        }
    }
    pub fn undo(&mut self, doc: &mut Document) {
        self.cancel(doc);
        if let Some(old) = self.undo.pop() {
            self.redo.push(std::mem::replace(doc, old));
        }
    }
    pub fn redo(&mut self, doc: &mut Document) {
        if self.pending.is_none()
            && let Some(new) = self.redo.pop()
        {
            self.undo.push(std::mem::replace(doc, new));
        }
    }
    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }
    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn sample() -> Document {
        let mut d = Document::new(8, 6).unwrap();
        d.add_image(
            "Red".into(),
            RgbaImage::from_pixel(8, 6, Rgba([255, 0, 0, 255])),
        )
        .unwrap();
        d
    }
    #[test]
    fn reject_bad_dimensions() {
        assert!(Document::new(0, 1).is_err());
        assert!(Document::new(16384, 16384).is_err());
    }
    #[test]
    fn version_one_projects_receive_identity_transform_and_no_text() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("v1.mycutnext");
        let d = sample();
        d.save(&path).unwrap();
        let mut v: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        v["version"] = serde_json::json!(1);
        for l in v["layers"].as_array_mut().unwrap() {
            l.as_object_mut().unwrap().remove("transform");
            l.as_object_mut().unwrap().remove("text");
        }
        std::fs::write(&path, serde_json::to_vec(&v).unwrap()).unwrap();
        let read = Document::open(&path).unwrap();
        assert_eq!(read.composite(), d.composite());
        assert_eq!(read.layers[0].transform, Transform::default());
        assert!(read.layers[0].text.is_none());
    }
    #[test]
    fn flip_is_nondestructive_pixel_exact_and_pickable() {
        let mut d = Document::new(4, 2).unwrap();
        let pixels =
            RgbaImage::from_fn(4, 2, |x, y| Rgba([(x * 60) as u8, (y * 90) as u8, 10, 255]));
        d.add_image("flip".into(), pixels.clone()).unwrap();
        d.selected_mut().unwrap().transform.flip_x = true;
        let result = d.composite();
        assert_eq!(result.get_pixel(0, 0), pixels.get_pixel(3, 0));
        assert_eq!(d.hit_test(0, 0), d.selected);
        assert_eq!(d.layers[0].pixels.as_ref(), &pixels);
        d.selected_mut().unwrap().transform.flip_y = true;
        assert_eq!(d.composite().get_pixel(0, 0), pixels.get_pixel(3, 1));
    }
    #[test]
    fn text_metadata_and_cached_pixels_open_without_font_file() {
        let mut d = sample();
        d.selected_mut().unwrap().text = Some(TextSpec {
            content: "Привет".into(),
            size: 32.,
            color: [255; 4],
            font: "missing-font.ttf".into(),
        });
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("text.mycutnext");
        d.save(&path).unwrap();
        let loaded = Document::open(&path).unwrap();
        assert_eq!(loaded.layers[0].text, d.layers[0].text);
        assert_eq!(loaded.composite(), d.composite());
    }
    #[test]
    fn transformed_pick_composite_and_roundtrip_agree() {
        let mut d = Document::new(32, 24).unwrap();
        d.add_image(
            "transformed".into(),
            RgbaImage::from_pixel(4, 2, Rgba([255, 0, 0, 255])),
        )
        .unwrap();
        let l = d.selected_mut().unwrap();
        l.x = 5;
        l.y = 6;
        l.transform.scale = [2., 3.];
        l.transform.rotation = std::f32::consts::FRAC_PI_2;
        assert_eq!(d.hit_test(3, 10), d.selected);
        assert!(d.composite().get_pixel(3, 10)[3] > 0);
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("transform.mycutnext");
        d.save(&path).unwrap();
        let read = Document::open(&path).unwrap();
        assert_eq!(read.layers[0].transform, d.layers[0].transform);
        assert_eq!(read.composite(), d.composite());
    }
    #[test]
    fn compose_visibility_opacity() {
        let mut d = sample();
        d.selected_mut().unwrap().opacity = 0.5;
        assert_eq!(d.composite().get_pixel(0, 0)[3], 128);
        d.selected_mut().unwrap().visible = false;
        assert_eq!(d.composite().get_pixel(0, 0)[3], 0);
    }
    #[test]
    fn stroke_undo_redo_and_cancel() {
        let mut d = sample();
        let mut h = History::default();
        h.begin(&d);
        assert!(d.stroke([1., 1.], [5., 1.], 1., [0, 255, 0, 255], false));
        h.commit();
        assert_eq!(d.composite().get_pixel(3, 1)[1], 255);
        h.undo(&mut d);
        assert_eq!(d.composite().get_pixel(3, 1)[0], 255);
        h.redo(&mut d);
        assert_eq!(d.composite().get_pixel(3, 1)[1], 255);
        h.begin(&d);
        d.layers.clear();
        h.cancel(&mut d);
        assert_eq!(d.layers.len(), 1);
    }
    #[test]
    fn locked_layer_rejects_edit() {
        let mut d = sample();
        d.selected_mut().unwrap().locked = true;
        assert!(d.apply(RasterAction::Invert).is_err());
        assert!(!d.stroke([0., 0.], [1., 1.], 2., [0; 4], true));
    }
    #[test]
    fn crop_preserves_rasters() {
        let mut d = sample();
        d.crop(2, 1, 4, 3).unwrap();
        assert_eq!((d.width, d.height), (4, 3));
        assert_eq!(d.layers[0].x, -2);
        assert_eq!(d.layers[0].pixels.dimensions(), (8, 6));
        assert!(d.crop(3, 0, 2, 3).is_err());
    }
    #[test]
    fn independent_duplicate_pixels() {
        let mut d = sample();
        let original = d.clone();
        d.stroke([0., 0.], [0., 0.], 2., [0; 4], true);
        assert_eq!(original.composite().get_pixel(0, 0)[3], 255);
        assert_eq!(d.composite().get_pixel(0, 0)[3], 0);
    }
    #[test]
    fn project_roundtrip_atomic_overwrite() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("doc.mycutnext");
        let mut d = sample();
        d.save(&path).unwrap();
        d.layers[0].name = "Русский слой".into();
        d.save(&path).unwrap();
        let got = Document::open(&path).unwrap();
        assert_eq!(got.layers[0].name, "Русский слой");
        assert_eq!(got.composite(), d.composite());
        assert!(d.save(&dir.path().join("old.mycut")).is_err());
    }
    #[test]
    fn png_and_jpeg_export() {
        let dir = tempfile::tempdir().unwrap();
        let d = sample();
        for ext in ["png", "jpg"] {
            let path = dir.path().join(format!("output.{ext}"));
            d.export(&path).unwrap();
            assert_eq!(Document::from_image(&path).unwrap().width, 8);
        }
    }
    #[test]
    fn transforms_and_invalid_filter() {
        let mut d = sample();
        d.apply(RasterAction::RotateRight).unwrap();
        assert_eq!(d.layers[0].pixels.dimensions(), (6, 8));
        assert!(d.apply(RasterAction::Blur(f32::NAN)).is_err());
        d.resize(4, 3).unwrap();
        assert_eq!(d.composite().dimensions(), (4, 3));
    }
    #[test]
    fn corruption_rejected() {
        assert!(decode(b"not an image").is_err());
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bad.mycutnext");
        std::fs::write(&path, b"{\"format\":\"wrong\"}").unwrap();
        assert!(Document::open(&path).is_err());
    }
    #[test]
    fn picking_uses_alpha_order_and_offsets() {
        let mut d = sample();
        let top = d
            .add_image(
                "top".into(),
                RgbaImage::from_pixel(2, 2, Rgba([0, 255, 0, 255])),
            )
            .unwrap();
        d.selected_mut().unwrap().x = 2;
        assert_eq!(d.hit_test(2, 0), Some(top));
        assert_eq!(d.hit_test(1, 0), Some(1));
        d.selected_mut().unwrap().visible = false;
        assert_eq!(d.hit_test(2, 0), Some(1));
        assert_eq!(d.hit_test(-1, 0), None);
    }
    #[test]
    fn duplicate_ids_and_nan_rejected_on_open() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("invalid.mycutnext");
        sample().save(&path).unwrap();
        let mut saved: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        let duplicate = saved["layers"][0].clone();
        saved["layers"].as_array_mut().unwrap().push(duplicate);
        std::fs::write(&path, serde_json::to_vec(&saved).unwrap()).unwrap();
        assert!(Document::open(&path).is_err());
        sample().save(&path).unwrap();
        let mut saved: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        // JSON cannot represent NaN; reject its null encoding and wrong ranges explicitly.
        for opacity in [serde_json::Value::Null, serde_json::json!(2.0)] {
            saved["layers"][0]["opacity"] = opacity;
            std::fs::write(&path, serde_json::to_vec(&saved).unwrap()).unwrap();
            assert!(Document::open(&path).is_err());
        }
    }
    #[test]
    fn transparent_jpeg_is_white() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("white.jpg");
        Document::new(4, 4).unwrap().export(&path).unwrap();
        let opened = Document::from_image(&path).unwrap();
        let p = *opened.layers[0].pixels.get_pixel(0, 0);
        assert!(p[0] > 250 && p[1] > 250 && p[2] > 250 && p[3] == 255);
    }
}
