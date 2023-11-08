use image::DynamicImage;


use crate::{
    common::Size,
    webgl_utils::{self, types::GLGuard},
};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct ImageId(String);

impl ImageId {
    pub fn generate() -> Self {
        let uuid = uuid::Uuid::new_v4();
        Self(uuid.to_string())
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub enum ViewsType {
    Single,
    Dual,
    Quad,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum InSingleViewName {
    Single,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum InDualViewName {
    Left,
    Right,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum InQuadViewName {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum InViewName {
    Single(InSingleViewName),
    Dual(InDualViewName),
    Quad(InQuadViewName),
}

pub fn all_views() -> Vec<InViewName> {
    vec![
        InViewName::Single(InSingleViewName::Single),
        InViewName::Dual(InDualViewName::Left),
        InViewName::Dual(InDualViewName::Right),
        InViewName::Quad(InQuadViewName::TopLeft),
        InViewName::Quad(InQuadViewName::TopRight),
        InViewName::Quad(InQuadViewName::BottomLeft),
        InViewName::Quad(InQuadViewName::BottomRight),
    ]
}

impl ToString for InSingleViewName {
    fn to_string(&self) -> String {
        match self {
            InSingleViewName::Single => "Single".to_string(),
        }
    }
}

impl ToString for InDualViewName {
    fn to_string(&self) -> String {
        match self {
            InDualViewName::Left => "Left".to_string(),
            InDualViewName::Right => "Right".to_string(),
        }
    }
}

impl ToString for InQuadViewName {
    fn to_string(&self) -> String {
        match self {
            InQuadViewName::TopLeft => "TopLeft".to_string(),
            InQuadViewName::TopRight => "TopRight".to_string(),
            InQuadViewName::BottomLeft => "BottomLeft".to_string(),
            InQuadViewName::BottomRight => "BottomRight".to_string(),
        }
    }
}

#[derive(Debug)]
pub struct TextureImage {
    pub image: DynamicImage,
    pub texture: GLGuard<web_sys::WebGlTexture>,
}

impl TextureImage {
    pub fn try_new(
        image: DynamicImage,
        gl: &web_sys::WebGl2RenderingContext,
    ) -> Result<Self, String> {
        let texture = webgl_utils::textures::create_texture_from_image(
            gl,
            &image,
            webgl_utils::types::CreateTextureParametersBuilder::default()
                .mag_filter(webgl_utils::constants::TextureMagFilter::Nearest)
                .min_filter(webgl_utils::constants::TextureMinFilter::Nearest)
                .build()
                .unwrap(),
        )?;
        Ok(Self { image, texture })
    }

    pub fn image_size(&self) -> Size {
        Size {
            width: self.image.width() as f32,
            height: self.image.height() as f32,
        }
    }
}
