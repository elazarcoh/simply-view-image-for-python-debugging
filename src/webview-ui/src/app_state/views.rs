use std::{collections::HashMap, iter::FromIterator};

use web_sys::HtmlElement;
use yew::NodeRef;

use crate::common::{constants::all_views, ImageId, ViewId};

pub(crate) struct ImageViews(HashMap<ViewId, (Option<ImageId>, NodeRef)>);

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
        image_id: &Option<ImageId>,
        node_ref: &NodeRef,
    ) -> bool {
        // TODO: implement this
        node_ref.cast::<HtmlElement>().is_some() && image_id.is_some()
    }

    pub(crate) fn visible_views(&self) -> Vec<ViewId> {
        self.0
            .iter()
            .filter(|(v, (object_id, node_ref))| self.is_visible(v, object_id, node_ref))
            .map(|(v, _)| *v)
            .collect::<Vec<_>>()
    }

    pub(crate) fn get_node_ref(&self, view_id: ViewId) -> NodeRef {
        self.0.get(&view_id).unwrap().1.clone()
    }

    pub(crate) fn get_viewable(&self, view_id: ViewId) -> Option<ImageId> {
        self.0.get(&view_id).unwrap().0.clone()
    }

    pub(crate) fn set_object_to_view(&mut self, object_id: ImageId, view_id: ViewId) {
        let view = self.0.get_mut(&view_id).unwrap();
        view.0 = Some(object_id);
    }
}

impl Default for ImageViews {
    fn default() -> Self {
        Self::new()
    }
}
