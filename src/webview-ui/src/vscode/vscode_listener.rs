use std::collections::HashMap;

use js_sys::Reflect;
use yewdux::dispatch;
use yewdux::prelude::Dispatch;

use gloo::events::EventListener;
use gloo_utils::format::JsValueSerdeExt;

use wasm_bindgen::JsCast;
use yew::prelude::*;

use crate::communication::common::MessageId;
use crate::communication::incoming_messages::{
    self, FromExtensionMessage, FromExtensionMessageWithId, ImageData,
};

use crate::image_view::types::TextureImage;
use crate::{
    communication::incoming_messages::{ExtensionResponse, ImageObjects},
    image_view::types::{ImageId, ViewId},
    reducer::StoreAction,
    store::AppState,
};

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
                    Self::handle_replace_data_request(
                        replacement_data.replacement_images,
                        replacement_data.replacement_data,
                    )
                }
            },
            FromExtensionMessage::Request(message) => match message {
                incoming_messages::ExtensionRequest::ShowImage {
                    image_data,
                    options,
                } => Self::handle_show_image_request(image_data, options),
                incoming_messages::ExtensionRequest::ReplaceData(replacement_data) => {
                    Self::handle_replace_data_request(
                        replacement_data.replacement_images,
                        replacement_data.replacement_data,
                    )
                }
            },
        }
    }

    fn handle_image_data_response(image_data: incoming_messages::ImageData) {
        let image_id = image_data.info.image_id.clone();

        let dispatch = Dispatch::<AppState>::new();
        let tex_image = TextureImage::try_new(image_data, dispatch.get().gl.as_ref().unwrap())
            .expect("Unable to create texture image");
        dispatch.apply(StoreAction::AddTextureImage(image_id, Box::new(tex_image)));
    }

    fn handle_show_image_request(
        image_data: incoming_messages::ImageData,
        options: incoming_messages::ShowImageOptions,
    ) {
        let image_id = image_data.info.image_id.clone();
        Self::handle_image_data_response(image_data);
        let dispatch = Dispatch::<AppState>::new();
        dispatch.apply(StoreAction::SetImageToView(image_id, ViewId::Primary));
    }

    fn handle_replace_data_request(
        replacement_images: ImageObjects,
        replacement_data: HashMap<ImageId, ImageData>,
    ) {
        let dispatch = Dispatch::<AppState>::new();
        dispatch.apply(StoreAction::ReplaceData {
            replacement_images,
            replacement_data,
        });
    }
}
