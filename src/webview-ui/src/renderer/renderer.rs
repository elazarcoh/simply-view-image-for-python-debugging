use std::{collections::HashMap, iter::FromIterator};

use web_sys::WebGlRenderingContext;
use yew::NodeRef;

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub enum ViewsType {
    Single,
    Dual,
    Quad,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub enum InSingleViewName {
    Single,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub enum InDualViewName {
    Left,
    Right,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub enum InQuadViewName {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

pub enum InViewName {
    Single(InSingleViewName),
    Dual(InDualViewName),
    Quad(InQuadViewName),
}

impl ToString for InSingleViewName {
    fn to_string(&self) -> String {
        match self {
            InSingleViewName::Single => "Single".to_string(),
        }
    }
}

impl ToString for InDualViewName {
    fn to_string(&self) -> String {
        match self {
            InDualViewName::Left => "Left".to_string(),
            InDualViewName::Right => "Right".to_string(),
        }
    }
}

impl ToString for InQuadViewName {
    fn to_string(&self) -> String {
        match self {
            InQuadViewName::TopLeft => "TopLeft".to_string(),
            InQuadViewName::TopRight => "TopRight".to_string(),
            InQuadViewName::BottomLeft => "BottomLeft".to_string(),
            InQuadViewName::BottomRight => "BottomRight".to_string(),
        }
    }
}

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
    gl: WebGlRenderingContext,
    // view_holders: HashMap<ViewsType, HashMap<String, ViewHolder>>,
}

impl Renderer {
    pub fn new(gl: WebGlRenderingContext) -> Self {
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
            gl,
            // view_holders: HashMap::from_iter(
            //     vec![ViewsType::Single, ViewsType::Dual, ViewsType::Quad]
            //         .into_iter()
            //         .map(|vt| (vt, make_map(vt))),
            // ),
        }
    }

    pub fn register(&mut self, view_id: InViewName, node: NodeRef) {
        let view_id = match view_id {
            InViewName::Single(v) => (ViewsType::Single, v.to_string()),
            InViewName::Dual(v) => (ViewsType::Dual, v.to_string()),
            InViewName::Quad(v) => (ViewsType::Quad, v.to_string()),
        };
        // self.view_holders
        //     .get_mut(&view_id.0)
        //     .unwrap()
        //     .get_mut(&view_id.1)
        //     .unwrap()
        //     .node = node;
    }
}
