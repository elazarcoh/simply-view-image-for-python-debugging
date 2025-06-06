use std::rc::Rc;

use glam::UVec2;
use stylist::yew::use_style;
use yew::prelude::*;
use yewdux::{prelude::Dispatch, use_selector};

use crate::{
    application_state::app_state::AppState,
    common::{pixel_value::PixelValue, AppMode, ViewId},
    components::{
        main_toolbar::MainToolbar, sidebar::Sidebar, status_bar::StatusBar,
        view_container::ViewContainer,
    },
    mouse_events::PixelHoverHandler,
    rendering::rendering_context::ViewContext,
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

pub(crate) enum PixelHoverEvent {
    Hovered(UVec2),
    Refresh,
    None,
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
        let view_context = Rc::clone(view_context);
        let view_id = *view_id;

        move || {
            let mouse_hover_listener = {
                PixelHoverHandler::install(
                    view_id,
                    Rc::clone(&view_context),
                    Callback::from(move |hovered_pixel: PixelHoverEvent| {
                        let current_pixel = match hovered_pixel {
                            PixelHoverEvent::Hovered(pixel) => Some(pixel),
                            PixelHoverEvent::Refresh => *pixel,
                            PixelHoverEvent::None => None,
                        };

                        let maybe_pixel_value = current_pixel
                            .zip(view_context.get_image_for_view(view_id))
                            .and_then(|(pixel, image)| {
                                image.map(|image| {
                                    let image = image.borrow();
                                    let dispatch = Dispatch::<AppState>::global();
                                    let batch_index = dispatch
                                        .get()
                                        .drawing_options
                                        .borrow()
                                        .get(&image.info.image_id)
                                        .and_then(|d| d.batch_item)
                                        .unwrap_or(0);

                                    image.bytes.get(&batch_index).map(|bytes| {
                                        PixelValue::from_image_info(&image.info, bytes, &pixel)
                                    })
                                })
                            })
                            .flatten();

                        pixel_value.set(maybe_pixel_value);
                        pixel.set(match hovered_pixel {
                            PixelHoverEvent::Hovered(pixel) => Some(pixel),
                            PixelHoverEvent::Refresh => current_pixel,
                            PixelHoverEvent::None => None,
                        });
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

    let view_container_node_ref = Dispatch::<AppState>::global()
        .get()
        .image_views
        .borrow()
        .get_node_ref(*view_id)
        .clone();
    let app_mode = use_selector(|state: &AppState| state.app_mode);
    log::info!("app_mode: {:?}", app_mode);

    let main_style = use_style!(
        r#"
        display: grid;
        height: 100vh;
        grid-template-areas:
            "sidebar main-toolbar"
            "sidebar main"
            "sidebar footer";
        grid-template-rows: auto 1fr auto;
        grid-template-columns: fit-content(200px) 1fr;
  
        .main {
            grid-area: main;
            width: 100%;
            height: 100%;
        }

        .sidebar {
            grid-area: sidebar;
            max-width: 200px;
        }
       
        .main-toolbar {
            grid-area: main-toolbar;
            width: 100%;
        }

        .status-bar {
            grid-area: footer;
            width: 100%;
        }

        .view-container {
            width: 100%;
            height: 100%;
        }
    "#,
    );

    html! {
        <div class={main_style}>
            <div class={"main-toolbar"}>
                <MainToolbar />
            </div>
            if *app_mode == AppMode::ImageList {
                <Sidebar class="sidebar" />
            } else {
            }
            <div class={"main"}>
                <ViewContainer node_ref={view_container_node_ref} class="view-container" view_id={ViewId::Primary}/>
            </div>
            <div class={"status-bar"}>
                <StatusBarWrapper view_id={*view_id} view_context={view_context.clone()} />
            </div>
        </div>
    }
}
