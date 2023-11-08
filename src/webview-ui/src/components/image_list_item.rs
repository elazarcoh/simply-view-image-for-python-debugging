use stylist::yew::use_style;
use yew::prelude::*;
use yewdux::{dispatch, prelude::Dispatch};

use crate::{
    communication::incoming_messages::ImageInfo,
    components::icon_button::{IconToggleButton, ToggleState},
    image_view::types::DrawingOptionsBuilder,
    store::AppState,
};

use super::icon_button::IconButton;

#[derive(PartialEq, Properties)]
pub struct DisplayOptionProps {
    pub entry: ImageInfo,
}

mod features {
    use enumset::{EnumSet, EnumSetType};

    use crate::communication::incoming_messages::{Channels, Datatype};

    #[derive(EnumSetType, Debug)]
    #[allow(clippy::upper_case_acronyms)]
    pub enum Feature {
        HighContrast,
        Grayscale,
        RGB,
        BGR,
        R,
        G,
        B,
        Invert,
        Transpose,
        Segmentation,
        Heatmap,
        NoAlpha,
    }

    #[rustfmt::skip]
    pub(crate) fn list_features(datatype: Datatype, channels: Channels) -> EnumSet<Feature> {
        match (channels, datatype) {
            (Channels::One, Datatype::Uint8) => Feature::HighContrast | Feature::Invert | Feature::Segmentation | Feature::Heatmap,
            (Channels::One, Datatype::Uint16) => Feature::HighContrast | Feature::Invert |  Feature::Segmentation | Feature::Heatmap,
            (Channels::One, Datatype::Float32) => Feature::HighContrast | Feature::Invert |  Feature::Heatmap,
            (Channels::One, Datatype::Int8) => Feature::HighContrast | Feature::Invert |  Feature::Segmentation | Feature::Heatmap,
            (Channels::One, Datatype::Int16) => Feature::HighContrast | Feature::Invert |  Feature::Segmentation | Feature::Heatmap,
            (Channels::One, Datatype::Bool) => EnumSet::from(Feature::Invert),
            (Channels::Two, Datatype::Uint8) => Feature::Grayscale | Feature::R | Feature::G | Feature::Invert,
            (Channels::Two, Datatype::Uint16) => Feature::Grayscale | Feature::R | Feature::G | Feature::Invert,
            (Channels::Two, Datatype::Float32) => Feature::Grayscale | Feature::R | Feature::G | Feature::Invert,
            (Channels::Two, Datatype::Int8) => Feature::Grayscale | Feature::R | Feature::G | Feature::Invert,
            (Channels::Two, Datatype::Int16) => Feature::Grayscale | Feature::R | Feature::G | Feature::Invert,
            (Channels::Two, Datatype::Bool) => Feature::Grayscale | Feature::R | Feature::G | Feature::Invert,
            (Channels::Three, Datatype::Uint8) => Feature::Grayscale | Feature::RGB | Feature::BGR | Feature::R | Feature::G | Feature::B | Feature::Invert,
            (Channels::Three, Datatype::Uint16) => Feature::Grayscale | Feature::RGB | Feature::BGR | Feature::R | Feature::G | Feature::B | Feature::Invert,
            (Channels::Three, Datatype::Float32) => Feature::Grayscale | Feature::RGB | Feature::BGR | Feature::R | Feature::G | Feature::B | Feature::Invert,
            (Channels::Three, Datatype::Int8) => Feature::Grayscale | Feature::RGB | Feature::BGR | Feature::R | Feature::G | Feature::B | Feature::Invert,
            (Channels::Three, Datatype::Int16) => Feature::Grayscale | Feature::RGB | Feature::BGR | Feature::R | Feature::G | Feature::B | Feature::Invert,
            (Channels::Three, Datatype::Bool) => Feature::Grayscale | Feature::RGB | Feature::BGR | Feature::R | Feature::G | Feature::B | Feature::Invert,
            (Channels::Four, Datatype::Uint8) => Feature::Grayscale | Feature::RGB | Feature::BGR | Feature::R | Feature::G | Feature::B | Feature::Invert | Feature::NoAlpha,
            (Channels::Four, Datatype::Uint16) => Feature::Grayscale | Feature::RGB | Feature::BGR | Feature::R | Feature::G | Feature::B | Feature::Invert | Feature::NoAlpha,
            (Channels::Four, Datatype::Float32) => Feature::Grayscale | Feature::RGB | Feature::BGR | Feature::R | Feature::G | Feature::B | Feature::Invert | Feature::NoAlpha,
            (Channels::Four, Datatype::Int8) => Feature::Grayscale | Feature::RGB | Feature::BGR | Feature::R | Feature::G | Feature::B | Feature::Invert | Feature::NoAlpha,
            (Channels::Four, Datatype::Int16) => Feature::Grayscale | Feature::RGB | Feature::BGR | Feature::R | Feature::G | Feature::B | Feature::Invert | Feature::NoAlpha,
            (Channels::Four, Datatype::Bool) => Feature::Grayscale | Feature::RGB | Feature::BGR | Feature::R | Feature::G | Feature::B | Feature::Invert | Feature::NoAlpha,
        }
    }
}

