use std::rc::Rc;

use glam::Vec4Swizzles;
use itertools::Itertools;
use stylist::{css, yew::use_style};
use yew::{prelude::*, virtual_dom::VNode};
use yewdux::{functional::use_selector, Dispatch};

use crate::{
    app_state::{app_state::AppState, images::ImageAvailability},
    coloring::{self, Coloring, DrawingOptions},
    colormap::colormap,
    common::{ImageId, ViewId},
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

fn make_info_items(
    image_id: &ImageId,
    image_availability: &ImageAvailability,
    drawing_options: &DrawingOptions,
) -> Option<Vec<VNode>> {
    let mut info_items = vec![];

    let dispatch = Dispatch::<AppState>::global();

    // show legend if image is available and is shown as segmentation
    if let ImageAvailability::Available(texture) = image_availability {
        if drawing_options.coloring == Coloring::Segmentation {
            let colormap = get_segmentation_colormap(&dispatch)
                .map_err(|e| {
                    log::error!("Error getting segmentation colormap: {:?}", e);
                })
                .ok()?;
            let coloring_factors = coloring::calculate_color_matrix(
                &texture.image.info,
                &texture.image.computed_info,
                &drawing_options,
            );
            if let Ok(values) = math_utils::image_calculations::image_unique_values_on_bytes(
                &texture.image.bytes,
                texture.image.info.datatype,
                texture.image.info.channels,
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
                            &drawing_options,
                        );
                        let rgb = (color_zero_one * 255.0).xyz().to_array();
                        rgb
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
            move |state: &AppState| -> Option<(ImageId, ImageAvailability, Option<DrawingOptions>)> {
                let image_id = state.image_views.borrow().get_image_id(view_id)?;
                let availability = state.image_cache.borrow().get(&image_id);
                let drawing_options = state.drawing_options.borrow().get(&image_id);
                Some((image_id, availability, drawing_options))
            },
        )
    };

    let inner_element =
        if let Some(availability) = current_image.as_ref().as_ref().map(|(_, a, _)| a) {
            match availability {
                ImageAvailability::NotAvailable => Some(html! {
                    <div>{"No Data"}</div>
                }),
                ImageAvailability::Pending => Some(html! {
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
                    <ViewableInfoContainer collapsed={true}>
                        {info_items}
                    </ViewableInfoContainer>
                </div>
            }
        </div>
    }
}
