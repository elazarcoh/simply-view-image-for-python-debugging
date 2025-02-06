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
    pub min: f32,
    pub max: f32,
    pub clip_min: Option<f32>,
    pub clip_max: Option<f32>,
}

#[function_component]
pub fn Colorbar(props: &ColorbarProps) -> Html {
    let ColorbarProps {
        min,
        max,
        clip_min,
        clip_max,
    } = props;

    let clip_min = clip_min.unwrap_or(*min);
    let clip_max = clip_max.unwrap_or(*max);

    let colorbar_style = use_style!(
        r#"
        position: absolute;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;

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

        --border-color: var(--vscode-foreground);
        --handle-color: green;

        &:hover,
        &[data-dragging="true"]
        {
            --handle-height: 4px;
            --handle-border: 2px;
        }

        
        .colorbar-container {
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 40px;
            height: 200px;
        }

        .colorbar {
            width: 100%;
            height: 100%;
            background: transparent;

            margin-right: calc(var(--box-border) + var(--colorbar-border));
            margin-left: calc(var(--box-border) + var(--colorbar-border));
            box-shadow: 0 0 0 var(--colorbar-border) var(--border-color);
            border: none; 

            z-index: 1;
        }

        .handle {
            background-color: var(--handle-color);

            position: absolute;
            left: 0;
            right: 0;
            height: var(--handle-height);
            
            --is-top-handle: clamp(0, round(down, var(--this-handle-position) / var(--other-handle-position)), 1);
            --is-bottom-handle: clamp(0, round(down, var(--other-handle-position) / var(--this-handle-position)), 1);

            bottom: calc(
                var(--this-handle-position) * 1%
                - (var(--is-bottom-handle) * var(--handle-height))
            );

            margin-right: var(--handle-border);
            margin-left: var(--handle-border);
            /* TODO */
            box-shadow: 
                calc(-1 * var(--handle-border)) 0 0 var(--border-color),
                var(--handle-border) 0 0 var(--border-color),
                0 calc(var(--is-top-handle) * var(--handle-border)) 0 var(--border-color);

            cursor: ns-resize;

            border-top-left-radius: calc(var(--is-top-handle) * 99px);
            border-top-right-radius: calc(var(--is-top-handle) * 99px);
            border-bottom-left-radius: calc(var(--is-bottom-handle) * 99px);
            border-bottom-right-radius: calc(var(--is-bottom-handle) * 99px);

            z-index: 3;
        }

        .box {
            pointer-events: none;

            top: calc(100% - var(--top-handle-position) * 1%);
            bottom: calc(var(--bottom-handle-position) * 1%);
            position: absolute;
            left: 0;
            right: 0;

            margin-right: var(--box-border);
            margin-left: var(--box-border);
            box-shadow: 
                calc(-1 * var(--box-border)) 0 0 var(--border-color),
                var(--box-border) 0 0 var(--border-color);

            z-index: 2;
        }

        .handle1 {
            --this-handle-position: var(--handle1-position);
            --other-handle-position: var(--handle2-position);
        }

        .handle2 {
            --this-handle-position: var(--handle2-position);
            --other-handle-position: var(--handle1-position);
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

    let clip_min_state = use_state(|| clip_min);
    let clip_max_state = use_state(|| clip_max);
    let min_handle_ref = use_node_ref();
    let max_handle_ref = use_node_ref();
    let start_state = use_state(|| (0.0, 0.0));

    let min_percent = ((*clip_min_state - min) / (max - min)).clamp(0.0, 1.0) * 100.0;
    let max_percent = ((*clip_max_state - min) / (max - min)).clamp(0.0, 1.0) * 100.0;
    let vars = format!(
        "--handle1-position: {}; --handle2-position: {};",
        min_percent, max_percent
    );

    let throttle = {
        let dispatch = Dispatch::<AppState>::global();
        let clip_min_state = clip_min_state.clone();
        let clip_max_state = clip_max_state.clone();
        yew_hooks::use_throttle(
            move || {
                let clip_min = *clip_min_state;
                let clip_max = *clip_max_state;
                // swap min and max if min > max
                let (clip_min, clip_max) = if clip_min > clip_max {
                    (clip_max, clip_min)
                } else {
                    (clip_min, clip_max)
                };
                dispatch.apply(StoreAction::UpdateDrawingOptions(
                    ViewableObjectId::new("image_gray_u8"),
                    UpdateDrawingOptions::ClipMin(Some(clip_min)),
                ));
                dispatch.apply(StoreAction::UpdateDrawingOptions(
                    ViewableObjectId::new("image_gray_u8"),
                    UpdateDrawingOptions::ClipMax(Some(clip_max)),
                ));
            },
            50,
        )
    };

    let (_, colorbar_height) =
        yew_hooks::use_size(colorbar_ref.as_ref().clone().unwrap_or_default());

    let min_dragging = {
        let min = *min;
        let max = *max;
        use_drag(
            min_handle_ref.clone(),
            UseDragOptions {
                on_relative_position_change: Some({
                    let clip_min_state = clip_min_state.clone();
                    let start_state = start_state.clone();
                    let throttle = throttle.clone();
                    Box::new(move |_, y| {
                        let colorbar_relative_move = -y / colorbar_height as f32;
                        let width = max - min;
                        let (clip_min, _) = *start_state;
                        let new_clip_min =
                            (clip_min + colorbar_relative_move * width).clamp(min, max);

                        clip_min_state.set(new_clip_min);

                        throttle.run();
                    })
                }),
                on_start: Some(Box::new({
                    let clip_min_state = clip_min_state.clone();
                    let clip_max_state = clip_max_state.clone();
                    let start_state = start_state.clone();
                    move || {
                        start_state.set((*clip_min_state, *clip_max_state));
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
    let max_dragging = {
        let min = *min;
        let max = *max;
        use_drag(
            max_handle_ref.clone(),
            UseDragOptions {
                on_relative_position_change: Some({
                    let clip_max_state = clip_max_state.clone();
                    let start_state = start_state.clone();
                    let throttle = throttle.clone();
                    Box::new(move |_, y| {
                        let colorbar_relative_move = -y / colorbar_height as f32;
                        let width = max - min;
                        let (_, clip_max) = *start_state;
                        let new_clip_max =
                            (clip_max + colorbar_relative_move * width).clamp(min, max);

                        clip_max_state.set(new_clip_max);

                        throttle.run();
                    })
                }),
                on_start: Some(Box::new({
                    let clip_min_state = clip_min_state.clone();
                    let clip_max_state = clip_max_state.clone();
                    let start_state = start_state.clone();
                    move || {
                        start_state.set((*clip_min_state, *clip_max_state));
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
            <div class={colorbar_style} style={vars} data-dragging={if min_dragging || max_dragging { "true" } else { "false" }}>
                <div class="colorbar-container">
                    <div ref={min_handle_ref} class={classes!("handle", "handle1")}></div>
                    <div ref={max_handle_ref} class={classes!("handle", "handle2")}></div>
                    <div class="box"></div>
                    <div class="colorbar" id="colorbar" ref={colorbar_ref}></div>
                </div>
            </div>
        }
    } else {
        html! {}
    }
}
