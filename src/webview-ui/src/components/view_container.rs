use std::rc::Rc;

use glam::Vec4Swizzles;
use itertools::Itertools;
use stylist::{css, yew::use_style};
use yew::{prelude::*, virtual_dom::VNode};
use yewdux::{dispatch, functional::use_selector, Dispatch};

use crate::{
    application_state::{
        app_state::{AppState, ElementsStoreKey, StoreAction, UpdateDrawingOptions},
        images::ImageAvailability,
    },
    coloring::{self, Coloring, DrawingOptions},
    colormap,
    common::{Channels, ViewId, ViewableObjectId},
    components::{
        legend::Legend, spinner::Spinner, viewable_info_container::ViewableInfoContainer,
    },
    hooks::{use_drag, use_event, UseDragOptions},
    math_utils,
};

fn get_segmentation_colormap(
    dispatch: &Dispatch<AppState>,
) -> anyhow::Result<Rc<colormap::ColorMap>> {
    let state = dispatch.get();
    let global_drawing_options = state.global_drawing_options.clone();
    let name = &global_drawing_options.segmentation_colormap_name;
    let colormap = dispatch
        .get()
        .color_map_registry
        .borrow()
        .get(name)
        .ok_or(anyhow::anyhow!("Color map {} not found", name));
    colormap
}

#[derive(PartialEq, Properties)]
pub struct ClippingInputProps {
    pub image_id: ViewableObjectId,
}

#[function_component]
pub fn ClippingInput(props: &ClippingInputProps) -> Html {
    let ClippingInputProps { image_id } = props;
    let clip = {
        let image_id = image_id.clone();
        use_selector(move |state: &AppState| {
            state
                .drawing_options
                .borrow()
                .get_or_default(&image_id)
                .clip
        })
    };
    let style = use_style!(
        r#"
        padding: 0.5rem;

        .label {
            font-size: 0.75rem;
            line-height: 1rem;
        }
        input::placeholder {
            color: transparent;
        }
        input:placeholder-shown + .vscode-action-button {
            opacity: 0;
        }

        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        "#,
    );
    let min_input_ref = use_node_ref();
    let max_input_ref = use_node_ref();
    enum ClippingInputType {
        Min,
        Max,
    }

    let onchange = |clip: ClippingInputType| {
        let image_id = image_id.clone();
        let node_ref = match clip {
            ClippingInputType::Min => min_input_ref.clone(),
            ClippingInputType::Max => max_input_ref.clone(),
        };
        let dispatch = Dispatch::<AppState>::global();
        Callback::from(move |ev: InputEvent| {
            ev.stop_propagation();
            if let Some(input) = node_ref.cast::<web_sys::HtmlInputElement>() {
                let value_str = input.value();
                let value: Option<f32> = value_str.parse().ok();
                dispatch.apply(StoreAction::UpdateDrawingOptions(
                    image_id.clone(),
                    match clip {
                        ClippingInputType::Min => UpdateDrawingOptions::ClipMin(value),
                        ClippingInputType::Max => UpdateDrawingOptions::ClipMax(value),
                    },
                ));
            }
        })
    };
    let clear = |clip: ClippingInputType| {
        let image_id = image_id.clone();
        let dispatch = Dispatch::<AppState>::global();
        Callback::from(move |_| {
            dispatch.apply(StoreAction::UpdateDrawingOptions(
                image_id.clone(),
                match clip {
                    ClippingInputType::Min => UpdateDrawingOptions::ClipMin(None),
                    ClippingInputType::Max => UpdateDrawingOptions::ClipMax(None),
                },
            ));
        })
    };

    html! {
        <div class={style}>
            <div>
                <div class="label">{"clip min"}</div>
                <div class="vscode-textfield">
                    <input
                        type="number"
                        step="any"
                        placeholder="min"
                        ref={min_input_ref.clone()}
                        oninput={onchange(ClippingInputType::Min)}
                        onkeydown={|ev: KeyboardEvent| { ev.stop_propagation(); }}
                        value={clip.min.map(|v| v.to_string()).unwrap_or_default()} />
                    <button class="vscode-action-button" title="Clear" onclick={clear(ClippingInputType::Min)}>
                        <i class="codicon codicon-close"></i>
                    </button>
                </div>
            </div>

             <div>
                <div class="label">{"clip max"}</div>
                <div class="vscode-textfield">
                    <input
                        type="number"
                        step="any"
                        placeholder="max"
                        ref={max_input_ref.clone()}
                        oninput={onchange(ClippingInputType::Max)}
                        onkeydown={|ev: KeyboardEvent| { ev.stop_propagation(); }}
                        value={clip.max.map(|v| v.to_string()).unwrap_or_default()} />
                    <button class="vscode-action-button" title="Clear" onclick={clear(ClippingInputType::Max)}>
                        <i class="codicon codicon-close"></i>
                    </button>
                </div>
            </div>
        </div>
    }
}

