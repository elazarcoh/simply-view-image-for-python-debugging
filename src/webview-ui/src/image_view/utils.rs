use crate::common::{Channels, Datatype};

use super::types::PixelValue;

trait MinMax<T> {
    const MIN: T;
    const MAX: T;
}

macro_rules! impl_minmax {
    ($t:ty) => {
        impl MinMax<$t> for $t {
            const MIN: $t = <$t>::MIN;
            const MAX: $t = <$t>::MAX;
        }
    };
}

impl_minmax!(u8);
impl_minmax!(u16);
impl_minmax!(u32);
impl_minmax!(i8);
impl_minmax!(i16);
impl_minmax!(i32);
impl_minmax!(f32);

fn minmax<const Ch: usize, T, Out>(values: &[T]) -> ([Out; Ch], [Out; Ch])
where
    T: MinMax<T> + Copy + PartialOrd,
    Out: From<T>,
{

    // let start = instant::Instant::now();

    let mut min: [T; Ch] = [T::MAX; Ch];
    let mut max: [T; Ch] = [T::MIN; Ch];

    let num_pixels = values.len() / Ch;
    let mut index = 0;
    for _ in 0..num_pixels {
        for channel in 0..Ch {
            let value = values[index];
            let current_min = &mut min[channel];
            let current_max = &mut max[channel];
            if value < *current_min {
                *current_min = value;
            }
            if value > *current_max {
                *current_max = value;
            }
            index += 1;
        }
    }


    // let end = instant::Instant::now();
    // log::debug!("minmax took {:?}", end - start);

    let min: [Out; Ch] = min.map(|v| Out::from(v));
    let max: [Out; Ch] = max.map(|v| Out::from(v));
    (min, max)
}

fn f32_pixel_value_from_minmax(
    channels: Channels,
    min: &[f64],
    max: &[f64],
) -> (PixelValue, PixelValue) {
    let mut min_pixel_value = PixelValue::new(channels, Datatype::Float32);
    min_pixel_value.fill(f32::MAX);
    let mut max_pixel_value = PixelValue::new(channels, Datatype::Float32);
    max_pixel_value.fill(f32::MIN);

    for ch in 0..channels as u32 {
        *max_pixel_value.get_mut::<f32>(ch) = max[ch as usize] as f32;
        *min_pixel_value.get_mut::<f32>(ch) = min[ch as usize] as f32;
    }

    (min_pixel_value, max_pixel_value)
}

fn make_minmax_pixel_value_from_bytes<T>(
    channels: Channels,
    bytes: &[u8],
) -> (PixelValue, PixelValue)
where
    T: MinMax<T> + Copy + PartialOrd + bytemuck::Pod,
    f64: From<T>,
{
    match channels {
        Channels::One => {
            let data = bytemuck::cast_slice::<u8, T>(bytes);
            let (min, max) = minmax::<1, T, f64>(data);
            f32_pixel_value_from_minmax(channels, &min, &max)
        }
        Channels::Two => {
            let data = bytemuck::cast_slice::<u8, T>(bytes);
            let (min, max) = minmax::<2, T, f64>(data);
            f32_pixel_value_from_minmax(channels, &min, &max)
        }
        Channels::Three => {
            let data = bytemuck::cast_slice::<u8, T>(bytes);
            let (min, max) = minmax::<3, T, f64>(data);
            f32_pixel_value_from_minmax(channels, &min, &max)
        }
        Channels::Four => {
            let data = bytemuck::cast_slice::<u8, T>(bytes);
            let (min, max) = minmax::<4, T, f64>(data);
            f32_pixel_value_from_minmax(channels, &min, &max)
        }
    }
}

pub(crate) fn image_minmax_on_bytes(
    bytes: &[u8],
    datatype: Datatype,
    channels: Channels,
) -> (PixelValue, PixelValue) {

    let (min, max) = match datatype {
        Datatype::Uint8 => make_minmax_pixel_value_from_bytes::<u8>(channels, bytes),
        Datatype::Uint16 => make_minmax_pixel_value_from_bytes::<u16>(channels, bytes),
        Datatype::Uint32 => make_minmax_pixel_value_from_bytes::<u32>(channels, bytes),
        Datatype::Float32 => make_minmax_pixel_value_from_bytes::<f32>(channels, bytes),
        Datatype::Int8 => make_minmax_pixel_value_from_bytes::<i8>(channels, bytes),
        Datatype::Int16 => make_minmax_pixel_value_from_bytes::<i16>(channels, bytes),
        Datatype::Int32 => make_minmax_pixel_value_from_bytes::<i32>(channels, bytes),
        Datatype::Bool => make_minmax_pixel_value_from_bytes::<u8>(channels, bytes),
    };


    log::debug!("min: {}, max: {}", min, max);

    (min, max)
}
