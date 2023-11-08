use glam::{Mat4, Vec4};

use crate::{
    communication::incoming_messages::{Channels, Datatype, ImageData, ImageInfo},
    math_utils::mat4::transpose,
    webgl_utils::draw,
};

use super::types::{Coloring, DrawingOptions};

const IDENTITY: Mat4 = Mat4::IDENTITY;
const DEFAULT: Mat4 = Mat4::IDENTITY;
#[rustfmt::skip]
const RED_AS_GRAYSCALE: Mat4 = transpose(&Mat4::from_cols_array(&[
    1.0, 0.0, 0.0, 0.0,
    1.0, 0.0, 0.0, 0.0,
    1.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0,
]));
#[rustfmt::skip]
const RGB_TO_GRAYSCALE: Mat4 = transpose(&Mat4::from_cols_array(&[
    0.3, 0.59, 0.11, 0.0,
    0.3, 0.59, 0.11, 0.0,
    0.3, 0.59, 0.11, 0.0,
    0.0, 0.0, 0.0, 1.0,
]));
#[rustfmt::skip]
const RGB_TO_R : Mat4 = transpose(&Mat4::from_cols_array(&[
    1.0, 0.0, 0.0, 0.0,
    1.0, 0.0, 0.0, 0.0,
    1.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 1.0,
]));
#[rustfmt::skip]
const RGB_TO_G : Mat4 = transpose(&Mat4::from_cols_array(&[
    0.0, 1.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 1.0,
]));
#[rustfmt::skip]
const RGB_TO_B : Mat4 = transpose(&Mat4::from_cols_array(&[
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0,
]));
#[rustfmt::skip]
const RGB_TO_BGR : Mat4 = transpose(&Mat4::from_cols_array(&[
    0.0, 0.0, 1.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    1.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 1.0,
]));
#[rustfmt::skip]
const RGB_INTEGER : Mat4 = transpose(&Mat4::from_cols_array(&[
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 0.0,
]));
#[rustfmt::skip]
const GRAY_ALPHA : Mat4 = transpose(&Mat4::from_cols_array(&[
    1.0, 0.0, 0.0, 0.0,
    1.0, 0.0, 0.0, 0.0,
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
]));

const ADD_ZERO: Vec4 = Vec4::ZERO;
const ALPHA_ONE: Vec4 = Vec4::new(0.0, 0.0, 0.0, 1.0);

fn is_integer(datatype: Datatype) -> bool {
    matches!(
        datatype,
        Datatype::Uint8
            | Datatype::Int8
            | Datatype::Uint16
            | Datatype::Int16
            | Datatype::Uint32
            | Datatype::Int32
    )
}

pub fn calculate_color_matrix(image_info: &ImageInfo, drawing_options: &DrawingOptions) -> (Mat4, Vec4) {
    let datatype = image_info.datatype;
    let num_channels = image_info.channels;
    match drawing_options.coloring {
        Coloring::Default => {
            if is_integer(datatype) {
                match num_channels {
                    Channels::One => (RED_AS_GRAYSCALE, ALPHA_ONE),  // Treat as grayscale. Alpha is always 1.
                    Channels::Two => (GRAY_ALPHA, ADD_ZERO),  // Treat as grayscale + alpha
                    Channels::Three => (RGB_INTEGER, ALPHA_ONE),  // Treat as RGB. Alpha is always 1.
                    Channels::Four => (DEFAULT, ADD_ZERO),
                }
            } else {
                (DEFAULT, ADD_ZERO)
            }
        }
        Coloring::Grayscale => {
            if image_info.channels == Channels::One && image_info.datatype == Datatype::Float32 {
                (RED_AS_GRAYSCALE, ADD_ZERO)
            } else if image_info.channels == Channels::Three {
                (RGB_TO_GRAYSCALE, ADD_ZERO)
            } else {
                log::warn!("Grayscale coloring is not supported for this image: {:?}, drawing_options: {:?}", image_info, drawing_options);
                (DEFAULT, ADD_ZERO)
            }
        }
        Coloring::R => match image_info.channels {
            Channels::One => (IDENTITY, ADD_ZERO),
            Channels::Two | Channels::Three | Channels::Four => (RGB_TO_R, ADD_ZERO),
        },
        Coloring::G => match image_info.channels {
            Channels::One => (IDENTITY, ADD_ZERO),
            Channels::Two | Channels::Three | Channels::Four => (RGB_TO_G, ADD_ZERO),
        },
        Coloring::B => match image_info.channels {
            Channels::One => (IDENTITY, ADD_ZERO),
            Channels::Two | Channels::Three | Channels::Four => (RGB_TO_B, ADD_ZERO),
        },
        Coloring::Bgr => match image_info.channels {
            Channels::One => (IDENTITY, ADD_ZERO),
            Channels::Two | Channels::Three | Channels::Four => (RGB_TO_BGR, ADD_ZERO),
        },
        Coloring::Rgb => (DEFAULT, ADD_ZERO),
        Coloring::Segmentation => {
            if image_info.channels == Channels::One && is_integer(image_info.datatype) {
                (IDENTITY, ADD_ZERO)
            } else {
                log::warn!("Segmentation coloring is not supported for this image: {:?}, drawing_options: {:?}", image_info, drawing_options);
                (DEFAULT, ADD_ZERO)
            }
        }
    }
}
