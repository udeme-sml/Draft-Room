package com.example.draft_server_java.websocket.outbound;

import java.util.List;

public record UserListOut(String type, List<String> users) implements OutboundMessage {
    public UserListOut(List<String> users) {
        this("userList", users);
    }
}
