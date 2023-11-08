use std::{collections::HashMap, fmt::format};

use image::EncodableLayout;
use web_sys::WebGl2RenderingContext;
use yewdux::prelude::Dispatch;

use crate::communication::incoming_messages::Channels;
use crate::image_view::types::ViewId;
use crate::reducer::StoreAction;
use crate::store::AppState;

use crate::{
    communication::incoming_messages::{Datatype, ImageData, ImageInfo, ValueVariableKind},
    image_view::types::{ImageId, TextureImage},
};

fn image_rgba_data_u8() -> &'static [u8] {
    const DATA: &[u8] = &[
        0u8, 0, 0, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231,
        255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200,
        191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231,
        255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 34,
        177, 76, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 34, 177, 76, 255,
        153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 0, 0, 0, 255, 0, 0, 0, 255,
        200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191,
        231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255,
        200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191,
        231, 255, 200, 191, 231, 255, 34, 177, 76, 255, 255, 174, 201, 255, 255, 174, 201, 255,
        255, 174, 201, 255, 34, 177, 76, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217,
        234, 255, 153, 217, 234, 255, 0, 0, 0, 255, 0, 0, 0, 255, 200, 191, 231, 255, 200, 191,
        231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255,
        200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191,
        231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 34, 177, 76, 255,
        255, 174, 201, 255, 255, 174, 201, 255, 34, 177, 76, 255, 153, 217, 234, 255, 153, 217,
        234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255,
        34, 177, 76, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 200, 191, 231, 255, 200, 191,
        231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255,
        200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191,
        231, 255, 34, 177, 76, 255, 255, 174, 201, 255, 255, 174, 201, 255, 34, 177, 76, 255, 153,
        217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234,
        255, 153, 217, 234, 255, 34, 177, 76, 255, 255, 242, 0, 255, 255, 242, 0, 255, 0, 0, 0,
        255, 0, 0, 0, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191,
        231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255,
        200, 191, 231, 255, 34, 177, 76, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174,
        201, 255, 34, 177, 76, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255,
        153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 34, 177, 76, 255, 255, 242, 0,
        255, 255, 242, 0, 255, 255, 242, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 200, 191, 231, 255,
        200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191,
        231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 34, 177, 76, 255, 255, 174, 201, 255,
        255, 174, 201, 255, 255, 174, 201, 255, 34, 177, 76, 255, 153, 217, 234, 255, 153, 217,
        234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255,
        34, 177, 76, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255,
        255, 242, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200,
        191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 34, 177, 76,
        255, 255, 174, 201, 255, 255, 174, 201, 255, 34, 177, 76, 255, 153, 217, 234, 255, 153,
        217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234,
        255, 153, 217, 234, 255, 34, 177, 76, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0,
        255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 0, 0, 0, 255,
        0, 0, 0, 255, 200, 191, 231, 255, 200, 191, 231, 255, 200, 191, 231, 255, 34, 177, 76, 255,
        255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 34, 177, 76, 255, 153, 217,
        234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255,
        153, 217, 234, 255, 153, 217, 234, 255, 34, 177, 76, 255, 255, 242, 0, 255, 255, 242, 0,
        255, 237, 28, 36, 255, 237, 28, 36, 255, 237, 28, 36, 255, 237, 28, 36, 255, 237, 28, 36,
        255, 237, 28, 36, 255, 237, 28, 36, 255, 237, 28, 36, 255, 237, 28, 36, 255, 237, 28, 36,
        255, 34, 177, 76, 255, 237, 28, 36, 255, 237, 28, 36, 255, 237, 28, 36, 255, 34, 177, 76,
        255, 237, 28, 36, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153,
        217, 234, 255, 153, 217, 234, 255, 237, 28, 36, 255, 34, 177, 76, 255, 237, 28, 36, 255,
        237, 28, 36, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174,
        201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 0, 0, 0, 255, 0, 0,
        0, 255, 255, 255, 255, 255, 34, 177, 76, 255, 200, 191, 231, 255, 200, 191, 231, 255, 34,
        177, 76, 255, 185, 122, 87, 255, 237, 28, 36, 255, 237, 28, 36, 255, 237, 28, 36, 255, 153,
        217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234,
        255, 34, 177, 76, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255,
        174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201,
        255, 255, 174, 201, 255, 0, 0, 0, 255, 34, 177, 76, 255, 200, 191, 231, 255, 200, 191, 231,
        255, 200, 191, 231, 255, 34, 177, 76, 255, 185, 122, 87, 255, 185, 122, 87, 255, 185, 122,
        87, 255, 237, 28, 36, 255, 237, 28, 36, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153,
        217, 234, 255, 153, 217, 234, 255, 34, 177, 76, 255, 255, 174, 201, 255, 255, 174, 201,
        255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255,
        174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 34, 177, 76,
        255, 200, 191, 231, 255, 200, 191, 231, 255, 34, 177, 76, 255, 185, 122, 87, 255, 185, 122,
        87, 255, 185, 122, 87, 255, 185, 122, 87, 255, 185, 122, 87, 255, 185, 122, 87, 255, 153,
        217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 34, 177, 76,
        255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255,
        174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201,
        255, 34, 177, 76, 255, 63, 72, 204, 255, 0, 0, 0, 255, 34, 177, 76, 255, 185, 122, 87, 255,
        185, 122, 87, 255, 185, 122, 87, 255, 185, 122, 87, 255, 185, 122, 87, 255, 185, 122, 87,
        255, 185, 122, 87, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153,
        217, 234, 255, 34, 177, 76, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201,
        255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255,
        174, 201, 255, 255, 174, 201, 255, 34, 177, 76, 255, 63, 72, 204, 255, 63, 72, 204, 255,
        34, 177, 76, 255, 185, 122, 87, 255, 185, 122, 87, 255, 185, 122, 87, 255, 185, 122, 87,
        255, 185, 122, 87, 255, 185, 122, 87, 255, 237, 28, 36, 255, 153, 217, 234, 255, 153, 217,
        234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 34, 177, 76, 255, 255, 174, 201, 255,
        255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174,
        201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 34, 177, 76, 255, 63, 72, 204, 255, 63,
        72, 204, 255, 63, 72, 204, 255, 34, 177, 76, 255, 0, 0, 0, 255, 185, 122, 87, 255, 185,
        122, 87, 255, 185, 122, 87, 255, 185, 122, 87, 255, 237, 28, 36, 255, 237, 28, 36, 255,
        153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 34, 177,
        76, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255,
        255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 34, 177,
        76, 255, 63, 72, 204, 255, 63, 72, 204, 255, 34, 177, 76, 255, 127, 127, 127, 255, 127,
        127, 127, 255, 0, 0, 0, 255, 185, 122, 87, 255, 237, 28, 36, 255, 237, 28, 36, 255, 255,
        242, 0, 255, 255, 242, 0, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255,
        153, 217, 234, 255, 34, 177, 76, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174,
        201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255,
        255, 174, 201, 255, 34, 177, 76, 255, 63, 72, 204, 255, 63, 72, 204, 255, 34, 177, 76, 255,
        127, 127, 127, 255, 127, 127, 127, 255, 0, 0, 0, 255, 237, 28, 36, 255, 255, 242, 0, 255,
        255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 153, 217, 234, 255, 153, 217, 234,
        255, 153, 217, 234, 255, 153, 217, 234, 255, 34, 177, 76, 255, 255, 174, 201, 255, 255,
        174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201,
        255, 255, 174, 201, 255, 34, 177, 76, 255, 63, 72, 204, 255, 63, 72, 204, 255, 63, 72, 204,
        255, 34, 177, 76, 255, 127, 127, 127, 255, 127, 127, 127, 255, 237, 28, 36, 255, 0, 0, 0,
        255, 0, 0, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 153, 217, 234,
        255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 34, 177, 76, 255, 255,
        174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201,
        255, 255, 174, 201, 255, 255, 174, 201, 255, 34, 177, 76, 255, 63, 72, 204, 255, 63, 72,
        204, 255, 63, 72, 204, 255, 34, 177, 76, 255, 127, 127, 127, 255, 237, 28, 36, 255, 255,
        242, 0, 255, 255, 242, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 242, 0, 255, 255, 242, 0,
        255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217, 234, 255, 34,
        177, 76, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201,
        255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 34, 177, 76, 255, 63, 72,
        204, 255, 63, 72, 204, 255, 63, 72, 204, 255, 34, 177, 76, 255, 237, 28, 36, 255, 255, 242,
        0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 0, 0, 0, 255, 255, 242, 0,
        255, 255, 242, 0, 255, 237, 28, 36, 255, 153, 217, 234, 255, 153, 217, 234, 255, 153, 217,
        234, 255, 34, 177, 76, 255, 255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255,
        255, 174, 201, 255, 255, 174, 201, 255, 255, 174, 201, 255, 34, 177, 76, 255, 237, 28, 36,
        255, 237, 28, 36, 255, 237, 28, 36, 255, 237, 28, 36, 255, 34, 177, 76, 255, 255, 242, 0,
        255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0,
        255, 255, 242, 0, 255, 255, 242, 0, 255, 237, 28, 36, 255, 153, 217, 234, 255, 153, 217,
        234, 255, 153, 217, 234, 255, 34, 177, 76, 255, 255, 174, 201, 255, 255, 174, 201, 255,
        255, 174, 201, 255, 255, 174, 201, 255, 237, 28, 36, 255, 237, 28, 36, 255, 34, 177, 76,
        255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0,
        255, 34, 177, 76, 255, 255, 242, 0, 255, 255, 242, 0, 255, 34, 177, 76, 255, 34, 177, 76,
        255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 237, 28, 36, 255, 237, 28, 36,
        255, 237, 28, 36, 255, 237, 28, 36, 255, 34, 177, 76, 255, 237, 28, 36, 255, 237, 28, 36,
        255, 237, 28, 36, 255, 237, 28, 36, 255, 127, 127, 127, 255, 127, 127, 127, 255, 34, 177,
        76, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242,
        0, 255, 34, 177, 76, 255, 34, 177, 76, 255, 34, 177, 76, 255, 34, 177, 76, 255, 255, 242,
        0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 63, 72, 204, 255, 63, 72,
        204, 255, 63, 72, 204, 255, 63, 72, 204, 255, 34, 177, 76, 255, 34, 177, 76, 255, 127, 127,
        127, 255, 127, 127, 127, 255, 127, 127, 127, 255, 127, 127, 127, 255, 34, 177, 76, 255,
        255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255,
        255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255,
        255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 63, 72, 204, 255,
        63, 72, 204, 255, 63, 72, 204, 255, 63, 72, 204, 255, 63, 72, 204, 255, 34, 177, 76, 255,
        127, 127, 127, 255, 127, 127, 127, 255, 127, 127, 127, 255, 127, 127, 127, 255, 34, 177,
        76, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242,
        0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242,
        0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255, 255, 242, 0, 255,
    ];
    DATA
}

