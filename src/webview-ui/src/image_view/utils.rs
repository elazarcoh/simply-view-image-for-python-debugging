use crate::communication::incoming_messages::{Channels, Datatype};

use super::types::PixelValue;

pub fn image_minmax_on_bytes(
    bytes: &[u8],
    datatype: Datatype,
    channels: Channels,
) -> (PixelValue, PixelValue) {
    let mut min = PixelValue::new(channels, Datatype::Float32);
    min.fill(f32::MAX);
    let mut max = PixelValue::new(channels, Datatype::Float32);
    max.fill(f32::MIN);

    let num_channels = channels as usize;
    let bytes_per_element = datatype.num_bytes();
    #[rustfmt::skip]
    bytes
        .chunks_exact(num_channels * bytes_per_element)
        .for_each(|pixel_bytes| {
            for (channel, bytes) in pixel_bytes.chunks_exact(bytes_per_element).enumerate() {
                let value: f32 = match datatype {
                    Datatype::Uint8 => u8::from_ne_bytes([bytes[0]]) as f32,
                    Datatype::Uint16 => u16::from_ne_bytes([bytes[0], bytes[1]]) as f32,
                    Datatype::Uint32 => u32::from_ne_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f32,
                    Datatype::Float32 => f32::from_ne_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]),
                    Datatype::Int8 => i8::from_ne_bytes([bytes[0]]) as f32,
                    Datatype::Int16 => i16::from_ne_bytes([bytes[0], bytes[1]]) as f32,
                    Datatype::Int32 => i32::from_ne_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as f32,
                    Datatype::Bool => bytes[0] as f32,
                };
                let current_min = min.get_mut::<f32>(channel as _);
                let current_max = max.get_mut::<f32>(channel as _);
                if f32::is_finite(value) {
                    if value < *current_min {
                        *current_min = value;
                    }
                    if value > *current_max {
                        *current_max = value;
                    }
                }
            }
        });

    log::debug!("min: {}, max: {}", min, max);

    (min, max)
}
