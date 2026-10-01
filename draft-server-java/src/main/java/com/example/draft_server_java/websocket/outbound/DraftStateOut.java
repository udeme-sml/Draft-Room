package com.example.draft_server_java.websocket.outbound;
import com.example.draft_server_java.domain.DraftState;
import com.example.draft_server_java.domain.Pick;
import java.util.List;

public record DraftStateOut(
    String type,
    List<String> turnOrder,
    String onClock,
    List<Pick> picks
) implements OutboundMessage {

    public DraftStateOut(DraftState draftState) {
        this(
            "draftState",
            draftState.turnOrder(), 
            draftState.onClock(), 
            draftState.picks()
        );
    }
    
}
