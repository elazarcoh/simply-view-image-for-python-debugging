use gloo::events::EventListener;
use stylist::yew::use_style;
use wasm_bindgen::JsCast;
use yew::{prelude::*};
use yewdux::prelude::*;

use crate::{
    components::{image_list_item::ImageListItem, icon_button::{IconToggleButton, ToggleState}},
    image_view::types::{ImageId, ViewId},
    reducer,
    store::{AppState},
};

#[derive(PartialEq, Properties)]
struct ToolbarProps {
    pinned: bool,
    pinned_button_clicked: Callback<()>,
    collapse_button_clicked: Callback<()>,
}

#[function_component]
fn Toolbar(props: &ToolbarProps) -> Html {
    let ToolbarProps {
        pinned,
        pinned_button_clicked,
        collapse_button_clicked,
    } = props;

    // let toggle_pinned = {
    //     let pinned_button_clicked = pinned_button_clicked.clone();
    //     Callback::from(move |_| {
    //         pinned_button_clicked.emit(());
    //     })
    // };

    let toolbar_style = use_style!(
        r#"
        width: 100%;
        display: flex;
        list-style-type: none;
        padding: var(--size-2);
        border-radius: var(--radius-3);
        gap: var(--size-4);
        box-shadow: 
            0 2px 0 0 hsl(0 0% 100% / 0.5) inset,
            0 2px 0 0 hsl(0 0% 25% / 0.5);
        align-items: right;
        justify-content: center;
        align-content: center;
        backdrop-filter: blur(10px);
        "#,
    );

    html! {
        <div class={toolbar_style}>

            <vscode-button appearance="icon" aria-label="Toggle sidebar" >
                <span class={"codicon codicon-chevron-right"}></span>
            </vscode-button>
        </div>
    }
}

#[derive(PartialEq, Properties)]
pub struct SidebarProps {}

#[function_component]
pub fn Sidebar(props: &SidebarProps) -> Html {
    let SidebarProps {} = props;

    let node_ref = use_node_ref();

    let pinned = use_state(|| true);
    let toggle_pin = {
        let pinned = pinned.clone();
        Callback::from(move |_| pinned.set(*pinned))
    };
    let collapsed = use_state(|| false);
    let on_collapse_change = {
        let collapsed = collapsed.clone();
        Callback::from(move |_| collapsed.set(!*collapsed))
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

    /* Expanded sidebar */
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

    let expanded_html = html! {
        <div class={if *pinned {classes!(sidebar_style.clone(), sidebar_pinned_style.clone())}
                    else if *dragging {classes!(sidebar_style.clone(), sidebar_unpinned_style.clone(), dragging_style.clone())}
                    else {classes!(sidebar_style.clone(), sidebar_unpinned_style.clone(), not_dragging_style.clone())}
        }>
            <Toolbar pinned={*pinned} pinned_button_clicked={toggle_pin} collapse_button_clicked={on_collapse_change} />
            <div>
                <crate::components::image_selection_list::ImageSelectionList />
            </div>
        </div>
    };

    /* Collapsed sidebar */
    let collapsed_style = use_style!(
        r#"
        "#,
    );
    let collapsed_html = html! {
    <div class={collapsed_style}>
    </div>
    };

    // html! {
    // <div ref={node_ref}>
    //    if *collapsed {{collapsed_html}}
    //    else {{expanded_html}}
    // </div>
    // }

    // html! {
    // <section class="component-container">
    //   <h2>{"Button"}</h2>
    //   <section class="component-example">
    //     <p>{"Default Button"}</p>
    //     <vscode-button appearance="primary">{"Button Text"}</vscode-button>
    //   </section>
    //   <section class="component-example">
    //     <p>{"Secondary Button"}</p>
    //     <vscode-button appearance="secondary">{"Button Text"}</vscode-button>
    //   </section>
    //   <section class="component-example">
    //     <p>{"With Disabled"}</p>
    //     <vscode-button disabled={true}>{"Button Text"}</vscode-button>
    //   </section>
    //   <section class="component-example">
    //     <p>{"With Start Icon"}</p>
    //     <vscode-button>
    //       {"Button Text"}
    //       <span slot="start" class="codicon codicon-add"></span>
    //     </vscode-button>
    //   </section>
    //   <section class="component-example">
    //     <p>{"With Icon Only"}</p>
    //     <vscode-button appearance="icon" >
    //       <span class="codicon codicon-check"></span>
    //     </vscode-button>
    //   </section>
    // </section>
    //   }
    // // Html::from_html_unchecked(r#"
    // //      <vscode-button aria-label="Confirm" appearance="icon" >
    // //        <span class="codicon codicon-check"></span>
    // //      </vscode-button>
    // // "#.into())
    html! {
        <div ref={node_ref}>
            <IconToggleButton
                aria_label={"Toggle sidebar".to_string()}
                on_icon={"codicon codicon-chevron-right".to_string()}
                off_icon={"codicon codicon-chevron-left".to_string()}
                initial_state={ToggleState::Off}
                on_state_changed={Callback::from(|_|
                    log::debug!("IconToggleButton::on_state_changed")
                )} />
            {"Hello world!"}
        </div>
    }
}
