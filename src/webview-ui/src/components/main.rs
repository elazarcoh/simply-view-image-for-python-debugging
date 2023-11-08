use stylist::yew::use_style;
use yew::prelude::*;

use crate::components::sidebar::Sidebar;


#[derive(PartialEq, Properties)]
pub struct MainProps {}

#[function_component]
pub fn Main(props: &MainProps) -> Html {
    let MainProps {} = props;

    let main_style = use_style!(
        r#"
        display: flex;
        height: 100vh;

    "#,
    );
    html! {
        <div class={main_style.clone()}>
            <Sidebar />
            <div>
                {"I'm a main"}
            </div>
        </div>
    }
}