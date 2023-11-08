use base64::{engine::general_purpose, Engine};
use js_sys::Reflect;
use yewdux::prelude::Dispatch;

use gloo::events::EventListener;
use gloo_utils::format::JsValueSerdeExt;

use wasm_bindgen::JsCast;
use yew::prelude::*;

use crate::communication::common::MessageId;
use crate::communication::incoming_messages::{
    self, FromExtensionMessage, FromExtensionMessageWithId,
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
        let handle_set_image_message = |image_data: incoming_messages::ImageData| {
            let image_id = image_data.info.image_id.clone();
            // let bytes = general_purpose::STANDARD.decode(message.base64).unwrap();
            // let image =
            //     image::load_from_memory(&message.bytes).expect("Unable to load image from bytes");

            let dispatch = Dispatch::<AppState>::new();
            let tex_image = TextureImage::try_new(image_data, dispatch.get().gl.as_ref().unwrap())
                .expect("Unable to create texture image");
            dispatch.apply(StoreAction::AddTextureImage(image_id, Box::new(tex_image)));

            // let _width = image.width();
            // let _height = image.height();
            // let _channels = image.color().channel_count();

            // // TODO: remove this
            // let _image = image::DynamicImage::ImageRgba8(image.to_rgba8());

            // let image = TextureImage::try_new(image, self.gl.borrow().as_ref().unwrap())
            //     .expect("Unable to create texture image");

            // let image_id = self.texture_image_cache.borrow_mut().add(image);

            // let _view_id = ViewId::Primary;

            // self.image_views
            //     .borrow_mut()
            //     .set_image_to_view(image_id, view_id);
        };

        let handle_images_response = |message: ImageObjects| {
            log::debug!("Received images response: {:?}", message);
            // let dispatch = Dispatch::<AppState>::new();
            // let images = message
            //     .variables
            //     .into_iter()
            //     .map(|info| {
            //         (
            //             ImageId::generate(),
            //             ImageData::new(ImageInfo {
            //                 expression: info.expression,
            //                 shape: vec![0, 0, 0],
            //                 data_type: "TODO".to_string(),
            //                 value_variable_kind: ValueVariableKind::Variable,
            //             }),
            //         )
            //     })
            //     .collect();
            // dispatch.apply(StoreAction::UpdateImages(images));
        };

        match message {
            FromExtensionMessage::Response(message) => match message {
                ExtensionResponse::ImageData(msg) => handle_set_image_message(msg),
                ExtensionResponse::ImageObjects(msg) => handle_images_response(msg),
            },
            FromExtensionMessage::Request(message) => {
                log::debug!("Received request: {:?}", message);
                todo!()
            }
        }
    }
}
