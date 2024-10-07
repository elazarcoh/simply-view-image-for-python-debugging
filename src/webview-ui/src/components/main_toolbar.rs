use std::{cell::RefCell, rc::Rc};

use itertools::Itertools;
use stylist::yew::{styled_component, use_style};
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
                <vscode-option value={name.clone()}>{name.clone()}</vscode-option>
            }
        });
    let style = use_style!(
        r#"
        display: flex;
        align-items: center;
        justify-content: flex-start;
        flex-direction: row;
        gap: 10px;
        "#
    );
    let node_ref = NodeRef::default();

    // Hacky way to get the current value of the dropdown
    type CallbackContainer = Rc<RefCell<Option<Box<dyn Fn()>>>>;
    let cb: CallbackContainer = Rc::new(RefCell::new(None));
    *cb.borrow_mut() = Some(Box::new({
        let cb = Rc::clone(&cb);
        let node_ref = node_ref.clone();
        move || {
            let timer = gloo::timers::callback::Timeout::new(100, {
                let node_ref = node_ref.clone();
                let cb = Rc::clone(&cb);
                move || {
                    let current_value = node_ref
                        .cast::<web_sys::HtmlElement>()
                        .unwrap()
                        .get_attribute("current-value")
                        .filter(|v| !v.is_empty());
                    log::debug!("current_value: {:?}", current_value);
                    match current_value {
                        Some(name) => {
                            let dispatch = Dispatch::<AppState>::global();
                            dispatch.apply(StoreAction::UpdateGlobalDrawingOptions(
                                UpdateGlobalDrawingOptions::GlobalHeatmapColormap(name),
                            ));
                        }
                        None => cb.borrow().as_ref().unwrap()(),
                    }
                }
            });
            timer.forget();
        }
    }) as Box<dyn Fn()>);
    let onchange = Callback::from({
        move |_: Event| {
            cb.borrow().as_ref().unwrap()();
        }
    });

    let current_name = global_drawing_options.heatmap_colormap_name.clone();
    html! {
        <div class={style}>
            <label>{"Colormap"}</label>
            <vscode-dropdown
                current-value={current_name}
                ref={node_ref.clone()}
                disabled={disabled.unwrap_or(false)}
                {onchange}
            >
                {for options}
            </vscode-dropdown>
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
            height: calc(var(--input-height) * 1px);

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
                font-family: var(--font-family);
                font-size: var(--vscode-font-size);
                font-weight: var(--font-weight);

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
