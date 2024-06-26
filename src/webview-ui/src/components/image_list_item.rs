use itertools::Itertools;
use stylist::{yew::use_style, Style};
use yew::prelude::*;
use yewdux::{prelude::use_selector, Dispatch};

use crate::{
    app_state::app_state::{AppState, ChangeImageAction, StoreAction, UpdateDrawingOptions},
    coloring::Coloring,
    common::{ImageInfo, ValueVariableKind},
    vscode::vscode_requests::VSCodeRequests,
};

use super::icon_button::IconButton;

#[derive(PartialEq, Properties)]
pub(crate) struct DisplayOptionProps {
    pub entry: ImageInfo,
}

mod features {
    use enumset::{EnumSet, EnumSetType};

    use crate::common::{Channels, Datatype};

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
    pub(crate) fn list_features(datatype: Datatype, channels: Channels) -> EnumSet<Feature> {
        let for_all = EnumSet::from(Feature::Invert);
        let rgb_features = Feature::SwapRgbBgr | Feature::R | Feature::G | Feature::B | Feature::Grayscale  | Feature::HighContrast;
        let bool_rgb_features = Feature::SwapRgbBgr | Feature::R | Feature::G | Feature::B ;
        let alpha_features = Feature::IgnoreAlpha;
        let rgba_features = rgb_features | alpha_features;
        let gray_alpha_features = Feature::HighContrast | alpha_features;
        let gray_features = Feature::HighContrast | Feature::Heatmap | alpha_features;
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

    let reset_button = html! {
        <IconButton
            aria_label={"Reset"}
            title={"Reset"}
            icon={"codicon codicon-discard"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::global();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::Reset)); }
            }}
        />
    };
    let high_contrast_button = html! {
        <IconButton
            class={if drawing_options.high_contrast { currently_selected_style.clone() } else { default_style.clone() }}
            aria_label={"High Contrast"}
            title={"High Contrast"}
            icon={"svifpd-icons svifpd-icons-contrast"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::global();
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
            icon={"svifpd-icons svifpd-icons-grayscale"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::global();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::Coloring(Coloring::Grayscale))); }
            }}
        />
    };
    let swap_rgb_bgr_button = html! {
        <IconButton
            class={if drawing_options.coloring == Coloring::SwapRgbBgr { currently_selected_style.clone() } else { default_style.clone() }}
            aria_label={"Swap RGB/BGR"}
            title={"Swap RGB/BGR"}
            icon={"svifpd-icons svifpd-icons-BGR"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::global();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::Coloring(Coloring::SwapRgbBgr))); }
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
                let dispatch = Dispatch::<AppState>::global();
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
                let dispatch = Dispatch::<AppState>::global();
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
                let dispatch = Dispatch::<AppState>::global();
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
                let dispatch = Dispatch::<AppState>::global();
                let drawing_options = drawing_options.clone();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::Invert(!drawing_options.invert))); }
            }}
        />
    };
    let ignore_alpha_button = html! {
        <IconButton
            class={if drawing_options.ignore_alpha { currently_selected_style.clone() } else { default_style.clone() }}
            aria_label={"Ignore Alpha"}
            title={"Ignore Alpha"}
            icon={"svifpd-icons svifpd-icons-toggle-transparency"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::global();
                let drawing_options = drawing_options.clone();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::IgnoreAlpha(!drawing_options.ignore_alpha))); }
            }}
        />
    };
    let heatmap_button = html! {
        <IconButton
            class={ if Coloring::Heatmap == drawing_options.coloring { currently_selected_style.clone() } else { default_style.clone() }}
            aria_label={"Heatmap"}
            title={"Heatmap"}
            icon={"svifpd-icons svifpd-icons-heatmap"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::global();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::Coloring(Coloring::Heatmap))); }
            }}
        />
    };
    let segmentation_button = html! {
        <IconButton
            class={ if Coloring::Segmentation == drawing_options.coloring { currently_selected_style.clone() } else { default_style.clone() }}
            aria_label={"Segmentation"}
            title={"Segmentation"}
            icon={"svifpd-icons svifpd-icons-segmentation"}
            onclick={{
                let image_id = image_id.clone();
                let dispatch = Dispatch::<AppState>::global();
                move |_| { dispatch.apply(StoreAction::UpdateDrawingOptions(image_id.clone(), UpdateDrawingOptions::Coloring(Coloring::Segmentation))); }
            }}
        />
    };

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
    }
    // if features.contains(features::Feature::Transpose) {
    //     buttons.push(transpose_button);
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

