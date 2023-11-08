use std::cell::RefCell;
use std::rc::Rc;
use stylist::yew::use_style;

use web_sys::HtmlCanvasElement;
use web_sys::HtmlElement;

use web_sys::WebGl2RenderingContext;

use wasm_bindgen::prelude::*;
use yew::prelude::*;
use yewdux::prelude::*;

use crate::communication::websocket_client::try_websocket;
use crate::components::main::Main;

use crate::configurations;
use crate::image_view;

use crate::image_view::renderer::Renderer;
use crate::image_view::rendering_context::CameraContext;
use crate::image_view::rendering_context::ImageViewData;
use crate::image_view::rendering_context::RenderingContext;
use crate::image_view::types::ImageId;
use crate::image_view::types::TextureImage;
use crate::image_view::types::ViewId;
use crate::mouse_events::PanHandler;
use crate::mouse_events::ZoomHandler;
use crate::reducer::StoreAction;
use crate::store::AppState;
use crate::store::ImageData;
use crate::store::ImageInfo;
use crate::store::ValueVariableKind;
use crate::vscode;
use crate::vscode::vscode_listener::VSCodeListener;
use crate::vscode::vscode_requests::VSCodeRequests;

fn rendering_context() -> impl RenderingContext {
    struct RenderingContextImpl {}

    impl RenderingContext for RenderingContextImpl {
        fn gl(&self) -> WebGl2RenderingContext {
            let state = Dispatch::<AppState>::new().get();
            state.gl.clone().unwrap()
            // self.gl
            //     .borrow()
            //     .as_ref()
            //     .expect("GL context not set")
            //     .clone()
        }

        fn texture_by_id(&self, id: &ImageId) -> Option<Rc<TextureImage>> {
            // log::debug!("Getting texture by id {:?}", id);
            let dispatch = Dispatch::<AppState>::new();
            dispatch.get().image_cache.borrow().get(id).map(Rc::clone)
        }

        fn visible_nodes(&self) -> Vec<ViewId> {
            let dispatch = Dispatch::<AppState>::new();
            dispatch.get().image_views().borrow().visible_views()
        }

        fn view_data(&self, view_id: ViewId) -> ImageViewData {
            let dispatch = Dispatch::<AppState>::new();
            ImageViewData {
                camera: dispatch.get().view_cameras.borrow().get(view_id),
                html_element: dispatch
                    .get()
                    .image_views()
                    .borrow()
                    .get_node_ref(view_id)
                    .cast::<HtmlElement>()
                    .unwrap_or_else(|| {
                        panic!(
                            "Unable to cast node ref to HtmlElement for view {:?}",
                            view_id
                        )
                    }),
                image_id: dispatch.get().image_views().borrow().get_image_id(view_id),
            }
        }

        fn rendering_configuration(&self) -> configurations::RenderingConfiguration {
            let dispatch = Dispatch::<AppState>::new();
            dispatch.get().configuration.rendering.clone()
        }
    }

    RenderingContextImpl {}
}

fn camera_context() -> impl CameraContext {
    struct CameraContextImpl {}

    impl CameraContext for CameraContextImpl {
        fn get_camera_for_view(&self, view_id: ViewId) -> image_view::camera::Camera {
            let dispatch = Dispatch::<AppState>::new();
            dispatch.get().view_cameras.borrow().get(view_id)
        }

        fn set_camera_for_view(&self, view_id: ViewId, camera: image_view::camera::Camera) {
            let dispatch = Dispatch::<AppState>::new();
            dispatch
                .get()
                .view_cameras
                .borrow_mut()
                .set(view_id, camera);
        }
    }

    CameraContextImpl {}
}

#[function_component]
pub fn App() -> Html {
    VSCodeRequests::init(vscode::acquire_vscode_api());

    let dispatch = Dispatch::<AppState>::new();

    let canvas_ref = use_node_ref();

    // TODO: move from here
    let view_id = ViewId::Primary;
    let my_node_ref = dispatch.get().image_views().borrow().get_node_ref(view_id);

    use_effect({
        let canvas_ref = canvas_ref.clone();
        let my_node_ref = my_node_ref.clone();

        move || {
            let message_listener = VSCodeListener::install_incoming_message_handler();

            let camera_context_rc = Rc::new(camera_context()) as Rc<dyn CameraContext>;

            let zoom_listener = {
                let canvas_ref = canvas_ref.clone();
                let view_element = my_node_ref
                    .cast::<HtmlElement>()
                    .expect("Unable to cast node ref to HtmlElement");
                ZoomHandler::install(
                    canvas_ref,
                    view_id,
                    &view_element,
                    Rc::clone(&camera_context_rc),
                )
            };

            let pan_listener = {
                let canvas_ref = canvas_ref.clone();
                let view_element = my_node_ref
                    .cast::<HtmlElement>()
                    .expect("Unable to cast node ref to HtmlElement");
                PanHandler::install(
                    canvas_ref,
                    view_id,
                    &view_element,
                    Rc::clone(&camera_context_rc),
                )
            };

            // Request images from VSCode on startup
            VSCodeRequests::request_images();

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

    // let onclick_get_image = Callback::from({
    //     let coordinator = Rc::clone(&coordinator);
    //     move |_| {
    //         coordinator.send_message(OutgoingMessage::RequestImageMessage(RequestImageMessage {}));
    //     }
    // });

    // let onclick_view_image = Callback::from({
    //     // let renderer = coordinator.renderer.clone();
    //     move |_| {
    //         // (*renderer.borrow_mut())
    //         //     .put_image_to_view(InViewName::Single(InSingleViewName::Single), "test")
    //     }
    // });

    // TODO: remove this
    let onclick = Callback::from(|_| {
        try_websocket();
    });

    let main_style = use_style!(
        r#"
        /* make sure we don't overflow, so no scroll bar.
         TODO: find the best value for this, or a better way to do this
         */
        width: 95vw;
        height: 90vh;
        margin: 0;
        padding: 0;

        .disable-hover {
            pointer-events: none;
        }
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
    "#,
    );
    html! {
        <div class={main_style}>
            <canvas id="gl-canvas" ref={canvas_ref} class={canvas_style}></canvas>
            // <vscode-button onclick={onclick_get_image}> {"Get image"} </vscode-button>
            <vscode-button onclick={onclick}> {"FooBar"} </vscode-button>
            // <vscode-panels>
            //     <vscode-panel-tab id="tab-1">
            //         {"PROBLEMS"}
            //     </vscode-panel-tab>
            //     <vscode-panel-tab id="tab-2">
            //         {"OUTPUT"}
            //     </vscode-panel-tab>
            //     <vscode-panel-tab id="tab-3">
            //         {"DEBUG CONSOLE"}
            //     </vscode-panel-tab>
            //     <vscode-panel-tab id="tab-4">
            //         {"TERMINAL"}
            //     </vscode-panel-tab>
            //     <vscode-panel-view id="view-1"> {"Problems Content"} </vscode-panel-view>
            //     <vscode-panel-view id="view-2"> {"Output Content"} </vscode-panel-view>
            //     <vscode-panel-view id="view-3"> {"Debug Console Content"} </vscode-panel-view>
            //     <vscode-panel-view id="view-4"> {"Terminal Content"} </vscode-panel-view>
            // </vscode-panels>
            // <div>{ "Hello World!" }</div>
            // <ImageSelectionList images={ entries }/>
            <Main gl_view_node_ref={my_node_ref} />
        </div>
    }
}
