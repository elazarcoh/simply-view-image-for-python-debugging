use stylist::yew::use_style;
use yew::prelude::*;

use crate::components::set_image_into_view_button::SetImageIntoViewButton;

#[derive(PartialEq, Properties, Clone)]
pub struct ImageInfo {
    pub shape: Vec<u32>,
    pub data_type: String,
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
pub struct ImageEntry {
    pub name: String,
    pub info: ImageInfo,
}

#[derive(PartialEq, Properties, Clone)]
pub struct ImageListItemProps {
    pub entry: ImageEntry,
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
                <label>{&entry.name}</label>
                <vscode-data-grid aria-label="Basic" grid-template-columns="max-content auto" class={info_grid_style.clone()}>
                    <vscode-data-grid-row>
                        <vscode-data-grid-cell class={info_grid_cell_style.clone()} cell-type="columnheader" grid-column="1">{"Shape"}</vscode-data-grid-cell>
                        <vscode-data-grid-cell class={info_grid_cell_style.clone()} grid-column="2">{shape_to_string(&entry.info.shape)}</vscode-data-grid-cell>
                    </vscode-data-grid-row>
                    <vscode-data-grid-row>
                        <vscode-data-grid-cell class={info_grid_cell_style.clone()} cell-type="columnheader" grid-column="1">{"Data Type"}</vscode-data-grid-cell>
                        <vscode-data-grid-cell class={info_grid_cell_style.clone()} grid-column="2">{&entry.info.data_type}</vscode-data-grid-cell>
                    </vscode-data-grid-row>
                </vscode-data-grid>
            </div>
        </div>
    }
}
