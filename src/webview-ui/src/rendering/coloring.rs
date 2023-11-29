use glam::{Mat4, Vec3, Vec4};

use crate::{
    math_utils::mat4::transpose, common::{Datatype, ImageInfo, ComputedInfo, Channels},
};


#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub(crate) enum Coloring {
    Default,
    Grayscale,
    R,
    G,
    B,
    SwapRgbBgr,
    Segmentation,
    Heatmap,
}

#[derive(
    Builder, tsify::Tsify, serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq, Hash,
)]
pub(crate) struct DrawingOptions {
    pub coloring: Coloring,
    pub invert: bool,
    pub high_contrast: bool,
    pub ignore_alpha: bool,
}

impl Default for DrawingOptions {
    fn default() -> Self {
        Self {
            coloring: Coloring::Default,
            invert: false,
            high_contrast: false,
            ignore_alpha: false,
        }
    }
}


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
        | Datatype::Uint8
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
    // x = MAX * (x - min) / (max - min) 
    // x = MAX * x / (max - min) - MAX * min / (max - min)
    // x = MAX * x / denom + add

    let datatype = image_info.datatype;
    let channels = image_info.channels;
    let dt_max = max_by_datatype(datatype);

    let calc_normalizer = |c| {
        let min = image_computed_info.min.get::<f32>(c);
        let max = image_computed_info.max.get::<f32>(c);
        let denom = max - min;

        (dt_max / denom, -dt_max * min / denom)
    };

    match channels {
        Channels::One 
        | Channels::Two // Two channels are treated as grayscale + alpha
         => {
            let (factor, add) = calc_normalizer(0);
            let factor = Mat4::from_scale(Vec3::new(factor, 1.0, 1.0));
            let add = Vec4::new(add, 0.0, 0.0, 0.0);
            (factor, add)
        }
        Channels::Three | Channels::Four => {
            let (factor_r, add_r) = calc_normalizer(0);
            let (factor_g, add_g) = calc_normalizer(1);
            let (factor_b, add_b) = calc_normalizer(2);
            let factor = Mat4::from_scale(Vec3::new(factor_r, factor_g, factor_b));
            let add = Vec4::new(add_r, add_g, add_b, 0.0);
            (factor, add)
        }
    }

}

