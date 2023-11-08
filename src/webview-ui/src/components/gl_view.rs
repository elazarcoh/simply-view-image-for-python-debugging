use stylist::yew::use_style;

use yew::prelude::*;

#[derive(Properties, PartialEq)]
pub(crate) struct GLViewProps {
    pub node_ref: NodeRef,
}

#[function_component]
pub(crate) fn GLView(props: &GLViewProps) -> Html {
    let GLViewProps { node_ref } = props;

    let image_view_style = use_style!(
        r#"
        height: 100%;
        width: 100%;
        border: 1px solid #0000ff;
    "#,
    );

    html! {
        <div ref={node_ref} class={image_view_style} />
    }
}
