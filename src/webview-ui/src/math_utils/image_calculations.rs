use glam::{Vec3, Mat3, Vec2};

use crate::{common::Size, image_view::constants::VIEW_SIZE};

use super::ToHom;

#[derive(Debug)]
pub struct PixelsInformation {
    pub lower_x_px: i32,
    pub lower_y_px: i32,
    pub upper_x_px: i32,
    pub upper_y_px: i32,

    pub image_pixel_size_device: i32, // assume square pixels
}

pub fn calculate_pixels_information(
    image_size: &Size,
    view_projection: &Mat3,
    rendered_area_size: &Size,
) -> PixelsInformation {
    let tl_ndc: Vec3 = Vec2::new(-1.0, 1.0).to_hom();
    let br_ndc: Vec3 = Vec2::new(1.0, -1.0).to_hom();

    let image_pixels_to_view = Mat3::from_scale(Vec2::new(
        VIEW_SIZE.width / image_size.width,
        VIEW_SIZE.height / image_size.height,
    ));
    let view_projection_inv = (*view_projection * image_pixels_to_view).inverse();

    let tl_world = view_projection_inv * tl_ndc;
    let br_world = view_projection_inv * br_ndc;

    let tlx = f32::min(tl_world.x, br_world.x);
    let tly = f32::min(tl_world.y, br_world.y);
    let brx = f32::max(tl_world.x, br_world.x);
    let bry = f32::max(tl_world.y, br_world.y);

    let tl = Vec2::new(tlx, tly);
    let br = Vec2::new(brx, bry);

    let lower_x_px = i32::max(0, (f32::floor(tl.x) as i32) - 1);
    let lower_y_px = i32::max(0, (f32::floor(tl.y) as i32) - 1);
    let upper_x_px = i32::min(image_size.width as i32, (f32::ceil(br.x) as i32) + 1);
    let upper_y_px = i32::min(image_size.height as i32, (f32::ceil(br.y) as i32) + 1);

    let pixel_size_device = (rendered_area_size.width / (brx - tlx)) as i32;

    PixelsInformation {
        lower_x_px,
        lower_y_px,
        upper_x_px,
        upper_y_px,
        image_pixel_size_device: pixel_size_device,
    }
}
