use glam::{Vec3, Vec2, Vec4};

pub(crate) mod mat3;
pub(crate) mod mat4;
pub(crate) mod image_calculations;

pub(crate) trait ToHom<Target> {
    fn to_hom(&self) -> Target;
}

impl ToHom<Vec3> for Vec2 {
    fn to_hom(&self) -> Vec3 {
        [self.x, self.y, 1.0].into()
    }
}

impl ToHom<Vec4> for Vec3 {
    fn to_hom(&self) -> Vec4 {
        [self.x, self.y, self.z, 1.0].into()
    }
}
