use stylist::yew::use_style;
use yew::prelude::*;
use yewdux::prelude::*;

use crate::{
    components::image_list_item::ImageListItem,
    image_view::types::{ImageId, ViewId},
    reducer,
    store::AppState,
};

#[derive(PartialEq, Properties)]
pub struct ImageSelectionListProps {}

#[function_component]
pub fn ImageSelectionList(props: &ImageSelectionListProps) -> Html {
    let images_data = use_selector(|state: &AppState| state.images.clone());

    let ImageSelectionListProps {} = props;

    let selected_entry = use_state::<Option<ImageId>, _>(|| None);

    let entry_style = use_style!(
        r#"
        border: 1px solid var(--vscode-panel-border);
        padding: 5px;
        width: 100%;
    "#,
    );

    let entries = images_data
        .borrow()
        .by_id
        .iter()
        .map(|(id, data)| {
            let onclick = {
                let selected_entry = selected_entry.clone();

                let dispatch = Dispatch::<AppState>::new();

                dispatch.apply_callback({
                    let id = id.clone();
                    move |_| {
                        selected_entry.set(Some(id.clone()));
                        reducer::StoreAction::SetImageToView(id.clone(), ViewId::Primary)
                    }
                })
            };

            let is_selected = *selected_entry == Some(id.clone());

            html! {
            <div>
                <vscode-option
                    aria-selected={if is_selected {"true"} else {"false"}}
                    {onclick}
                    class={entry_style.clone()}
                >
                    <ImageListItem entry={data.info.clone()} />
                </vscode-option>
            </div>
            }
        })
        .collect::<Vec<_>>();

    html! {
        <div>
            {for entries}
        </div>
    }
}
