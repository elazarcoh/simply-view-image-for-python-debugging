use std::rc::Rc;

use glam::Vec4Swizzles;
use itertools::Itertools;
use stylist::{css, yew::use_style};
use yew::{prelude::*, virtual_dom::VNode};
use yewdux::{functional::use_selector, Dispatch};

use crate::{
    application_state::{app_state::AppState, images::ImageAvailability},
    coloring::{self, Coloring, DrawingOptions},
    colormap,
    common::{Channels, ViewId, ViewableObjectId},
    components::{
        legend::Legend, spinner::Spinner, viewable_info_container::ViewableInfoContainer,
    },
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
pub struct ClippingInputProps {}

#[function_component]
pub fn ClippingInput(props: &ClippingInputProps) -> Html {
    let ClippingInputProps {} = props;
    let style = use_style!(
        r#"

        .container {
            background-color: var(--vscode-input-background);
            position: relative;
            display: block;
            overflow: hidden;
            border-radius: 0.375rem;
            border: 1px solid #e2e8f0;
            padding-left: 0.75rem;
            padding-right: 0.75rem;
            padding-top: 0.5rem;
            --tw-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            --tw-shadow-colored: 0 1px 2px 0 var(--tw-shadow-color);
            box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
        }

        .container:focus-within {
            --tw-border-opacity: 1;
            border-color: rgb(37 99 235 / var(--tw-border-opacity, 1)) /* #2563eb */;
        }

        .container input {
            background-color: transparent;
            color: var(--vscode-input-foreground);
            height: 2rem;
            width: 100%;
            border: none;
            padding: 0;
        }

        .container input::placeholder {
            color: transparent;
        }

        .container input:focus {
            border-color: transparent;
            outline: 2px solid transparent;
            outline-offset: 2px;
        }

        .container span {
            position: absolute;
            inset-inline-start: 0.75rem;
            top: 0.75rem;
            transform: translateY(-50%);
            font-size: 0.6rem;
            line-height: 1rem;
            color: #9ca3af;
            transition-property: all;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            transition-duration: 150ms;
        }

        .container .peer:placeholder-shown ~ .peer-placeholder-shown {
            top: 50%;
            font-size: 0.75rem;
            line-height: 1.25rem;
        }

        .container .peer:focus ~ .peer-focus {
            top: 0.75rem;
            font-size: 0.6rem;
            line-height: 1rem;
        }

        "#,
    );
    html! {
        <div class={style}>
            <div>{"Clipping"}</div>

            <label
                for="UserEmail"
                class="container"
            >
                <input
                    type="email"
                    id="UserEmail"
                    placeholder="Email"
                    class="peer"
                />

                <span
                    class="peer-placeholder-shown peer-focus"
                    >
                    {"Email"}
                </span>
            </label>
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

        if texture.info.channels == Channels::One {
            info_items.push(html! {
                <ClippingInput />
            });
        }
    }

    Some(info_items)
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
        "#,
    );

    html! {
        <div class={classes!(class.clone(), css!("position: relative;"))}>
            <div ref={node_ref.clone()} class={style}>
                {inner_element}
            </div>
            if !info_items.is_empty() {
                <div class={info_container_style}>
                    <ViewableInfoContainer collapsed={false}>
                        {info_items}
                    </ViewableInfoContainer>
                </div>
            }
        </div>
    }
}
