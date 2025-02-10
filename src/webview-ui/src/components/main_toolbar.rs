use itertools::Itertools;
use stylist::yew::{styled_component, use_style};
use wasm_bindgen::JsCast;
use yew::prelude::*;

use yewdux::{prelude::use_selector, Dispatch};

use crate::{
    application_state::app_state::{AppState, StoreAction, UpdateGlobalDrawingOptions},
    coloring::Coloring,
    colormap::ColorMapKind,
    common::ViewId,
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

    html! {
        <div class={style}>
            <label>{"Colormap"}</label>
            <div class="vscode-select">
            <select
                disabled={disabled.unwrap_or(false)}
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

    let drawing_options = use_selector(move |state: &AppState| {
        state
            .image_views
            .borrow()
            .get_currently_viewing(ViewId::Primary)
            .map(|cv| state.drawing_options.borrow().get_or_default(cv.id()))
            .unwrap_or_default()
    });

    let style = use_style!(
        r#"
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

    html! {
        <div class={style}>
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
