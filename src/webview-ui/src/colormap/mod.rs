pub(crate) mod builtin_colormaps;
mod _colormap;
pub(crate) use self::_colormap::{create_texture_for_colormap, ColorMap, ColorMapKind};