fn image_data_with(bytes: &[u8], datatype: Datatype, channels: Channels, name: &str) -> ImageData {
    ImageData {
        info: ImageInfo {
            image_id: ImageId::generate(),
            value_variable_kind: ValueVariableKind::Variable,
            expression: name.to_string(),
            width: 25,
            height: 25,
            channels,
            datatype,
            additional_info: HashMap::new(),
        },
        bytes: bytes.to_vec(),
    }
}

fn image_texture_rgba_u8(gl: &WebGl2RenderingContext) -> TextureImage {
    let bytes_rgba = image_rgba_data_u8();
    let image_data = image_data_with(bytes_rgba, Datatype::Uint8, Channels::Four, "image_rgba_u8");
    TextureImage::try_new(image_data, gl).unwrap()
}

fn image_texture_rgb_u8(gl: &WebGl2RenderingContext) -> TextureImage {
    let bytes_rgba = image_rgba_data_u8();
    let data = bytes_rgba
        .chunks_exact(4)
        .flat_map(|chunk| chunk[0..3].to_vec())
        .collect::<Vec<u8>>();
    let image_data = image_data_with(data.as_bytes(), Datatype::Uint8, Channels::Three, "image_rgb_u8");
    TextureImage::try_new(image_data, gl).unwrap()
}

