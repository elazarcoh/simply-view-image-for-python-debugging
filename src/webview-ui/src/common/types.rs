use std::{collections::HashMap, convert::TryFrom, fmt::Display, rc::Rc};

use super::pixel_value::PixelValue;

#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) struct ImageId(String);

#[cfg(debug_assertions)]
impl ImageId {
    pub(crate) fn new(id: &str) -> Self {
        Self(id.to_owned())
    }
}

impl Display for ImageId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

#[derive(Debug)]
pub(crate) struct Size {
    pub width: f32,
    pub height: f32,
}

impl Size {
    pub(crate) fn from_width_and_height_u32((width, height): (u32, u32)) -> Self {
        Self {
            width: width as _,
            height: height as _,
        }
    }
}

#[derive(tsify::Tsify, serde::Deserialize, Debug, Clone, PartialEq)]
pub(crate) enum ValueVariableKind {
    #[serde(rename = "variable")]
    Variable,
    #[serde(rename = "expression")]
    Expression,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub(crate) enum ViewId {
    Primary,
}

#[derive(Clone)]
pub(crate) enum ImageAvailability {
    NotAvailable,
    Pending,
    ImageAvailable(Rc<super::texture_image::TextureImage>),
    PlotlyAvailable(Rc<super::viewables::plotly::PlotlyPlot>),
}

impl PartialEq for ImageAvailability {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::ImageAvailable(l0), Self::ImageAvailable(r0)) => Rc::ptr_eq(l0, r0),
            _ => core::mem::discriminant(self) == core::mem::discriminant(other),
        }
    }
}
