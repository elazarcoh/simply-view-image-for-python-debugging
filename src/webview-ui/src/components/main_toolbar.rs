use itertools::Itertools;
use stylist::{
    css,
    yew::{styled_component, use_style},
};
use wasm_bindgen::JsCast;
use yew::prelude::*;

use yewdux::{prelude::use_selector, use_selector_with_deps, Dispatch};

use crate::{
    application_state::app_state::{AppState, StoreAction, UpdateGlobalDrawingOptions},
    coloring::Coloring,
    colormap::ColorMapKind,
    common::{AppMode, Image, ViewId},
    components::{checkbox::Checkbox, display_options::DisplayOption},
};

#[derive(PartialEq, Properties)]
pub struct HeatmapColormapDropdownProps {
    #[prop_or_default]
    disabled: Option<bool>,
}

#[styled_component]
pub fn HeatmapColormapDropdown(props: &HeatmapColormapDropdownProps) -> Html {
    let HeatmapColormapDropdownProps { disabled } = props;

    let global_drawing_options =
        use_selector(move |state: &AppState| state.global_drawing_options.clone());

    let color_map_registry = use_selector(move |state: &AppState| state.color_map_registry.clone());
    let options = color_map_registry
        .borrow()
        .all_with_kind(enumset::enum_set!(
            ColorMapKind::Linear | ColorMapKind::Diverging
        ))
        .iter()
        .map(|c| c.name.clone())
        .sorted()
        .map(|name| {
            html! {
                <option value={name.clone()} selected={name == global_drawing_options.heatmap_colormap_name}>{name.clone()}</option>
            }
        });
    let style = use_style!(
        r#"
        display: flex;
        align-items: center;
        justify-content: flex-start;
        flex-direction: row;
        gap: 10px;

        label {
            user-select: none;
        }

        &[disabled] label {
            opacity: 0.5;
        }
        &[disabled] select {
            cursor: not-allowed;
            opacity: 0.5;
        }
        "#
    );

    let onchange = Callback::from({
        move |e: Event| {
            let value = e
                .target()
                .unwrap()
                .dyn_ref::<web_sys::HtmlSelectElement>()
                .unwrap()
                .value();
            if !value.is_empty() {
                let dispatch = Dispatch::<AppState>::global();
                dispatch.apply(StoreAction::UpdateGlobalDrawingOptions(
                    UpdateGlobalDrawingOptions::GlobalHeatmapColormap(value),
                ));
            }
        }
    });

    let disabled = disabled.unwrap_or(false);

    html! {
        <div class={style} disabled={disabled}>
            <label>{"Colormap"}</label>
            <div class="vscode-select">
                <select
                    disabled={disabled}
                    {onchange}
                >
                    {for options}
                </select>
                <span class="chevron-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"
                        />
                    </svg>
                </span>
            </div>
        </div>
    }
}

#[derive(PartialEq, Properties)]
pub(crate) struct MainToolbarProps {}

#[function_component]
pub(crate) fn MainToolbar(props: &MainToolbarProps) -> Html {
    let MainToolbarProps {} = props;

    let cv = use_selector(move |state: &AppState| {
        state
            .image_views
            .borrow()
            .get_currently_viewing(ViewId::Primary)
    });
    let drawing_options = use_selector_with_deps(
        |state: &AppState, cv| {
            cv.as_ref()
                .as_ref()
                .map(|cv| state.drawing_options.borrow().get_or_default(cv.id()))
                .unwrap_or_default()
        },
        cv.clone(),
    );

    let app_mode = use_selector(|state: &AppState| state.app_mode);

    let cv_image_info = use_selector_with_deps(
        |state: &AppState, (cv, app_mode)| {
            if **app_mode == AppMode::SingleImage {
                cv.as_ref()
                    .as_ref()
                    .and_then(|cv| state.images.borrow().get(cv.id()).cloned())
            } else {
                None
            }
        },
        (cv.clone(), app_mode.clone()),
    );

    let style = use_style!(
        r#"
            box-sizing: border-box;
            height: 100%;

            background-color: var(--vscode-sideBar-background);
            border-bottom: 1px var(--vscode-panel-border) solid;

            padding-left: 10px;
            padding-right: 10px;
            padding-top: 2px;
            padding-bottom: 2px;

            display: flex;
            align-items: center;
            justify-content: flex-start;
            flex-direction: row;
            gap: 10px;

            .help {
                margin-left: auto;
            }
            .help .tooltiptext {
                background: var(--vscode-editorHoverWidget-background);
                border: 1px solid var(--vscode-editorHoverWidget-border);
                border-radius: 3px;
                box-shadow: 0 2px 8px var(--vscode-widget-shadow);
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                font-weight: var(--vscode-font-weight);

                visibility: hidden;
                width: fit-content;
                min-width: 30dvh;
                color: var(--vscode-foreground);
                text-align: center;
                padding: 2px 8px;
                
                position: absolute;
                z-index: 1;
                right: 10px;

                opacity: 0;

            }
            .help:hover .tooltiptext {
                visibility: visible;
                opacity: 1;
                transition: opacity 0.3s;
                transition-delay: 0.5s;
            }
        "#
    );

    let display_colorbar =
        use_selector(|state: &AppState| state.global_drawing_options.display_colorbar);
    let dispatch = Dispatch::<AppState>::global();
    let on_colorbar_change = Callback::from(move |checked: bool| {
        dispatch.apply(StoreAction::UpdateGlobalDrawingOptions(
            UpdateGlobalDrawingOptions::DisplayColorbar(checked),
        ));
    });

    html! {
        <div class={style}>

            if let Some(ref cv_image_info) = cv_image_info.as_ref() {
                if let Image::Full(image) = cv_image_info {
                        <DisplayOption
                            entry={image.clone()}
                        />
                }
            }

            <Checkbox
                checked={*display_colorbar}
                disabled={drawing_options.coloring != Coloring::Heatmap}
                on_change={on_colorbar_change}
            >
                {"Colorbar"}
            </Checkbox>
            <div class={classes!("vscode-vertical-divider", css!("height: 75%;"))} />
            <HeatmapColormapDropdown disabled={drawing_options.coloring != Coloring::Heatmap} />
            <div class={classes!("codicon", "codicon-question", "help")} >
                <span class={classes!("tooltiptext")}>
                    <p>{"Click + Drag to pan"}</p>
                    <p>{"Scroll to zoom"}</p>
                    <p>{"Shift + Scroll/Up/Down to change batch item"}</p>
                </span>
            </div>
        </div>
    }
}
