use anyhow::Result;
use enumset::EnumSet;
use std::{collections::HashMap, rc::Rc};

use web_sys::WebGl2RenderingContext;

use crate::{
    colormap::{builtin_colormaps::BUILTIN_COLORMAPS, colormap},
    webgl_utils::GLGuard,
};

pub(crate) struct ColorMapTexturesCache(HashMap<String, Rc<GLGuard<web_sys::WebGlTexture>>>);

impl ColorMapTexturesCache {
    pub(crate) fn new() -> Self {
        Self(HashMap::new())
    }

    pub(crate) fn get_or_create(
        &mut self,
        gl: &WebGl2RenderingContext,
        colormap: &colormap::ColorMap,
    ) -> Result<Rc<GLGuard<web_sys::WebGlTexture>>> {
        let name = colormap.name.to_string();
        if self.0.contains_key(&name) {
            return Ok(self.0.get(&name).unwrap().clone());
        }

        let tex = colormap::create_texture_for_colormap(gl, colormap)?;
        self.0.insert(name.clone(), Rc::new(tex));
        Ok(self.0.get(&name).unwrap().clone())
    }
}

impl Default for ColorMapTexturesCache {
    fn default() -> Self {
        Self::new()
    }
}

pub(crate) struct ColorMapRegistry(HashMap<String, Rc<colormap::ColorMap>>);
impl ColorMapRegistry {
    pub(crate) fn new() -> Self {
        Self(HashMap::new())
    }

    pub(crate) fn all_with_kind(
        &self,
        kinds: EnumSet<colormap::ColorMapKind>,
    ) -> Vec<Rc<colormap::ColorMap>> {
        self.0
            .values()
            .filter(|c| kinds.contains(c.kind))
            .cloned()
            .collect()
    }

    pub(crate) fn get(&self, name: &str) -> Option<Rc<colormap::ColorMap>> {
        self.0.get(name).cloned()
    }

    pub(crate) fn register(&mut self, colormap: colormap::ColorMap) {
        self.0.insert(colormap.name.to_string(), Rc::new(colormap));
    }
}
impl Default for ColorMapRegistry {
    fn default() -> Self {
        let mut registry = Self::new();
        BUILTIN_COLORMAPS
            .iter()
            .for_each(|c| registry.register(c.clone()));
        registry
    }
}
