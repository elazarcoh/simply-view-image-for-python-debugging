use std::{cell::RefCell, collections::HashMap, iter::FromIterator, rc::Rc};

use wasm_bindgen::prelude::*;
use web_sys::{
    HtmlCanvasElement, HtmlElement, WebGl2RenderingContext as GL, WebGl2RenderingContext,
};
use yew::NodeRef;

use super::{ImageCache, InDualViewName, InQuadViewName, InSingleViewName, InViewName, ViewsType};
use crate::webgl_utils;
use crate::webgl_utils::types::{ArrayData, ArraySpec};

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

#[derive(PartialEq)]
struct ViewData {
    pub image_id: Option<String>,
}

impl Default for ViewData {
    fn default() -> Self {
        Self { image_id: None }
    }
}

#[derive(PartialEq)]
struct ViewHolder {
    node: NodeRef,
    data: ViewData,
}

#[derive(PartialEq)]
struct ViewHolders(HashMap<ViewsType, HashMap<String, ViewHolder>>);

impl ViewHolders {
    fn visible_nodes(&self) -> Vec<(&ViewHolder, HtmlElement)> {
        self.0
            .values()
            .flat_map(|m| m.values())
            .filter_map(|v| v.node.cast::<HtmlElement>().map(|e| (v, e)))
            .collect::<Vec<_>>()
    }

    pub fn register(&mut self, view_id: InViewName, node: NodeRef) {
        log::debug!("Renderer::register({:?})", view_id);
        let view_id = match view_id {
            InViewName::Single(v) => (ViewsType::Single, v.to_string()),
            InViewName::Dual(v) => (ViewsType::Dual, v.to_string()),
            InViewName::Quad(v) => (ViewsType::Quad, v.to_string()),
        };
        self.0
            .get_mut(&view_id.0)
            .unwrap()
            .get_mut(&view_id.1)
            .unwrap()
            .node = node;
    }
}

#[derive(PartialEq)]
pub struct Renderer {
    gl: Option<WebGl2RenderingContext>,
    view_holders: Rc<RefCell<ViewHolders>>,
    image_cache: Rc<RefCell<ImageCache>>,
}

impl Renderer {
    pub fn new(image_cache: Rc<RefCell<ImageCache>>) -> Self {
        let make_map = |vt: ViewsType| -> HashMap<String, ViewHolder> {
            HashMap::from_iter(views(vt).into_iter().map(|v| {
                (
                    v,
                    ViewHolder {
                        node: NodeRef::default(),
                        data: ViewData::default(),
                    },
                )
            }))
        };
        Self {
            gl: None,
            view_holders: Rc::new(RefCell::new(ViewHolders(HashMap::from_iter(
                vec![ViewsType::Single, ViewsType::Dual, ViewsType::Quad]
                    .into_iter()
                    .map(|vt| (vt, make_map(vt))),
            )))),
            image_cache,
        }
    }

    fn request_animation_frame(f: &Closure<dyn FnMut()>) {
        web_sys::window()
            .unwrap()
            .request_animation_frame(f.as_ref().unchecked_ref())
            .expect("should register `requestAnimationFrame` OK");
    }

