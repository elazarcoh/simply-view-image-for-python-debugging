use glam::UVec2;
use stylist::yew::use_style;
use wasm_bindgen::JsCast;
use yew::prelude::*;
use yewdux::{use_selector, Dispatch};

use crate::{
    application_state::app_state::{AppState, StoreAction},
    common::{pixel_value::PixelValue, SessionId},
};

#[derive(PartialEq, Properties)]
pub struct SessionSelectProps {}

#[function_component]
pub fn SessionSelect(props: &SessionSelectProps) -> Html {
    let SessionSelectProps {} = props;

    let sessions = use_selector(|state: &AppState| state.sessions.clone());
    let active_session = sessions.borrow().active_session.clone();

    let onchange = Callback::from({
        move |e: Event| {
            let value = e
                .target()
                .unwrap()
                .dyn_ref::<web_sys::HtmlSelectElement>()
                .unwrap()
                .value();
            if !value.is_empty() {
                let dispatch = Dispatch::<AppState>::global();
                dispatch.apply(StoreAction::SetActiveSession(SessionId::new(&value)));
            }
        }
    });

    let options = sessions
        .borrow()
        .sessions
        .iter()
        .map(|session| {
            let id = session.0.clone();
            let selected = if let Some(active_session) = active_session.as_ref() {
                active_session.0 == id
            } else {
                false
            };
            html! {
                <option value={id.clone()} selected={selected}>
                    {id}
                </option>
            }
        })
        .collect::<Vec<_>>();

    let style = use_style!(
        r#"
        display: flex;
        align-items: center;
        justify-content: flex-start;
        flex-direction: row;
        gap: 10px;
        max-width: 200px;

        label {
            user-select: none;
        }

        &[disabled] label {
            opacity: 0.5;
        }
        &[disabled] select {
            cursor: not-allowed;
            opacity: 0.5;
        }
        "#
    );

    if options.is_empty() {
        return html! {};
    }

    html! {
        <div class={style}>
            <div class="vscode-select">
                <select
                    {onchange}
                >
                    {for options}
                </select>
                <span class="chevron-icon">
                    <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <path
                            fill-rule="evenodd"
                            clip-rule="evenodd"
                            d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"
                        />
                    </svg>
                </span>
            </div>
        </div>
    }
}

#[derive(PartialEq, Properties)]
pub(crate) struct StatusBarProps {
    pub pixel: Option<UVec2>,
    pub pixel_value: Option<PixelValue>,
}

#[function_component]
pub(crate) fn StatusBar(props: &StatusBarProps) -> Html {
    let StatusBarProps { pixel, pixel_value } = props;

    let style = use_style!(
        r#"
        display: flex;
        flex-direction: row;
        user-select: none;
        background-color: var(--vscode-statusBar-background);
        border-top: 1px solid var(--vscode-statusBar-border);
        padding-top: 4px;
        padding-bottom: 4px;
        padding-left: 15px;

        min-height: 1.25em;
        line-height: 1.25em;

        .left {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
        }

        .right {
            margin-left: auto;
            margin-right: 4px;
        }

        .item {
            white-space: nowrap;
            width: 7ch;
        }
    "#,
    );

    html! {
        <div class={style}>
            <div class="left">
                <div class="item">{pixel.map(|p| format!("x: {}", p.x)).unwrap_or_default()}</div>
                <div class="item">{pixel.map(|p| format!("y: {}", p.y)).unwrap_or_default()}</div>
                <div class="item">{pixel_value.map(|p| format!("{}", p)).unwrap_or_default()}</div>
            </div>
            <div class="right">
                <SessionSelect />
            </div>
        </div>
    }
}
