use stylist::yew::use_style;
use yew::prelude::*;
use yewdux::{use_selector_with_deps, Dispatch};

use crate::{
    application_state::{
        app_state::{AppState, StoreAction, UpdateDrawingOptions},
        images::DrawingContext,
    },
    coloring::Coloring,
    common::ImageInfo,
};

use super::icon_button::IconButton;

#[derive(PartialEq, Properties)]
pub(crate) struct DisplayOptionProps {
    pub entry: ImageInfo,
    pub drawing_context: DrawingContext,
}

mod features {
    use enumset::{EnumSet, EnumSetType};

    use crate::common::{Channels, Datatype, ImageInfo};

    #[derive(EnumSetType, Debug)]
    #[allow(clippy::upper_case_acronyms)]
    pub(crate) enum Feature {
        HighContrast,
        Grayscale,
        SwapRgbBgr,
        R,
        G,
        B,
        Invert,
        Transpose,
        Segmentation,
        Heatmap,
        IgnoreAlpha,
    }

    #[rustfmt::skip]
    pub(crate) fn list_features(entry: &ImageInfo) -> EnumSet<Feature> {

        let datatype = entry.datatype;
        let channels = entry.channels;

        let for_all = EnumSet::only(Feature::Invert);
        let rgb_features = Feature::SwapRgbBgr | Feature::R | Feature::G | Feature::B | Feature::Grayscale  | Feature::HighContrast;
        let bool_rgb_features = Feature::SwapRgbBgr | Feature::R | Feature::G | Feature::B ;
        let alpha_features = Feature::IgnoreAlpha;
        let rgba_features = rgb_features | alpha_features;
        let gray_alpha_features = Feature::HighContrast | alpha_features;
        let gray_features = Feature::HighContrast | Feature::Heatmap | alpha_features;
        let integer_gray_features = Feature::Segmentation | gray_features;
        // let batched_features = EnumSet::only(Feature::Batched);
        let binary_features = EnumSet::only(Feature::Segmentation);
        let no_additional_features = EnumSet::empty();

        for_all | match (channels, datatype) {
            (Channels::One, Datatype::Uint8) => integer_gray_features,
            (Channels::One, Datatype::Uint16) => integer_gray_features,
            (Channels::One, Datatype::Uint32) => integer_gray_features,
            (Channels::One, Datatype::Float32) => gray_features,
            (Channels::One, Datatype::Int8) => integer_gray_features,
            (Channels::One, Datatype::Int16) => integer_gray_features,
            (Channels::One, Datatype::Int32) => integer_gray_features,
            (Channels::One, Datatype::Bool) => binary_features,
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
            (Channels::Three, Datatype::Bool) => bool_rgb_features,
            (Channels::Four, Datatype::Uint8) => rgba_features,
            (Channels::Four, Datatype::Uint16) => rgba_features,
            (Channels::Four, Datatype::Uint32) => rgba_features,
            (Channels::Four, Datatype::Float32) => rgba_features,
            (Channels::Four, Datatype::Int8) => rgba_features,
            (Channels::Four, Datatype::Int16) => rgba_features,
            (Channels::Four, Datatype::Int32) => rgba_features,
            (Channels::Four, Datatype::Bool) => bool_rgb_features,
        } 

    }
}

