
use stylist::yew::use_style;
use yew::prelude::*;

use crate::components::{main_toolbar::MainToolbar, sidebar::Sidebar, GLView};

pub(crate) trait UIHandler {
}

#[derive(PartialEq, Properties)]
pub(crate) struct MainProps {
    pub gl_view_node_ref: NodeRef,
}

#[function_component]
pub(crate) fn Main(props: &MainProps) -> Html {
    let MainProps { gl_view_node_ref } = props;

    let main_style = use_style!(
        r#"
        display: flex;
        height: 100vh;

        .main {
            width: 100%;
        }
       
        .main-toolbar {
            width: 100%;
            height: 2em;
        }
    "#,
    );
    // let image_view_container_style = use_style!(
    //     r#"
    //     display: flex;
    //     flex-direction: column;
    //     width: 100%;
    //     height: 100%;
    //     margin: 0;
    //     padding: 0;
    //     justify-content: center;
    //     align-items: center;
    // "#,
    // );

    // let num_entries = 2;
    // let images = (0..num_entries)
    //     .map(|i| image_list_item::ImageEntry {
    //         name: format!("My image {}", i),
    //         info: image_list_item::ImageInfo {
    //             shape: vec![256, 256, 4],
    //             data_type: "u8".to_string(),
    //         },
    //     })
    //     .collect::<Vec<_>>();

    html! {
        <div class={main_style.clone()}>
            <Sidebar />
            <div class={"main"}>
                <GLView node_ref={gl_view_node_ref} />
            </div>
        </div>
    }
}