fn image_texture_rg_u8(gl: &WebGl2RenderingContext) -> TextureImage {
    let bytes_rgba = image_rgba_data_u8();
    let data = bytes_rgba
        .chunks_exact(4)
        .flat_map(|chunk| chunk[0..2].to_vec())
        .collect::<Vec<u8>>();
    let image_data = image_data_with(data.as_bytes(), Datatype::Uint8, Channels::Two, "image_rg_u8");
    TextureImage::try_new(image_data, gl).unwrap()
}

fn image_texture_gray_u8(gl: &WebGl2RenderingContext) -> TextureImage {
    let bytes_rgba = image_rgba_data_u8();
    let data = bytes_rgba
        .chunks_exact(4)
        .map(|chunk| {
            let r = chunk[0] as f32;
            let g = chunk[1] as f32;
            let b = chunk[2] as f32;

            (r * 0.3 + g * 0.59 + b * 0.11) as u8
        })
        .collect::<Vec<u8>>();
    let image_data = image_data_with(data.as_bytes(), Datatype::Uint8, Channels::One, "image_gray_u8");
    TextureImage::try_new(image_data, gl).unwrap()
}

fn image_texture_rgba_f32(gl: &WebGl2RenderingContext) -> TextureImage {
    let bytes_rgba = image_rgba_data_u8();
    let data = bytes_rgba
        .chunks_exact(4)
        .flat_map(|chunk| {
            let r = chunk[0] as f32 / 255.0;
            let g = chunk[1] as f32 / 255.0;
            let b = chunk[2] as f32 / 255.0;
            let a = chunk[3] as f32 / 255.0;
            vec![r, g, b, a]
        })
        .collect::<Vec<f32>>();
    let image_data = image_data_with(data.as_bytes(), Datatype::Float32, Channels::Four, "image_rgba_f32");
    TextureImage::try_new(image_data, gl).unwrap()
}

