package com.example.draft_server_java.domain;

import java.util.ArrayList;
import java.util.List;

public class DraftRoom {
    private final List<String> turnOrder = new ArrayList<>();
    private int turn = 0;
    private boolean draftStarted = false;
    private final List<Pick> picks = new ArrayList<>();
    private final PlayerPool playerPool;

    public DraftRoom(PlayerPool playerPool) {
        this.playerPool = playerPool;
    }

    public synchronized void join(String playerName) {
        String trimmedName = playerName.trim();
        if (trimmedName.isEmpty()) {
            throw new IllegalArgumentException("Name cannot be empty");
        }
        if (trimmedName.length() > 16) {
            throw new IllegalArgumentException("Name cannot be longer than 16 characters");
        }
        if (trimmedName.contains("/") || trimmedName.contains("\\") || trimmedName.contains("|") || trimmedName.contains("?") ||
            trimmedName.contains("*") || trimmedName.contains("\"") || trimmedName.contains("<") || trimmedName.contains(">") ||
            trimmedName.contains(":")) {
            throw new IllegalArgumentException("Name cannot contain invalid characters");
        }
        if (turnOrder.contains(trimmedName.replaceAll(" ", "_"))) {
            throw new IllegalArgumentException("Name already taken");
        }
        if (draftStarted) {
            throw new IllegalStateException("Draft already started, wait for it to end");
        }
        turnOrder.add(trimmedName.replaceAll(" ", "_"));
    }

    public synchronized void startDraft() {
        if (draftStarted) {
            throw new IllegalStateException("Draft already started");
        }
        if (turnOrder.size() < 2) {
            throw new IllegalStateException("Not enough players to start draft");
        }
        draftStarted = true;
    }

    public synchronized void pick(String picker, String pickedPlayer) {
        String trimmedPickedPlayer = pickedPlayer.trim().toLowerCase();
        if (!draftStarted) {
            throw new IllegalStateException("Draft not started yet");
        }
        if (!turnOrder.get(turn).equals(picker)) {
            throw new IllegalStateException("It is " + turnOrder.get(turn) + "'s turn to pick");
        }
        if (trimmedPickedPlayer.isEmpty()) {
            throw new IllegalArgumentException("Player name cannot be empty");
        }
        if (!playerPool.contains(trimmedPickedPlayer)) {
            throw new IllegalArgumentException("Player does not exist");
        }
        if (playerPool.get(trimmedPickedPlayer) != null) {
            throw new IllegalArgumentException("Player already picked by " + playerPool.get(trimmedPickedPlayer));
        }
        playerPool.set(trimmedPickedPlayer, picker);
        picks.add(new Pick(trimmedPickedPlayer, picker));
        if (turn >= turnOrder.size() - 1) {
            turn = 0;
        } else {
            turn++;
        }
    }

    public synchronized DraftState getDraftState() {
        String onClock = draftStarted ? turnOrder.get(turn) : null;
        return new DraftState(
            List.copyOf(turnOrder),
            onClock,
            List.copyOf(picks)
        );
    }
}