pub(crate) fn calculate_color_matrix(
    image_info: &ImageInfo,
    image_computed_info: &ComputedInfo,
    drawing_options: &DrawingOptions,
) -> (Mat4, Vec4) {
    let datatype = image_info.datatype;
    let channels = image_info.channels;

    let has_alpha_channel = channels == Channels::Two || channels == Channels::Four;

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
    let right_reorder = match channels {
        Channels::One => IDENTITY,
        Channels::Two => RG_TO_RED_ALPHA,
        Channels::Three => IDENTITY,
        Channels::Four => IDENTITY,
    };
    let (reorder, reorder_add) = match drawing_options.coloring {
        | Coloring::Default
        // Heatmap and Segmentation coloring using the default coloring
        | Coloring::Segmentation { .. }
        | Coloring::Heatmap{..} 
         => {
            match datatype {
                | Datatype::Uint8
                | Datatype::Uint16
                | Datatype::Uint32
                | Datatype::Int8
                | Datatype::Int16
                | Datatype::Int32 => match channels {
                    Channels::One => (RED_AS_GRAYSCALE, only_max_alpha(datatype)), // Treat as grayscale. Alpha is always 1.
                    Channels::Two => (RED_AS_GRAYSCALE, ADD_ZERO), // Treat as grayscale + alpha
                    Channels::Three => (RGB_INTEGER, only_max_alpha(datatype)), // Treat as RGB. Alpha is always 1.
                    Channels::Four => (DEFAULT, ADD_ZERO),
                },
                Datatype::Float32 => match channels {
                    Channels::One => (RED_AS_GRAYSCALE, only_max_alpha(datatype)), // Treat as grayscale. Alpha is always 1.
                    Channels::Two => (RED_AS_GRAYSCALE, ADD_ZERO), // Treat as grayscale + alpha
                    Channels::Three => (DEFAULT, only_max_alpha(datatype)), // Treat as RGB. Alpha is always 1.
                    Channels::Four => (DEFAULT, ADD_ZERO),
                },
                Datatype::Bool => match channels {
                    Channels::One => (RED_AS_GRAYSCALE, only_max_alpha(datatype)), // Treat as grayscale. Alpha is always 1.
                    Channels::Two => (RED_AS_GRAYSCALE, ADD_ZERO), // Treat as grayscale + alpha
                    Channels::Three => (DEFAULT, only_max_alpha(datatype)), // Treat as RGB. Alpha is always 1.
                    Channels::Four => (DEFAULT, ADD_ZERO),
                },
            }
        }
        Coloring::Grayscale => {
            match channels {
                Channels::One => {
                    log::warn!("Grayscale coloring is not supported for 1-channel images.");
                    (DEFAULT, ADD_ZERO)
                }
                Channels::Two => {
                    log::warn!("Grayscale coloring is not supported for 2-channel images.");
                    (DEFAULT, ADD_ZERO)
                }
                Channels::Three => (RGB_TO_GRAYSCALE, only_max_alpha(datatype)),
                Channels::Four => (RGB_TO_GRAYSCALE, ADD_ZERO),
            }
        }
        Coloring::R => match channels {
            Channels::One => {
                log::warn!("R coloring is not supported for 1-channel images.");
                (DEFAULT, ADD_ZERO)
            }
            Channels::Two => {
                log::warn!("R coloring is not supported for 2-channel images.");
                (DEFAULT, ADD_ZERO)
            }
            Channels::Three => (RGB_TO_R, only_max_alpha(datatype)),
            Channels::Four => (RGB_TO_R, ADD_ZERO),
        },
        Coloring::G => match channels {
            Channels::One => {
                log::warn!("G coloring is not supported for 1-channel images.");
                (DEFAULT, ADD_ZERO)
            }
            Channels::Two => {
                log::warn!("G coloring is not supported for 2-channel images.");
                (DEFAULT, ADD_ZERO)
            }
            Channels::Three => (RGB_TO_G, only_max_alpha(datatype)),
            Channels::Four => (RGB_TO_G, ADD_ZERO),
        },
        Coloring::B => match channels {
            Channels::One => {
                log::warn!("B coloring is not supported for 1-channel images.");
                (DEFAULT, ADD_ZERO)
            }
            Channels::Two => {
                log::warn!("B coloring is not supported for 2-channel images.");
                (DEFAULT, ADD_ZERO)
            }
            Channels::Three => (RGB_TO_B, only_max_alpha(datatype)),
            Channels::Four => (RGB_TO_B, ADD_ZERO),
        }
        Coloring::SwapRgbBgr => match channels {
            Channels::One => {
                log::warn!("SwapRgbBgr coloring is not supported for 1-channel images.");
                (DEFAULT, ADD_ZERO)
            }
            Channels::Two => {
                log::warn!("SwapRgbBgr coloring is not supported for 2-channel images.");
                (DEFAULT, ADD_ZERO)
            }
            Channels::Three => (RGB_TO_BGR, only_max_alpha(datatype)),
            Channels::Four => (RGB_TO_BGR, ADD_ZERO),
        },
    };
    
    let modify_value_mult = IDENTITY;
    let modify_value_add = ADD_ZERO;

    let heatmap: bool = matches!(drawing_options.coloring, Coloring::Heatmap{..});
    let (modify_value_mult, modify_value_add) = if drawing_options.high_contrast || heatmap  {
        stretch_values_matrix(image_info, image_computed_info)
    } else {
        (modify_value_mult, modify_value_add)
    };

    let (modify_value_mult, modify_value_add) = if drawing_options.ignore_alpha && has_alpha_channel {
        (IGNORE_ALPHA * modify_value_mult, only_max_alpha(datatype) + modify_value_add)
    } else {
        (modify_value_mult, modify_value_add)
    };

    let modify_value_mult = normalization_matrix * modify_value_mult;

    (
        reorder * modify_value_mult * right_reorder,
        reorder * normalization_matrix * (modify_value_add + reorder_add),
    )
}
