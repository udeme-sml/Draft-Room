package com.example.draft_server_java.websocket.outbound;

public sealed interface OutboundMessage permits
        ServerMessageOut,
        ServerRequestOut,
        ErrorOut,
        DraftStateOut,
        UserJoinedOut,
        UserListOut {
}
