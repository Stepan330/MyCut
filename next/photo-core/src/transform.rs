use crate::Layer;
use image::RgbaImage;
use imageproc::geometric_transformations::{Interpolation, Projection, warp_into_with};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Transform {
    pub scale: [f32; 2],
    pub rotation: f32,
    pub offset: [f32; 2],
    pub flip_x: bool,
    pub flip_y: bool,
}
impl Default for Transform {
    fn default() -> Self {
        Self {
            scale: [1., 1.],
            rotation: 0.,
            offset: [0., 0.],
            flip_x: false,
            flip_y: false,
        }
    }
}
impl Transform {
    pub fn valid(&self) -> bool {
        self.scale
            .iter()
            .all(|v| v.is_finite() && (0.02..=100.).contains(v))
            && self.rotation.is_finite()
            && self.rotation.abs() < 100000.
            && self
                .offset
                .iter()
                .all(|v| v.is_finite() && v.abs() <= 1000000.)
    }
}
impl Layer {
    pub fn world_point(&self, p: [f32; 2]) -> [f32; 2] {
        let (s, c) = self.transform.rotation.sin_cos();
        let x = (if self.transform.flip_x {
            self.pixels.width() as f32 - p[0]
        } else {
            p[0]
        }) * self.transform.scale[0];
        let y = (if self.transform.flip_y {
            self.pixels.height() as f32 - p[1]
        } else {
            p[1]
        }) * self.transform.scale[1];
        [
            self.x as f32 + self.transform.offset[0] + x * c - y * s,
            self.y as f32 + self.transform.offset[1] + x * s + y * c,
        ]
    }
    pub fn local_point(&self, p: [f32; 2]) -> [f32; 2] {
        let (s, c) = self.transform.rotation.sin_cos();
        let x = p[0] - self.x as f32 - self.transform.offset[0];
        let y = p[1] - self.y as f32 - self.transform.offset[1];
        let local = [
            (x * c + y * s) / self.transform.scale[0],
            (-x * s + y * c) / self.transform.scale[1],
        ];
        [
            if self.transform.flip_x {
                self.pixels.width() as f32 - local[0]
            } else {
                local[0]
            },
            if self.transform.flip_y {
                self.pixels.height() as f32 - local[1]
            } else {
                local[1]
            },
        ]
    }
    pub fn corners(&self) -> [[f32; 2]; 4] {
        let w = self.pixels.width() as f32;
        let h = self.pixels.height() as f32;
        [[0., 0.], [w, 0.], [w, h], [0., h]].map(|p| self.world_point(p))
    }
    pub fn place_anchor(&mut self, local: [f32; 2], world: [f32; 2]) {
        let current = self.world_point(local);
        self.transform.offset[0] += world[0] - current[0];
        self.transform.offset[1] += world[1] - current[1];
    }
    pub(crate) fn transformed_raster(
        &self,
        width: u32,
        height: u32,
    ) -> Option<(RgbaImage, i64, i64)> {
        let corners = self.corners();
        let minx = corners
            .iter()
            .map(|p| p[0])
            .fold(f32::INFINITY, f32::min)
            .floor()
            .clamp(0., width as f32) as u32;
        let miny = corners
            .iter()
            .map(|p| p[1])
            .fold(f32::INFINITY, f32::min)
            .floor()
            .clamp(0., height as f32) as u32;
        let maxx = corners
            .iter()
            .map(|p| p[0])
            .fold(f32::NEG_INFINITY, f32::max)
            .ceil()
            .clamp(0., width as f32) as u32;
        let maxy = corners
            .iter()
            .map(|p| p[1])
            .fold(f32::NEG_INFINITY, f32::max)
            .ceil()
            .clamp(0., height as f32) as u32;
        if maxx <= minx || maxy <= miny {
            return None;
        }
        let origin = self.world_point([0.5, 0.5]);
        let projection =
            Projection::translate(origin[0] - 0.5 - minx as f32, origin[1] - 0.5 - miny as f32)
                * Projection::rotate(self.transform.rotation)
                * Projection::scale(
                    self.transform.scale[0] * if self.transform.flip_x { -1. } else { 1. },
                    self.transform.scale[1] * if self.transform.flip_y { -1. } else { 1. },
                );
        // Interpolate premultiplied channels so transparent edges do not acquire dark fringes.
        let source_width = self.pixels.width();
        let source_height = self.pixels.height();
        // imageproc's bilinear sampler needs all four neighbours, even at weight 0.
        // Replicated one-pixel borders preserve the last row/column and one-pixel layers.
        let mut source = RgbaImage::from_fn(source_width + 2, source_height + 2, |x, y| {
            *self.pixels.get_pixel(
                x.saturating_sub(1).min(source_width - 1),
                y.saturating_sub(1).min(source_height - 1),
            )
        });
        for p in source.pixels_mut() {
            let a = p[3] as f32 / 255.;
            for c in 0..3 {
                p[c] = (p[c] as f32 * a).round() as u8;
            }
        }
        let mut output = RgbaImage::new(maxx - minx, maxy - miny);
        let inverse = projection.invert();
        warp_into_with(
            &source,
            |x, y| {
                let (px, py) = inverse * (x, y);
                if px < -0.50001
                    || py < -0.50001
                    || px > source_width as f32 - 0.49999
                    || py > source_height as f32 - 0.49999
                {
                    (-100., -100.)
                } else {
                    (px + 1., py + 1.)
                }
            },
            Interpolation::Bilinear,
            image::Rgba([0; 4]),
            &mut output,
        );
        for p in output.pixels_mut() {
            if p[3] > 0 {
                for c in 0..3 {
                    p[c] = (p[c] as f32 * 255. / p[3] as f32).round().min(255.) as u8;
                }
            }
        }
        Some((output, i64::from(minx), i64::from(miny)))
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::Document;
    #[test]
    fn rotated_scaled_points_roundtrip_and_anchor() {
        let mut d = Document::new(100, 100).unwrap();
        d.add_image("a".into(), RgbaImage::new(20, 10)).unwrap();
        let l = d.selected_mut().unwrap();
        l.transform.scale = [2., 3.];
        l.transform.rotation = 0.7;
        let p = [8., 4.];
        let back = l.local_point(l.world_point(p));
        assert!((back[0] - p[0]).abs() < 0.001);
        l.place_anchor([20., 10.], [70., 80.]);
        let a = l.world_point([20., 10.]);
        assert!((a[0] - 70.).abs() < 0.001 && (a[1] - 80.).abs() < 0.001);
    }
}
