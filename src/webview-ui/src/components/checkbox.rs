use wasm_bindgen::JsCast;
use yew::prelude::*;

#[derive(PartialEq, Properties)]
pub struct CheckboxProps {
    pub(crate) checked: bool,
    #[prop_or_default]
    pub(crate) disabled: Option<bool>,
    #[prop_or_default]
    pub(crate) children: Html,
    #[prop_or_default]
    pub(crate) on_change: Option<Callback<bool>>,
}

#[function_component]
pub fn Checkbox(props: &CheckboxProps) -> Html {
    let disabled = props.disabled.unwrap_or(false);
    let onchange = props.on_change.as_ref().map(|on_change| {
        Callback::from({
            let on_change = on_change.clone();
            move |event: Event| {
                let target = event.target().unwrap();
                let checked = target
                    .dyn_ref::<web_sys::HtmlInputElement>()
                    .unwrap()
                    .checked();
                on_change.emit(checked);
            }
        })
    });
    html! {
        <div class={classes!("vscode-checkbox", if disabled { "disabled" } else { "" })}>
            <input type="checkbox" id="checkbox" disabled={disabled} checked={props.checked} onchange={onchange} />
            <label for="checkbox">
                <span class="text">
                    {props.children.clone()}
                </span>
                <span class="icon">
                    <i class="codicon codicon-check icon-checked"></i>
                    <i class="codicon codicon-chrome-minimize icon-indeterminate"></i>
                </span>
            </label>
        </div>
    }
}
