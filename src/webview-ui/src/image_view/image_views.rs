

use std::{collections::HashMap, iter::FromIterator};

use web_sys::HtmlElement;
use yew::NodeRef;



use super::types::{
    all_views, ImageId, InViewName,
};

// fn views(vt: ViewsType) -> Vec<InViewName> {
//     match vt {
//         ViewsType::Single => vec![InViewName::Single(InSingleViewName::Single)],
//         ViewsType::Dual => vec![
//             InViewName::Dual(InDualViewName::Left),
//             InViewName::Dual(InDualViewName::Right),
//         ],
//         ViewsType::Quad => vec![
//             InViewName::Quad(InQuadViewName::TopLeft),
//             InViewName::Quad(InQuadViewName::TopRight),
//             InViewName::Quad(InQuadViewName::BottomLeft),
//             InViewName::Quad(InQuadViewName::BottomRight),
//         ],
//     }
// }

pub struct ImageViews(HashMap<InViewName, (Option<ImageId>, NodeRef)>);

impl ImageViews {
    pub fn new() -> Self {
        Self(HashMap::from_iter(
                all_views()
                    .into_iter()
                    .map(|v| (v, (None, NodeRef::default()))),
            ))
    }

    pub fn is_visible(
        &self,
        _view_id: &InViewName,
        image_id: &Option<ImageId>,
        node_ref: &NodeRef,
    ) -> bool {
        // TODO: implement this
        node_ref.cast::<HtmlElement>().is_some() && image_id.is_some()
    }

    pub fn visible_views(&self) -> Vec<InViewName> {
        self.0
            .iter()
            .filter(|(v, (image_id, node_ref))| self.is_visible(v, image_id, node_ref))
            .map(|(v, _)| *v)
            .collect::<Vec<_>>()
    }

    pub fn get_node_ref(&self, view_id: InViewName) -> NodeRef {
        self.0.get(&view_id).unwrap().1.clone()
    }

    pub fn get_image_id(&self, view_id: InViewName) -> Option<ImageId> {
        self.0.get(&view_id).unwrap().0.clone()
    }

    pub fn set_image_to_view(&mut self, image_id: ImageId, view_id: InViewName) {
        let view = self.0.get_mut(&view_id).unwrap();
        view.0 = Some(image_id);
    }
}
