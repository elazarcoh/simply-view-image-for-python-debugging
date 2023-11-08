#[derive(tsify::Tsify, serde::Serialize, serde::Deserialize, Debug, Clone)]
pub(crate) struct MessageId(String);

impl MessageId {
    pub(crate) fn generate() -> Self {
        let uuid = uuid::Uuid::new_v4();
        Self(uuid.to_string())
    }
}
