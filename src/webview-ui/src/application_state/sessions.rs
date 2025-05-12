use crate::common::SessionId;

#[derive(Debug, Default)]
pub(crate) struct Sessions {
    pub sessions: Vec<SessionId>,
    pub active_session: Option<SessionId>,
}
