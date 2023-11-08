pub struct Camera {
    translation: glam::Vec2,
    zoom: f32,
}

impl Default for Camera {
    fn default() -> Self {
        Self {
            translation: glam::Vec2::ZERO,
            zoom: 1.0,
        }
    }
}

impl Camera {
    pub fn as_matrix(&self) -> glam::Mat3 {
        let zoom_scale = 1.0_f32 / self.zoom;
        glam::Mat3::from_scale_angle_translation(
            glam::Vec2::new(zoom_scale, zoom_scale),
            0.0,
            self.translation,
        )
    }
}
