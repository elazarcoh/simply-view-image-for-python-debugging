use yew::prelude::*;

//
// Adapted from https://github.com/christo-pr/dangerously-set-html-content/blob/main/src/index.js
//

#[derive(PartialEq, Properties)]
pub(crate) struct DangerouslySetHtmlContentProps {
    html: AttrValue,
}

#[function_component]
pub(crate) fn DangerouslySetHtmlContent(props: &DangerouslySetHtmlContentProps) -> Html {
    let DangerouslySetHtmlContentProps { html } = props;

    let node_ref = use_node_ref();
    let is_first_render = use_mut_ref(|| true);

    let html = html.to_owned();
    use_effect_with((html, node_ref.clone()), {
        let is_first_render = is_first_render.clone();
        move |(html, node_ref)| {
            if *is_first_render.borrow() {
                *is_first_render.borrow_mut() = false;

                let slot_html = gloo_utils::document()
                    .create_range()
                    .expect("failed creating range")
                    .create_contextual_fragment(&html)
                    .expect("failed creating fragment");

                let div_element = node_ref.cast::<web_sys::Element>().unwrap();
                div_element.set_inner_html("");
                div_element.append_child(&slot_html).unwrap();
            }
            || {}
        }
    });

    html! {
        <div ref={node_ref.clone()} />
    }
}
