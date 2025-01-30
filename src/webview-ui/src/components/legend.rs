use stylist::yew::use_style;
use yew::prelude::*;

use crate::common::Size;

#[derive(PartialEq, Properties)]
struct LegendItemProps {
    pub color: [f32; 3],
    pub label: AttrValue,
}

#[function_component]
fn LegendItem(props: &LegendItemProps) -> Html {
    let LegendItemProps { color, label } = props;

    let rect_size = Size {
        width: 20.0,
        height: 20.0,
    };
    let rect_svg = html! {
        <svg
            width={rect_size.width.to_string()}
            height={rect_size.height.to_string()}
            xmlns={"http://www.w3.org/2000/svg"}>
            <rect
                width={rect_size.width.to_string()}
                height={rect_size.height.to_string()}
                fill={format!("rgb({},{},{})", color[0], color[1], color[2])} >
                <title>{label}</title>
            </rect>
        </svg>
    };
    let style = use_style!(
        r#"
        box-sizing: border-box;
        width: fit-content;
        user-select: none;
        display: flex;
        justify-content: flex-start;
        align-items: center;
        column-gap: 8px;
        "#,
    );

    html! {
        <div class={classes!(style, "legend-item")}>
            {rect_svg}
            <span>{label}</span>
        </div>
    }
}

#[derive(PartialEq, Properties)]
pub(crate) struct LegendProps {
    pub content: Vec<crate::common::types::LegendItem>,
}

#[function_component]
pub(crate) fn Legend(props: &LegendProps) -> Html {
    let LegendProps { content } = props;
    let style = use_style!(
        r#"
        width: 100%;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.25rem;
        padding: 8px;

        .legend-item {
            flex: 1;
        }
        "#,
    );

    html! {
        <div class={style}>
            {for content.iter().map(|item| html! {
                <LegendItem color={item.color} label={item.label.clone()} />
            })}
        </div>
    }
}
