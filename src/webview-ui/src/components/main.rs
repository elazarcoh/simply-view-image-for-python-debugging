use std::rc::Rc;

use glam::UVec2;
use stylist::yew::use_style;
use yew::prelude::*;
use yewdux::prelude::Dispatch;

use crate::{
    components::{main_toolbar::MainToolbar, sidebar::Sidebar, status_bar::StatusBar},
    image_view::{
        rendering_context::ViewContext,
        types::{PixelValue, ViewId},
    },
    mouse_events::PixelHoverHandler,
    store::AppState,
};

#[derive(Properties)]
struct StatusBarWrapperProps {
    view_id: ViewId,
    view_context: Rc<dyn ViewContext>,
}

impl PartialEq for StatusBarWrapperProps {
    fn eq(&self, other: &Self) -> bool {
        self.view_id == other.view_id && Rc::ptr_eq(&self.view_context, &other.view_context)
    }
}

#[function_component]
fn StatusBarWrapper(props: &StatusBarWrapperProps) -> Html {
    let StatusBarWrapperProps {
        view_id,
        view_context,
    } = props;

    let pixel = use_state(|| Option::<UVec2>::None);
    let pixel_value = use_state(|| Option::<PixelValue>::None);

    use_effect({
        let pixel = pixel.clone();
        let pixel_value = pixel_value.clone();
        let view_context = Rc::clone(&view_context);
        let view_id = view_id.clone();

        move || {
            let mouse_hover_listener = {
                PixelHoverHandler::install(
                    view_id,
                    Rc::clone(&view_context),
                    Callback::from(move |hovered_pixel: Option<UVec2>| {
                        let maybe_pixel_value = hovered_pixel.and_then(|pixel| {
                            let image = view_context.get_image_for_view(view_id);
                            image.and_then(|image| {
                                Some(PixelValue::from_image(&image.image, &pixel))
                            })
                        });

                        pixel_value.set(maybe_pixel_value);
                        pixel.set(hovered_pixel);
                    }),
                )
            };

            move || {
                drop(mouse_hover_listener);
            }
        }
    });

    html! {
        <StatusBar pixel={*pixel} pixel_value={*pixel_value} />
    }
}

#[derive(Properties)]
pub(crate) struct MainProps {
    pub view_id: ViewId,
    pub view_context: Rc<dyn ViewContext>,
}

impl PartialEq for MainProps {
    fn eq(&self, other: &Self) -> bool {
        self.view_id == other.view_id && Rc::ptr_eq(&self.view_context, &other.view_context)
    }
}

#[function_component]
pub(crate) fn Main(props: &MainProps) -> Html {
    let MainProps {
        view_id,
        view_context,
    } = props;

    let gl_view_node_ref = Dispatch::<AppState>::new()
        .get()
        .image_views()
        .borrow()
        .get_node_ref(*view_id)
        .clone();

    let main_style = use_style!(
        r#"
        display: flex;
        height: 100vh;
  
        .main {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
        }
       
        .main-toolbar {
            width: 100%;
            height: 2em;
        }

        .status-bar {
            width: 100%;
        }

        .gl-view {
            width: 100%;
            height: 100%;
        }
    "#,
    );

    html! {
        <div class={main_style}>
            <Sidebar />
            <div class={"main"}>
                <div ref={gl_view_node_ref} class={"gl-view"} />
                <div class={"status-bar"}>
                    <StatusBarWrapper view_id={*view_id} view_context={view_context.clone()} />
                </div>
            </div>
        </div>
    }
}
