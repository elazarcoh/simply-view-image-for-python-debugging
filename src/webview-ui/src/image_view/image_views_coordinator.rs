use std::cell::RefCell;
use std::rc::Rc;
use std::{collections::HashMap, iter::FromIterator};

use web_sys::HtmlElement;
use yew::NodeRef;

use super::camera::Camera;
use super::image_view::{ImageView, ImageViewModel};
use super::types::{
    all_views, InDualViewName, InQuadViewName, InSingleViewName, InViewName, ViewsType,
};

fn views(vt: ViewsType) -> Vec<InViewName> {
    match vt {
        ViewsType::Single => vec![InViewName::Single(InSingleViewName::Single)],
        ViewsType::Dual => vec![
            InViewName::Dual(InDualViewName::Left),
            InViewName::Dual(InDualViewName::Right),
        ],
        ViewsType::Quad => vec![
            InViewName::Quad(InQuadViewName::TopLeft),
            InViewName::Quad(InQuadViewName::TopRight),
            InViewName::Quad(InQuadViewName::BottomLeft),
            InViewName::Quad(InQuadViewName::BottomRight),
        ],
    }
}

pub struct ViewHolders(HashMap<InViewName, ImageView>);

impl ViewHolders {
    fn new(camera_provider: &CameraProvider) -> Self {
        Self {
            0: HashMap::from_iter(all_views().into_iter().map(|v| {
                let camera_ref = camera_provider.get(v);
                (
                    v,
                    ImageView {
                        node_ref: NodeRef::default(),
                        model: ImageViewModel::new(camera_ref),
                    },
                )
            })),
        }
    }
    pub fn visible_nodes(&self) -> Vec<(&ImageView, HtmlElement)> {
        self.0
            .values()
            .filter_map(|v| v.node_ref.cast::<HtmlElement>().map(|e| (v, e)))
            .collect::<Vec<_>>()
    }
}

struct CameraProvider {
    cameras: HashMap<InViewName, Rc<Camera>>,
}

impl CameraProvider {
    fn new() -> Self {
        Self {
            cameras: all_views()
                .into_iter()
                .map(|v| (v, Rc::new(Camera::default())))
                .collect(),
        }
    }
    fn get(&self, view_id: InViewName) -> Rc<Camera> {
        Rc::clone(self.cameras.get(&view_id).unwrap())
    }
}

pub struct ImageViewsCoordinator {
    camera_provider: CameraProvider,
    pub view_holders: Rc<ViewHolders>,
    // image_cache: ImageCache,
}

impl ImageViewsCoordinator {
    pub fn new() -> Self {
        let camera_provider = CameraProvider::new();
        let make_map = |vt: ViewsType| -> HashMap<InViewName, ImageView> {
            HashMap::from_iter(views(vt).into_iter().map(|v| {
                let camera_ref = camera_provider.get(v);
                (
                    v,
                    ImageView {
                        node_ref: NodeRef::default(),
                        model: ImageViewModel::new(camera_ref),
                    },
                )
            }))
        };
        let view_holders = Rc::new(ViewHolders::new(&camera_provider));
        Self {
            camera_provider,
            view_holders,
        }
    }

    pub fn get_node_ref(&self, view_id: InViewName) -> NodeRef {
        self.view_holders.0.get(&view_id).unwrap().node_ref.clone()
    }
}
