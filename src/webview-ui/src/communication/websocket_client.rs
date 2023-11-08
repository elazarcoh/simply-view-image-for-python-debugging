use futures::{SinkExt, StreamExt};
use gloo_net::websocket::{futures::WebSocket, Message};

pub fn try_websocket() {
    log::info!("Trying WebSocket");
    let mut ws = WebSocket::open("ws://localhost:44455").unwrap();
    // let mut ws = WebSocket::open("wss://ws.ifelse.io").unwrap();
    let (mut write, mut read) = ws.split();

    yew::platform::spawn_local(async move {
        log::info!("WebSocket Opened");
        write
            .send(Message::Text(String::from("test")))
            .await
            .unwrap();
        write
            .send(Message::Text(String::from("test 2")))
            .await
            .unwrap();
    });

    yew::platform::spawn_local(async move {
        log::info!("WebSocket Reading");
        while let Some(msg) = read.next().await {
            log::info!("1. {:?}", msg)
        }
        log::info!("WebSocket Closed")
    })
}
