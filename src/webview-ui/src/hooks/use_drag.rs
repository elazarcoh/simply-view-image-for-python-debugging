use crate::hooks::use_event;
use gloo::utils::window;
use web_sys::PointerEvent;
use yew::prelude::*;
use yew_hooks::use_mut_latest;

#[derive(Default)]
pub struct UseDragOptions {
    pub on_relative_position_change: Option<Box<dyn FnMut(f32, f32)>>,
    pub on_start: Option<Box<dyn FnMut()>>,
    pub on_end: Option<Box<dyn FnMut(f32, f32)>>,
}

#[hook]
pub fn use_drag(node: NodeRef, options: UseDragOptions) -> bool {
    use crate::hooks::use_window_event;

    let is_moving = use_state(|| false);
    let offset_position = use_state(|| (0.0, 0.0));
    let start_position = use_mut_ref(|| (0.0, 0.0, 0.0, 0.0));

    let on_relative_position_change_ref = use_mut_latest(options.on_relative_position_change);
    let on_start_ref = use_mut_latest(options.on_start);
    let on_end_ref = use_mut_latest(options.on_end);

    {
        let is_moving = is_moving.clone();
        let start_position = start_position.clone();
        let win = window();
        use_event(node.clone(), "pointerdown", move |event: PointerEvent| {
            event.prevent_default();

            let scroll_x = win.scroll_x().unwrap_or(0.0) as f32;
            let scroll_y = win.scroll_y().unwrap_or(0.0) as f32;
            *start_position.borrow_mut() = (
                event.client_x() as f32,
                event.client_y() as f32,
                scroll_x,
                scroll_y,
            );

            is_moving.set(true);

            let on_start_ref = on_start_ref.current();
            let on_start = &mut *on_start_ref.borrow_mut();
            if let Some(start) = on_start {
                start();
            }
        })
    };

    {
        let is_moving = is_moving.clone();
        let offset_position = offset_position.clone();
        let start_position = start_position.clone();
        let win = window();

        use_window_event("pointermove", move |event: PointerEvent| {
            event.prevent_default();
            if *is_moving {
                let scroll_x = win.scroll_x().unwrap_or(0.0) as f32;
                let scroll_y = win.scroll_y().unwrap_or(0.0) as f32;
                let (start_x, start_y, start_scroll_x, start_scroll_y) = *start_position.borrow();
                let new_offset_x =
                    (event.client_x() as f32) + scroll_x - (start_x + start_scroll_x);
                let new_offset_y =
                    (event.client_y() as f32) + scroll_y - (start_y + start_scroll_y);
                offset_position.set((new_offset_x, new_offset_y));

                let on_relative_position_change_ref = on_relative_position_change_ref.current();
                let on_relative_position_change =
                    &mut *on_relative_position_change_ref.borrow_mut();
                if let Some(relative_position_change) = on_relative_position_change {
                    relative_position_change(new_offset_x, new_offset_y);
                }
            }
        })
    };

    {
        let make_end_callback = |by_cancellation: bool| {
            let is_moving = is_moving.clone();
            let offset_position = offset_position.clone();
            let on_end_ref = on_end_ref.clone();

            move |event: PointerEvent| {
                event.prevent_default();
                if *is_moving {
                    is_moving.set(false);
                    let (x, y) = if by_cancellation {
                        (0.0, 0.0)
                    } else {
                        *offset_position
                    };
                    offset_position.set((0.0, 0.0));

                    let on_end_ref = on_end_ref.current();
                    let on_end = &mut *on_end_ref.borrow_mut();
                    if let Some(end) = on_end {
                        end(x, y);
                    }
                }
            }
        };

        use_window_event("pointerup", make_end_callback(false));
        use_window_event("pointercancel", make_end_callback(true));
    };

    *is_moving
}
