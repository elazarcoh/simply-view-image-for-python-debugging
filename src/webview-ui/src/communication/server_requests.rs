use std::{rc::Rc, ops::Deref};
use yew::prelude::*;

use super::common::MessageId;

pub(crate) trait ServerRequests {
    fn requests_images(&self) -> MessageId;
}

#[derive(Clone)]
pub(crate) struct ServerRequestsContext {
    value: Rc<dyn ServerRequests>,
}

impl PartialEq for ServerRequestsContext {
    fn eq(&self, other: &Self) -> bool {
        Rc::ptr_eq(&self.value, &other.value)
    }
}

impl Deref for ServerRequestsContext {
    type Target = Rc<dyn ServerRequests>;

    fn deref(&self) -> &Self::Target {
        &self.value
    }
}

#[derive(Properties)]
pub(crate) struct ServerRequestsProviderProps {
    pub server_requests: Rc<dyn ServerRequests>,
    #[prop_or_default]
    pub children: Html,
}

impl PartialEq for ServerRequestsProviderProps {
    fn eq(&self, other: &Self) -> bool {
        Rc::ptr_eq(&self.server_requests, &other.server_requests) && self.children == other.children
    }
}

#[function_component]
pub(crate) fn ServerRequestsProvider(props: &ServerRequestsProviderProps) -> Html {
    let ServerRequestsProviderProps {
        server_requests,
        children,
    } = props;

    let ctx = ServerRequestsContext {
        value: server_requests.clone(),
    };

    html! {
        <ContextProvider<ServerRequestsContext> context={ctx}>
            {children.clone()}
        </ContextProvider<ServerRequestsContext>>
    }
}
