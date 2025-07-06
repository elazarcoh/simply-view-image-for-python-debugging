use std::rc::Rc;

use itertools::Itertools;
use wasm_bindgen::{prelude::Closure, JsValue};
use yewdux::{dispatch, Dispatch, Listener};

use anyhow::Result;

use crate::{
    application_state::images::ImageAvailability, bindings::lodash, common::constants,
    configurations::AutoUpdateImages, vscode::vscode_requests::VSCodeRequests,
};

use super::app_state::AppState;

pub(crate) struct ImagesFetcher {
    debounced_fetch_missing_images: lodash::Debounced,
}

impl Default for ImagesFetcher {
    fn default() -> Self {
        Self {
            debounced_fetch_missing_images: lodash::debounce_closure(
                Closure::wrap(Box::new(move |_: JsValue| {
                    let _ = Self::fetch_missing_images()
                        .map_err(|e| log::error!("ImagesFetcher: {}", e));
                })),
                constants::TIMES.data_fetcher_debounce,
                Default::default(),
            ),
        }
    }
}

impl ImagesFetcher {
    fn fetch_missing_images() -> Result<()> {
        let dispatch = Dispatch::<AppState>::global();
        let state = dispatch.get();

        let currently_viewing_objects = state
            .image_views
            .borrow()
            .visible_views()
            .iter()
            .filter_map(|view_id| state.image_views.borrow().get_currently_viewing(*view_id))
            .collect::<Vec<_>>();

        for cv in currently_viewing_objects {
            match cv {
                crate::common::CurrentlyViewing::Image(image_id) => {
                    log::debug!(
                        "ImagesFetcher::on_change: CurrentlyViewing::Image {:?}",
                        image_id
                    );

                    let current = state.image_cache.borrow().get(&image_id);

                    if current == ImageAvailability::NotAvailable {
                        log::debug!(
                            "ImagesFetcher::on_change: image {:?} not in cache",
                            image_id
                        );
                        if let Some(image_info) = state.images.borrow().get(&image_id) {
                            log::debug!("ImagesFetcher::on_change: fetching image {:?}", image_id);
                            VSCodeRequests::request_image_data(
                                image_id.clone(),
                                image_info.minimal().expression.clone(),
                            );
                            dispatch.reduce_mut(|s| {
                                s.image_cache.borrow_mut().set_pending(&image_id);
                            });
                        }
                    }
                }
                crate::common::CurrentlyViewing::BatchItem(image_id) => {
                    let current = state.image_cache.borrow().get(&image_id);
                    let current_index = state
                        .drawing_options
                        .borrow()
                        .get_or_default(&image_id)
                        .batch_item
                        // batch item is not set, so we default to 0 (first time we see the image)
                        .unwrap_or(0);

                    if let ImageAvailability::NotAvailable = current {
                        log::debug!(
                            "ImagesFetcher::on_change: image {:?} not in cache",
                            image_id
                        );
                        if let Some(image) = state.images.borrow().get(&image_id) {
                            dispatch.reduce_mut(|s| {
                                s.image_cache.borrow_mut().set_pending(&image_id);
                            });
                            let expression = image.minimal().expression.clone();
                            log::debug!(
                                "ImagesFetcher::on_change: fetching item {:?} for image {:?}",
                                current_index,
                                image_id
                            );
                            VSCodeRequests::request_batch_item_data(
                                image_id.clone(),
                                expression,
                                current_index,
                                None,
                            );
                        }
                    } else if let ImageAvailability::Pending(Some(image))
                    | ImageAvailability::Available(image) = current
                    {
                        // generally available, but maybe batch item is not.
                        let current_drawing_options = state
                            .drawing_options
                            .borrow()
                            .get_or_default(&image_id)
                            .clone();

                        if let Some(item) = current_drawing_options.batch_item {
                            let has_item = image.borrow().textures.contains_key(&item);
                            if has_item {
                                log::debug!(
                                    "ImagesFetcher::on_change: batch item {} already in cache. changing to ImageAvailability::Available",
                                    item
                                );
                                // changed back to batch item that is already in cache
                                dispatch.reduce_mut(|s| {
                                    s.image_cache
                                        .borrow_mut()
                                        .try_set_available(&image_id)
                                        .unwrap_or_else(|e| {
                                            log::error!("ImagesFetcher::on_change: {}", e)
                                        });
                                });
                            } else {
                                // state.image_cache.borrow_mut().set_pending(&image_id);
                                dispatch.reduce_mut(|s| {
                                    s.image_cache.borrow_mut().set_pending(&image_id);
                                });
                                let expression = state
                                    .images
                                    .borrow()
                                    .get(&image_id)
                                    .unwrap()
                                    .minimal()
                                    .expression
                                    .clone();
                                let currently_holding =
                                    image.borrow().textures.keys().copied().collect_vec();
                                log::debug!(
                                    "ImagesFetcher::on_change: {:?}[{}] not in cache (has {:?})",
                                    image_id,
                                    item,
                                    currently_holding
                                );
                                VSCodeRequests::request_batch_item_data(
                                    image_id.clone(),
                                    expression,
                                    item,
                                    Some(currently_holding),
                                );
                            }
                        }
                    } else {
                        log::debug!("ImagesFetcher::on_change: current {:?} ", current);
                    }
                }
            }
        }

        Ok(())
    }

    pub(crate) fn force_fetch_missing_images() -> Result<()> {
        // Force fetch regardless of autoUpdate configuration
        Self::fetch_missing_images()
    }
}

impl Listener for ImagesFetcher {
    type Store = AppState;

    fn on_change(&mut self, _cx: &yewdux::Context, state: Rc<Self::Store>) {
        // Check if auto-update is enabled and should fetch for current images
        let should_auto_fetch = match &state.configuration.auto_update_images {
            AutoUpdateImages::True => true,
            AutoUpdateImages::False => false,
            AutoUpdateImages::Pinned => {
                // For pinned mode, we need to check if any of the currently viewing images are pinned
                let currently_viewing_objects = state
                    .image_views
                    .borrow()
                    .visible_views()
                    .iter()
                    .filter_map(|view_id| {
                        state.image_views.borrow().get_currently_viewing(*view_id)
                    })
                    .collect::<Vec<_>>();

                currently_viewing_objects.iter().any(|cv| {
                    let image_id = cv.id();
                    state.images.borrow().is_pinned(image_id)
                })
            }
        };

        if should_auto_fetch {
            self.debounced_fetch_missing_images
                .call1(&JsValue::NULL, &JsValue::UNDEFINED)
                .expect("debounced_fetch_missing_images call failed");
        }
    }
}
