use stylist::yew::use_style;

use yew::prelude::*;

#[derive(Properties, PartialEq)]
pub struct Props {
    pub node_ref: NodeRef,
}

#[function_component]
pub fn GLView(props: &Props) -> Html {
    let image_view_style = use_style!(
        r#"
        height: 100%;
        width: 100%;
        border: 1px solid #0000ff;
    "#,
    );

    html! {
        <div ref={props.node_ref.clone()} class={image_view_style} />
    }
}
