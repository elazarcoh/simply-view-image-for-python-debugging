use std::ops::Deref;

use web_sys::{WebGl2RenderingContext, WebGlBuffer};

use crate::webgl_utils::BindingPoint;

use super::{GLDrop, GLBuffer};

pub(crate) struct ReusableBuffer {
    gl: WebGl2RenderingContext,
    buf: WebGlBuffer,
    size: usize,
}

impl GLDrop for ReusableBuffer {
    fn drop(&self, gl: &WebGl2RenderingContext) {
        gl.delete_buffer(Some(&self.buf));
    }
}

impl Deref for ReusableBuffer {
    type Target = WebGlBuffer;

    fn deref(&self) -> &Self::Target {
        log::debug!("Derefing ReusableBuffer");
        &self.buf
    }
}

impl GLBuffer for ReusableBuffer {
    fn bind(&self, gl: &WebGl2RenderingContext, binding_point: BindingPoint) {
        gl.bind_buffer(binding_point as _, Some(&self.buf));
    }
}


impl ReusableBuffer {
    pub(crate) fn new(gl: WebGl2RenderingContext, size: usize) -> Result<Self, String> {

        let buf = gl.create_buffer().ok_or("Couldn't create buffer.")?;
        gl.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&buf));
        gl.buffer_data_with_i32(
            WebGl2RenderingContext::ARRAY_BUFFER,
            size as _,
            WebGl2RenderingContext::DYNAMIC_DRAW,
        );

        Ok(Self { buf, gl, size })
    }

    pub(crate) fn set_content(&mut self, content: &[u8], offset: usize) -> Result<(), String> {
        if content.len() > self.size {
            self.gl.delete_buffer(Some(&self.buf));

            self.buf = self.gl.create_buffer().ok_or("Couldn't create buffer.")?;

            log::debug!(
                "Reallocating buffer from {} to {}",
                self.size,
                content.len()
            );
            self.size = content.len();

            self.gl
                .bind_buffer(BindingPoint::ArrayBuffer as _, Some(&self.buf));

            self.gl.buffer_data_with_i32(
                BindingPoint::ArrayBuffer as _,
                self.size as _,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        } else if content.len() + offset > self.size {
            log::debug!(
                "Resizing buffer from {} to {}",
                self.size,
                content.len() + offset
            );

            self.gl.bind_buffer(BindingPoint::CopyReadBuffer as _, Some(&self.buf));

            let new_size = self.size + (content.len() + offset - self.size);
            // create a new buffer and copy the old one into it
            let new_buf = self.gl.create_buffer().ok_or("Couldn't create buffer.")?;
            self.gl
                .bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&new_buf));
            self.gl.buffer_data_with_i32(
                WebGl2RenderingContext::ARRAY_BUFFER,
                new_size as _,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );

            self.gl.copy_buffer_sub_data_with_i32_and_i32_and_i32(
                BindingPoint::CopyReadBuffer as _,
                BindingPoint::ArrayBuffer as _,
                0,
                0,
                self.size as _,
            );
        }
        else {
            self.gl
                .bind_buffer(BindingPoint::ArrayBuffer as _, Some(&self.buf));
        }

        self.gl.buffer_sub_data_with_i32_and_u8_array(
            BindingPoint::ArrayBuffer as _,
            offset as _,
            content,
        );

        Ok(())
    }
}
