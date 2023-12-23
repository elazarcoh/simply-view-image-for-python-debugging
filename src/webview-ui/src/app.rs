use crate::app_state::app_state::AppState;
use crate::app_state::app_state::GlobalDrawingOptions;
use crate::app_state::images::ImageAvailability;
use crate::colormap::colormap;
use crate::common::camera;
use crate::common::ImageId;
use crate::common::Size;
use crate::common::ViewId;
use crate::components::main::Main;
use crate::configurations;
use crate::mouse_events::PanHandler;
use crate::mouse_events::ZoomHandler;
use crate::rendering::coloring::DrawingOptions;
use crate::rendering::renderer::Renderer;
use crate::rendering::rendering_context::ImageViewData;
use crate::rendering::rendering_context::RenderingContext;
use crate::rendering::rendering_context::ViewContext;
use crate::vscode;
use crate::vscode::vscode_listener::VSCodeListener;
use crate::vscode::vscode_requests::VSCodeRequests;
use crate::webgl_utils;
use anyhow::{anyhow, Result};
use std::cell::RefCell;
use std::rc::Rc;
use stylist::yew::use_style;
use wasm_bindgen::prelude::*;
use web_sys::HtmlCanvasElement;
use web_sys::HtmlElement;
use web_sys::WebGl2RenderingContext;
use yew::prelude::*;
use yewdux::prelude::*;

fn rendering_context() -> impl RenderingContext {
    struct RenderingContextImpl {}

    impl RenderingContext for RenderingContextImpl {
        fn gl(&self) -> WebGl2RenderingContext {
            let state = Dispatch::<AppState>::new().get();
            state.gl.clone().unwrap()
        }

        fn texture_by_id(&self, id: &ImageId) -> ImageAvailability {
            let dispatch = Dispatch::<AppState>::new();
            dispatch.get().image_cache.borrow().get(id)
        }

        fn visible_nodes(&self) -> Vec<ViewId> {
            let dispatch = Dispatch::<AppState>::new();
            dispatch.get().image_views.borrow().visible_views()
        }

        fn view_data(&self, view_id: ViewId) -> ImageViewData {
            let dispatch = Dispatch::<AppState>::new();
            ImageViewData {
                camera: dispatch.get().view_cameras.borrow().get(view_id),
                html_element: dispatch
                    .get()
                    .image_views
                    .borrow()
                    .get_node_ref(view_id)
                    .cast::<HtmlElement>()
                    .unwrap_or_else(|| {
                        panic!(
                            "Unable to cast node ref to HtmlElement for view {:?}",
                            view_id
                        )
                    }),
                image_id: dispatch.get().image_views.borrow().get_image_id(view_id),
            }
        }

        fn rendering_configuration(&self) -> configurations::RenderingConfiguration {
            let dispatch = Dispatch::<AppState>::new();
            dispatch.get().configuration.rendering.clone()
        }

        fn drawing_options(&self, image_id: &ImageId) -> (DrawingOptions, GlobalDrawingOptions) {
            let dispatch = Dispatch::<AppState>::new();
            let state = dispatch.get();
            let drawing_options = state.drawing_options.borrow().get_or_default(image_id);
            let global_drawing_options = state.global_drawing_options.clone();
            (drawing_options, global_drawing_options)
        }

        fn get_color_map_texture(
            &self,
            colormap_name: &str,
        ) -> Result<Rc<webgl_utils::GLGuard<web_sys::WebGlTexture>>> {
            let dispatch = Dispatch::<AppState>::new();
            let state = dispatch.get();
            let gl = state.gl()?;
            let colormap = self.get_color_map(colormap_name)?;
            dispatch
                .get()
                .color_map_textures_cache
                .borrow_mut()
                .get_or_create(gl, &colormap)
        }

        fn get_color_map(&self, name: &str) -> Result<Rc<colormap::ColorMap>> {
            let dispatch = Dispatch::<AppState>::new();
            dispatch
                .get()
                .color_map_registry
                .borrow()
                .get(name)
                .ok_or(anyhow!("Color map {} not found", name))
        }
    }

    RenderingContextImpl {}
}

