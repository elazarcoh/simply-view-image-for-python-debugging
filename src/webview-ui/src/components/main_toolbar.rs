use itertools::Itertools;
use stylist::{
    css,
    yew::{styled_component, use_style},
};
use wasm_bindgen::JsCast;
use yew::prelude::*;

use yewdux::{prelude::use_selector, use_selector_with_deps, Dispatch};

use crate::{
    application_state::{
        app_state::{AppState, OverlayAction, StoreAction, UpdateGlobalDrawingOptions},
        images::DrawingContext,
        views::OverlayItem,
    },
    coloring::Coloring,
    colormap::ColorMapKind,
    common::{AppMode, CurrentlyViewing, Image, Size, SizeU32, ViewId},
    components::{checkbox::Checkbox, display_options::DisplayOption, icon_button::IconButton},
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
pub struct OverlayMenuItemProps {
    overlay: OverlayItem,
}

#[function_component]
pub fn OverlayMenuItem(props: &OverlayMenuItemProps) -> Html {
    let OverlayMenuItemProps { overlay } = props;
    let overlay = overlay.clone();

    let info = use_selector_with_deps(
        |state: &AppState, overlay: &OverlayItem| {
            let images = state.images.borrow();
            let image = images
                .get(&overlay.id)
                .unwrap_or_else(|| panic!("Image with id {:?} not found", overlay.id));
            if let Image::Full(info) = image {
                info.clone()
            } else {
                panic!("Overlay item is not a full image: {:?}", overlay.id);
            }
        },
        overlay.clone(),
    );

    let cv = use_selector_with_deps(
        move |state: &AppState, view_id: &ViewId| {
            state.image_views.borrow().get_currently_viewing(*view_id)
        },
        overlay.view_id,
    );
    let cv_image_id = cv.as_ref().as_ref().map(|cv| cv.id().clone());
    if cv_image_id.is_none() {
        log::warn!(
            "OverlayMenuItem: No currently viewing image found for view_id {:?}",
            overlay.view_id
        );
        return html! {};
    }
    let cv_image_id = cv_image_id.unwrap();
    let view_id = overlay.view_id;

    let overlay_expression = use_selector_with_deps(
        |state: &AppState, overlay_id| {
            let images = state.images.borrow();
            let info = images
                .get(overlay_id)
                .unwrap_or_else(|| panic!("Image with id {:?} not found", overlay_id))
                .minimal();
            info.expression.clone()
        },
        overlay.id.clone(),
    );

    let same_size = use_selector_with_deps(
        {
            let cv_image_id = cv_image_id.clone();
            move |state: &AppState, overlay_id| {
                let images = state.images.borrow();
                let overlay_size = images.get(overlay_id).and_then(|image| {
                    if let Image::Full(info) = image {
                        Some(SizeU32 {
                            width: info.width,
                            height: info.height,
                        })
                    } else {
                        None
                    }
                });
                let cv_size = images.get(&cv_image_id).and_then(|image| {
                    if let Image::Full(info) = image {
                        Some(SizeU32 {
                            width: info.width,
                            height: info.height,
                        })
                    } else {
                        None
                    }
                });
                overlay_size == cv_size
            }
        },
        overlay.id.clone(),
    );

    let drawing_options = use_selector_with_deps(
        |state: &AppState, (image_id, drawing_context)| {
            state
                .drawing_options
                .borrow()
                .get(image_id, drawing_context)
                .cloned()
                .unwrap_or_default()
        },
        (overlay.id.clone(), DrawingContext::Overlay),
    );

    let dispatch = Dispatch::<AppState>::global();
    let hide_button = html! {
        <IconButton
            aria_label={"Hide Overlay"}
            title={"Hide Overlay"}
            icon={"codicon codicon-eye"}
            onclick={dispatch.apply_callback({
                let cv_image_id = cv_image_id.clone();
                move |_| {
                    OverlayAction::Hide {
                        view_id,
                        image_id: cv_image_id.clone()
                    }
                }
            })}
        />
    };
    let show_button = html! {
        <IconButton
            aria_label={"Show Overlay"}
            title={"Show Overlay"}
            icon={"codicon codicon-eye-closed"}
            onclick={dispatch.apply_callback({
                let cv_image_id = cv_image_id.clone();
                move |_| {
                    OverlayAction::Show {
                        view_id,
                        image_id: cv_image_id.clone()
                    }
                }
            })}
        />
    };
    let show_hide_button = if overlay.hidden {
        show_button
    } else {
        hide_button
    };

    let alpha_state = use_state(|| 1.0);
    use_effect_with(drawing_options.global_alpha, {
        let alpha_state = alpha_state.clone();
        move |alpha| {
            alpha_state.set(*alpha);
            || ()
        }
    });
    let alpha_throttle = {
        let alpha_state = alpha_state.clone();
        let overlay_id = overlay.id.clone();
        move || {
            dispatch.apply(OverlayAction::SetAlpha {
                image_id: overlay_id.clone(),
                alpha: *alpha_state,
            });
        }
    };
    let alpha_slider = html! {
        <input
            class="slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={alpha_state.to_string()}
            oninput={
                Callback::from({
                    let alpha_state = alpha_state.clone();
                    move |e: InputEvent| {
                        let value = e
                            .target()
                            .unwrap()
                            .dyn_ref::<web_sys::HtmlInputElement>()
                            .unwrap()
                            .value();
                        if let Ok(value) = value.parse::<f32>() {
                            alpha_state.set(value);
                            alpha_throttle();
                        }
                    }
                })
            }
        />
    };

    let display_options = html! {
        <DisplayOption entry={( *info ).clone()} drawing_context={DrawingContext::Overlay} />
    };

    let maybe_warning = if !*same_size {
        html! {
            <span class={classes!("codicon", "codicon-warning", css!("color: var(--vscode-editorWarning-foreground);"))}
            title="Overlay image size does not match the currently viewed image size." />
        }
    } else {
        html! {}
    };

    let style = use_style!(
        r#"
            position: relative;

            .top {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                flex-direction: row;
                gap: 10px;
            }

            .overlay-id {
                font-size: 0.9em;
                color: var(--vscode-foreground);
            }

            .controls-container {
                z-index: 10;
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                transform: translateY(100%);
                background-color: var(--vscode-sideBar-background);
                border: 1px solid var(--vscode-panel-border);
                padding: 5px;
                min-width: max-content;
            }

            &[data-hidden="true"] .controls-container {
                display: none;
            }

            .slider-container {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                margin: 0.3em 0;
            }

            .slider-container label {
                font-size: 0.75rem;
                line-height: 0.6em;
            }

            .slider {
                width: 100px;
                margin-left: 10px;
            }
        "#
    );

    html! {
        <div
            class={style}
            data-hidden={overlay.hidden.to_string()}
        >
            <div class="top">
                <span>
                    {show_hide_button}
                </span>
                <span class="overlay-expression">
                    {overlay_expression}
                </span>
                { maybe_warning }
            </div>
            <div class="controls-container">
                <div>
                    { display_options }
                </div>
                <div class="slider-container">
                    <label for="alpha-slider">{ "Alpha:" }</label>
                    { alpha_slider }
                </div>
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
                .and_then(|cv| {
                    state
                        .drawing_options
                        .borrow()
                        .get(cv.id(), &DrawingContext::BaseImage)
                        .cloned()
                })
                .unwrap_or_default()
        },
        cv.clone(),
    );

    let app_mode = use_selector(|state: &AppState| state.app_mode);

    let cv_image_info_in_single_mode = use_selector_with_deps(
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

    // Colorbar visibility
    let display_colorbar =
        use_selector(|state: &AppState| state.global_drawing_options.display_colorbar);
    let dispatch = Dispatch::<AppState>::global();
    let on_colorbar_change = Callback::from(move |checked: bool| {
        dispatch.apply(StoreAction::UpdateGlobalDrawingOptions(
            UpdateGlobalDrawingOptions::DisplayColorbar(checked),
        ));
    });

    // Overlay related
    let overlay = use_selector_with_deps(
        {
            move |state: &AppState, cv: &Option<CurrentlyViewing>| {
                cv.as_ref().and_then(|cv| {
                    state
                        .overlays
                        .borrow()
                        .get_image_overlay(ViewId::Primary, cv.id())
                        .cloned()
                })
            }
        },
        (*cv).clone(),
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

    html! {
        <div class={style}>

            if let Some(ref cv_image_info) = cv_image_info_in_single_mode.as_ref() {
                if let Image::Full(image) = cv_image_info {
                        <DisplayOption
                            entry={image.clone()}
                            drawing_context={DrawingContext::BaseImage}
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

            if let Some(overlay) = overlay.as_ref() {
                <div class={classes!("overlay-menu-item")}>
                    <OverlayMenuItem overlay={overlay.clone()} />
                </div>
            }

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