fn make_info_items(
    _image_id: &ViewableObjectId,
    image_availability: &ImageAvailability,
    drawing_options: &DrawingOptions,
) -> Option<Vec<VNode>> {
    let mut info_items = vec![];

    let dispatch = Dispatch::<AppState>::global();

    // show legend if image is available and is shown as segmentation
    if let ImageAvailability::Available(texture) = image_availability {
        let texture = texture.borrow();

        if texture.info.channels == Channels::One {
            info_items.push(html! {
                <ClippingInput image_id={texture.info.image_id.clone()} />
            });
        }

        if drawing_options.coloring == Coloring::Segmentation {
            let colormap = get_segmentation_colormap(&dispatch)
                .map_err(|e| {
                    log::error!("Error getting segmentation colormap: {:?}", e);
                })
                .ok()?;
            let coloring_factors = coloring::calculate_color_matrix(
                &texture.info,
                &texture.computed_info,
                drawing_options,
            );

            let batch_index = drawing_options.batch_item.unwrap_or(0);

            if let Ok(values) = math_utils::image_calculations::image_unique_values_on_bytes(
                &texture.bytes[&batch_index],
                texture.info.datatype,
                texture.info.channels,
            ) {
                let seg_values = values
                    .iter()
                    .map(|v| v.as_rgba_f32()[0] as i32)
                    .collect_vec();
                let colors = values
                    .iter()
                    .map(|v| {
                        let color_zero_one = coloring::calculate_pixel_color_from_colormap(
                            v,
                            &coloring_factors,
                            colormap.as_ref(),
                            drawing_options,
                        );

                        (color_zero_one * 255.0).xyz().to_array()
                    })
                    .collect::<Vec<_>>();
                let pairs_sorted = seg_values
                    .into_iter()
                    .zip(colors)
                    .sorted_by_key(|(v, _)| *v)
                    .collect_vec();

                info_items.push(html! {
                    <Legend
                        content={pairs_sorted.iter().map(|(v, c)| crate::common::types::LegendItem {
                            color: *c,
                            label: v.to_string(),
                        }).collect_vec()}
                    />
                });
            }
        }
    }

    Some(info_items)
}

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
        --box-border: 2px;

        :hover,
        [data-dragging="true"]
        {
            --handle-height: 4px;
            --handle-border: 2px;
        }
        
        .colorbar-container {
            position: relative;
            width: 40px;
            height: 200px;
            padding-right: var(--box-border);
            padding-left: var(--box-border);
        }

        .colorbar {
            width: 100%;
            height: 100%;
            background: transparent;
        }

        .handle {
            position: absolute;
            left: 0;
            right: 0;
            height: var(--handle-height);
            border-top: var(--handle-border) solid white;
            border-bottom: var(--handle-border) solid white;

            --is-top-handle: clamp(0, round(down, var(--this-handle-position) / var(--other-handle-position)), 1);
            --is-bottom-handle: clamp(0, round(down, var(--other-handle-position) / var(--this-handle-position)), 1);
            bottom: calc(var(--this-handle-position) * 1% - var(--handle-border) - calc(var(--handle-height) * var(--is-bottom-handle)));

            background: black;
            cursor: ns-resize;

            border-top-left-radius: calc(var(--is-top-handle) * 99px);
            border-top-right-radius: calc(var(--is-top-handle) * 99px);
            border-bottom-left-radius: calc(var(--is-bottom-handle) * 99px);
            border-bottom-right-radius: calc(var(--is-bottom-handle) * 99px);
        }

        .box {
            top: calc(100% - var(--top-handle-position) * 1%);
            bottom: calc(var(--bottom-handle-position) * 1%);
            position: absolute;
            left: 0;
            right: 0;
            border-left: var(--box-border) solid white;
            border-right: var(--box-border) solid white;
            pointer-events: none;
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
                    <div class="colorbar" id="colorbar" ref={colorbar_ref}></div>
                    <div ref={min_handle_ref} class={classes!("handle", "handle1")}></div>
                    <div ref={max_handle_ref} class={classes!("handle", "handle2")}></div>
                    <div class="box"></div>
                </div>
            </div>
        }
    } else {
        html! {}
    }
}

