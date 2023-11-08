use base64::{engine::general_purpose, Engine};
use yewdux::prelude::Dispatch;

use gloo::events::EventListener;
use gloo_utils::format::JsValueSerdeExt;

use wasm_bindgen::JsCast;
use yew::prelude::*;

use crate::communication::incoming_messages::{self, FromExtensionMessageWithId};

use crate::image_view::types::TextureImage;
use crate::{
    communication::incoming_messages::{FromExtensionMessage, ImageObjects},
    image_view::types::{ImageId, ViewId},
    reducer::StoreAction,
    store::{AppState, ImageData, ImageInfo, ValueVariableKind},
};

pub(crate) struct VSCodeListener;

impl VSCodeListener {
    pub fn install_incoming_message_handler() -> EventListener {
        let onmessage = Callback::from(move |event: web_sys::Event| {
            let data = event
                .dyn_ref::<web_sys::MessageEvent>()
                .expect("Unable to cast event to MessageEvent")
                .data();

            log::debug!("Received message: {:?}", data);
            let message: FromExtensionMessageWithId = data.into_serde().unwrap();

            Self::handle_incoming_message(message.message);
        });

        let window = web_sys::window().unwrap();
        EventListener::new(&window, "message", move |e| onmessage.emit(e.clone()))
    }

    fn handle_incoming_message(message: FromExtensionMessage) {
        let handle_set_image_message = |message: incoming_messages::ImageData| {
            let image_id = message.image_id;
            let bytes = general_purpose::STANDARD.decode(message.base64).unwrap();
            let image =
                image::load_from_memory_with_format(&bytes, image::ImageFormat::Png).unwrap();

            let dispatch = Dispatch::<AppState>::new();

            let tex_image = TextureImage::try_new(image, dispatch.get().gl.as_ref().unwrap())
                .expect("Unable to create texture image");
            dispatch.apply(StoreAction::AddTextureImage(image_id, tex_image));

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
            let dispatch = Dispatch::<AppState>::new();
            let images = message
                .variables
                .into_iter()
                .map(|info| {
                    (
                        ImageId::generate(),
                        ImageData::new(ImageInfo {
                            expression: info.name,
                            shape: vec![0, 0, 0],
                            data_type: "TODO".to_string(),
                            value_variable_kind: ValueVariableKind::Variable,
                        }),
                    )
                })
                .collect();
            dispatch.apply(StoreAction::UpdateImages(images));
        };

        match message {
            FromExtensionMessage::ImageData(msg) => handle_set_image_message(msg),
            FromExtensionMessage::ImageObjects(msg) => handle_images_response(msg),
        }
    }
}
