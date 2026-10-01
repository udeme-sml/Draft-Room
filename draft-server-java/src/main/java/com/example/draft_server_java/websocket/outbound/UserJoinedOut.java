package com.example.draft_server_java.websocket.outbound;

public record UserJoinedOut(String type, String name) implements OutboundMessage {
    public UserJoinedOut(String name) {
        this("userJoined", name);
    }
}
