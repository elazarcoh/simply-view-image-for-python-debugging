use stylist::{css, yew::use_style, Style};
use yew::prelude::*;
use yewdux::{
    dispatch,
    prelude::{use_selector, Dispatch},
};

use crate::{
    communication::incoming_messages::ImageInfo,
    components::icon_button::{IconToggleButton, ToggleState},
    image_view::types::{Coloring, DrawingOptionsBuilder},
    reducer::{StoreAction, UpdateDrawingOptions},
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
        let for_all = EnumSet::from(Feature::Invert);
        let rgb_features = Feature::RGB | Feature::BGR | Feature::R | Feature::G | Feature::B | Feature::Grayscale | Feature::NoAlpha;
        let gray_alpha_features = Feature::NoAlpha | Feature::HighContrast;
        let gray_features = Feature::HighContrast | Feature::Heatmap | Feature::NoAlpha;
        let integer_gray_features = Feature::Segmentation | gray_features;
        let no_additional_features = EnumSet::empty();

        for_all | match (channels, datatype) {
            (Channels::One, Datatype::Uint8) => integer_gray_features,
            (Channels::One, Datatype::Uint16) => integer_gray_features,
            (Channels::One, Datatype::Uint32) => integer_gray_features,
            (Channels::One, Datatype::Float32) => gray_features,
            (Channels::One, Datatype::Int8) => integer_gray_features,
            (Channels::One, Datatype::Int16) => integer_gray_features,
            (Channels::One, Datatype::Int32) => integer_gray_features,
            (Channels::One, Datatype::Bool) => no_additional_features,
            (Channels::Two, Datatype::Uint8) => gray_alpha_features,
            (Channels::Two, Datatype::Uint16) => gray_alpha_features,
            (Channels::Two, Datatype::Uint32) => gray_alpha_features,
            (Channels::Two, Datatype::Float32) => gray_alpha_features,
            (Channels::Two, Datatype::Int8) => gray_alpha_features,
            (Channels::Two, Datatype::Int16) => gray_alpha_features,
            (Channels::Two, Datatype::Int32) => gray_alpha_features,
            (Channels::Two, Datatype::Bool) => no_additional_features,
            (Channels::Three, Datatype::Uint8) => rgb_features,
            (Channels::Three, Datatype::Uint16) => rgb_features,
            (Channels::Three, Datatype::Uint32) => rgb_features,
            (Channels::Three, Datatype::Float32) => rgb_features,
            (Channels::Three, Datatype::Int8) => rgb_features,
            (Channels::Three, Datatype::Int16) => rgb_features,
            (Channels::Three, Datatype::Int32) => rgb_features,
            (Channels::Three, Datatype::Bool) => no_additional_features,
            (Channels::Four, Datatype::Uint8) => rgb_features,
            (Channels::Four, Datatype::Uint16) => rgb_features,
            (Channels::Four, Datatype::Uint32) => rgb_features,
            (Channels::Four, Datatype::Float32) => rgb_features,
            (Channels::Four, Datatype::Int8) => rgb_features,
            (Channels::Four, Datatype::Int16) => rgb_features,
            (Channels::Four, Datatype::Int32) => rgb_features,
            (Channels::Four, Datatype::Bool) => no_additional_features,
            
        }

    }
}

