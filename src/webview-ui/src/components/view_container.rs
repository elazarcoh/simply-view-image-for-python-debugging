use std::{
    cell::{Ref, RefCell},
    rc::Rc,
};

use stylist::{css, yew::use_style};
use wasm_bindgen::{closure::Closure, JsCast};
use web_sys::{window, Element, ResizeObserver, ResizeObserverEntry, ResizeObserverSize};

use yew::prelude::*;
use yew_hooks::prelude::*;

use yew_hooks::use_size;
use yewdux::functional::use_selector;

use crate::{
    app_state::app_state::AppState,
    bindings::plotlyjs::{self, relayout_plot, resize_plot},
    common::{viewables::plotly::PlotlyPlot, ImageAvailability, ViewId},
    components::spinner::Spinner,
};

#[derive(PartialEq, Properties)]
pub struct PlotlyContainerProps {
    hidden: bool,
}

#[function_component]
pub fn PlotlyContainer(props: &PlotlyContainerProps) -> Html {
    let PlotlyContainerProps { hidden } = props;

    let element_ref = use_node_ref();

    // based on this: https://github.com/plotly/react-plotly.js/issues/76#issuecomment-1655339186
    use_effect_with((), {
        let element_ref = element_ref.clone();
        move |_| {
            let resize_observer = Rc::new(RefCell::new(None));
            if let Some(element) = element_ref.cast::<Element>() {
                let closure = Closure::wrap(Box::new(|_| {
                    wasm_bindgen_futures::spawn_local(async move {
                        resize_plot("plotly-view").await;
                    });
                })
                    as Box<dyn Fn(Vec<ResizeObserverEntry>)>);

                *resize_observer.borrow_mut() =
                    Some(ResizeObserver::new(closure.as_ref().unchecked_ref()).unwrap());
                // Forget the closure to keep it alive
                closure.forget();

                resize_observer.borrow().as_ref().unwrap().observe(&element);
            }

            move || {
                resize_observer.borrow().as_ref().map(|o| o.disconnect());
            }
        }
    });

    // using string style instead of css! macro because for some reason the css! macro kills the plotly plot auto-resize.
    // using visibility instead of display because display: none; kills the plotly plot auto-resize.
    let style = if *hidden {
        "height: 100%; width: 100%; visibility: hidden;"
    } else {
        "height: 100%; width: 100%; visibility: visible;"
    };

    html! {
        <div ref={element_ref} style={{style}}>
            <div id="plotly-view" style="height: 100%; width: 100%;"></div>
        </div>
    }
}

#[derive(PartialEq, Properties)]
pub(crate) struct ViewContainerProps {
    #[prop_or_default]
    pub class: Classes,
    pub node_ref: NodeRef,
    pub view_id: ViewId,
}

#[function_component]
pub(crate) fn ViewContainer(props: &ViewContainerProps) -> Html {
    let ViewContainerProps {
        node_ref,
        class,
        view_id,
    } = props;

    let current_image_availability = {
        let view_id = *view_id;
        use_selector(move |state: &AppState| -> Option<ImageAvailability> {
            let viewable = state.image_views.borrow().get_viewable(view_id)?;
            Some(state.viewables_cache.borrow().get(&viewable))
        })
    };

    let inner_element = if let Some(availability) = current_image_availability.as_ref() {
        match availability {
            ImageAvailability::NotAvailable => Some(html! {
                <div>{"No Data"}</div>
            }),
            ImageAvailability::Pending => Some(html! {
                <Spinner />
            }),
            ImageAvailability::ImageAvailable(_) => None,
            ImageAvailability::PlotlyAvailable(_) => None,
        }
    } else {
        None
    };

    let is_plotly = matches!(
        current_image_availability.as_ref(),
        Some(ImageAvailability::PlotlyAvailable(_))
    );

    let style = use_style!(
        r#"
        display: flex;
        height: 100%;
        width: 100%;
        justify-content: center;
        align-items: center;
        "#,
    );

    html! {
        <div ref={node_ref.clone()} class={classes!(class.clone(), style)}>
            {inner_element}
            <PlotlyContainer hidden={!is_plotly} />
        </div>
    }
}
