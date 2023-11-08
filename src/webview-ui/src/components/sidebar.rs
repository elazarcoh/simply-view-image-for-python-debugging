use gloo::events::EventListener;
use stylist::yew::use_style;
use wasm_bindgen::JsCast;
use yew::prelude::*;

#[derive(PartialEq, Properties)]
pub struct SidebarProps {
}

#[function_component]
pub fn Sidebar(props: &SidebarProps) -> Html {
    let SidebarProps {} = props;

    let node_ref = use_node_ref();

    let pinned = use_state(|| true);
    let toggle_pinned = {
        let pinned = pinned.clone();
        Callback::from(move |_| {
            pinned.set(!*pinned);
        })
    };

    let dragging = use_state(|| false);
    use_effect_with(node_ref.clone(), {
        let dragging = dragging.clone();
        let node_ref = node_ref.clone();
        move |_| {
            let window = web_sys::window().unwrap();
            let element = node_ref.cast::<web_sys::HtmlElement>().unwrap();

            let mousedown = Callback::from({
                let dragging = dragging.clone();
                move |event: web_sys::Event| {
                    // check if mouse is inside the element
                    let inside =
                        element.contains(event.target().unwrap().dyn_ref::<web_sys::Node>());
                    if !inside {
                        dragging.set(true);
                    }
                }
            });
            let mouseup = Callback::from({
                let dragging = dragging.clone();
                move |_event: web_sys::Event| {
                    dragging.set(false);
                }
            });

            let mousedown_listener = EventListener::new(&window, "mousedown", move |e| {
                mousedown.emit(e.clone());
            });
            let mouseup_listener = EventListener::new(&window, "mouseup", move |e| {
                mouseup.emit(e.clone());
            });
            move || {
                drop(mousedown_listener);
                drop(mouseup_listener);
            }
        }
    });

    let sidebar_style = use_style!(
        r#"
        top: 0;
        background-color: #333;
        color: #fff;
        width: 200px;
        height: 100%;
    "#,
    );
    let sidebar_unpinned_style = use_style!(
        r#"
        position: fixed;
        z-index: 1;
        opacity: 0; /* Hidden by default */
        transition: opacity 0.3s; /* Add a fade-in transition */
    "#,
    );
    let sidebar_pinned_style = use_style!(
        r#"
        position: flex;
    "#,
    );
    let dragging_style = use_style!(
        r#"
        visibility: hidden;
        "#,
    );
    let not_dragging_style = use_style!(
        r#"
        &:hover {
            opacity: 1;
            visibility: visible;
        }
    "#,
    );

    html! {
    <div ref={node_ref}>
        <div class={if *pinned {classes!(sidebar_style.clone(), sidebar_pinned_style.clone())}
                    else if *dragging {classes!(sidebar_style.clone(), sidebar_unpinned_style.clone(), dragging_style.clone())}
                    else {classes!(sidebar_style.clone(), sidebar_unpinned_style.clone(), not_dragging_style.clone())}
        }>
            <button onclick={toggle_pinned}>
                {"Toggle pinned"}
            </button>
            <div>
                <crate::components::image_selection_list::ImageSelectionList />
            </div>
        </div>
    </div>
    }
}
