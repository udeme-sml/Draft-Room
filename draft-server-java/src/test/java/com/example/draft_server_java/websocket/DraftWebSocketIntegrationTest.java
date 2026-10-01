package com.example.draft_server_java.websocket;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.annotation.DirtiesContext.ClassMode;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@DirtiesContext(classMode = ClassMode.AFTER_EACH_TEST_METHOD)
class DraftWebSocketIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private ObjectMapper objectMapper;

    private final java.util.ArrayList<DraftTestClient> clients = new java.util.ArrayList<>();

    @AfterEach
    void closeClients() throws Exception {
        for (DraftTestClient client : clients) {
            client.close();
        }
        clients.clear();
    }

    @Test
    void connectJoinStartReceivesDraftState() throws Exception {
        DraftTestClient alice = connectAndJoin("Alice");
        connectAndJoin("Bob");

        alice.send("/start");

        JsonNode draftState = alice.awaitJson(
            node -> node.path("type").asText().equals("draftState"),
            10
        );
        Assertions.assertEquals("Alice", draftState.path("onClock").asText());
        Assertions.assertEquals(2, draftState.path("turnOrder").size());
    }

    @Test
    void validPickUpdatesOnClockInDraftState() throws Exception {
        DraftTestClient alice = connectAndJoin("Alice");
        connectAndJoin("Bob");

        alice.send("/start");
        alice.awaitJson(node -> node.path("type").asText().equals("draftState"), 10);

        alice.send("/pick lebron james");

        JsonNode afterPick = alice.awaitJson(
            node -> node.path("type").asText().equals("draftState")
                && node.path("onClock").asText().equals("Bob"),
            10
        );
        Assertions.assertEquals("Bob", afterPick.path("onClock").asText());
        Assertions.assertEquals(1, afterPick.path("picks").size());
    }

    private DraftTestClient connectAndJoin(String name) throws Exception {
        DraftTestClient client = new DraftTestClient(port, objectMapper);
        clients.add(client);
        client.connect();
        client.awaitJson(node -> node.path("type").asText().equals("serverMessage")
            && node.path("message").asText().equals("Connected"), 5);
        client.awaitJson(node -> node.path("type").asText().equals("serverRequest"), 5);
        client.send(name);
        client.awaitJson(node -> node.path("type").asText().equals("userList"), 5);
        return client;
    }

    private static final class DraftTestClient extends TextWebSocketHandler {

        private final int port;
        private final ObjectMapper objectMapper;
        private final BlockingQueue<String> frames = new LinkedBlockingQueue<>();
        private WebSocketSession session;

        DraftTestClient(int port, ObjectMapper objectMapper) {
            this.port = port;
            this.objectMapper = objectMapper;
        }

        void connect() throws Exception {
            String uri = "ws://localhost:" + port + "/";
            session = new StandardWebSocketClient()
                .execute(this, uri)
                .get(10, TimeUnit.SECONDS);
        }

        void send(String text) throws Exception {
            session.sendMessage(new TextMessage(text));
        }

        void close() throws Exception {
            if (session != null && session.isOpen()) {
                session.close();
            }
        }

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) {
            frames.offer(message.getPayload());
        }

        JsonNode awaitJson(Predicate<JsonNode> match, int timeoutSeconds) throws Exception {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(timeoutSeconds);
            while (System.nanoTime() < deadline) {
                long nanosLeft = deadline - System.nanoTime();
                if (nanosLeft <= 0) {
                    break;
                }
                String payload = frames.poll(
                    Math.max(1, TimeUnit.NANOSECONDS.toMillis(nanosLeft)),
                    TimeUnit.MILLISECONDS
                );
                if (payload == null) {
                    continue;
                }
                JsonNode node = objectMapper.readTree(payload);
                if (match.test(node)) {
                    return node;
                }
            }
            Assertions.fail("Timed out waiting for matching WebSocket JSON frame");
            return null;
        }
    }
}
