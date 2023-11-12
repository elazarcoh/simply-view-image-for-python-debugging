use glam::UVec2;
use stylist::yew::use_style;
use yew::prelude::*;

use crate::image_view::types::PixelValue;

#[derive(PartialEq, Properties)]
pub(crate) struct StatusBarProps {
    pub pixel: Option<UVec2>,
    pub pixel_value: Option<PixelValue>,
}

#[function_component]
pub(crate) fn StatusBar(props: &StatusBarProps) -> Html {
    let StatusBarProps { pixel, pixel_value } = props;

    let style = use_style!(
        r#"
        display: flex;
        flex-direction: row;
        width: 100%;
        user-select: none;
        background-color: var(--vscode-statusBar-background);
        border-top: 1px solid var(--vscode-statusBar-border);
        padding-top: 4px;
        padding-bottom: 4px;
        padding-left: 15px;

        min-height: 1.25em;
        line-height: 1.25em;

        .item {
            white-space: nowrap;
            width: 7ch;
        }
    "#,
    );

    html! {
        <div class={style}>
            <div class="item">{pixel.map(|p| format!("x: {}", p.x)).unwrap_or("A".to_string())}</div>
            <div class="item">{pixel.map(|p| format!("y: {}", p.y)).unwrap_or("A".to_string())}</div>
            <div class="item">{pixel_value.map(|p| format!("{}", p)).unwrap_or("A".to_string())}</div>
        </div>
    }
}
