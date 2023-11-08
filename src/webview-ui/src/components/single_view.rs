use stylist::yew::use_style;
use yew::prelude::*;

#[derive(PartialEq, Properties)]
pub struct SingleViewProps {
    pub node_ref: NodeRef,
}

#[function_component]
pub fn SingleView(props: &SingleViewProps) -> Html {
    let SingleViewProps {
        node_ref,
    } = props;
    html! {
        <div>
        </div>
    }
}
