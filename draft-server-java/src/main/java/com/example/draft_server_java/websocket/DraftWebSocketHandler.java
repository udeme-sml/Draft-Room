package com.example.draft_server_java.websocket;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import com.example.draft_server_java.websocket.outbound.UserJoinedOut;
import com.example.draft_server_java.websocket.outbound.UserListOut;

import tools.jackson.databind.ObjectMapper;

@Component
public class DraftWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(DraftWebSocketHandler.class);
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
        log.info("connection established: {}", session.getId());
        try {
            send(session, new ServerMessageOut("Connected"));
            send(session, new ServerRequestOut("Name: "));
        } catch (IOException e) {
            sessions.remove(session);
            log.warn("failed to greet session {}", session.getId(), e);
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws IOException {
        String payload = message.getPayload();
        log.info("received: {}", payload);
        String name = sessionName(session);
        if (name == null) {
            handleNameMessage(session, payload);
            return;
        }
        handleCommandMessage(session, name, payload);
    }

    private void handleNameMessage(WebSocketSession session, String raw) throws IOException {
        try {
            room.join(raw);
            String name = normalizeName(raw);
            session.getAttributes().put(ATTR_NAME, name);
            notifyUserJoined(session, name);
            send(session, new UserListOut(getConnectedNames()));
            log.info("{} joined (session {})", name, session.getId());
        } catch (IllegalArgumentException | IllegalStateException e) {
            send(session, new ErrorOut(e.getMessage()));
        }
    }

    private void notifyUserJoined(WebSocketSession joiner, String joinedName) throws IOException {
        for (WebSocketSession other : sessions) {
            if (other.isOpen() && other != joiner && sessionName(other) != null) {
                send(other, new UserJoinedOut(joinedName));
            }
        }
    }

    private List<String> getConnectedNames() {
        List<String> names = new ArrayList<>();
        for (WebSocketSession s : sessions) {
            String n = sessionName(s);
            if (s.isOpen() && n != null) {
                names.add(n);
            }
        }
        return names;
    }

    private void handleCommandMessage(WebSocketSession session, String name, String payload) throws IOException {
        String trimmed = payload.trim();
        if (trimmed.startsWith("/start")) {
            handleStart(session);
        } else if (trimmed.startsWith("/pick")) {
            handlePick(session, name, trimmed);
        } else if (trimmed.equals("/users")) {
            send(session, new UserListOut(getConnectedNames()));
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
            log.info("draft started, first on clock: {}", first);
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
            log.info("{} picked {}, next: {}", pickerName, playerKey, next);
        } catch (IllegalArgumentException | IllegalStateException e) {
            send(session, new ErrorOut(e.getMessage()));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        sessions.remove(session);
        log.info("connection closed: {} ({})", session.getId(), sessionName(session));
    }

    public Set<WebSocketSession> getSessions() {
        return sessions;
    }
}