#[function_component]
pub(crate) fn DisplayOption(props: &DisplayOptionProps) -> Html {
    let DisplayOptionProps {
        entry,
        drawing_context,
    } = props;
    let drawing_context = *drawing_context;

    let image_id = entry.image_id.clone();
    let drawing_options = use_selector_with_deps(
        move |state: &AppState, (image_id, drawing_context)| {
            state
                .drawing_options
                .borrow()
                .get(image_id, drawing_context)
                .cloned()
                .unwrap_or_default()
        },
        (image_id, drawing_context),
    );

    let features = features::list_features(entry);

    let base_style = use_style!(
        r#"
        padding: 1px;
        "#,
    );
    let currently_selected_style = use_style!(
        r#"
        background-color: var(--vscode-button-background);
        :hover {
            background-color: var(--vscode-button-background);
        }
    "#
    );
    let default_style = use_style!(r#" "#);

    let image_id = entry.image_id.clone();
    let make_drawing_options_update = |update: UpdateDrawingOptions| {
        let image_id = image_id.clone();
        let dispatch = Dispatch::<AppState>::global();
        Callback::from(move |_| {
            dispatch.apply(StoreAction::UpdateDrawingOptions(
                image_id.clone(),
                drawing_context,
                update.clone(),
            ));
        })
    };

    let reset_button = html! {
        <IconButton
            class={base_style.clone()}
            aria_label={"Reset"}
            title={"Reset"}
            icon={"codicon codicon-discard"}
            onclick={make_drawing_options_update(UpdateDrawingOptions::Reset)}
        />
    };
    let high_contrast_button = html! {
        <IconButton
            class={classes!(
                base_style.clone(),
                if drawing_options.high_contrast { currently_selected_style.clone() } else { default_style.clone() })
            }
            aria_label={"High Contrast"}
            title={"High Contrast"}
            icon={"svifpd-icons svifpd-icons-contrast"}
            onclick={make_drawing_options_update(UpdateDrawingOptions::HighContrast(!drawing_options.high_contrast))}
        />
    };
    let grayscale_button = html! {
        <IconButton
            class={
                classes!(
                    base_style.clone(),
                    if drawing_options.coloring == Coloring::Grayscale { currently_selected_style.clone() } else { default_style.clone() }
                )
            }
            aria_label={"Grayscale"}
            title={"Grayscale"}
            icon={"svifpd-icons svifpd-icons-grayscale"}
            onclick={make_drawing_options_update(UpdateDrawingOptions::Coloring(Coloring::Grayscale))}
        />
    };
    let swap_rgb_bgr_button = html! {
        <IconButton
            class={classes!(
                base_style.clone(),
                if drawing_options.coloring == Coloring::SwapRgbBgr { currently_selected_style.clone() } else { default_style.clone() }
            )}
            aria_label={"Swap RGB/BGR"}
            title={"Swap RGB/BGR"}
            icon={"svifpd-icons svifpd-icons-BGR"}
            onclick={make_drawing_options_update(UpdateDrawingOptions::Coloring(Coloring::SwapRgbBgr))}
        />
    };
    let r_button = html! {
        <IconButton
            class={classes!(
                base_style.clone(),
                if drawing_options.coloring == Coloring::R { currently_selected_style.clone() } else { default_style.clone() }
            )}
            aria_label={"Red Channel"}
            title={"Red Channel"}
            icon={"svifpd-icons svifpd-icons-R"}
            onclick={make_drawing_options_update(UpdateDrawingOptions::Coloring(Coloring::R))}
        />
    };
    let g_button = html! {
        <IconButton
            class={classes!(
                base_style.clone(),
                if drawing_options.coloring == Coloring::G { currently_selected_style.clone() } else { default_style.clone() }
            )}
            aria_label={"Green Channel"}
            title={"Green Channel"}
            icon={"svifpd-icons svifpd-icons-G"}
            onclick={make_drawing_options_update(UpdateDrawingOptions::Coloring(Coloring::G))}
        />
    };
    let b_button = html! {
        <IconButton
            class={classes!(
                base_style.clone(),
                if drawing_options.coloring == Coloring::B { currently_selected_style.clone() } else { default_style.clone() }
            )}
            aria_label={"Blue Channel"}
            title={"Blue Channel"}
            icon={"svifpd-icons svifpd-icons-B"}
            onclick={make_drawing_options_update(UpdateDrawingOptions::Coloring(Coloring::B))}
        />
    };
    let invert_button = html! {
        <IconButton
            class={classes!(
                base_style.clone(),
                if drawing_options.invert { currently_selected_style.clone() } else { default_style.clone() }
            )}
            aria_label={"Invert Colors"}
            title={"Invert Colors"}
            icon={"svifpd-icons svifpd-icons-invert"}
            onclick={make_drawing_options_update(UpdateDrawingOptions::Invert(!drawing_options.invert))}
        />
    };
    let ignore_alpha_button = html! {
        <IconButton
            class={classes!(
                base_style.clone(),
                if drawing_options.ignore_alpha { currently_selected_style.clone() } else { default_style.clone() }
            )}
            aria_label={"Ignore Alpha"}
            title={"Ignore Alpha"}
            icon={"svifpd-icons svifpd-icons-toggle-transparency"}
            onclick={make_drawing_options_update(UpdateDrawingOptions::IgnoreAlpha(!drawing_options.ignore_alpha))}
        />
    };
    let heatmap_button = html! {
        <IconButton
            class={classes!(
                base_style.clone(),
                if drawing_options.coloring == Coloring::Heatmap { currently_selected_style.clone() } else { default_style.clone() }
            )}
            aria_label={"Heatmap"}
            title={"Heatmap"}
            icon={"svifpd-icons svifpd-icons-heatmap"}
            onclick={make_drawing_options_update(UpdateDrawingOptions::Coloring(Coloring::Heatmap))}
        />
    };
    let segmentation_button = html! {
        <IconButton
            class={classes!(
                base_style.clone(),
                if drawing_options.coloring == Coloring::Segmentation { currently_selected_style.clone() } else { default_style.clone() }
            )}
            aria_label={"Segmentation"}
            title={"Segmentation"}
            icon={"svifpd-icons svifpd-icons-segmentation"}
            onclick={make_drawing_options_update(UpdateDrawingOptions::Coloring(Coloring::Segmentation))}
        />
    };
    let edges_button = html! {
        <IconButton
            class={classes!(
                base_style.clone(),
                if drawing_options.coloring == Coloring::Edges { currently_selected_style.clone() } else { default_style.clone() }
            )}
            aria_label={"Edges"}
            title={"Edges"}
            icon={"svifpd-icons svifpd-icons-edges"}
            onclick={make_drawing_options_update(UpdateDrawingOptions::Coloring(Coloring::Edges))}
        />
    };
    // let tensor_button = html! {
    //     <IconButton
    //         class={ if drawing_options.as_batch_slice.0 { currently_selected_style.clone() } else { default_style.clone() }}
    //         aria_label={"Tensor"}
    //         title={"Tensor"}
    //         icon={"svifpd-icons svifpd-icons-tensor"}
    //         onclick={{
    //             let image_id = image_id.clone();
    //             let dispatch = Dispatch::<AppState>::global();
    //             let drawing_options = drawing_options.clone();
    //             move |_| { dispatch.apply(StoreAction::SetAsBatched(image_id.clone(), !drawing_options.as_batch_slice.0)); }
    //         }}
    //     />
    // };

    let mut buttons = Vec::new();
    if features.contains(features::Feature::HighContrast) {
        buttons.push(high_contrast_button);
    }
    if features.contains(features::Feature::Grayscale) {
        buttons.push(grayscale_button);
    }
    if features.contains(features::Feature::SwapRgbBgr) {
        buttons.push(swap_rgb_bgr_button);
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
    if features.contains(features::Feature::IgnoreAlpha) {
        buttons.push(ignore_alpha_button);
    }
    if features.contains(features::Feature::Heatmap) {
        buttons.push(heatmap_button);
    }
    if features.contains(features::Feature::Segmentation) {
        buttons.push(segmentation_button);
        buttons.push(edges_button);
    }
    // if features.contains(features::Feature::Transpose) {
    //     buttons.push(transpose_button);
    // }
    // if features.contains(features::Feature::Batched) {
    //     buttons.push(tensor_button);
    // }

    if !buttons.is_empty() {
        buttons.insert(0, reset_button);
    }

    let style = use_style!(
        r#"
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: flex-start;
            flex-wrap: nowrap;
            gap: 10px;
        "#
    );

    let toolbar_style = use_style!(
        r#"
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-start;
        align-items: center;
    "#
    );

    html! {
        <div class={style.clone()}>
            <div class={toolbar_style}>
                {for buttons.into_iter()}
            </div>
        </div>
    }
}
