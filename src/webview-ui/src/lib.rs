#[macro_use]
extern crate derive_builder;
#[macro_use]
extern crate lazy_static;

mod communication;
use base64::{engine::general_purpose, Engine as _};
mod components;
mod renderer;
mod vscode;
mod webgl_utils;
use cfg_if::cfg_if;
use gloo_utils::format::JsValueSerdeExt;

use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::rc::Rc;
use web_sys::window;

use gloo::events::EventListener;
use wasm_bindgen::prelude::*;
use web_sys::console;
use yew::prelude::*;
use yew_hooks::prelude::*;

use crate::components::GLView;
use crate::components::RendererProvider;
use crate::renderer::Image;
use crate::renderer::ImageCache;
use crate::renderer::InSingleViewName;
use crate::renderer::InViewName;
use crate::renderer::Renderer;

// #[wasm_bindgen]
// pub fn send_example_to_js() -> JsValue {
//     // let example = com_types::Example {
//     //     field3: [2., 3., 4., 5.],
//     // };

//     // JsValue::from_serde(&example).unwrap()
// }

// #[wasm_bindgen]
// pub fn receive_example_from_js(_: JsValue) {
//     // let example: com_types::Example = val.into_serde().unwrap();
// }

// When the `wee_alloc` feature is enabled, this uses `wee_alloc` as the global
// allocator.
//
// If you don't want to use `wee_alloc`, you can safely delete this.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

struct VSCodeMessageHandler {
    webview_api: vscode::WebviewApi,
    image_cache: Rc<RefCell<ImageCache>>,
}

impl VSCodeMessageHandler {
    pub fn new(webview_api: vscode::WebviewApi, image_cache: Rc<RefCell<ImageCache>>) -> Self {
        Self {
            webview_api,
            image_cache,
        }
    }
}

#[derive(Serialize, Deserialize)]
pub struct MyMessage {
    pub message: String,
    #[serde(rename = "imageBase64")]
    pub image_base64: String,
}

impl VSCodeMessageHandler {
    fn handle_message(&self, message: JsValue) {
        log::debug!("Received message: {:?}", message);
        let message: MyMessage = message.into_serde().unwrap();
        log::debug!("Received message.message: {:?}", message.message);

        let bytes = general_purpose::STANDARD
            .decode(message.image_base64)
            .unwrap();
        let image = image::load_from_memory_with_format(&bytes, image::ImageFormat::Png).unwrap();
        let width = image.width();
        let height = image.height();
        let channels = image.color().channel_count();
        log::debug!("Received image: {}x{}x{}", width, height, channels);

        (*self.image_cache.borrow_mut()).insert("test".to_string(), Image::new(image));

        // match message.command.as_str() {
        //     "hello" => {
        //         info!("Received hello message: {}", message.payload);
        //     }
        //     "warn" => {
        //         warn!("Received warn message: {}", message.payload);
        //     }
        //     _ => {
        //         warn!("Received unknown message: {}", message.command);
        //     }
        // }
    }

    pub fn send_message(&self, message: JsValue) {
        self.webview_api.post_message(message);
    }
}

struct Coordinator {
    renderer: Rc<RefCell<Renderer>>,
    vscode_message_handler: Rc<VSCodeMessageHandler>,
}

#[function_component]
fn App() -> Html {
    let coordinator = use_memo(
        {
            let vscode = vscode::acquire_vscode_api();
            let image_cache = Rc::new(RefCell::new(ImageCache::new()));
            |_| Coordinator {
                renderer: Rc::new(RefCell::new(Renderer::new(image_cache.clone()))),
                vscode_message_handler: Rc::new(VSCodeMessageHandler::new(vscode, image_cache)),
            }
        },
        (),
    );

    use_effect({
        let window = window().unwrap();
        let coordinator = coordinator.clone();

        move || {
            let onmessage = Callback::from(move |event: Event| {
                let data = event
                    .dyn_ref::<web_sys::MessageEvent>()
                    .expect("Unable to cast event to MessageEvent")
                    .data();
                coordinator.vscode_message_handler.handle_message(data);
            });
            let message_listener =
                EventListener::new(&window, "message", move |e| onmessage.emit(e.clone()));

            move || drop(message_listener)
        }
    });

    let onclick_get_image = Callback::from({
        let message_handler = coordinator.vscode_message_handler.clone();
        move |_| {
            let greeting = String::from("Hi there");
            log::debug!("Sending greeting: {}", greeting);
            message_handler.send_message(
                JsValue::from_serde(&MyMessage {
                    message: greeting,
                    image_base64: String::from(""),
                })
                .unwrap(),
            );
        }
    });

    let onclick_view_image = Callback::from({
        let renderer = coordinator.renderer.clone();
        move |_| {
            (*renderer.borrow_mut())
                .put_image_to_view(InViewName::Single(InSingleViewName::Single), "test")
        }
    });

    html! {
        <RendererProvider renderer={coordinator.renderer.clone()}>
            <vscode-button onclick={onclick_get_image}> {"Get image"} </vscode-button>
            <vscode-image onclick={onclick_view_image} > {"View image"} </vscode-image>
            <div>{ "Hello World!" }</div>
            <GLView view_name={InViewName::Single(InSingleViewName::Single)}/>
        </RendererProvider>
    }
}

cfg_if! {
    if #[cfg(feature = "console_log")] {
        fn init_log() {
            use log::Level;
            console_log::init_with_level(Level::Trace).expect("error initializing log");
        }
    } else {
        fn init_log() {}
    }
}

// Called by our JS entry point to run the example
#[wasm_bindgen(start)]
fn run() -> Result<(), JsValue> {
    // This provides better error messages in debug mode.
    // It's disabled in release mode so it doesn't bloat up the file size.
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    init_log();

    console::clear();

    // Use `web_sys`'s global `window` function to get a handle on the global
    // window object.
    let window = web_sys::window().expect("no global `window` exists");
    let document = window.document().expect("should have a document on window");
    let body = document.body().expect("document should have a body");

    // Manufacture the element we're gonna append
    let val = document.create_element("p")?;
    val.set_text_content(Some("Hello from Rust!"));

    body.append_child(&val)?;

    // vscode.postMessage(send_example_to_js());
    // vscode.postMessage(JsValue::from_str(
    //     r#"{ "command": "hello", "payload": "Hey there partner! 🤠", "requestId": 1 }"#,
    // ));

    console::log_1(&"Hello using web-sys".into());

    yew::Renderer::<App>::new().render();

    Ok(())
}
