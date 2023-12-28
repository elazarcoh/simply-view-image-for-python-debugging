use glam::Mat4;

#[rustfmt::skip]
pub(crate) const fn transpose(mat: &Mat4) -> Mat4 {
    let as_array: [f32; 16] = mat.to_cols_array();
    Mat4::from_cols_array(&[
        as_array[0], as_array[4], as_array[8], as_array[12],
        as_array[1], as_array[5], as_array[9], as_array[13],
        as_array[2], as_array[6], as_array[10], as_array[14],
        as_array[3], as_array[7], as_array[11], as_array[15],
    ])
}
