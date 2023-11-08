use gloo_timers::callback::Interval;
use std::borrow::BorrowMut;
use std::cell::RefCell;
use std::rc::Rc;

use gloo::console;
use wasm_bindgen::prelude::Closure;
use wasm_bindgen::JsCast;

use web_sys::{window, Event, HtmlCanvasElement, HtmlElement, WebGlRenderingContext};
use yew::prelude::*;
use yew::{function_component, html, use_effect_with_deps, use_node_ref, Html};

// #[derive(Debug, PartialEq, Clone)]
// pub struct GL {
//     pub gl: Option<WebGlRenderingContext>,
//     // pub gl: <Option<WebGlRenderingContext>>,
//     pub get_gl: Callback<(), Option<WebGlRenderingContext>>,
// }

// #[derive(Properties, Debug, PartialEq)]
// pub struct GLContextProps {
//     #[prop_or_default]
//     pub children: Children,
// }

// type TTT = Box<dyn Fn((), NodeRef) -> WebGlRenderingContext>;

// #[function_component]
// pub fn GLProvider(props: &GLContextProps) -> Html {
//     let canvas_ref = use_node_ref();
//     let gll = use_memo(|_| RefCell::<Option<WebGlRenderingContext>>::new(None), ());

//     let callback = {
//         let canvas_ref = canvas_ref.clone();
//         let gll = gll.clone();

//         move |_: ()| {
//             console::log!("use_callback");
//             if let Some(gl) = (*gll).borrow().as_ref() {
//                 console::log!("got gl context");
//             } else {
//                 console::log!("no gl context");
//             }

//             let canvas = canvas_ref
//                 .cast::<HtmlCanvasElement>()
//                 .expect("canvas_ref not attached to a canvas element");

//             let gl: WebGlRenderingContext = canvas
//                 .get_context("webgl")
//                 .unwrap()
//                 .unwrap()
//                 .dyn_into()
//                 .unwrap();

//             console::log!("GL context created");

//             gl
//         }
//     };

//     // {
//     //     let canvas_ref = canvas_ref.clone();
//     //     let gll = gll.clone();

//     //     use_effect_with_deps(
//     //         move |canvas_ref| {
//     //             let canvas = canvas_ref
//     //                 .cast::<HtmlCanvasElement>()
//     //                 .expect("canvas_ref not attached to a canvas element");

//     //             let glctx: WebGlRenderingContext = canvas
//     //                 .get_context("webgl")
//     //                 .unwrap()
//     //                 .unwrap()
//     //                 .dyn_into()
//     //                 .unwrap();

//     //             console::log!("GL context created");

//     //             (*gll).borrow_mut().gl = Some(glctx);
//     //         },
//     //         canvas_ref,
//     //     );
//     // }
//     //     }
//     //     let gggg: Rc<GL> = Rc::new(gl.borrow().clone());
//     //     gggg
//     // };
//     // let gl_ref = {
//     //     let canvas_ref = canvas_ref.clone();
//     //     let gl_ref = use_callback(
//     //         |_: (), canvas_ref| {
//     //             console::log!("use_effect_with_deps");
//     //             let canvas = canvas_ref
//     //                 .cast::<HtmlCanvasElement>()
//     //                 .expect("canvas_ref not attached to a canvas element");

//     //             let gl: WebGlRenderingContext = canvas
//     //                 .get_context("webgl")
//     //                 .unwrap()
//     //                 .unwrap()
//     //                 .dyn_into()
//     //                 .unwrap();

//     //             console::log!("GL context created");

//     //             Rc::new(RefCell::new(GL { gl: Rc::new(Some(gl)) }))
//     //         },
//     //         (canvas_ref),
//     //     );
//     //     gl_ref
//     // };

//     // {
//     //     let gll = gll.clone();
//     //     if (*gll).borrow().gl.is_some() {
//     //         console::log!("got gl context");
//     //     } else {
//     //         console::log!("no gl context");
//     //     }
//     //     let timeout = Interval::new(1_000, move || {
//     //         if (*gll).borrow().gl.is_some() {
//     //             console::log!("got gl context");
//     //         } else {
//     //             console::log!("no gl context");
//     //         }
//     //     });
//     //     timeout.forget();
//     // }
//     // {
//     //     let canvas_ref = canvas_ref.clone();
//     //     let gl_ref = gl_ref.clone();

//     //     use_effect_with_deps(
//     //         move |(canvas_ref)| {
//     //             console::log!("use_effect_with_deps");
//     //             let canvas = canvas_ref
//     //                 .cast::<HtmlCanvasElement>()
//     //                 .expect("canvas_ref not attached to a canvas element");

//     //             let gl: webglrenderingcontext = canvas
//     //                 .get_context("webgl")
//     //                 .unwrap()
//     //                 .unwrap()
//     //                 .dyn_into()
//     //                 .unwrap();

//     //             console::log!("GL context created");

//     //             (*gl_ref).borrow_mut().gl = Rc::new(Some(gl));
//     //         },
//     //         canvas_ref,
//     //     );
//     // }

//     html! {
//         <ContextProvider<TTT> context={callback}>
//             <canvas id="gl-canvas" ref={canvas_ref} ></canvas>
//             {props.children.clone()}
//         </ContextProvider<TTT>>
//     }
// }

// pub fn use_gl_context() -> impl Hook<Output = Option<Rc<RefCell<GL>>>> {
//     use_context::<Rc<RefCell<GL>>>()
// }

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct Message {
    pub inner: String,
    pub gl: Option<WebGlRenderingContext>,
}

impl Reducible for Message {
    type Action = (String, Option<WebGlRenderingContext>);

    fn reduce(self: Rc<Self>, action: Self::Action) -> Rc<Self> {
        Message {
            inner: action.0,
            gl: action.1,
        }
        .into()
    }
}

pub type MessageContext = UseReducerHandle<Message>;

#[derive(Properties, Debug, PartialEq)]
pub struct MessageProviderProps {
    #[prop_or_default]
    pub children: Children,
}

#[function_component]
pub fn GLProvider(props: &MessageProviderProps) -> Html {
    let canvas_ref = use_node_ref();

    let msg = use_reducer(|| Message {
        inner: "No message yet.".to_string(),
        gl: None,
    });

    {
        let canvas_ref = canvas_ref.clone();
        let msg = msg.clone();
        use_effect_with_deps(
            move |(msg, canvas_ref)| {
                let canvas = canvas_ref
                    .cast::<HtmlCanvasElement>()
                    .expect("canvas_ref not attached to a canvas element");

                let gl: WebGlRenderingContext = canvas
                    .get_context("webgl")
                    .unwrap()
                    .unwrap()
                    .dyn_into()
                    .unwrap();

                console::log!("GL context created");

                msg.dispatch(("GL context created".to_string(), Some(gl)));
            },
            (msg, canvas_ref),
        );
    }

    html! {
        <ContextProvider<MessageContext> context={msg}>
            <canvas id="gl-canvas" ref={canvas_ref} ></canvas>
            {props.children.clone()}
        </ContextProvider<MessageContext>>
    }
}
