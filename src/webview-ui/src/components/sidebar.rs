use gloo::events::EventListener;
use stylist::yew::use_style;
use wasm_bindgen::JsCast;
use web_sys::HtmlElement;
use yew::prelude::*;
use yewdux::prelude::*;

use crate::{
    communication::server_requests::ServerRequestsContext,
    components::{
        icon_button::{IconButton, IconToggleButton, ToggleState},
        image_list_item::ImageListItem,
    },
    image_view::types::{ImageId, ViewId},
    reducer,
    store::AppState,
};

#[derive(PartialEq, Properties)]
struct ToolbarProps {
    children: Html,
}

#[function_component]
fn Toolbar(props: &ToolbarProps) -> Html {
    let ToolbarProps { children } = props;

    // let toggle_pinned = {
    //     let pinned_button_clicked = pinned_button_clicked.clone();
    //     Callback::from(move |_| {
    //         pinned_button_clicked.emit(());
    //     })
    // };

    let toolbar_style = use_style!(
        r#"
        width: 100%;
        display: inline-flex;
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        align-content: center;
        flex-wrap: nowrap;
        column-gap: 4px;
        "#,
    );

    html! {
        <div class={toolbar_style}>
           {children.clone()}
        </div>
    }
}

#[derive(PartialEq, Properties)]
pub struct RefreshButtonProps {}

#[function_component]
pub fn RefreshButton(props: &RefreshButtonProps) -> Html {
    let RefreshButtonProps {} = props;

    let server_requests_ctx = use_context::<ServerRequestsContext>().unwrap();

    let is_loading = use_state(|| false);

    html! {
        <IconButton
            aria_label={"Refresh"}
            icon={"codicon codicon-refresh"}
            onclick={Callback::from({
                let server_requests_ctx = server_requests_ctx.clone();
                let is_loading = is_loading.clone();
                move |_| {
                    let id = server_requests_ctx.requests_images();
                    is_loading.set(true);
                }})}
            spin={*is_loading}
            />
    }
}

#[derive(PartialEq, Properties)]
pub struct SidebarProps {}

#[function_component]
pub fn Sidebar(props: &SidebarProps) -> Html {
    let SidebarProps {} = props;

    let node_ref = use_node_ref();

    let pinned = use_state(|| true);
    let collapsed = use_state(|| false);

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

    let pin_toggle_button = html! {
        <IconToggleButton
            aria_label={"Toggle sidebar"}
            on_icon={"codicon codicon-pinned"}
            off_icon={"codicon codicon-pin"}
            initial_state={if *pinned {ToggleState::On} else {ToggleState::Off}}
            on_state_changed={
                let pinned = pinned.clone();
                Callback::from(move |(state, e): (_, MouseEvent)| {

                    pinned.set(state == ToggleState::On)
                })
            } />
    };

    let collapse_toggle_button = html! {
        <IconToggleButton
            aria_label={"Toggle sidebar"}
            on_icon={"codicon codicon-chevron-right"}
            off_icon={"codicon codicon-chevron-left"}
            initial_state={if *collapsed {ToggleState::On} else {ToggleState::Off}}
            on_state_changed={
                let collapsed = collapsed.clone();
                Callback::from(move |(state, _)| collapsed.set(state == ToggleState::On))
            } />
    };
    let refresh_button = html! {
        <RefreshButton />
    };

    /* Expanded sidebar */
    let sidebar_style = use_style!(
        r#"
        top: 0;
        background-color: var(--vscode-sideBar-background);
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
            <Toolbar>
                {refresh_button}
                {pin_toggle_button}
                {collapse_toggle_button}
            </Toolbar>
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

    html! {
        <div ref={node_ref}>
        if *collapsed {{collapsed_html}}
        else {{expanded_html}}
        </div>
    }
}
