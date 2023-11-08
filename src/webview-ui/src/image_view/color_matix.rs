use glam::{Mat4, Vec3, Vec4};

use crate::{
    communication::incoming_messages::{Channels, ComputedInfo, Datatype, ImageData, ImageInfo},
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
    0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 1.0,
]));
#[rustfmt::skip]
const RGB_TO_G : Mat4 = transpose(&Mat4::from_cols_array(&[
    0.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 1.0,
]));
#[rustfmt::skip]
const RGB_TO_B : Mat4 = transpose(&Mat4::from_cols_array(&[
    0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0,
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
#[rustfmt::skip]  // To be used with ALPHA_ONE
const IGNORE_ALPHA: Mat4 = transpose(&Mat4::from_cols_array(&[
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0 ,0.0, 0.0, 0.0,
]));

#[rustfmt::skip]  // In RGB Integer, the alpha channel is always 1. We discard it so it won't be normalized, and set it to 1 by adding it after the matrix multiplication.
const RGB_INTEGER : Mat4 = transpose(&Mat4::from_cols_array(&[
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0,
]));
#[rustfmt::skip]
const RG_TO_RED_ALPHA : Mat4 = transpose(&Mat4::from_cols_array(&[
    1.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
]));

const ADD_ZERO: Vec4 = Vec4::ZERO;

const fn with_alpha(alpha: f32) -> Vec4 {
    Vec4::new(0.0, 0.0, 0.0, alpha)
}
const fn max_by_datatype(datatype: Datatype) -> f32 {
    match datatype {
        Datatype::Uint8 => u8::MAX as f32,
        Datatype::Uint16 => u16::MAX as f32,
        Datatype::Uint32 => u32::MAX as f32,
        Datatype::Float32 => 1.0,
        Datatype::Int8 => i8::MAX as f32,
        Datatype::Int16 => i16::MAX as f32,
        Datatype::Int32 => i32::MAX as f32,
        Datatype::Bool => 1.0,
    }
}
const fn only_max_alpha(datatype: Datatype) -> Vec4 {
    with_alpha(max_by_datatype(datatype))
}

#[rustfmt::skip]
const NORMALIZE_U8: Mat4 = transpose(&Mat4::from_cols_array(&[
    1.0 / u8::MAX as f32, 0.0, 0.0, 0.0,
    0.0, 1.0 / u8::MAX as f32, 0.0, 0.0,
    0.0, 0.0, 1.0 / u8::MAX as f32, 0.0,
    0.0, 0.0, 0.0, 1.0 / u8::MAX as f32,
]));
#[rustfmt::skip]
const NORMALIZE_U16: Mat4 = transpose(&Mat4::from_cols_array(&[
    1.0 / u16::MAX as f32, 0.0, 0.0, 0.0,
    0.0, 1.0 / u16::MAX as f32, 0.0, 0.0,
    0.0, 0.0, 1.0 / u16::MAX as f32, 0.0,
    0.0, 0.0, 0.0, 1.0 / u16::MAX as f32,
]));
#[rustfmt::skip]
const NORMALIZE_U32: Mat4 = transpose(&Mat4::from_cols_array(&[
    1.0 / u32::MAX as f32, 0.0, 0.0, 0.0,
    0.0, 1.0 / u32::MAX as f32, 0.0, 0.0,
    0.0, 0.0, 1.0 / u32::MAX as f32, 0.0,
    0.0, 0.0, 0.0, 1.0 / u32::MAX as f32,
]));
#[rustfmt::skip]
const NORMALIZE_I8: Mat4 = transpose(&Mat4::from_cols_array(&[
    1.0 / i8::MAX as f32, 0.0, 0.0, 0.0,
    0.0, 1.0 / i8::MAX as f32, 0.0, 0.0,
    0.0, 0.0, 1.0 / i8::MAX as f32, 0.0,
    0.0, 0.0, 0.0, 1.0 / i8::MAX as f32,
]));
#[rustfmt::skip]
const NORMALIZE_I16: Mat4 = transpose(&Mat4::from_cols_array(&[
    1.0 / i16::MAX as f32, 0.0, 0.0, 0.0,
    0.0, 1.0 / i16::MAX as f32, 0.0, 0.0,
    0.0, 0.0, 1.0 / i16::MAX as f32, 0.0,
    0.0, 0.0, 0.0, 1.0 / i16::MAX as f32,
]));
#[rustfmt::skip]
const NORMALIZE_I32: Mat4 = transpose(&Mat4::from_cols_array(&[
    1.0 / i32::MAX as f32, 0.0, 0.0, 0.0,
    0.0, 1.0 / i32::MAX as f32, 0.0, 0.0,
    0.0, 0.0, 1.0 / i32::MAX as f32, 0.0,
    0.0, 0.0, 0.0, 1.0 / i32::MAX as f32,
]));

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

fn stretch_values_matrix(
    image_info: &ImageInfo,
    image_computed_info: &ComputedInfo,
) -> (Mat4, Vec4) {
    // x = (x - min) / (max - min) = x / (max - min) - min / (max - min)
    // x = x * (1 / (max - min)) - min / (max - min)
    // x = x * (1 / (max - min)) + (-min / (max - min))
    let mut factor = Vec3::ONE;
    let mut add = Vec3::ZERO;
    let color_channels = u32::min(image_info.channels as u32, 3);
    (0..color_channels).for_each(|c| {
        let min = image_computed_info.min.get::<f32>(c);
        let max = image_computed_info.max.get::<f32>(c);
        let denom = max - min;

        factor[c as usize] = 1.0 / denom;
        add[c as usize] = -min / denom;
    });

    let factor = Mat4::from_scale(factor);
    let add = Vec4::new(add.x, add.y, add.z, 0.0);

    (factor, add)
}

pub fn calculate_color_matrix(
    image_info: &ImageInfo,
    image_computed_info: &ComputedInfo,
    drawing_options: &DrawingOptions,
) -> (Mat4, Vec4) {
    let datatype = image_info.datatype;
    let num_channels = image_info.channels;
    let normalization_matrix = match datatype {
        Datatype::Uint8 => NORMALIZE_U8,
        Datatype::Uint16 => NORMALIZE_U16,
        Datatype::Uint32 => NORMALIZE_U32,
        Datatype::Float32 => IDENTITY,
        Datatype::Int8 => NORMALIZE_I8,
        Datatype::Int16 => NORMALIZE_I16,
        Datatype::Int32 => NORMALIZE_I32,
        Datatype::Bool => IDENTITY,
    };
    let right_reorder = match num_channels {
        Channels::One => IDENTITY,
        Channels::Two => RG_TO_RED_ALPHA,
        Channels::Three => IDENTITY,
        Channels::Four => IDENTITY,
    };
    let (reorder, reorder_add) = match drawing_options.coloring {
        Coloring::Default => {
            match datatype {
                Datatype::Uint8
                | Datatype::Uint16
                | Datatype::Uint32
                | Datatype::Int8
                | Datatype::Int16
                | Datatype::Int32 => match num_channels {
                    Channels::One => (RED_AS_GRAYSCALE, only_max_alpha(datatype)), // Treat as grayscale. Alpha is always 1.
                    Channels::Two => (RED_AS_GRAYSCALE, ADD_ZERO), // Treat as grayscale + alpha
                    Channels::Three => (RGB_INTEGER, only_max_alpha(datatype)), // Treat as RGB. Alpha is always 1.
                    Channels::Four => (DEFAULT, ADD_ZERO),
                },
                Datatype::Float32 => match num_channels {
                    Channels::One => (RED_AS_GRAYSCALE, only_max_alpha(datatype)), // Treat as grayscale. Alpha is always 1.
                    Channels::Two => (RED_AS_GRAYSCALE, ADD_ZERO), // Treat as grayscale + alpha
                    Channels::Three => (DEFAULT, only_max_alpha(datatype)), // Treat as RGB. Alpha is always 1.
                    Channels::Four => (DEFAULT, ADD_ZERO),
                },
                Datatype::Bool => match num_channels {
                    Channels::One => (RED_AS_GRAYSCALE, only_max_alpha(datatype)), // Treat as grayscale. Alpha is always 1.
                    Channels::Two => (RED_AS_GRAYSCALE, ADD_ZERO), // Treat as grayscale + alpha
                    Channels::Three => (DEFAULT, only_max_alpha(datatype)), // Treat as RGB. Alpha is always 1.
                    Channels::Four => (DEFAULT, ADD_ZERO),
                },
            }
        }
        Coloring::Grayscale => {
            match num_channels {
                Channels::One => (IDENTITY, only_max_alpha(datatype)), // Treat as grayscale. Alpha is always 1.
                Channels::Two => (RED_AS_GRAYSCALE, ADD_ZERO), // Treat as grayscale + alpha
                Channels::Three | Channels::Four => (RGB_TO_GRAYSCALE, ADD_ZERO),
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
        Coloring::SwapRgbBgr => match image_info.channels {
            Channels::One => (IDENTITY, ADD_ZERO),
            Channels::Two | Channels::Three | Channels::Four => (RGB_TO_BGR, ADD_ZERO),
        },
        Coloring::Segmentation => {
            if image_info.channels == Channels::One && is_integer(image_info.datatype) {
                (IDENTITY, ADD_ZERO)
            } else {
                log::warn!("Segmentation coloring is not supported for this image: {:?}, drawing_options: {:?}", image_info, drawing_options);
                (DEFAULT, ADD_ZERO)
            }
        }
    };
    
    let modify_value_mult = IDENTITY;
    let modify_value_add = ADD_ZERO;

    let (modify_value_mult, modify_value_add) = if drawing_options.high_contrast {
        stretch_values_matrix(image_info, image_computed_info)
    } else {
        (modify_value_mult, modify_value_add)
    };

    let (modify_value_mult, modify_value_add) = if drawing_options.ignore_alpha {
        (IGNORE_ALPHA * modify_value_mult, only_max_alpha(datatype) + modify_value_add)
    } else {
        (modify_value_mult, modify_value_add)
    };

    let modify_value_mult = normalization_matrix * modify_value_mult;

    // TODO: fix bugs
    log::debug!("reorder: {}, add: {}", reorder, reorder_add);
    log::debug!("modify_value_mult: {}, add: {}", modify_value_mult, modify_value_add);
    let res = (reorder * modify_value_mult * right_reorder, reorder * (modify_value_add + reorder_add));
    log::debug!("color_matrix: {}, add: {}", res.0, res.1);
    res
}
