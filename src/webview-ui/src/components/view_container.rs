use std::rc::Rc;

use glam::Vec4Swizzles;
use itertools::Itertools;
use stylist::{css, yew::use_style};
use yew::{prelude::*, virtual_dom::VNode};
use yewdux::{functional::use_selector, Dispatch};

use crate::{
    application_state::{
        app_state::{AppState, StoreAction, UpdateDrawingOptions},
        images::ImageAvailability,
        vscode_data_fetcher::ImagesFetcher,
    },
    coloring::{self, Coloring, DrawingOptions},
    colormap,
    common::{Channels, ViewId, ViewableObjectId},
    components::{
        colorbar::Colorbar, legend::Legend, spinner::Spinner, button::Button,
        viewable_info_container::ViewableInfoContainer,
    },
    math_utils, configurations::AutoUpdateImages,
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
pub struct NoDataViewProps {
    pub view_id: ViewId,
}

#[function_component]
pub fn NoDataView(props: &NoDataViewProps) -> Html {
    let NoDataViewProps { view_id } = props;
    
    let auto_update_mode = use_selector(|state: &AppState| state.configuration.auto_update_images.clone());
    let current_image_id = {
        let view_id = *view_id;
        use_selector(move |state: &AppState| -> Option<ViewableObjectId> {
            let binding = state.image_views.borrow().get_currently_viewing(view_id)?;
            Some(binding.id().clone())
        })
    };

    let force_fetch_onclick = {
        let current_image_id = current_image_id.clone();
        Callback::from(move |_| {
            if let Some(_image_id) = &current_image_id {
                let dispatch = Dispatch::<AppState>::global();
                let state = dispatch.get();
                if let Err(e) = ImagesFetcher::force_fetch_missing_images(state) {
                    log::error!("Force fetch failed: {:?}", e);
                }
            }
        })
    };

    let should_show_force_button = match auto_update_mode {
        AutoUpdateImages::False => true,
        AutoUpdateImages::Pinned => {
            // Show button if current image is not pinned
            current_image_id.as_ref().map_or(false, |image_id| {
                let dispatch = Dispatch::<AppState>::global();
                let state = dispatch.get();
                !state.images.borrow().is_pinned(image_id)
            })
        }
        AutoUpdateImages::True => false, // No need for force button if auto-update is on
    };

    let style = use_style!(
        r#"
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        "#,
    );

    html! {
        <div class={style}>
            <div>{"No Data"}</div>
            if should_show_force_button {
                <Button onclick={force_fetch_onclick}>
                    {"Fetch Image"}
                </Button>
            }
        </div>
    }
}

#[derive(PartialEq, Properties)]
pub struct ColorbarContainerProps {
    pub view_id: ViewId,
}

#[function_component]
pub fn ColorbarContainer(props: &ColorbarContainerProps) -> Html {
    let ColorbarContainerProps { view_id } = props;

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

    if let Some((_, availability, drawing_options)) = current_image.as_ref() {
        if drawing_options.as_ref().map(|o| o.coloring) == Some(Coloring::Heatmap) {
            if let ImageAvailability::Available(texture) = availability {
                let image_info = &texture.borrow().computed_info;
                let image_id = texture.borrow().info.image_id.clone();
                let min = image_info.min.as_rgba_f32()[0];
                let max = image_info.max.as_rgba_f32()[0];
                let clip_min = drawing_options.as_ref().and_then(|o| o.clip.min);
                let clip_max = drawing_options.as_ref().and_then(|o| o.clip.max);

                return html! {
                    <Colorbar image_id={image_id} min={min} max={max} clip_min={clip_min} clip_max={clip_max} />
                };
            }
        }
    }
    html! {
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
    let display_colorbar =
        use_selector(|state: &AppState| state.global_drawing_options.display_colorbar);

    let inner_element =
        if let Some(availability) = current_image.as_ref().as_ref().map(|(_, a, _)| a) {
            match availability {
                ImageAvailability::NotAvailable => Some(html! {
                    <NoDataView view_id={*view_id} />
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
        z-index: 2;
        "#,
    );

    let colorbar_container_style = use_style!(
        r#"
        height: 100%;
        position: absolute;
        top: 0;
        right: 0;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        z-index: 1;
        "#,
    );

    html! {
        <div class={classes!(class.clone(), css!("position: relative;"))}>
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
            <div class={classes!(colorbar_container_style, if *display_colorbar { "" } else { "hidden" })}>
                <ColorbarContainer view_id={*view_id} />
            </div>
        </div>
    }
}
