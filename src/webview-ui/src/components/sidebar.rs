use gloo::events::EventListener;
use stylist::{css, yew::use_style};
use wasm_bindgen::JsCast;

use yew::prelude::*;
use yewdux::Dispatch;

use crate::{
    app_state::app_state::{AppState, StoreAction},
    bindings::plotlyjs::new_plot,
    common::ViewId,
    components::{
        icon_button::{IconButton, IconToggleButton, ToggleState},
        image_selection_list::ImageSelectionList,
    },
    vscode::vscode_requests::VSCodeRequests,
};

#[cfg(debug_assertions)]
use crate::tmp_for_debug::set_debug_images;

#[derive(PartialEq, Properties)]
struct ToolbarProps {
    children: Html,
}

#[function_component]
fn Toolbar(props: &ToolbarProps) -> Html {
    let ToolbarProps { children } = props;

    let toolbar_style = use_style!(
        r#"
        width: 100%;
        height: calc(var(--input-height) * 1px);

        display: inline-flex;
        flex-direction: row;
        align-items: flex-end;
        justify-content: flex-end;
        align-content: center;
        flex-wrap: nowrap;
        column-gap: 4px;

        border-bottom: 1px var(--vscode-panel-border) solid;
        padding-bottom: 2px;
        padding-top: 2px;
        "#,
    );

    html! {
        <div class={toolbar_style}>
           {children.clone()}
        </div>
    }
}

#[derive(PartialEq, Properties)]
pub(crate) struct RefreshButtonProps {}

#[function_component]
pub(crate) fn RefreshButton(props: &RefreshButtonProps) -> Html {
    let RefreshButtonProps {} = props;

    let is_loading = use_state(|| false);

    html! {
        <IconButton
            title={"Refresh Images"}
            aria_label={"Refresh"}
            icon={"codicon codicon-refresh"}
            onclick={Callback::from( {
                let _is_loading = is_loading.clone();
                move |_| {
                    let _id = VSCodeRequests::request_images();
                    // is_loading.set(true);
                }})}
            spin={*is_loading}
            />
    }
}

#[derive(PartialEq, Properties)]
pub(crate) struct SidebarProps {
    #[prop_or_default]
    pub class: Classes,
}

#[function_component]
pub(crate) fn Sidebar(props: &SidebarProps) -> Html {
    let SidebarProps { class } = props;

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
            title={"Pin sidebar"}
            aria_label={"Pin sidebar"}
            on_icon={"codicon codicon-pinned"}
            off_icon={"codicon codicon-pin"}
            initial_state={if *pinned {ToggleState::On} else {ToggleState::Off}}
            on_state_changed={
                let pinned = pinned.clone();
                Callback::from(move |(state, _e): (_, MouseEvent)| {
                    pinned.set(state == ToggleState::On)
                })
            } />
    };

    let collapse_toggle_button = html! {
        <IconButton
            title={"Toggle sidebar"}
            aria_label={"Toggle sidebar"}
            icon={"codicon codicon-chevron-left"}
            onclick={
                let collapsed = collapsed.clone();
                Callback::from(move |_| collapsed.set(true))
            } />
    };
    let expand_toggle_button = html! {
        <IconButton
            title={"Toggle sidebar"}
            aria_label={"Toggle sidebar"}
            icon={"codicon codicon-chevron-right"}
            onclick={
                let collapsed = collapsed.clone();
                Callback::from(move |_| collapsed.set(false))
            } />
    };
    let refresh_button = html! {
        <RefreshButton />
    };
    let add_expression_button = html! {
        <IconButton
            title={"Add expression"}
            aria_label={"Add expression"}
            icon={"codicon codicon-add"}
            onclick={Callback::from({
                |_| { let _id = VSCodeRequests::add_expression(); }
            })}
            />
    };

    #[cfg(debug_assertions)]
    let debug_images_button = html! {
        <IconButton
            title={"Debug images"}
            aria_label={"Debug images"}
            icon={"codicon codicon-debug"}
            onclick={Callback::from({
                |_|  {
                    let dispatch = Dispatch::<AppState>::global();
                    // dispatch.apply(StoreAction::SetObjectToView("PLOTLY", ViewId::Primary));
                    yew::platform::spawn_local(async {
                        new_plot("my-plot").await;
                    });
                    // set_debug_images()
                }
            })}
            />
    };
    #[cfg(not(debug_assertions))]
    let debug_images_button = html! {};

    /* Expanded sidebar */
    let expanded_style = use_style!(
        r#"
        top: 0;
        background-color: var(--vscode-sideBar-background);
        border-right: 1px solid var(--vscode-sideBar-border);
        height: 100%;
        min-width: 200px;
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
        <div class={if *pinned {classes!(expanded_style.clone(), sidebar_pinned_style.clone())}
                    else if *dragging {classes!(expanded_style.clone(), sidebar_unpinned_style.clone(), dragging_style.clone())}
                    else {classes!(expanded_style.clone(), sidebar_unpinned_style.clone(), not_dragging_style.clone())}
        }>
            <Toolbar>
                {debug_images_button}
                {add_expression_button}
                {refresh_button.clone()}
                {pin_toggle_button}
                {collapse_toggle_button}
            </Toolbar>
            <div class={css!("overflow-y: auto; height: 100%;")}>
                <ImageSelectionList />
            </div>
        </div>
    };

    /* Collapsed sidebar */
    let collapsed_style = use_style!(
        r#"
        display: flex;
        flex-direction: column;
        padding: 2px;
        background-color: var(--vscode-sideBar-background);
        border-right: 1px solid var(--vscode-sideBar-border);
        height: 100%;
        width: fit-content;
        "#,
    );
    let collapsed_html = html! {
    <div class={collapsed_style}>
        {expand_toggle_button}
        {refresh_button}
    </div>
    };

    html! {
        <div ref={node_ref} class={class.clone()}>
        if *collapsed {{collapsed_html}}
        else {{expanded_html}}
        </div>
    }
}
