use crate::coloring::DrawingOptions;

#[derive(Debug, Clone, PartialEq, Default, serde::Serialize, serde::Deserialize)]
pub(crate) struct CurrentImage {
    pub(crate) id: String,
    pub(crate) expression: String,
    pub(crate) drawing_options: DrawingOptions,
}

#[derive(Builder, Debug, Clone, PartialEq, Default, serde::Serialize, serde::Deserialize)]
#[builder(setter(into), name = "HostExtensionStateUpdate")]
pub(crate) struct HostExtensionState {
    pub(crate) current_image_id: Option<String>,
    pub(crate) current_image_expression: Option<String>,
    pub(crate) current_image_drawing_options: Option<DrawingOptions>,
}

pub(crate) fn update_host_extension_state(
    host_extension_state: HostExtensionState,
    update: HostExtensionStateUpdate,
) -> HostExtensionState {
    macro_rules! update_field {
        ($field:ident) => {
            if let Some($field) = update.$field {
                $field
            } else {
                host_extension_state.$field
            }
        };
    }

    HostExtensionState {
        current_image_id: update_field!(current_image_id),
        current_image_expression: update_field!(current_image_expression),
        current_image_drawing_options: update_field!(current_image_drawing_options),
    }
}
