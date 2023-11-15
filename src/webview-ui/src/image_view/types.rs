use anyhow::Result;
use std::fmt::Display;

use bytemuck::Pod;
use glam::UVec2;
use strum::EnumCount;

use crate::{
    common::{Channels, Datatype, ImageData, Size},
    webgl_utils::{self, types::GLGuard},
};


#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub(crate) enum ViewId {
    Primary,
}

pub(crate) fn all_views() -> Vec<ViewId> {
    vec![ViewId::Primary]
}
