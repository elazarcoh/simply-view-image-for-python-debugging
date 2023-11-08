use stylist::yew::use_style;
use yew::prelude::*;

#[derive(PartialEq, Properties)]
pub struct MainToolbarProps {}

#[function_component]
pub fn MainToolbar(props: &MainToolbarProps) -> Html {
    let MainToolbarProps {} = props;
    html! {
        <div>
            {"I'm a main toolbar"}
        </div>
    }
}