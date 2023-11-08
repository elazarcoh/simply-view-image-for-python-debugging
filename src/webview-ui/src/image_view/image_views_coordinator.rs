use std::cell::RefCell;
use std::rc::Rc;
use std::{collections::HashMap, iter::FromIterator};

use web_sys::HtmlElement;
use yew::NodeRef;

use super::camera::Camera;
use super::image_cache::ImageCache;
use super::image_view::{ImageView, ImageViewModel};
use super::types::{
    all_views, ImageId, InDualViewName, InQuadViewName, InSingleViewName, InViewName, TextureImage,
    ViewsType,
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

struct ViewHolders(HashMap<InViewName, ImageView>);

impl ViewHolders {
    fn new(camera_provider: &CameraProvider) -> Self {
        Self {
            0: HashMap::from_iter(all_views().into_iter().map(|v| {
                let camera_ref = camera_provider.get(v);
                (
                    v,
                    ImageView {
                        node_ref: NodeRef::default(),
                        model: ImageViewModel::new(),
                    },
                )
            })),
        }
    }
    pub fn visible_nodes(&self) -> Vec<(ImageView, HtmlElement)> {
        self.0
            .values()
            .filter_map(|v| v.node_ref.cast::<HtmlElement>().map(|e| (v.clone(), e)))
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
    view_holders: ViewHolders,
    image_cache: ImageCache,
}

impl ImageViewsCoordinator {
    pub fn new() -> Self {
        let camera_provider = CameraProvider::new();
        let view_holders = ViewHolders::new(&camera_provider);
        let image_cache = ImageCache::new();
        Self {
            camera_provider,
            view_holders,
            image_cache,
        }
    }

    pub fn get_node_ref(&self, view_id: InViewName) -> NodeRef {
        self.view_holders.0.get(&view_id).unwrap().node_ref.clone()
    }

    pub fn add_image(&mut self, image: TextureImage) -> ImageId {
        self.image_cache.add(image)
    }

    pub fn set_image_to_view(&mut self, image_id: ImageId, view_id: InViewName) {
        let image = self.image_cache.get(&image_id).unwrap();
        let view = self.view_holders.0.get_mut(&view_id).unwrap();
        view.model.set_image_id(image_id);
    }

    pub fn visible_nodes(&self) -> Vec<(ImageView, HtmlElement)> {
        self.view_holders.visible_nodes()
    }

    pub fn texture_image_by_id(&self, id: &ImageId) -> Option<&TextureImage> {
        self.image_cache.get(id)
    }
}
