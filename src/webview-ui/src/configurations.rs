#[derive(Debug, PartialEq, Eq, Clone)]
pub(crate) struct RenderingConfiguration {
    pub minimum_size_to_render_pixel_border: usize,
    pub minimum_size_to_render_pixel_values: usize,
}
impl Default for RenderingConfiguration {
    fn default() -> RenderingConfiguration {
        Self {
            minimum_size_to_render_pixel_border: 30,
            minimum_size_to_render_pixel_values: 50,
        }
    }
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub(crate) struct Configuration {
    pub rendering: RenderingConfiguration,
    pub invert_scroll_direction: bool,
    pub auto_update_images: bool,
}

#[allow(clippy::derivable_impls)] // we want to manually implement Default, because I want to have it explicit here
impl Default for Configuration {
    fn default() -> Self {
        Self {
            rendering: Default::default(),
            invert_scroll_direction: false,
            auto_update_images: true,
        }
    }
}
