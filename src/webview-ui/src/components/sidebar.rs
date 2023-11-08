use stylist::{css, yew::use_style};
use yew::prelude::*;

#[derive(PartialEq, Properties)]
pub struct SidebarProps {}

#[function_component]
pub fn Sidebar(props: &SidebarProps) -> Html {
    let SidebarProps {} = props;

    let pinned = use_state(|| false);
    let toggle_pinned = {
        let pinned = pinned.clone();
        Callback::from(move |_| {
            log::debug!("toggle_pinned");
            pinned.set(!*pinned);
        })
    };

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

        &:hover {
            opacity: 1;
            visibility: visible;
        }
    "#,
    );
    let sidebar_pinned_style = use_style!(
        r#"
        position: flex;
    "#,
    );

    html! {
        <div class={if *pinned {classes!(sidebar_style.clone(), sidebar_pinned_style.clone())}
                    else {classes!(sidebar_style.clone(), sidebar_unpinned_style.clone())}}>
            <button onclick={toggle_pinned}>
                {"Toggle pinned"}
            </button>
            <div>
                {"I'm a sidebar"}
            </div>
        </div>
    }
}
