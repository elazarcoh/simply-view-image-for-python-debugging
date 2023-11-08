use std::{borrow::Cow, collections::HashMap};

pub(crate) struct ColorMap {
    pub cet_name: Cow<'static, str>,
    pub name: Cow<'static, str>,
    pub map: Cow<'static, [[f32; 3]]>,
}

impl ColorMap {
    pub const fn new(cet_name: &'static str, name: &'static str, map: &'static [[f32; 3]]) -> Self {
        Self {
            cet_name: Cow::Borrowed(cet_name),
            name: Cow::Borrowed(name),
            map: Cow::Borrowed(map),
        }
    }
}

