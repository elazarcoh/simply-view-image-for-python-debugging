#[derive(serde::Serialize)]
pub struct RequestImageMessage {}

#[derive(serde::Serialize)]
pub enum OutgoingMessage {
    RequestImageMessage(RequestImageMessage),
}
