use stylist::yew::use_style;
use yew::prelude::*;

use crate::communication::incoming_messages::ImageInfo;

use super::icon_button::IconButton;


#[derive(PartialEq, Properties)]
pub struct DisplayOptionProps {
    // pub entry: ImageInfo,
}

#[function_component]
pub fn DisplayOption(props: &DisplayOptionProps) -> Html {
    let DisplayOptionProps {} = props;

    let grayscale_button = html! {
        <vscode-button aria-label={"Grayscale"}>
            {"G"}
        </vscode-button>
    };
    let high_contrast_button = html! {
        <IconButton
            aria_label={"High Contrast"}
            icon={"codicon codicon-refresh"}
        />
    };

    let style = use_style!(
        r#"
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: left;
        /* TODO: remove this */
        background-color: #787878 ;
    "#);

    html! {
        <div class={style}>
            {high_contrast_button}
            {grayscale_button}
        </div>
    }
}


fn shape_to_string(shape: &[u32]) -> String {
    let mut shape_string = String::new();
    for (i, dim) in shape.iter().enumerate() {
        if i > 0 {
            shape_string.push('x');
        }
        shape_string.push_str(&dim.to_string());
    }
    shape_string
}

#[derive(PartialEq, Properties, Clone)]
pub struct ImageListItemProps {
    pub entry: ImageInfo,
}

#[function_component]
pub fn ImageListItem(props: &ImageListItemProps) -> Html {
    let ImageListItemProps { entry } = props;

    let container_style = use_style!(
        r#"
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: left;
    "#
    );

    let info_grid_style = use_style!(
        r#"
        user-select: none;
        pointer-events: none;
    "#,
    );

    let info_grid_cell_style = use_style!(
        r#"
        padding-top: 1px;
        padding-bottom: 1px;
    "#,
    );

    html! {
        <div class={container_style.clone()}>
            <div>
                <label>{&entry.expression}</label>
                <vscode-data-grid aria-label="Basic" grid-template-columns="max-content auto" class={info_grid_style.clone()}>
                    <vscode-data-grid-row>
                        <vscode-data-grid-cell class={info_grid_cell_style.clone()} cell-type="columnheader" grid-column="1">{"Shape"}</vscode-data-grid-cell>
                        // <vscode-data-grid-cell class={info_grid_cell_style.clone()} grid-column="2">{shape_to_string(&entry.shape)}</vscode-data-grid-cell>
                    </vscode-data-grid-row>
                    <vscode-data-grid-row>
                        <vscode-data-grid-cell class={info_grid_cell_style.clone()} cell-type="columnheader" grid-column="1">{"Data Type"}</vscode-data-grid-cell>
                        // <vscode-data-grid-cell class={info_grid_cell_style.clone()} grid-column="2">{&entry.data_type}</vscode-data-grid-cell>
                    </vscode-data-grid-row>
                </vscode-data-grid>
            </div>
        </div>
    }
}