#[function_component]
pub fn DisplayOption(props: &DisplayOptionProps) -> Html {
    let DisplayOptionProps { entry } = props;

    let features = features::list_features(entry.datatype, entry.channels);

    let dispatch = Dispatch::<AppState>::new();
    let image_id = entry.image_id.clone();
    let drawing_options = dispatch
        .get()
        .drawing_options
        .borrow()
        .get_or_default(&image_id);

    let high_contrast_button = html! {
        <IconToggleButton
            aria_label={"High Contrast"}
            off_icon={"svifpd-icons svifpd-icons-contrast"}
            initial_state={ToggleState::from(drawing_options.high_contrast)}

        />
    };
    let grayscale_button = html! {
        <IconButton
            aria_label={"Grayscale"}
            icon={"codicon svifpd-icons-Grayscale"}
        />
    };
    let RGB_button = html! {
        <IconButton
            aria_label={"RGB"}
            icon={"svifpd-icons svifpd-icons-RGB"}
        />
    };
    let BGR_button = html! {
        <IconButton
            aria_label={"BGR"}
            icon={"svifpd-icons svifpd-icons-BGR"}
        />
    };
    let R_button = html! {
        <IconButton
            aria_label={"R"}
            icon={"svifpd-icons svifpd-icons-R"}
        />
    };
    let G_button = html! {
        <IconButton
            aria_label={"G"}
            icon={"svifpd-icons svifpd-icons-G"}
        />
    };
    let B_button = html! {
        <IconButton
            aria_label={"B"}
            icon={"svifpd-icons svifpd-icons-B"}
        />
    };
    let invert_button = html! {
        <IconButton
            aria_label={"Invert"}
            icon={"svifpd-icons svifpd-icons-invert"}
        />
    };
    let transpose_button = html! {
        <IconButton
            aria_label={"Transpose"}
            icon={"svifpd-icons svifpd-icons-transpose"}
        />
    };

    let mut buttons = Vec::new();
    if features.contains(features::Feature::HighContrast) {
        buttons.push(high_contrast_button);
    }
    if features.contains(features::Feature::Grayscale) {
        buttons.push(grayscale_button);
    }
    if features.contains(features::Feature::RGB) {
        buttons.push(RGB_button);
    }
    if features.contains(features::Feature::BGR) {
        buttons.push(BGR_button);
    }
    if features.contains(features::Feature::R) {
        buttons.push(R_button);
    }
    if features.contains(features::Feature::G) {
        buttons.push(G_button);
    }
    if features.contains(features::Feature::B) {
        buttons.push(B_button);
    }
    if features.contains(features::Feature::Invert) {
        buttons.push(invert_button);
    }
    if features.contains(features::Feature::Transpose) {
        buttons.push(transpose_button);
    }

    let style = use_style!(
        r#"
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-start;
        align-items: center;
    "#
    );

    html! {
        <div class={style}>
            {for buttons.into_iter()}
        </div>
    }
}

fn shape_to_string(shape: &[u32]) -> String {
    let mut shape_string = String::new();
    for (i, dim) in shape.iter().enumerate() {
        if i > 0 {
            shape_string.push('x');
        }
        shape_string.push_str(&dim.to_string());
    }
    shape_string
}

#[derive(PartialEq, Properties, Clone)]
pub struct ImageListItemProps {
    pub entry: ImageInfo,
}

#[function_component]
pub fn ImageListItem(props: &ImageListItemProps) -> Html {
    let ImageListItemProps { entry } = props;

    let container_style = use_style!(
        r#"
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: left;
    "#
    );

    let info_grid_style = use_style!(
        r#"
        user-select: none;
        pointer-events: none;
    "#,
    );

    let info_grid_cell_style = use_style!(
        r#"
        padding-top: 1px;
        padding-bottom: 1px;
    "#,
    );

    html! {
        <div class={container_style.clone()}>
            <div>
                <label>{&entry.expression}</label>
                <vscode-data-grid aria-label="Basic" grid-template-columns="max-content auto" class={info_grid_style.clone()}>
                    <vscode-data-grid-row>
                        <vscode-data-grid-cell class={info_grid_cell_style.clone()} cell-type="columnheader" grid-column="1">{"Shape"}</vscode-data-grid-cell>
                        // <vscode-data-grid-cell class={info_grid_cell_style.clone()} grid-column="2">{shape_to_string(&entry.shape)}</vscode-data-grid-cell>
                    </vscode-data-grid-row>
                    <vscode-data-grid-row>
                        <vscode-data-grid-cell class={info_grid_cell_style.clone()} cell-type="columnheader" grid-column="1">{"Data Type"}</vscode-data-grid-cell>
                        // <vscode-data-grid-cell class={info_grid_cell_style.clone()} grid-column="2">{&entry.data_type}</vscode-data-grid-cell>
                    </vscode-data-grid-row>
                </vscode-data-grid>
                <DisplayOption entry={entry.clone()} />
            </div>
        </div>
    }
}