fn make_info_row(label: &str, value: &str, info_grid_cell_style: &Style) -> Html {
    html! {
    <>
        <vscode-data-grid-row>
            <vscode-data-grid-cell class={info_grid_cell_style.clone()} cell-type="columnheader" grid-column="1">{label}</vscode-data-grid-cell>
            <vscode-data-grid-cell class={info_grid_cell_style.clone()} grid-column="2">{value}</vscode-data-grid-cell>
        </vscode-data-grid-row>
    </>
    }
}

#[derive(PartialEq, Properties, Clone)]
pub(crate) struct ImageListItemProps {
    pub pinned: bool,
    pub entry: ImageInfo,
    pub selected: bool,
}

#[function_component]
pub(crate) fn ImageListItem(props: &ImageListItemProps) -> Html {
    let ImageListItemProps {
        pinned,
        entry,
        selected,
    } = props;
    let image_id = entry.image_id.clone();

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
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    "#,
    );

    let rows = entry
        .additional_info
        .iter()
        .sorted()
        .map(|(k, v)| make_info_row(k, v, &info_grid_cell_style));

    let edit_button = html! {
        <IconButton
            aria_label={"Edit"}
            title={"Edit"}
            icon={"codicon codicon-edit"}
            onclick={Callback::from({
                let expression = entry.expression.clone();
                move |_| {
                    let _id = VSCodeRequests::edit_expression(expression.clone());
                }
            })}
        />
    };
    let dispatch = Dispatch::<AppState>::global();

    let pin_button = html! {
        <IconButton
            aria_label={"Pin"}
            title={"Pin"}
            icon={"codicon codicon-pin"}
            onclick={dispatch.apply_callback({let image_id = image_id.clone(); move |_| ChangeImageAction::Pin(image_id.clone())})}
        />
    };
    let unpin_style = use_style!(
        r#"
        box-shadow: inset 0px 0px 1px 1px var(--vscode-checkbox-background);
        background-color: var(--vscode-checkbox-background);
        "#
    );
    let unpin_button = html! {
        <IconButton
            aria_label={"Unpin"}
            title={"Unpin"}
            icon={"codicon codicon-pinned"}
            onclick={dispatch.apply_callback({let image_id = image_id.clone(); move |_| ChangeImageAction::Unpin(image_id.clone())})}
            class={unpin_style}
        />
    };

    let pin_unpin_button = if *pinned {
        unpin_button
    } else if *selected {
        pin_button
    } else {
        html!(<></>)
    };

    let item_style = use_style!(
        r#"

        .item-label-container {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            flex-wrap: nowrap;
            gap: 10px;
        }
        .item-label {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        "#
    );

    html! {
        <div class={item_style.clone()}>
            <div class="item-label-container">
                {pin_unpin_button}
                <label class="item-label" title={entry.expression.clone()}>{&entry.expression}</label>
                if entry.value_variable_kind == ValueVariableKind::Expression {{edit_button}} else {<></>}
            </div>

            <vscode-data-grid aria-label="Basic" grid-template-columns="max-content auto" class={info_grid_style.clone()}>
                {for rows}
            </vscode-data-grid>

            if *selected {<DisplayOption entry={entry.clone()} />} else {<></>}
        </div>
    }
}