    pub fn bind_gl(&mut self, gl: WebGl2RenderingContext) {
        log::debug!("Renderer::bind_gl");

        gl.enable(WebGl2RenderingContext::SCISSOR_TEST);

        // Gloo-render's request_animation_frame has this extra closure
        // wrapping logic running every frame, unnecessary cost.
        // Here constructing the wrapped closure just once.

        let cb = Rc::new(RefCell::new(None));

        *cb.borrow_mut() = Some(Closure::wrap(Box::new({
            let cb = cb.clone();
            let gl = gl.clone();
            let view_holders = self.view_holders.clone();
            move || {
                if gl.is_context_lost() {
                    // Drop our handle to this closure so that it will get cleaned
                    // up once we return.
                    let _ = cb.borrow_mut().take();
                    return;
                } else {
                    Renderer::render(&gl, &view_holders);
                    // Renderer::request_animation_frame(cb.borrow().as_ref().unwrap());
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
        self.view_holders.borrow_mut().register(view_id, node);
    }

    pub fn put_image_to_view(&mut self, view_id: InViewName, image_id: &str) {
        log::debug!("Renderer::put_image_to_view({:?}, {})", view_id, image_id);
        let view_id = match view_id {
            InViewName::Single(v) => (ViewsType::Single, v.to_string()),
            InViewName::Dual(v) => (ViewsType::Dual, v.to_string()),
            InViewName::Quad(v) => (ViewsType::Quad, v.to_string()),
        };
        self.view_holders
            .borrow_mut()
            .0
            .get_mut(&view_id.0)
            .unwrap()
            .get_mut(&view_id.1)
            .unwrap()
            .data
            .image_id = Some(image_id.to_string());
    }

    fn render(gl: &WebGl2RenderingContext, view_holders: &Rc<RefCell<ViewHolders>>) {
        let render_result = view_holders
            .borrow()
            .visible_nodes()
            .iter()
            .map(|(v, e)| Renderer::render_view(gl, v, e))
            .collect::<Result<Vec<_>, _>>();
        if let Err(e) = render_result {
            log::error!("Renderer::render: {}", e);
        }
    }

    fn render_view(
        gl: &WebGl2RenderingContext,
        v: &ViewHolder,
        e: &HtmlElement,
    ) -> Result<(), String> {
        let canvas = gl
            .canvas()
            .unwrap()
            .dyn_into::<HtmlCanvasElement>()
            .unwrap();
        let rect = e.get_bounding_client_rect();

        // The following two lines set the size (in CSS pixels) of
        // the drawing buffer to be identical to the size of the
        // canvas HTML element, as determined by CSS.
        canvas.set_width(canvas.client_width() as u32);
        canvas.set_height(canvas.client_height() as u32);

        let width = rect.right() - rect.left();
        let height = rect.bottom() - rect.top();
        let left = rect.left();
        let bottom = gl
            .canvas()
            .unwrap()
            .dyn_into::<HtmlCanvasElement>()
            .unwrap()
            .client_height() as f64
            - rect.bottom();

        gl.viewport(left as i32, bottom as i32, width as i32, height as i32);
        gl.scissor(left as i32, bottom as i32, width as i32, height as i32);

        gl.clear_color(1.0, 0.0, 0.0, 1.0);
        gl.clear(WebGl2RenderingContext::COLOR_BUFFER_BIT);

        let vert_code = include_str!("../shaders/basic.vert");
        let frag_code = include_str!("../shaders/basic.frag");
            
        let array_info: ArraySpec<&[f32]> = ArraySpec {
            name: "a_position".to_string(),
            data: ArrayData::Slice(&[
                -0.5_f32, -0.5, // bottom left
                0.5, -0.5, // bottom right
                0.0, 0.5, // top
            ]),
            num_components: 2,
        };
        let attr = webgl_utils::attributes::create_attributes_from_array(gl, array_info)?;

        // triangle at the center of the screen
        let vertices: Vec<f32> = vec![
            -0.5, -0.5, // bottom left
            0.5, -0.5, // bottom right
            0.0, 0.5, // top
        ];
        let vertex_buffer = gl.create_buffer().unwrap();
        let verts = js_sys::Float32Array::from(vertices.as_slice());

        gl.bind_buffer(GL::ARRAY_BUFFER, Some(&vertex_buffer));
        gl.buffer_data_with_array_buffer_view(GL::ARRAY_BUFFER, &verts, GL::STATIC_DRAW);

        let shader_program = webgl_utils::GLProgramBuilder::new(&gl)
            .vertex_shader(vert_code)
            .fragment_shader(frag_code)
            .attribute("a_position")
            .build()?;

        gl.use_program(Some(&shader_program.program));

        shader_program.uniform_setters.get("u_time").unwrap()(&gl, &0.0);

        // Attach the position vector as an attribute for the GL context.
        let position = gl.get_attrib_location(&shader_program.program, "a_position") as u32;
        gl.vertex_attrib_pointer_with_i32(position, 2, GL::FLOAT, false, 0, 0);
        gl.enable_vertex_attrib_array(position);

        // Attach the time as a uniform for the GL context.
        gl.draw_arrays(GL::TRIANGLES, 0, 6);

        Ok(())
    }
}
