use stylist::yew::use_style;
use yew::prelude::*;

use crate::components::{sidebar::Sidebar, main_toolbar::MainToolbar, GLView};


#[derive(PartialEq, Properties)]
pub struct MainProps {
    pub gl_view_node_ref: NodeRef,
}

#[function_component]
pub fn Main(props: &MainProps) -> Html {
    let MainProps {
        gl_view_node_ref,
    } = props;

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


    html! {
        <div class={main_style.clone()}>
            <Sidebar />
            <div class={"main"}>
                <div class={"main-toolbar"}>
                    <MainToolbar />
                </div>
                {"I'm a main"}
                <GLView node_ref={gl_view_node_ref} />
            </div>
        </div>
    }
}