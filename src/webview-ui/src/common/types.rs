pub struct Size {
    pub width: f32,
    pub height: f32,
}

impl Size {
    pub fn from_width_and_height_u32((width, height): (u32, u32)) -> Self {
        Self {
            width: width as _,
            height: height as _,
        }
    }
}
