use stylist::css;
use yew::prelude::*;

use super::types::ToggleState;

#[derive(PartialEq, Properties)]
pub struct ButtonProps {
    #[prop_or_default]
    pub class: Classes,
    #[prop_or_default]
    pub onclick: Option<Callback<MouseEvent>>,
    pub children: Html,
}

#[function_component]
pub fn Button(props: &ButtonProps) -> Html {
    let ButtonProps {
        class,
        children,
        onclick,
    } = props;
    html! {
        <button type="button" class={classes!("vscode-button", class.clone())} onclick={onclick.clone()}>
            {children.clone()}
        </button>
    }
}

#[derive(PartialEq, Properties)]
pub struct ToggleButtonProps {
    #[prop_or_default]
    pub on_text: Option<AttrValue>,
    pub off_text: AttrValue,
    pub initial_state: ToggleState,
    #[prop_or_default]
    pub on_state_changed: Option<Callback<(ToggleState, MouseEvent)>>,
    #[prop_or_default]
    pub class: Classes,
}

#[function_component]
pub fn ToggleButton(props: &ToggleButtonProps) -> Html {
    let ToggleButtonProps {
        on_text,
        off_text,
        initial_state,
        on_state_changed,
        class,
    } = props;

    let state = use_state(|| *initial_state);

    let onclick = Callback::from({
        let on_state_changed = on_state_changed.clone();
        let state = state.clone();
        move |e| {
            let new_state = match *state {
                ToggleState::On => ToggleState::Off,
                ToggleState::Off => ToggleState::On,
            };
            if let Some(on_state_changed) = on_state_changed.as_ref() {
                on_state_changed.emit((new_state, e));
            }
            state.set(new_state);
        }
    });

    html! {
        if *state == ToggleState::On {
            <Button class={classes!(
                css!(r#"
                    box-shadow: inset 0px 0px 1px 1px var(--vscode-checkbox-background);
                    background-color: var(--vscode-checkbox-background);
                "#),
                class.clone())
            }
            onclick={Some(onclick.clone())}>
                {on_text.clone().unwrap_or_else(|| off_text.clone())}
            </Button>
        } else {
            <Button  class={class.clone()} onclick={Some(onclick.clone())}>
                {off_text.clone()}
            </Button>
        }
    }
}
