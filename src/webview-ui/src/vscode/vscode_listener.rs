use crate::application_state::app_state::{AppState, ImageObject, StoreAction};
use crate::common::{AppMode, ImageData, SessionId, ViewId};
use crate::vscode::messages::*;
use anyhow::Result;
use gloo::events::EventListener;
use itertools::Itertools;
use std::collections::HashMap;
use std::convert::TryFrom;
use wasm_bindgen::JsCast;
use yew::prelude::*;
use yewdux::Dispatch;

pub(crate) struct VSCodeListener;

impl VSCodeListener {
    pub(crate) fn install_incoming_message_handler() -> EventListener {
        let onmessage = Callback::from(move |event: web_sys::Event| {
            let data = event
                .dyn_ref::<web_sys::MessageEvent>()
                .expect("Unable to cast event to MessageEvent")
                .data();

            log::debug!("Received message");
            log::debug!("message data: {:?}", data);
            let start = instant::Instant::now();
            let message: FromExtensionMessageWithId = serde_wasm_bindgen::from_value(data).unwrap();
            let end = instant::Instant::now();
            log::debug!("deserialization took {:?}", end - start);

            Self::handle_incoming_message(message.message);
        });

        let window = web_sys::window().unwrap();
        EventListener::new(&window, "message", move |e| onmessage.emit(e.clone()))
    }

    fn handle_incoming_message(message: FromExtensionMessage) {
        match message {
            FromExtensionMessage::Response(message) => match message {
                ExtensionResponse::ImageData(msg) => Self::handle_image_data_response(msg),
                ExtensionResponse::ReplaceData(replacement_data) => {
                    Self::handle_replace_data_request(replacement_data);
                    Ok(())
                }
            },
            FromExtensionMessage::Request(message) => match message {
                ExtensionRequest::ShowImage {
                    image_data,
                    options,
                } => Self::handle_show_image_request(image_data, options),
                ExtensionRequest::ReplaceData(replacement_data) => {
                    Self::handle_replace_data_request(replacement_data);
                    Ok(())
                }
                ExtensionRequest::Configuration(configurations) => {
                    Self::handle_configuration_request(configurations)
                }
                ExtensionRequest::SetMode { mode } => Self::handle_set_mode_request(mode),
                ExtensionRequest::SetSessionNames(SessionNames { session_names }) => {
                    Self::handle_set_session_names(session_names)
                }
            },
        }
        .map_err(|e| log::error!("Error handling message: {:?}", e))
        .ok();
    }

    fn handle_image_data_response(image_message: ImageMessage) -> Result<()> {
        let image_id = image_message.image_id.clone();
        let dispatch = Dispatch::<AppState>::global();
        let image_data = ImageData::try_from(image_message)?;

        dispatch.apply(StoreAction::AddImageWithData(image_id.clone(), image_data));
        Ok(())
    }

    fn handle_show_image_request(
        image_data: ImageMessage,
        options: ShowImageOptions,
    ) -> Result<()> {
        let _ = options;
        let image_id = image_data.image_id.clone();
        Self::handle_image_data_response(image_data)?;

        let dispatch = Dispatch::<AppState>::global();
        dispatch.apply(StoreAction::SetImageToView(image_id, ViewId::Primary));
        Ok(())
    }

    fn handle_replace_data_request(replace_data: ReplaceData) {
        let ReplaceData {
            session_id,
            replacement_images,
        } = replace_data;
        let dispatch = Dispatch::<AppState>::global();
        let (images, errors): (Vec<_>, Vec<_>) = replacement_images
            .0
            .into_iter()
            .map(ImageObject::try_from)
            .partition_result();

        if !errors.is_empty() {
            log::error!("Unable to parse images: {:?}", errors);
        }

        dispatch.apply(StoreAction::ReplaceData(images));
        if let Some(session_id) = session_id {
            dispatch.apply(StoreAction::SetActiveSession(session_id));
        }
    }

    fn handle_configuration_request(configurations: Configuration) -> Result<()> {
        let dispatch = Dispatch::<AppState>::global();
        dispatch.reduce_mut(|state| {
            if let Some(invert_scroll_direction) = configurations.invert_scroll_direction {
                state.configuration.invert_scroll_direction = invert_scroll_direction;
            }
        });
        Ok(())
    }

    fn handle_set_mode_request(mode: AppMode) -> Result<()> {
        let dispatch = Dispatch::<AppState>::global();
        dispatch.apply(StoreAction::SetMode(mode));
        Ok(())
    }

    fn handle_set_session_names(session_names: HashMap<SessionId, String>) -> Result<()> {
        let dispatch = Dispatch::<AppState>::global();
        dispatch.apply(StoreAction::SetSessionNames(session_names));
        Ok(())
    }
}
