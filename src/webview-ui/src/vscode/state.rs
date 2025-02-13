use crate::coloring::DrawingOptions;

#[derive(Debug, Clone, PartialEq, Default, serde::Serialize, serde::Deserialize)]
pub(crate) struct CurrentImage {
    pub(crate) id: String,
    pub(crate) expression: String,
    pub(crate) drawing_options: DrawingOptions,
}

#[derive(Debug, Clone, PartialEq, Default, serde::Serialize, serde::Deserialize)]
pub(crate) struct HostExtensionState {
    pub(crate) current_image: Option<CurrentImage>,
}
