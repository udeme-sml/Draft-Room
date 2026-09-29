package com.example.draft_server_java.domain;

public record Pick(String player, String by) {
    public Pick(String player, String by) {
        this.player = player;
        this.by = by;
    }
}
