use std::{env, fs, io::Write, path::PathBuf};

fn base_output() -> PathBuf {
    PathBuf::from(env::var("OUT_DIR").unwrap()).join("shaders")
}

fn is_debug() -> bool {
    match env::var("PROFILE") {
        Ok(profile) => profile == "debug",
        _ => false,
    }
}

fn create_shader_file(content: &str, filename: &str) {
    let base_output = base_output();

    let file_path = base_output.join(filename);
    let mut file = fs::File::create(file_path).expect("Unable to create file");
    file.write_all(content.as_bytes())
        .expect("Unable to write to file");

    // Also write to project_root/debug_shaders in debug mode
    if is_debug() {
        let root_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
        let debug_dir = root_dir.join("debug_shaders");
        fs::create_dir_all(&debug_dir).unwrap();

        let debug_file = debug_dir.join(filename);
        fs::write(&debug_file, content).unwrap();
    }
}

fn main() {
    let base_output = base_output();
    println!("cargo:rustc-env=SHADERS_DIR={}", base_output.display());
    fs::create_dir_all(&base_output).expect("Unable to create directory");

    #[rustfmt::skip]
    create_shader_file(shaders::UINT_FRAGMENT_SHADER, "uint-image.frag");
    #[rustfmt::skip]
    create_shader_file(shaders::INT_FRAGMENT_SHADER, "int-image.frag");
    #[rustfmt::skip]
    create_shader_file(shaders::NORMALIZED_FRAGMENT_SHADER, "normalized-image.frag");
    #[rustfmt::skip]
    create_shader_file(shaders::UINT_PLANAR_FRAGMENT_SHADER, "uint-planar-image.frag");
    #[rustfmt::skip]
    create_shader_file(shaders::INT_PLANAR_FRAGMENT_SHADER, "int-planar-image.frag");
    #[rustfmt::skip]
    create_shader_file(shaders::NORMALIZED_PLANAR_FRAGMENT_SHADER, "normalized-planar-image.frag");

    println!("cargo:rerun-if-changed=build.rs");
}
