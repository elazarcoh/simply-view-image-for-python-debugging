mod communication;
mod components;
mod renderer;
mod vscode;
use cfg_if::cfg_if;
use gloo_utils::format::JsValueSerdeExt;
use log::{info, warn};
use std::cell::RefCell;
use std::rc::Rc;
use web_sys::{window, HtmlCanvasElement, WebGl2RenderingContext};

use gloo::events::EventListener;
use wasm_bindgen::prelude::*;
use web_sys::console;
use web_sys::HtmlElement;
use yew::prelude::*;
use yew_hooks::prelude::*;

use crate::components::GLView;
use crate::components::RendererProvider;
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

struct VSCodeMessageHandler {}

impl VSCodeMessageHandler {
    fn handle_message(&self, message: JsValue) {
        log::debug!("Received message: {:?}", message);
        // let message = message.into_serde().unwrap();
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
}

struct Coordinator {
    renderer: Rc<RefCell<Renderer>>,
    vscode_message_handler: Rc<VSCodeMessageHandler>,
}

#[function_component]
fn App() -> Html {
    let coordinator = use_memo(
        |_| Coordinator {
            renderer: Rc::new(RefCell::new(Renderer::new())),
            vscode_message_handler: Rc::new(VSCodeMessageHandler {}),
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

    html! {
        <RendererProvider renderer={coordinator.renderer.clone()}>
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

    // let vscode = vscode::acquireVsCodeApi();

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
