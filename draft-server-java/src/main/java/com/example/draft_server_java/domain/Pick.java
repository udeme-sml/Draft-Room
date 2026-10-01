package com.example.draft_server_java.domain;

public record Pick(String player, String by) {
    public String getPlayer() {
        return player;
    }
    public String getBy() {
        return by;
    }
}
