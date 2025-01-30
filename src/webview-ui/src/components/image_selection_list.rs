use itertools::Itertools;
use stylist::{css, yew::use_style};
use web_sys::{ScrollBehavior, ScrollToOptions};
use yew::prelude::*;
use yewdux::prelude::*;

use crate::{
    application_state::app_state::{AppState, StoreAction},
    common::{CurrentlyViewing, Image, ViewId},
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
        let opts = ScrollToOptions::new();
        opts.set_top(position.top);
        opts.set_behavior(ScrollBehavior::Instant);
        container.scroll_to_with_scroll_to_options(&opts);
    }
}

#[derive(PartialEq, Properties)]
struct ImageItemWrapperProps {
    container_ref: NodeRef,
    info: Image,
    currently_viewing: Option<CurrentlyViewing>,
    is_pinned: bool,
    onclick: Callback<MouseEvent>,
}

#[function_component]
fn ImageItemWrapper(props: &ImageItemWrapperProps) -> Html {
    let ImageItemWrapperProps {
        container_ref,
        info,
        currently_viewing,
        is_pinned,
        onclick,
    } = props;

    let node_ref = use_node_ref();

    let maybe_batch_item = use_selector({
        let image_id = info.minimal().image_id.clone();
        move |state: &AppState| {
            state
                .drawing_options
                .borrow()
                .get(&image_id)
                .and_then(|d| d.batch_item)
        }
    });

    let is_selected = currently_viewing.is_some();

    use_effect_with(is_selected, {
        let node_ref = node_ref.clone();
        let container_ref = container_ref.clone();
        move |is_selected| {
            if let Some((node, container)) = node_ref
                .cast::<web_sys::HtmlElement>()
                .zip(container_ref.cast::<web_sys::HtmlElement>())
            {
                if *is_selected {
                    scroll_to_element(&container, &node);
                };
            }

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
        <div
            ref={node_ref.clone()}
            aria-selected={if is_selected {"true"} else {"false"}}
            {onclick}
            class={entry_style.clone()}
        >
            <ImageListItem entry={info.clone()} selected={is_selected} pinned={is_pinned} batch_index={*maybe_batch_item} />
        </div>
    }
}

#[derive(PartialEq, Properties)]
pub(crate) struct ImageSelectionListProps {}

#[function_component]
pub(crate) fn ImageSelectionList(props: &ImageSelectionListProps) -> Html {
    let ImageSelectionListProps {} = props;

    let node_ref = use_node_ref();

    let images_data = use_selector(|state: &AppState| state.images.clone());
    let selected_entry = use_selector(|state: &AppState| {
        state
            .image_views
            .borrow()
            .get_currently_viewing(ViewId::Primary)
    });

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

            let cv = {
                let cv = selected_entry.as_ref().as_ref().cloned();
                let current_id = cv.as_ref().map(|cv| cv.id());
                if current_id == Some(id) {
                    cv
                } else {
                    None
                }
            };

            let is_pinned = images_data.borrow().is_pinned(id);

            html! {
                <ImageItemWrapper
                    container_ref={node_ref.clone()}
                    info={info.clone()}
                    currently_viewing={cv}
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

    let style = use_style!(
        r#"
        overflow-y: auto;
        height: 100%;

        .inner {
            width: 100%;
            margin-bottom: 100px;
        }

        .inner > div[aria-selected="true"] {
            background-color: var(--vscode-list-activeSelectionBackground);
        }
    "#,
    );

    html! {
        <div class={style} ref={node_ref}>
            <div class={"inner"}>
                {for entries}
            </div>
        </div>
    }
}
