package com.example.draft_server_java.websocket.outbound;

public record ServerRequestOut(String type, String request) implements OutboundMessage {
    public ServerRequestOut(String request) {
        this("serverRequest", request);
    }
}