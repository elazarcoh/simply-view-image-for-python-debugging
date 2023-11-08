use gloo::timers::callback::Timeout;
use stylist::yew::styled_component;
use yew::prelude::*;

#[derive(PartialEq, Clone, Copy, Debug)]
pub enum ToggleState {
    On,
    Off,
}

#[derive(PartialEq, Properties, Default)]
pub struct IconButtonProps {
    aria_label: Option<AttrValue>,
    icon: Option<AttrValue>,
    onclick: Option<Callback<MouseEvent>>,
}

#[styled_component]
pub fn IconButton(props: &IconButtonProps) -> Html {
    let IconButtonProps {
        aria_label,
        icon,
        onclick,
    } = props;

    let node_ref = use_node_ref();

    // Hack to make the appearance="icon" work. The appearance attribute is not set normally.
    {
        let node_ref = node_ref.clone();
        use_effect_with(node_ref, {
            move |node_ref| {
                // Doesn't work without waiting a bit for the DOM to be updated.
                if let Some(e) = node_ref.cast::<web_sys::HtmlElement>() {
                    Timeout::new(10, move || {
                        let _ = e.set_attribute("appearance", "icon");
                        let _ = e.style().set_property("visibility", "visible");
                    })
                    .forget();
                }
                move || {}
            }
        });
    }

    html! {
        <vscode-button aria-label={aria_label.clone()} ref={node_ref} onclick={onclick.clone()} class={css!("visibility: hidden;")}>
            <span class={icon}></span>
        </vscode-button>
    }
}

#[derive(PartialEq, Properties)]
pub struct IconToggleButtonProps {
    pub aria_label: String,
    pub on_icon: String,
    pub off_icon: String,
    pub initial_state: ToggleState,
    pub on_state_changed: Callback<(ToggleState, MouseEvent)>,
}

#[styled_component]
pub fn IconToggleButton(props: &IconToggleButtonProps) -> Html {
    let IconToggleButtonProps {
        aria_label,
        on_icon,
        off_icon,
        initial_state,
        on_state_changed,
    } = props;

    let state = use_state(|| *initial_state);

    let onclick = {
        let on_state_changed = on_state_changed.clone();
        let state = state.clone();
        Callback::from(move |e| {
            let new_state = match *state {
                ToggleState::On => ToggleState::Off,
                ToggleState::Off => ToggleState::On,
            };
            on_state_changed.emit((new_state, e));
            state.set(new_state);
        })
    };

    html! {
        if *state == ToggleState::On {
            <div class={css!(r#"
                > vscode-button {
                    box-shadow: inset 0px 0px 1px 1px var(--vscode-checkbox-background);
                    background-color: var(--vscode-checkbox-background);
                }
                "#)}>
                <IconButton aria_label={Some(aria_label.clone())} icon={Some(on_icon.clone())} onclick={Some(onclick.clone())} />
            </div>
        } else {
            <div >
                <IconButton aria_label={Some(aria_label.clone())} icon={Some(off_icon.clone())} onclick={Some(onclick.clone())} />
            </div>
        }
    }
}
