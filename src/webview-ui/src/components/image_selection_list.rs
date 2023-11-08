use stylist::yew::use_style;
use yew::prelude::*;
use yewdux::prelude::*;

use crate::{components::image_list_item::ImageListItem, store::{AppState, ImageInfo}};


#[derive(PartialEq, Properties)]
pub struct ImageSelectionListProps {
}

#[function_component]
pub fn ImageSelectionList(props: &ImageSelectionListProps) -> Html {

    let images_data = use_selector(|state: &AppState| state.images.clone());
    let image_infos = images_data.borrow().by_id.values().map(|image_data| image_data.info.clone()).collect::<Vec<_>>();

    let ImageSelectionListProps {} = props;

    let selected_entry = use_state::<Option<(usize, ImageInfo)>, _>(|| None);

    let entry_style = use_style!(
        r#"
        border: 1px solid var(--vscode-panel-border);
        padding: 5px;
        width: 100%;
    "#,
    );

    let entries = (0..image_infos.len()).map(|i| {
        let entry = &image_infos[i];
        let onclick = {
            let selected_entry = selected_entry.clone();
            let entry = entry.clone();
            Callback::from(move |_| {
                selected_entry.set(Some((i, entry.clone())));
            })
        };

        let is_selected = *selected_entry == Some((i, entry.clone()));

        html! {
        <div>
            <vscode-option
                aria-selected={if is_selected {"true"} else {"false"}}
                {onclick}
                class={entry_style.clone()}
            >
                <ImageListItem entry={entry.clone()} />
            </vscode-option>
        </div>
        }
    });

    html! {
        <div>
            {for entries}
        </div>
    }
}
