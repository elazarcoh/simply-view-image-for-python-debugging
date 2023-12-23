use yew::prelude::*;

#[derive(PartialEq, Properties)]
pub struct ViewContainerProps {
    #[prop_or_default]
    pub class: Classes,
    pub node_ref: NodeRef,
}

#[function_component]
pub fn ViewContainer(props: &ViewContainerProps) -> Html {
    let ViewContainerProps { node_ref, class } = props;
    html! {
        <div ref={node_ref.clone()} class={class.clone()}>

        </div>
    }
}
