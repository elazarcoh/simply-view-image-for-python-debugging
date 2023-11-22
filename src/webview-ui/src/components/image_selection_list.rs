use itertools::Itertools;
use stylist::{css, yew::use_style};
use yew::prelude::*;
use yewdux::prelude::*;

use crate::{
    app_state::app_state::{AppState, StoreAction},
    components::image_list_item::ImageListItem, common::ViewId,
};

#[derive(PartialEq, Properties)]
pub(crate) struct ImageSelectionListProps {}

#[function_component]
pub(crate) fn ImageSelectionList(props: &ImageSelectionListProps) -> Html {
    let ImageSelectionListProps {} = props;

    let images_data = use_selector(|state: &AppState| state.images.clone());
    let selected_entry =
        use_selector(|state: &AppState| state.image_views.borrow().get_image_id(ViewId::Primary));

    let entry_style = use_style!(
        r#"
        padding: 5px;
        width: 100%;
    "#,
    );

    let num_entries = images_data.borrow().len();
    let entries = images_data
        .borrow()
        .iter()
        .map(|(id, info)| {
            let onclick = {
                let dispatch = Dispatch::<AppState>::new();

                dispatch.apply_callback({
                    let id = id.clone();
                    move |_| {
                        StoreAction::SetImageToView(id.clone(), ViewId::Primary)
                    }
                })
            };

            let is_selected = *selected_entry == Some(id.clone());

            html! {
                <vscode-option
                    aria-selected={if is_selected {"true"} else {"false"}}
                    {onclick}
                    class={entry_style.clone()}
                >
                    <ImageListItem entry={info.clone()} selected={is_selected} />
                </vscode-option>
            }
        })
        .interleave(
            std::iter::once(html! { <hr class={css!("margin: 0; border-color: var(--vscode-menu-border);")} /> })
                .cycle()
                .take(num_entries),
        )
        .collect::<Vec<_>>();

    html! {
        <div class={css!("width: 100%; margin-bottom: 100px;")}>
            {for entries}
        </div>
    }
}
