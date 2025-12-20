use yew::prelude::*;

/// One menu entry
#[derive(Clone, PartialEq)]
pub struct ContextMenuItem {
    pub label: String,
    pub disabled: bool,
    pub action: Callback<()>,
}

/// Data to control and display the context menu
#[derive(Clone, PartialEq)]
pub struct ContextMenuData {
    pub x: i32,
    pub y: i32,
    pub items: Vec<ContextMenuItem>,
}

/// Global context type
type ContextMenuState = UseStateHandle<Option<ContextMenuData>>;

/// Provide the context at the root of the app
#[derive(Properties, PartialEq)]
pub struct ProviderProps {
    #[prop_or_default]
    pub children: Children,
}

#[function_component]
pub fn ContextMenuProvider(props: &ProviderProps) -> Html {
    let state = use_state(|| None::<ContextMenuData>);
    html! {
        <ContextProvider<ContextMenuState> context={state}>
            { for props.children.iter() }
        </ContextProvider<ContextMenuState>>
    }
}

#[hook]
pub fn use_context_menu() -> UseStateHandle<Option<ContextMenuData>> {
    use_context::<ContextMenuState>().expect("ContextMenuProvider is missing")
}
