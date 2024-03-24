use itertools::Itertools;
use stylist::{css, yew::use_style};
use web_sys::{ScrollBehavior, ScrollLogicalPosition, ScrollToOptions};
use yew::prelude::*;
use yewdux::prelude::*;

use crate::{
    app_state::app_state::{AppState, StoreAction},
    common::{ImageInfo, ViewId},
    components::image_list_item::ImageListItem,
};

#[derive(Debug)]
struct ScrollY {
    top: f64,
    is_visible: bool,
}
fn calc_y_scroll(parent: &web_sys::HtmlElement, target: &web_sys::HtmlElement) -> ScrollY {
    let parent_pos = parent.get_bounding_client_rect();
    let target_pos = target.get_bounding_client_rect();
    let is_visible =
        target_pos.top() >= parent_pos.top() && target_pos.bottom() <= parent_pos.bottom();
    // calculate the scroll position using nearest edge
    let top = if target_pos.top() < parent_pos.top() {
        target_pos.top() - parent_pos.top()
    } else {
        target_pos.bottom() - parent_pos.bottom()
    };
    ScrollY {
        top: top + parent.scroll_top() as f64,
        is_visible,
    }
}

fn scroll_to_element(container: &web_sys::HtmlElement, element: &web_sys::HtmlElement) {
    let position = calc_y_scroll(container, element);
    if !position.is_visible {
        container.scroll_to_with_scroll_to_options(
            ScrollToOptions::new()
                .top(position.top)
                .behavior(ScrollBehavior::Instant),
        );
    }
}

#[derive(PartialEq, Properties)]
struct ImageItemWrapperProps {
    container_ref: NodeRef,
    info: ImageInfo,
    is_selected: bool,
    is_pinned: bool,
    onclick: Callback<MouseEvent>,
}

#[function_component]
fn ImageItemWrapper(props: &ImageItemWrapperProps) -> Html {
    let ImageItemWrapperProps {
        container_ref,
        info,
        is_selected,
        is_pinned,
        onclick,
    } = props;

    let node_ref = use_node_ref();

    use_effect_with(*is_selected, {
        let node_ref = node_ref.clone();
        let container_ref = container_ref.clone();
        move |is_selected| {
            node_ref
                .cast::<web_sys::HtmlElement>()
                .zip(container_ref.cast::<web_sys::HtmlElement>())
                .map(|(node, container)| {
                    if *is_selected {
                        scroll_to_element(&container, &node);
                    };
                });

            move || {}
        }
    });

    let entry_style = use_style!(
        r#"
        padding: 5px;
        width: 100%;
    "#,
    );

    html! {
        <vscode-option
            ref={node_ref.clone()}
            aria-selected={if *is_selected {"true"} else {"false"}}
            {onclick}
            class={entry_style.clone()}
        >
            <ImageListItem entry={info.clone()} selected={is_selected} pinned={is_pinned} />
        </vscode-option>
    }
}

#[derive(PartialEq, Properties)]
pub(crate) struct ImageSelectionListProps {}

#[function_component]
pub(crate) fn ImageSelectionList(props: &ImageSelectionListProps) -> Html {
    let ImageSelectionListProps {} = props;

    let node_ref = use_node_ref();

    let images_data = use_selector(|state: &AppState| state.images.clone());
    let selected_entry =
        use_selector(|state: &AppState| state.image_views.borrow().get_image_id(ViewId::Primary));

    let num_entries = images_data.borrow().len();
    let entries = images_data
        .borrow()
        .iter()
        .map(|(id, info)| {
            let onclick = {
                let dispatch = Dispatch::<AppState>::global();

                dispatch.apply_callback({
                    let id = id.clone();
                    move |_| {
                        StoreAction::SetImageToView(id.clone(), ViewId::Primary)
                    }
                })
            };

            let is_selected = *selected_entry == Some(id.clone());
            let is_pinned = images_data.borrow().is_pinned(id);

            html! {
                <ImageItemWrapper
                    container_ref={node_ref.clone()}
                    info={info.clone()}
                    is_selected={is_selected}
                    is_pinned={is_pinned}
                    onclick={onclick}
                />
            }
        })
        .interleave(
            std::iter::once(html! { <hr class={css!("margin: 0; border-color: var(--vscode-menu-border);")} /> })
                .cycle()
                .take(num_entries),
        )
        .collect::<Vec<_>>();

    html! {
        <div class={css!("overflow-y: auto; height: 100%;")} ref={node_ref}>
            <div class={css!("width: 100%; margin-bottom: 100px;")}>
                {for entries}
            </div>
        </div>
    }
}
