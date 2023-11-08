use stylist::{yew::use_style, css};
use yew::prelude::*;

#[derive(PartialEq, Properties)]
pub struct SetImageIntoViewButtonProps {
    // on_click: Callback<()>,
}

#[function_component]
pub fn SetImageIntoViewButton(props: &SetImageIntoViewButtonProps) -> Html {
    let SetImageIntoViewButtonProps {} = props;
    let button_group_style = use_style!(
        r#"
        display: grid;
        grid-template-rows: 1fr 1fr;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
    "#,
    );
    let button_style = use_style!(
        r#"
        color: var(--vscode-checkbox-background);
        border: 1px solid var(--vscode-checkbox-selectBorder);
        height: 100%;
        aspect-ratio: 1 / 1;

        &:hover {
            background-color: var(--vscode-button-hoverBackground);
            border: 1px solid var(--vscode-focusBorder);
        }
    "#,
    );
    html! {
    <>
        <div class={button_group_style.clone()}>
            <button class={classes!(css!("grid-area: 1 / 1 / 2 / 2;"), button_style.clone())} ></button>
            <button class={classes!(css!("grid-area: 1 / 2 / 2 / 3;"), button_style.clone())} ></button>
            <button class={classes!(css!("grid-area: 2 / 1 / 3 / 2;"), button_style.clone())} ></button>
            <button class={classes!(css!("grid-area: 2 / 2 / 3 / 3;"), button_style.clone())} ></button>
        </div>
    </>
    }
}
