use super::ViewId;

pub(crate) const MAX_PIXEL_SIZE_DEVICE: i32 = 250;

pub(crate) fn all_views() -> Vec<ViewId> {
    vec![ViewId::Primary]
}

pub(crate) struct Times {
    pub(crate) data_fetcher_debounce: u32,
    pub(crate) keyboard_debounce: u32,
    pub(crate) view_shift_scroll_debounce: u32,
}
pub(crate) const TIMES: Times = Times {
    data_fetcher_debounce: 700,
    keyboard_debounce: 100,
    view_shift_scroll_debounce: 250,
};
