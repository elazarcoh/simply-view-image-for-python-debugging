
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub enum ViewsType {
    Single,
    Dual,
    Quad,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum InSingleViewName {
    Single,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum InDualViewName {
    Left,
    Right,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum InQuadViewName {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
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
