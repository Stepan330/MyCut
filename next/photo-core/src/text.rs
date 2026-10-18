//! Plain LTR text adapter. ab_glyph owns font parsing, outline metrics and coverage.
use crate::{Result, dimensions};
use ab_glyph::{Font, FontRef, ScaleFont, point};
use image::{Pixel, Rgba, RgbaImage};
use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct TextSpec {
    pub content: String,
    pub size: f32,
    pub color: [u8; 4],
    pub font: String,
}
impl TextSpec {
    pub fn valid(&self) -> bool {
        self.content.len() <= 65536
            && self.size.is_finite()
            && (4.0..=512.0).contains(&self.size)
            && self.font.len() <= 2048
    }
}
pub fn render_text(spec: &TextSpec, bytes: &[u8]) -> Result<RgbaImage> {
    if !spec.valid() {
        return Err("Text limit: 64 KiB, font size 4–512 px".into());
    }
    let font = FontRef::try_from_slice(bytes).map_err(|_| "Invalid TrueType/OpenType font")?;
    let scaled = font.as_scaled(spec.size);
    let line_height = (scaled.height() + scaled.line_gap()).max(spec.size);
    let mut outlines = Vec::new();
    let (mut minx, mut miny, mut maxx, mut maxy) = (0_f32, 0_f32, 1_f32, line_height);
    let mut x = 0.;
    let mut baseline = scaled.ascent();
    let mut previous = None;
    for ch in spec.content.chars() {
        if ch == '\n' {
            x = 0.;
            baseline += line_height;
            previous = None;
            maxy = maxy.max(baseline - scaled.descent());
            continue;
        }
        if ch == '\r' {
            continue;
        }
        let id = font.glyph_id(ch);
        if let Some(last) = previous {
            x += scaled.kern(last, id);
        }
        let glyph = id.with_scale_and_position(spec.size, point(x, baseline));
        if let Some(outline) = font.outline_glyph(glyph) {
            let b = outline.px_bounds();
            minx = minx.min(b.min.x);
            miny = miny.min(b.min.y);
            maxx = maxx.max(b.max.x);
            maxy = maxy.max(b.max.y);
            outlines.push(outline);
        }
        x += scaled.h_advance(id);
        maxx = maxx.max(x);
        previous = Some(id);
    }
    let ox = 1. - minx.floor();
    let oy = 1. - miny.floor();
    let width = (maxx.ceil() - minx.floor() + 2.) as u32;
    let height = (maxy.ceil() - miny.floor() + 2.) as u32;
    dimensions(width, height)?;
    let mut output = RgbaImage::new(width, height);
    for outline in outlines {
        let b = outline.px_bounds();
        outline.draw(|x, y, coverage| {
            let px = (b.min.x + ox) as i32 + x as i32;
            let py = (b.min.y + oy) as i32 + y as i32;
            if px >= 0 && py >= 0 && px < width as i32 && py < height as i32 {
                let mut color = spec.color;
                color[3] = (color[3] as f32 * coverage).round() as u8;
                output
                    .get_pixel_mut(px as u32, py as u32)
                    .blend(&Rgba(color));
            }
        });
    }
    Ok(output)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn invalid_text_and_font_fail() {
        let mut s = TextSpec {
            content: "text".into(),
            size: f32::NAN,
            color: [255; 4],
            font: "Arial".into(),
        };
        assert!(render_text(&s, b"bad").is_err());
        s.size = 32.;
        assert!(render_text(&s, b"bad").is_err());
    }
    #[test]
    fn system_font_cyrillic_multiline_grows_without_clipping() {
        let Ok(bytes) = std::fs::read("C:/Windows/Fonts/arial.ttf") else {
            return;
        };
        let mut s = TextSpec {
            content: "Привет\nMyCut й".into(),
            size: 24.,
            color: [255; 4],
            font: "Arial".into(),
        };
        let small = render_text(&s, &bytes).unwrap();
        s.size = 48.;
        let big = render_text(&s, &bytes).unwrap();
        assert!(big.width() > small.width() && big.height() > small.height());
        assert!(big.pixels().any(|p| p[3] > 0));
        for x in 0..big.width() {
            assert_eq!(big.get_pixel(x, 0)[3], 0);
            assert_eq!(big.get_pixel(x, big.height() - 1)[3], 0);
        }
    }
}
