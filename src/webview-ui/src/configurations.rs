#[derive(Debug, PartialEq, Eq, Clone)]
pub(crate) enum AutoUpdateImages {
    True,
    False,
    Pinned,
}

impl Default for AutoUpdateImages {
    fn default() -> Self {
        Self::True
    }
}

impl From<&str> for AutoUpdateImages {
    fn from(value: &str) -> Self {
        match value {
            "false" => Self::False,
            "pinned" => Self::Pinned,
            _ => Self::True, // default to true for any other value including "true"
        }
    }
}

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
    pub auto_update_images: AutoUpdateImages,
}

#[allow(clippy::derivable_impls)] // we want to manually implement Default, because I want to have it explicit here
impl Default for Configuration {
    fn default() -> Self {
        Self {
            rendering: Default::default(),
            invert_scroll_direction: false,
            auto_update_images: AutoUpdateImages::default(),
        }
    }
}
