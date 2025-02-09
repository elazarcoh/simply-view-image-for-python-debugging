use stylist::yew::use_style;
use yew::prelude::*;
use yewdux::{functional::use_selector, Dispatch};

use crate::{
    application_state::app_state::{AppState, ElementsStoreKey, StoreAction, UpdateDrawingOptions},
    common::ViewableObjectId,
    hooks::{use_drag, UseDragOptions},
};

#[derive(PartialEq, Properties)]
pub struct ColorbarProps {
    pub image_id: ViewableObjectId,
    pub min: f32,
    pub max: f32,
    pub clip_min: Option<f32>,
    pub clip_max: Option<f32>,
}

#[function_component]
pub fn Colorbar(props: &ColorbarProps) -> Html {
    let ColorbarProps {
        image_id,
        min,
        max,
        clip_min,
        clip_max,
    } = props;

    let clip_min = clip_min.unwrap_or(*min);
    let clip_max = clip_max.unwrap_or(*max);

    let colorbar_style = use_style!(
        r#"
        width: 40px;
        height: 200px;

        --handle1-position: 0;
        --handle2-position: 100;

        --is-h1-top: clamp(0, round(down, var(--handle1-position) / var(--handle2-position)), 1);
        --is-h2-top: clamp(0, round(down, var(--handle2-position) / var(--handle1-position)), 1);
        --top-handle-position: calc(
            var(--is-h1-top) * var(--handle1-position) +
            var(--is-h2-top) * var(--handle2-position)
        );
        --bottom-handle-position: calc(
            var(--is-h1-top) * var(--handle2-position) +
            var(--is-h2-top) * var(--handle1-position)
        );

        --handle-height: 2px;
        --handle-border: 1.5px;
        --box-border: 3px;
        --colorbar-border: 2px;

        --border-color: rgba(204, 204, 204, 0.5);
        --handle-color: var(--vscode-foreground);

        &:hover,
        &[data-dragging="true"]
        {
            --handle-height: 4px;
        }

        .colorbar-container {
            position: relative;
            height: 100%;
            width: 100%;
        }

        .colorbar {
            position: absolute;
            background: transparent;

            right: calc(var(--box-border) + var(--colorbar-border));
            left: calc(var(--box-border) + var(--colorbar-border));
            top: var(--colorbar-border);
            bottom: var(--colorbar-border);
            box-shadow: 0 0 0 var(--colorbar-border) var(--border-color);
            border: none;

            z-index: 1;
        }

        .handle {
            background-color: var(--handle-color);

            position: absolute;
            left: var(--handle-border);
            right: var(--handle-border);
            height: var(--handle-height);

            bottom: calc(
                var(--this-handle-position) * 1% -
                    (var(--is-bottom-handle) * var(--handle-height))
                );

            box-shadow:
                0 var(--handle-border) 0 0 var(--border-color),
                0 calc(-1 * var(--handle-border)) 0 0 var(--border-color),
                var(--handle-border) 0 0 0 var(--border-color),
                calc(-1 * var(--handle-border)) 0 0 0 var(--border-color);
            border-top-left-radius: calc(var(--is-top-handle) * 99px);
            border-top-right-radius: calc(var(--is-top-handle) * 99px);
            border-bottom-left-radius: calc(var(--is-bottom-handle) * 99px);
            border-bottom-right-radius: calc(var(--is-bottom-handle) * 99px);

            cursor: ns-resize;

            z-index: 3;
        }

        .box {
            pointer-events: none;

            position: absolute;
            top: calc(100% - var(--top-handle-position) * 1%);
            bottom: calc(var(--bottom-handle-position) * 1%);
            left: var(--box-border);
            right: var(--box-border);

            box-shadow:
                calc(-1 * var(--box-border)) 0 0 var(--border-color),
                var(--box-border) 0 0 var(--border-color);

            z-index: 2;
        }

        .handle1-position {
            --this-handle-position: var(--handle1-position);
            --other-handle-position: var(--handle2-position);

            --is-top-handle: clamp(
                0,
                round(down, var(--this-handle-position) / var(--other-handle-position)),
                1
                );
            --is-bottom-handle: clamp(
                0,
                round(down, var(--other-handle-position) / var(--this-handle-position)),
                1
                );
        }

        .handle2-position {
            --this-handle-position: var(--handle2-position);
            --other-handle-position: var(--handle1-position);

            --is-top-handle: clamp(
                0,
                round(down, var(--this-handle-position) / var(--other-handle-position)),
                1
                );
            --is-bottom-handle: clamp(
                0,
                round(down, var(--other-handle-position) / var(--this-handle-position)),
                1
                );
        }
        
        .handle-text-container {
            position: relative;
            display: block;
        }


        &:hover .handle-text,
        &[data-dragging="true"] .handle-text {
            display: block;
        }

        .handle-text {
            display: none;

            position: absolute;
            bottom: calc(var(--this-handle-position) * 1%);

            left: -0.5em;
            transform: translateX(-100%) translateY(50%);
            user-select: none;

            border-width: 1px;
            border-style: solid;
            border-color: var(--vscode-sideBar-border);
            background-color: var(--vscode-sideBar-background);
            padding: 0.1em 0.5em;
            border-radius: 0.5em;

            height: 1em;
            line-height: 1em;
        }

        .handle-text::after {
            content: "";
            position: absolute;
            top: 50%;
            left: 100%;
            transform: translateY(-50%);
            border-width: 6px;
            border-style: solid;
            border-color: transparent transparent transparent var(--vscode-sideBar-background);
        }

        .bound-text {
            position: absolute;
            bottom: var(--position);
            transform: translateY(50%);
            right: 0;
            left: 0;
            z-index: 4;
            pointer-events: none;

            display: flex;
            justify-content: center;
            align-items: center;
        }

        .bound-text > div {
            font-size: 8px;
 
            user-select: none;
            border-width: 1px;
            border-style: solid;
            border-color: var(--vscode-sideBar-border);
            background-color: var(--vscode-sideBar-background);
            padding: 0.1em 0.5em;
            border-radius: 0.5em;
            height: 1em;
            line-height: 1em;
            text-align: center;       
        }

        &:hover .bound-text > div,
        &[data-dragging="true"] .bound-text > div {
            transform: scale(1.2);
        }

        "#,
    );
    let colorbar_ref = use_selector(|state: &AppState| {
        state
            .elements_refs_store
            .borrow()
            .get(&ElementsStoreKey::ColorBar)
            .cloned()
    });

    let clip1_state = use_state(|| clip_min);
    let clip2_state = use_state(|| clip_max);
    let handle1_ref = use_node_ref();
    let handle2_ref = use_node_ref();
    let start_state = use_state(|| (0.0, 0.0));

    let pos1_percents = ((*clip1_state - min) / (max - min)).clamp(0.0, 1.0) * 100.0;
    let pos2_percents = ((*clip2_state - min) / (max - min)).clamp(0.0, 1.0) * 100.0;
    let vars = format!(
        "--handle1-position: {}; --handle2-position: {};",
        pos1_percents, pos2_percents
    );

    let throttle = {
        yew_hooks::use_throttle(
            {
                let dispatch = Dispatch::<AppState>::global();
                let clip1_state = clip1_state.clone();
                let clip2_state = clip2_state.clone();
                let image_id = image_id.clone();
                move || {
                    let clip1 = *clip1_state;
                    let clip2 = *clip2_state;
                    let (clip_min, clip_max) = if clip1 < clip2 {
                        (clip1, clip2)
                    } else {
                        (clip2, clip1)
                    };
                    dispatch.apply(StoreAction::UpdateDrawingOptions(
                        image_id.clone(),
                        UpdateDrawingOptions::ClipMin(Some(clip_min)),
                    ));
                    dispatch.apply(StoreAction::UpdateDrawingOptions(
                        image_id.clone(),
                        UpdateDrawingOptions::ClipMax(Some(clip_max)),
                    ));
                }
            },
            50,
        )
    };

    let (_, colorbar_height) =
        yew_hooks::use_size(colorbar_ref.as_ref().clone().unwrap_or_default());

    let dragging1 = {
        let min = *min;
        let max = *max;
        use_drag(
            handle1_ref.clone(),
            UseDragOptions {
                on_relative_position_change: Some({
                    let clip1_state = clip1_state.clone();
                    let start_state = start_state.clone();
                    let throttle = throttle.clone();
                    Box::new(move |_, y| {
                        let colorbar_relative_move = -y / colorbar_height as f32;
                        let width = max - min;
                        let (clip, _) = *start_state;
                        let new_clip = (clip + colorbar_relative_move * width).clamp(min, max);

                        clip1_state.set(new_clip);

                        throttle.run();
                    })
                }),
                on_start: Some(Box::new({
                    let clip1_state = clip1_state.clone();
                    let clip2_state = clip2_state.clone();
                    let start_state = start_state.clone();
                    move || {
                        start_state.set((*clip1_state, *clip2_state));
                    }
                })),
                on_end: Some({
                    let throttle = throttle.clone();
                    Box::new(move |x, y| {
                        throttle.run();
                    })
                }),
            },
        )
    };
    let dragging2 = {
        let min = *min;
        let max = *max;
        use_drag(
            handle2_ref.clone(),
            UseDragOptions {
                on_relative_position_change: Some({
                    let clip2_state = clip2_state.clone();
                    let start_state = start_state.clone();
                    let throttle = throttle.clone();
                    Box::new(move |_, y| {
                        let colorbar_relative_move = -y / colorbar_height as f32;
                        let width = max - min;
                        let (_, clip) = *start_state;
                        let new_clip = (clip + colorbar_relative_move * width).clamp(min, max);

                        clip2_state.set(new_clip);

                        throttle.run();
                    })
                }),
                on_start: Some(Box::new({
                    let clip1_state = clip1_state.clone();
                    let clip2_state = clip2_state.clone();
                    let start_state = start_state.clone();
                    move || {
                        start_state.set((*clip1_state, *clip2_state));
                    }
                })),
                on_end: Some({
                    let throttle = throttle.clone();
                    Box::new(move |x, y| {
                        throttle.run();
                    })
                }),
            },
        )
    };

    if let Some(ref colorbar_ref) = *colorbar_ref {
        html! {
            <div class={colorbar_style} style={vars} data-dragging={if dragging1 || dragging2 { "true" } else { "false" }}>
                <div class="colorbar-container">
                    <div class="bound-text" style="--position: 0;">
                        <div>{format!("{:.7}", float_pretty_print::PrettyPrintFloat(*min as f64))}</div>
                    </div>
                    <div class="bound-text" style="--position: 100%;">
                        <div>{format!("{:.7}", float_pretty_print::PrettyPrintFloat(*max as f64))}</div>
                    </div>

                    <div ref={handle1_ref} class={classes!("handle", "handle1-position")}></div>
                    <div class="handle-text handle1-position">
                        {format!("{:.7}", float_pretty_print::PrettyPrintFloat(*clip1_state as f64))}
                    </div>
                    <div ref={handle2_ref} class={classes!("handle", "handle2-position")}></div>
                    <div class="handle-text handle2-position">
                        {format!("{:.7}", float_pretty_print::PrettyPrintFloat(*clip2_state as f64))}
                    </div>

                    <div class="box"></div>
                    <div class="colorbar" id="colorbar" ref={colorbar_ref}></div>
                </div>
            </div>
        }
    } else {
        html! {}
    }
}
