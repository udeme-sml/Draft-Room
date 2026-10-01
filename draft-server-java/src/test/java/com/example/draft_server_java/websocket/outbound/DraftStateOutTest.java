package com.example.draft_server_java.websocket.outbound;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

import com.example.draft_server_java.domain.DraftState;

import tools.jackson.databind.ObjectMapper;

public class DraftStateOutTest {
    @Test
    void draftStateJsonMatchesWireShape() throws Exception {
        var json = new ObjectMapper().writeValueAsString(
            new DraftStateOut(new DraftState(List.of("Alice"), "Alice", List.of())));
        assertTrue(json.contains("\"type\":\"draftState\""));
        assertTrue(json.contains("\"turnOrder\""));
    }  
}
