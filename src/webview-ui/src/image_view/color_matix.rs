use glam::Mat4;

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
    0.0, 0.0, 0.0, 1.0,
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

pub fn calculate_color_matrix(image_info: &ImageInfo, drawing_options: &DrawingOptions) -> Mat4 {
    match drawing_options.coloring {
        Coloring::Default => {
            if image_info.channels == Channels::One && image_info.datatype == Datatype::Float32 {
                RED_AS_GRAYSCALE
            } else {
                DEFAULT
            }
        }
        Coloring::Grayscale => {
            if image_info.channels == Channels::One && image_info.datatype == Datatype::Float32 {
                RED_AS_GRAYSCALE
            } else if image_info.channels == Channels::Three {
                RGB_TO_GRAYSCALE
            } else {
                log::warn!("Grayscale coloring is not supported for this image: {:?}, drawing_options: {:?}", image_info, drawing_options);
                DEFAULT
            }
        }
        Coloring::R => {
            if image_info.channels == Channels::One {
                IDENTITY
            } else if image_info.channels == Channels::Two
                || image_info.channels == Channels::Three
                || image_info.channels == Channels::Four
            {
                RGB_TO_R
            } else {
                log::warn!(
                    "R coloring is not supported for this image: {:?}, drawing_options: {:?}",
                    image_info,
                    drawing_options
                );
                DEFAULT
            }
        }
    }
}
