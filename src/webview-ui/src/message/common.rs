use serde::{Deserialize, Serialize};
use tsify::{declare, Tsify};

use wasm_bindgen::prelude::*;

#[declare]
type Base64 = String;

#[declare]
type Identifier = String;
