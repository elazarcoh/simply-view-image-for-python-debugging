
pub(crate) fn projection(
    width: f32,
    height: f32,
) -> glam::Mat3 {
    glam::Mat3::from_cols_array_2d(&[
        [2.0 / width, 0.0, 0.0],
        [0.0, -2.0 / height, 0.0],
        [-1.0, 1.0, 1.0],
    ])
}