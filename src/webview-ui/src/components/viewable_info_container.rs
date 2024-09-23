use stylist::yew::use_style;
use yew::prelude::*;

use crate::components::icon_button::IconButton;

#[derive(PartialEq, Properties)]
pub(crate) struct ViewableInfoContainerProps {
    #[prop_or_default]
    pub children: Html,
    pub collapsed: bool,
}

#[function_component]
pub(crate) fn ViewableInfoContainer(props: &ViewableInfoContainerProps) -> Html {
    let ViewableInfoContainerProps {
        children,
        collapsed,
    } = props;

    let collapsed = use_state(|| *collapsed);

    let style = use_style!(
        r#"
        background-color: var(--vscode-sideBar-background);
        border: 1px solid var(--vscode-sideBar-border);
        height: 100%;
        width: 100%;

        .content_container {
            direction: ltr;  /* parent is rtl, reset to ltr */
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }
        .expanded {
            display: flex;
            flex-direction: row-reverse;
            align-items: flex-start;
        }
        .scroll_container {
            direction: rtl;  /* put the scrollbar on the left */
            overflow-y: auto;
            overflow-x: hidden;
            max-height: 70vh;
        }
        .collapsed {
            display: flex;
            flex-direction: row-reverse;
            align-items: flex-start;
        }
        "#,
    );
    let children_container = html! {
        <div class="content_container">
            {children.clone()}
        </div>
    };
    let expanded_html = html! {
        <div class="expanded">
            <IconButton
                title={"Collapse"}
                aria_label={"Collapse"}
                icon={"codicon codicon-chevron-right"}
                onclick={
                    let collapsed = collapsed.clone();
                    Callback::from(move |_| collapsed.set(true))
                } />
            <div class="scroll_container" >
                {children_container}
            </div>
        </div>
    };
    let collapsed_html = html! {
        <div class="collapsed">
            <IconButton
                title={"Expand"}
                aria_label={"Expand"}
                icon={"svifpd-icons svifpd-icons-legend"}
                onclick={
                    let collapsed = collapsed.clone();
                    Callback::from(move |_| collapsed.set(false))
                } />
        </div>
    };

    html! {
        <div class={style}>
            if *collapsed {{collapsed_html}}
            else {{expanded_html}}
        </div>
    }
}
