use web_sys::{WebGlRenderingContext};

#[derive(Clone, PartialEq)]
pub struct Renderer {}

impl Renderer {
    pub fn new(_: WebGlRenderingContext) -> Self {
        Self {  }
    }
}
