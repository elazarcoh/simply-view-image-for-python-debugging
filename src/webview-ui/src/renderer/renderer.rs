use std::{cell::RefCell, collections::HashMap, iter::FromIterator, rc::Rc};

use wasm_bindgen::prelude::*;
use web_sys::WebGlRenderingContext;
use yew::NodeRef;

use super::{InDualViewName, InQuadViewName, InSingleViewName, InViewName, ViewsType};

fn views(vt: ViewsType) -> Vec<String> {
    match vt {
        ViewsType::Single => vec![InSingleViewName::Single.to_string()],
        ViewsType::Dual => vec![
            InDualViewName::Left.to_string(),
            InDualViewName::Right.to_string(),
        ],
        ViewsType::Quad => vec![
            InQuadViewName::TopLeft.to_string(),
            InQuadViewName::TopRight.to_string(),
            InQuadViewName::BottomLeft.to_string(),
            InQuadViewName::BottomRight.to_string(),
        ],
    }
}

#[derive(Clone, PartialEq)]
struct ViewHolder {
    node: NodeRef,
}

#[derive(PartialEq)]
pub struct Renderer {
    gl: Option<WebGlRenderingContext>,
    view_holders: HashMap<ViewsType, HashMap<String, ViewHolder>>,
}

impl Renderer {
    pub fn new() -> Self {
        let make_map = |vt: ViewsType| -> HashMap<String, ViewHolder> {
            HashMap::from_iter(views(vt).into_iter().map(|v| {
                (
                    v,
                    ViewHolder {
                        node: NodeRef::default(),
                    },
                )
            }))
        };
        Self {
            gl: None,
            view_holders: HashMap::from_iter(
                vec![ViewsType::Single, ViewsType::Dual, ViewsType::Quad]
                    .into_iter()
                    .map(|vt| (vt, make_map(vt))),
            ),
        }
    }

    fn request_animation_frame(f: &Closure<dyn FnMut()>) {
        web_sys::window()
            .unwrap()
            .request_animation_frame(f.as_ref().unchecked_ref())
            .expect("should register `requestAnimationFrame` OK");
    }

    pub fn bind_gl(&mut self, gl: WebGlRenderingContext) {
        log::debug!("Renderer::bind_gl");

        // Gloo-render's request_animation_frame has this extra closure
        // wrapping logic running every frame, unnecessary cost.
        // Here constructing the wrapped closure just once.

        let cb = Rc::new(RefCell::new(None));

        *cb.borrow_mut() = Some(Closure::wrap(Box::new({
            let cb = cb.clone();
            let gl = gl.clone();
            move || {
                if gl.is_context_lost() {
                    // Drop our handle to this closure so that it will get cleaned
                    // up once we return.
                    let _ = cb.borrow_mut().take();
                    return;
                } else {
                    Renderer::render(&gl);
                    Renderer::request_animation_frame(cb.borrow().as_ref().unwrap());
                }
            }
        }) as Box<dyn FnMut()>));

        Renderer::request_animation_frame(cb.borrow().as_ref().unwrap());

        self.gl = Some(gl);
    }

    pub fn unbind_gl(&mut self) {
        log::debug!("Renderer::unbind_gl");
        self.gl = None;
    }

    pub fn register(&mut self, view_id: InViewName, node: NodeRef) {
        log::debug!("Renderer::register({:?})", view_id);
        let view_id = match view_id {
            InViewName::Single(v) => (ViewsType::Single, v.to_string()),
            InViewName::Dual(v) => (ViewsType::Dual, v.to_string()),
            InViewName::Quad(v) => (ViewsType::Quad, v.to_string()),
        };
        self.view_holders
            .get_mut(&view_id.0)
            .unwrap()
            .get_mut(&view_id.1)
            .unwrap()
            .node = node;
    }

    fn render(gl: &WebGlRenderingContext) {
        gl.clear_color(0.0, 1.0, 0.0, 1.0);
        gl.clear(WebGlRenderingContext::COLOR_BUFFER_BIT);
    }

    //     gl.enable(WebGlRenderingContext::SCISSOR_TEST);
    //         div_ref.cast::<HtmlElement>().map(|elem| {
    //             console::log!("div_ref cast to HtmlElement");
    //             let rect = elem.get_bounding_client_rect();

    //             if (rect.bottom() < 0.0
    //                 || rect.top()
    //                     > gl.canvas()
    //                         .unwrap()
    //                         .dyn_into::<HtmlCanvasElement>()
    //                         .unwrap()
    //                         .client_height() as f64)
    //                 || (rect.right() < 0.0
    //                     || rect.left()
    //                         > gl.canvas()
    //                             .unwrap()
    //                             .dyn_into::<HtmlCanvasElement>()
    //                             .unwrap()
    //                             .client_width() as f64)
    //             {
    //                 console::log!("GLView div_ref not visible");
    //             }

    //             let width = rect.right() - rect.left();
    //             let height = rect.bottom() - rect.top();
    //             let left = rect.left();
    //             // let bottom = gl.canvas().unwrap().dyn_into::<HtmlCanvasElement>().unwrap().client_height() as f64 - rect.bottom();
    //             let bottom = 100;

    //             console::log!(
    //                 "width: {}, height: {}, left: {}, bottom: {}",
    //                 width,
    //                 height,
    //                 left,
    //                 bottom
    //             );
    //             gl.viewport(left as i32, bottom as i32, width as i32, height as i32);
    //             gl.scissor(left as i32, bottom as i32, width as i32, height as i32);

    //             gl.clear_color(1.0, 0.0, 0.0, 1.0);
    //             gl.clear(WebGlRenderingContext::COLOR_BUFFER_BIT);
}