#[derive(PartialEq, Properties)]
pub(crate) struct ViewContainerProps {
    #[prop_or_default]
    pub class: Classes,
    pub node_ref: NodeRef,
    pub view_id: ViewId,
}

#[function_component]
pub(crate) fn ViewContainer(props: &ViewContainerProps) -> Html {
    let ViewContainerProps {
        node_ref,
        class,
        view_id,
    } = props;

    let current_image = {
        let view_id = *view_id;
        use_selector(
            move |state: &AppState| -> Option<(ViewableObjectId, ImageAvailability, Option<DrawingOptions>)> {
                let binding = state.image_views.borrow().get_currently_viewing(view_id)?;
                let image_id = binding.id();
                let availability = state.image_cache.borrow().get(image_id);
                let drawing_options = state.drawing_options.borrow().get(image_id);
                Some((image_id.clone(), availability, drawing_options))
            },
        )
    };

    let inner_element =
        if let Some(availability) = current_image.as_ref().as_ref().map(|(_, a, _)| a) {
            match availability {
                ImageAvailability::NotAvailable => Some(html! {
                    <div>{"No Data"}</div>
                }),
                ImageAvailability::Pending(_) => Some(html! {
                    <Spinner />
                }),
                ImageAvailability::Available(_) => None,
            }
        } else {
            None
        };

    let info_items =
        if let Some((image_id, availability, drawing_options)) = current_image.as_ref() {
            let drawing_options = drawing_options.clone().unwrap_or_default();
            make_info_items(image_id, availability, &drawing_options)
        } else {
            None
        }
        .unwrap_or_default();

    let style = use_style!(
        r#"
        display: flex;
        height: 100%;
        width: 100%;
        justify-content: center;
        align-items: center;
        "#,
    );

    let info_container_style = use_style!(
        r#"
        position: absolute;
        top: 0;
        right: 0;
        max-width: 144px;
        "#,
    );

    let mut colorbar = html! {};
    if let Some((_, availability, drawing_options)) = current_image.as_ref() {
        if drawing_options.as_ref().map(|o| o.coloring) == Some(Coloring::Heatmap) {
            if let ImageAvailability::Available(texture) = availability {
                let image_info = &texture.borrow().computed_info;
                let min = image_info.min.as_rgba_f32()[0];
                let max = image_info.max.as_rgba_f32()[0];
                let clip_min = drawing_options.as_ref().and_then(|o| o.clip.min);
                let clip_max = drawing_options.as_ref().and_then(|o| o.clip.max);
                colorbar = html! {
                    <Colorbar min={min} max={max} clip_min={clip_min} clip_max={clip_max} />
                };
            }
        }
    }

    html! {
        <div class={classes!(class.clone(), css!("position: relative;"))}>
            {colorbar}
            <div ref={node_ref.clone()} class={style}>
                {inner_element}
            </div>
            if !info_items.is_empty() {
                <div class={info_container_style}>
                    <ViewableInfoContainer collapsed={true}>
                        {info_items}
                    </ViewableInfoContainer>
                </div>
            }
        </div>
    }
}
