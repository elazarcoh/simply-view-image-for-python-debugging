use stylist::yew::use_style;
use yew::prelude::*;

use crate::components::image_list_item::ImageListItem;

use super::image_list_item::ImageEntry;

#[derive(PartialEq, Properties)]
pub struct ImageSelectionListProps {
    pub images: Vec<ImageEntry>,
}

#[function_component]
pub fn ImageSelectionList(props: &ImageSelectionListProps) -> Html {
    let ImageSelectionListProps { images } = props;

    let selected_entry = use_state::<Option<(usize, ImageEntry)>, _>(|| None);

    let entry_style = use_style!(
        r#"
        border: 1px solid var(--vscode-panel-border);
        padding: 5px;
    "#,
    );

    let entries = (0..images.len()).map(|i| {
        let entry = &images[i];
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
