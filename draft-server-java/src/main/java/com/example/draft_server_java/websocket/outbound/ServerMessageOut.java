package com.example.draft_server_java.websocket.outbound;

public record ServerMessageOut(String type, String message) implements OutboundMessage {
    public ServerMessageOut(String message) {
        this("serverMessage", message);
    }
}