fn image_texture_rgb_f32(gl: &WebGl2RenderingContext) -> TextureImage {
    let bytes_rgba = image_rgba_data_u8();
    let data = bytes_rgba
        .chunks_exact(4)
        .flat_map(|chunk| {
            let r = chunk[0] as f32 / 255.0;
            let g = chunk[1] as f32 / 255.0;
            let b = chunk[2] as f32 / 255.0;
            vec![r, g, b]
        })
        .collect::<Vec<f32>>();
    let image_data = image_data_with(data.as_bytes(), Datatype::Float32, Channels::Three, "image_rgb_f32");
    TextureImage::try_new(image_data, gl).unwrap()
}

fn image_texture_gray_f32(gl: &WebGl2RenderingContext) -> TextureImage {
    let bytes_rgba = image_rgba_data_u8();
    let data = bytes_rgba
        .chunks_exact(4)
        .map(|chunk| {
            let r = chunk[0] as f32 / 255.0;
            let g = chunk[1] as f32 / 255.0;
            let b = chunk[2] as f32 / 255.0;
            (r * 0.3 + g * 0.59 + b * 0.11)
        })
        .collect::<Vec<f32>>();
    let image_data = image_data_with(data.as_bytes(), Datatype::Float32, Channels::One, "image_gray_f32");
    TextureImage::try_new(image_data, gl).unwrap()
}

fn image_texture_with_transparency(gl: &WebGl2RenderingContext) -> TextureImage {
    let bytes_rgba = image_rgba_data_u8();
    let data = bytes_rgba
        .chunks_exact(4)
        .enumerate()
        .flat_map(|(i, chunk)| {
            let r = chunk[0];
            let g = chunk[1];
            let b = chunk[2];
            let mut a = chunk[3];
            if i % 4 == 0 {
                a = 0;
            } else if i % 3 == 0 {
                a = 127;
            } else if i % 2 == 0 {
                a = 200;
            }
            vec![r, g, b, a]
        })
        .collect::<Vec<u8>>();
    let image_data = image_data_with(
        data.as_bytes(),
        Datatype::Uint8,
        Channels::Four,
        "image_with_transparency",
    );
    TextureImage::try_new(image_data, gl).unwrap()
}

fn image_fully_transparent(gl: &WebGl2RenderingContext) -> TextureImage {
    let bytes_rgba = image_rgba_data_u8();
    let data = bytes_rgba
        .chunks_exact(4)
        .flat_map(|chunk| {
            let r = chunk[0];
            let g = chunk[1];
            let b = chunk[2];
            let a = 0;
            vec![r, g, b, a]
        })
        .collect::<Vec<u8>>();
    let image_data = image_data_with(data.as_bytes(), Datatype::Uint8, Channels::Four, "transparent_image");
    TextureImage::try_new(image_data, gl).unwrap()
}

#[cfg(debug_assertions)]
pub fn set_debug_images(gl: &WebGl2RenderingContext) {
    let dispatch = Dispatch::<AppState>::new();

    log::debug!("creating debug image texture");
    let images = vec![
        image_texture_rgba_u8(gl),
        image_texture_rgb_u8(gl),
        image_texture_rg_u8(gl),
        image_texture_gray_u8(gl),
        image_texture_rgba_f32(gl),
        image_texture_rgb_f32(gl),
        image_texture_gray_f32(gl),
        image_texture_with_transparency(gl),
        image_fully_transparent(gl),
    ];
    dispatch.apply(StoreAction::UpdateImages(
        images
            .iter()
            .map(|image| (image.image.info.image_id.clone(), image.image.info.clone()))
            .collect(),
    ));

    for image in images {
        let image_id = image.image.info.image_id.clone();
        dispatch.apply(StoreAction::AddTextureImage(image_id.clone(), image));
        log::debug!("setting image to view");
        let view_id = ViewId::Primary;
        dispatch.apply(StoreAction::SetImageToView(image_id, view_id));
    }
}
