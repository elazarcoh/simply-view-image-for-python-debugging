use web_sys::{WebGl2RenderingContext, WebGlBuffer};

use super::GLDrop;

pub struct ReusableBuffer {
    gl: WebGl2RenderingContext,
    buf: WebGlBuffer,
    size: usize,
}

impl GLDrop for ReusableBuffer {
    fn drop(&self, gl: &WebGl2RenderingContext) {
        gl.delete_buffer(Some(&self.buf));
    }
}

impl ReusableBuffer {
    pub fn new(gl: WebGl2RenderingContext, size: usize) -> Result<Self, String> {

        let buf = gl.create_buffer().ok_or("Couldn't create buffer.")?;
        gl.bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&buf));
        gl.buffer_data_with_i32(
            WebGl2RenderingContext::ARRAY_BUFFER,
            size as _,
            WebGl2RenderingContext::DYNAMIC_DRAW,
        );

        Ok(Self { buf, gl, size })
    }

    pub fn bind(&self) {
        self.gl
            .bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&self.buf));
    }

    pub fn set_content(&mut self, content: &[u8]) -> Result<(), String> {
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
                .bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&self.buf));

            self.gl.buffer_data_with_i32(
                WebGl2RenderingContext::ARRAY_BUFFER,
                self.size as _,
                WebGl2RenderingContext::DYNAMIC_DRAW,
            );
        } else {
            self.gl
                .bind_buffer(WebGl2RenderingContext::ARRAY_BUFFER, Some(&self.buf));
        }

        self.gl.buffer_sub_data_with_i32_and_u8_array(
            WebGl2RenderingContext::ARRAY_BUFFER,
            0,
            content,
        );

        Ok(())
    }
}