fn view_context() -> impl ViewContext {
    struct CameraContextImpl {}

    impl ViewContext for CameraContextImpl {
        fn get_camera_for_view(&self, view_id: ViewId) -> camera::Camera {
            let dispatch = Dispatch::<AppState>::new();
            dispatch.get().view_cameras.borrow().get(view_id)
        }

        fn set_camera_for_view(&self, view_id: ViewId, camera: camera::Camera) {
            let dispatch = Dispatch::<AppState>::new();
            dispatch
                .get()
                .view_cameras
                .borrow_mut()
                .set(view_id, camera);
        }

        fn get_image_size_for_view(&self, view_id: ViewId) -> Option<Size> {
            let dispatch = Dispatch::<AppState>::new();
            let image_id = dispatch.get().image_views.borrow().get_image_id(view_id);
            dispatch
                .get()
                .images
                .borrow()
                .get(&image_id?)
                .map(|image| Size {
                    width: image.width as _,
                    height: image.height as _,
                })
        }

        fn get_view_element(&self, view_id: ViewId) -> HtmlElement {
            let dispatch = Dispatch::<AppState>::new();
            dispatch
                .get()
                .image_views
                .borrow()
                .get_node_ref(view_id)
                .cast::<HtmlElement>()
                .unwrap_or_else(|| {
                    panic!(
                        "Unable to cast node ref to HtmlElement for view {:?}",
                        view_id
                    )
                })
        }

        fn get_image_for_view(&self, view_id: ViewId) -> Option<ImageAvailability> {
            let dispatch = Dispatch::<AppState>::new();
            let image_id = dispatch.get().image_views.borrow().get_image_id(view_id);
            image_id.map(|image_id| dispatch.get().image_cache.borrow().get(&image_id))
        }
    }

    CameraContextImpl {}
}

#[function_component]
pub(crate) fn App() -> Html {
    VSCodeRequests::init(vscode::acquire_vscode_api());

    let dispatch = Dispatch::<AppState>::new();

    let canvas_ref = use_node_ref();

    // TODO: move from here
    let view_id = ViewId::Primary;

    let view_context_rc = Rc::new(view_context()) as Rc<dyn ViewContext>;

    use_effect({
        let view_context_rc = Rc::clone(&view_context_rc);

        move || {
            // send message to VSCode that the webview is ready
            VSCodeRequests::webview_ready();

            let message_listener = VSCodeListener::install_incoming_message_handler();

            let zoom_listener = ZoomHandler::install(view_id, Rc::clone(&view_context_rc));
            let pan_listener = PanHandler::install(view_id, Rc::clone(&view_context_rc));

            move || {
                drop(message_listener);
                drop(zoom_listener);
                drop(pan_listener);
            }
        }
    });

    let renderer = use_memo((), |_| RefCell::new(Renderer::new()));
    use_effect_with(canvas_ref.clone(), {
        let renderer = Rc::clone(&renderer);

        move |canvas_ref: &NodeRef| {
            let canvas = canvas_ref
                .cast::<HtmlCanvasElement>()
                .expect("canvas_ref not attached to a canvas element");

            let gl: WebGl2RenderingContext = canvas
                .get_context("webgl2")
                .unwrap()
                .unwrap()
                .dyn_into()
                .unwrap();

            [
                webgl_utils::WebGlExtension::OesTextureFloat,
                webgl_utils::WebGlExtension::OesTextureFloatLinear,
                webgl_utils::WebGlExtension::ExtColorBufferFloat,
            ]
            .map(|ext| webgl_utils::general::enable_extension(&gl, ext).unwrap());

            let dispatch = Dispatch::<AppState>::new();
            dispatch.reduce_mut(|state| {
                state.gl = Some(gl.clone());
            });

            renderer
                .borrow_mut()
                .set_rendering_context(Rc::new(rendering_context()));

            move || {
                dispatch.reduce_mut(|state| {
                    state.gl = None;
                });
            }
        }
    });

    let main_style = use_style!(
        r#"

    "#,
    );
    let canvas_style = use_style!(
        r#"
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
        border: 0;
        padding: 0;
    "#,
    );

    html! {
        <div class={main_style}>
            <canvas id="gl-canvas" ref={canvas_ref} class={canvas_style}></canvas>
            <Main view_id={ViewId::Primary} view_context={Rc::clone(&view_context_rc)} />
        </div>
    }
}
