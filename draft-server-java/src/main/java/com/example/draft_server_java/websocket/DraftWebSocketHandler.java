package com.example.draft_server_java.websocket;

import java.io.IOException;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.example.draft_server_java.domain.DraftRoom;
import com.example.draft_server_java.domain.DraftState;
import com.example.draft_server_java.domain.PlayerPool;
import com.example.draft_server_java.websocket.outbound.DraftStateOut;
import com.example.draft_server_java.websocket.outbound.ErrorOut;
import com.example.draft_server_java.websocket.outbound.OutboundMessage;
import com.example.draft_server_java.websocket.outbound.ServerMessageOut;
import com.example.draft_server_java.websocket.outbound.ServerRequestOut;

import tools.jackson.databind.ObjectMapper;

@Component
public class DraftWebSocketHandler extends TextWebSocketHandler {

    private static final String ATTR_NAME = "name";

    private final ObjectMapper objectMapper;
    private final DraftRoom room = new DraftRoom(new PlayerPool());
    private final Set<WebSocketSession> sessions = ConcurrentHashMap.newKeySet();

    public DraftWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    private void send(WebSocketSession session, OutboundMessage message) throws IOException {
        String json = objectMapper.writeValueAsString(message);
        session.sendMessage(new TextMessage(json));
    }

    private void broadcast(OutboundMessage message) throws IOException {
        String json = objectMapper.writeValueAsString(message);
        TextMessage frame = new TextMessage(json);
        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                session.sendMessage(frame);
            }
        }
    }

    private String sessionName(WebSocketSession session) {
        return (String) session.getAttributes().get(ATTR_NAME);
    }

    private static String normalizeName(String raw) {
        return raw.trim().replace(" ", "_");
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        sessions.add(session);
        try {
            send(session, new ServerMessageOut("Connected"));
            send(session, new ServerRequestOut("Name: "));
        } catch (IOException e) {
            sessions.remove(session);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        String name = sessionName(session);
        if (name == null) {
            handleNameMessage(session, message.getPayload());
            return;
        }
        handleCommandMessage(session, name, message.getPayload());
    }

    private void handleNameMessage(WebSocketSession session, String raw) throws IOException {
        try {
            room.join(raw);
            session.getAttributes().put(ATTR_NAME, normalizeName(raw));
        } catch (IllegalArgumentException | IllegalStateException e) {
            send(session, new ErrorOut(e.getMessage()));
        }
    }

    private void handleCommandMessage(WebSocketSession session, String name, String payload) throws IOException {
        String trimmed = payload.trim();
        if (trimmed.startsWith("/start")) {
            handleStart(session);
        } else if (trimmed.startsWith("/pick")) {
            handlePick(session, name, trimmed);
        }
    }

    private void handleStart(WebSocketSession session) throws IOException {
        try {
            room.startDraft();
            DraftState state = room.getDraftState();
            String first = state.onClock();
            broadcast(new ServerMessageOut("Draft started"));
            broadcast(new ServerMessageOut(first + " is picking first..."));
            broadcast(new DraftStateOut(state));
        } catch (IllegalStateException e) {
            send(session, new ErrorOut(e.getMessage()));
        }
    }

    private void handlePick(WebSocketSession session, String pickerName, String trimmed) throws IOException {
        String playerPart = null;
        int space = trimmed.indexOf(' ');
        if (space >= 0) {
            playerPart = trimmed.substring(space + 1);
        }
        try {
            if (playerPart == null || playerPart.trim().isEmpty()) {
                throw new IllegalArgumentException("Player name cannot be empty");
            }
            room.pick(pickerName, playerPart);
            DraftState state = room.getDraftState();
            String playerKey = playerPart.trim().toLowerCase();
            String next = state.onClock();
            broadcast(new ServerMessageOut(pickerName + " picked " + playerKey));
            broadcast(new DraftStateOut(state));
            broadcast(new ServerMessageOut(next + " is picking next..."));
        } catch (IllegalArgumentException | IllegalStateException e) {
            send(session, new ErrorOut(e.getMessage()));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
    }

    public Set<WebSocketSession> getSessions() {
        return sessions;
    }
}
