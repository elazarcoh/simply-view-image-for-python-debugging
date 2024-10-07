use std::{collections::HashMap, iter::FromIterator};

use web_sys::{CustomEvent, HtmlElement};
use yew::NodeRef;

use crate::common::{constants::all_views, CurrentlyViewing, ViewId, ViewableObjectId};

pub(crate) struct ImageViews(HashMap<ViewId, (Option<CurrentlyViewing>, NodeRef)>);

impl ImageViews {
    fn new() -> Self {
        log::debug!("ImageViews::new");
        Self(HashMap::from_iter(
            all_views()
                .into_iter()
                .map(|v| (v, (None, NodeRef::default()))),
        ))
    }

    pub(crate) fn is_visible(
        &self,
        _view_id: &ViewId,
        image_id: &Option<CurrentlyViewing>,
        node_ref: &NodeRef,
    ) -> bool {
        // TODO: implement this
        node_ref.cast::<HtmlElement>().is_some() && image_id.is_some()
    }

    pub(crate) fn visible_views(&self) -> Vec<ViewId> {
        self.0
            .iter()
            .filter(|(v, (cv, node_ref))| self.is_visible(v, cv, node_ref))
            .map(|(v, _)| *v)
            .collect::<Vec<_>>()
    }

    pub(crate) fn get_node_ref(&self, view_id: ViewId) -> NodeRef {
        self.0.get(&view_id).unwrap().1.clone()
    }

    pub(crate) fn get_currently_viewing(&self, view_id: ViewId) -> Option<CurrentlyViewing> {
        self.0.get(&view_id).unwrap().0.clone()
    }

    pub(crate) fn is_currently_viewing(&self, image_id: &ViewableObjectId) -> Vec<ViewId> {
        self.0
            .iter()
            .filter(|(_, (cv, _))| cv.as_ref().map_or(false, |cv| cv.id() == image_id))
            .map(|(v, _)| *v)
            .collect::<Vec<_>>()
    }

    pub(crate) fn set_image_to_view(&mut self, image_id: ViewableObjectId, view_id: ViewId) {
        let view = self.0.get_mut(&view_id).unwrap();
        view.0 = Some(CurrentlyViewing::Image(image_id));
    }

    pub(crate) fn set_batch_item_to_view(&mut self, batch_id: ViewableObjectId, view_id: ViewId) {
        let view = self.0.get_mut(&view_id).unwrap();
        view.0 = Some(CurrentlyViewing::BatchItem(batch_id));
    }

    pub(crate) fn send_event_to_view(&self, view_id: ViewId, event: &str) {
        log::debug!(
            "ImageViews::send_event_to_view: view_id={:?}, event={}",
            view_id,
            event
        );
        let node_ref = self.get_node_ref(view_id);
        if let Some(element) = node_ref.cast::<HtmlElement>() {
            element
                .dispatch_event(&CustomEvent::new(event).unwrap())
                .unwrap();
        }
    }
}

impl Default for ImageViews {
    fn default() -> Self {
        Self::new()
    }
}
