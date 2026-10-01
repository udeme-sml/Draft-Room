package com.example.draft_server_java.websocket.outbound;

public record ErrorOut(String type, String message) implements OutboundMessage {
    public ErrorOut(String message) {
        this("error", message);
    }
}