#[function_component]
pub fn DisplayOption(props: &DisplayOptionProps) -> Html {
    let DisplayOptionProps { entry } = props;

    let image_id = entry.image_id.clone();
    let drawing_options = use_selector(move |state: &AppState| {
        state.drawing_options.borrow().get_or_default(&image_id)
    });

    let features = features::list_features(entry.datatype, entry.channels);

    let currently_selected_style = use_style!(
        r#"
        background-color: var(--vscode-button-background);
    "#
    );
    let default_style = use_style!(r#" "#);

    let image_id = entry.image_id.clone();
    let high_contrast_button = html! {
        <IconButton
            class={if drawing_options.high_contrast { currently_selected_style.clone() } else { default_style.clone() }}
            aria_label={"High Contrast"}
            title={"High Contrast"}
            icon={"svifpd-icons svifpd-icons-contrast"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::new();
                let drawing_options = drawing_options.clone();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::HighContrast(!drawing_options.high_contrast))); }
            }}
        />
    };
    let grayscale_button = html! {
        <IconButton
            class={if drawing_options.coloring == Coloring::Grayscale { currently_selected_style.clone() } else { default_style.clone() }}
            aria_label={"Grayscale"}
            title={"Grayscale"}
            icon={"codicon svifpd-icons-Grayscale"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::new();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::Coloring(Coloring::Grayscale))); }
            }}
        />
    };
    let rgb_button = html! {
        <IconButton
            class={if drawing_options.coloring == Coloring::Rgb { currently_selected_style.clone() } else { default_style.clone() }}
            aria_label={"RGB"}
            title={"RGB"}
            icon={"svifpd-icons svifpd-icons-RGB"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::new();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::Coloring(Coloring::Rgb))); }
            }}
        />
    };
    let bgr_button = html! {
        <IconButton
            class={if drawing_options.coloring == Coloring::Bgr { currently_selected_style.clone() } else { default_style.clone() }}
            aria_label={"BGR"}
            title={"BGR"}
            icon={"svifpd-icons svifpd-icons-BGR"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::new();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::Coloring(Coloring::Bgr))); }
            }}
        />
    };
    let r_button = html! {
        <IconButton
            class={if drawing_options.coloring == Coloring::R { currently_selected_style.clone() } else { default_style.clone() }}
            aria_label={"Red Channel"}
            title={"Red Channel"}
            icon={"svifpd-icons svifpd-icons-R"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::new();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::Coloring(Coloring::R))); }
            }}
        />
    };
    let g_button = html! {
        <IconButton
            class={if drawing_options.coloring == Coloring::G { currently_selected_style.clone() } else { default_style.clone() }}
            aria_label={"Green Channel"}
            title={"Green Channel"}
            icon={"svifpd-icons svifpd-icons-G"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::new();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::Coloring(Coloring::G))); }
            }}
        />
    };
    let b_button = html! {
        <IconButton
            class={if drawing_options.coloring == Coloring::B { currently_selected_style.clone() } else { default_style.clone() }}
            aria_label={"Blue Channel"}
            title={"Blue Channel"}
            icon={"svifpd-icons svifpd-icons-B"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::new();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::Coloring(Coloring::B))); }
            }}
        />
    };
    let invert_button = html! {
        <IconButton
            class={if drawing_options.invert { currently_selected_style.clone() } else { default_style.clone() }}
            aria_label={"Invert Colors"}
            title={"Invert Colors"}
            icon={"svifpd-icons svifpd-icons-invert"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::new();
                let drawing_options = drawing_options.clone();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::Invert(!drawing_options.invert))); }
            }}
        />
    };
    // let transpose_button = html! {
    //     <IconButton
    //         aria_label={"Transpose"}
    //         title={"Transpose"}
    //         icon={"svifpd-icons svifpd-icons-transpose"}
    //     />
    // };

    let mut buttons = Vec::new();
    if features.contains(features::Feature::HighContrast) {
        buttons.push(high_contrast_button);
    }
    if features.contains(features::Feature::Grayscale) {
        buttons.push(grayscale_button);
    }
    if features.contains(features::Feature::RGB) {
        buttons.push(rgb_button);
    }
    if features.contains(features::Feature::BGR) {
        buttons.push(bgr_button);
    }
    if features.contains(features::Feature::R) {
        buttons.push(r_button);
    }
    if features.contains(features::Feature::G) {
        buttons.push(g_button);
    }
    if features.contains(features::Feature::B) {
        buttons.push(b_button);
    }
    if features.contains(features::Feature::Invert) {
        buttons.push(invert_button);
    }
    // if features.contains(features::Feature::Transpose) {
    //     buttons.push(transpose_button);
    // }

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
