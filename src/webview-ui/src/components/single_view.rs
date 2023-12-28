
use yew::prelude::*;

#[derive(PartialEq, Properties)]
pub(crate) struct SingleViewProps {
    pub node_ref: NodeRef,
}

#[function_component]
pub(crate) fn SingleView(props: &SingleViewProps) -> Html {
    let SingleViewProps {
        node_ref: _,
    } = props;
    html! {
        <div>
        </div>
    }
}
