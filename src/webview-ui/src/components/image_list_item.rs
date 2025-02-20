use itertools::Itertools;
use stylist::yew::use_style;
use yew::prelude::*;
use yewdux::Dispatch;

use crate::{
    application_state::app_state::{AppState, UiAction},
    common::{Image, MinimalImageInfo, ValueVariableKind},
    components::display_options::DisplayOption,
    vscode::vscode_requests::VSCodeRequests,
};

use super::icon_button::IconButton;

fn make_info_row(label: &str, value: &str) -> Html {
    html! {
    <>
        <div class={"info-row"}>
            <div class={"info-label"}>{label}</div>
            <div class={"info-data"}>{value}</div>
        </div>
    </>
    }
}

#[derive(PartialEq, Properties, Clone)]
pub(crate) struct ImageListItemProps {
    pub pinned: bool,
    pub entry: Image,
    pub selected: bool,
    pub batch_index: Option<u32>,
}

#[function_component]
pub(crate) fn ImageListItem(props: &ImageListItemProps) -> Html {
    let ImageListItemProps {
        pinned,
        entry,
        selected,
        batch_index,
    } = props;

    let MinimalImageInfo {
        image_id,
        value_variable_kind,
        expression,
        ..
    } = entry.minimal();

    let info_grid_style = use_style!(
        r#"
        user-select: none;
        pointer-events: none;
        display: grid;
        grid-template-columns: max-content auto;
        grid-template-rows: auto;
        padding-top: 1px;
        padding-bottom: 5px;
        padding-left: 5px;
        row-gap: 1px;
        column-gap: 5px;

        .info-row {
            display: contents;
        }
        .info-row .info-label {
            font-weight: bold;
        }
        .info-row .info-data {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
    "#,
    );

    let mut rows = entry
        .minimal()
        .additional_info
        .iter()
        .sorted()
        .map(|(k, v)| make_info_row(k, v))
        .collect::<Vec<_>>();

    if let Some(batch_index) = batch_index {
        let batch_row = make_info_row("Batch Index", &batch_index.to_string());
        rows.push(batch_row);
    }

    let edit_button = html! {
        <IconButton
            aria_label={"Edit"}
            title={"Edit"}
            icon={"codicon codicon-edit"}
            onclick={Callback::from({
                let expression = expression.clone();
                move |_| {
                    let _id = VSCodeRequests::edit_expression(expression.clone());
                }
            })}
        />
    };
    let dispatch = Dispatch::<AppState>::global();

    let pin_button = html! {
        <IconButton
            aria_label={"Pin"}
            title={"Pin"}
            icon={"codicon codicon-pin"}
            onclick={dispatch.apply_callback({let image_id = image_id.clone(); move |_| UiAction::Pin(image_id.clone())})}
        />
    };
    let unpin_style = use_style!(
        r#"
        box-shadow: inset 0px 0px 1px 1px var(--vscode-checkbox-background);
        background-color: var(--vscode-checkbox-background);
        "#
    );
    let unpin_button = html! {
        <IconButton
            aria_label={"Unpin"}
            title={"Unpin"}
            icon={"codicon codicon-pinned"}
            onclick={dispatch.apply_callback({let image_id = image_id.clone(); move |_| UiAction::Unpin(image_id.clone())})}
            class={unpin_style}
        />
    };

    let pin_unpin_button = if *pinned {
        unpin_button
    } else if *selected {
        pin_button
    } else {
        html!(<></>)
    };

    let item_style = use_style!(
        r#"

        .item-label-container {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            flex-wrap: nowrap;
            gap: 10px;
        }
        .item-label {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            user-select: none;
        }
        "#
    );

    html! {
        <div class={item_style.clone()}>
            <div class="item-label-container">
                {pin_unpin_button}
                <label class="item-label" title={expression.clone()}>{&expression}</label>
                if *value_variable_kind == ValueVariableKind::Expression {{edit_button}} else {<></>}
            </div>

            <div class={info_grid_style.clone()}>
                {for rows}
            </div>

            if let Image::Full(entry) = entry {
                if *selected {<DisplayOption entry={entry.clone()} />} else {<></>}
            } else {<></>}
        </div>
    }
}
