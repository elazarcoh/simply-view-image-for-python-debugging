use super::ViewId;

pub(crate) const MAX_PIXEL_SIZE_DEVICE: i32 = 250;

pub(crate) fn all_views() -> Vec<ViewId> {
    vec![ViewId::Primary]
}
