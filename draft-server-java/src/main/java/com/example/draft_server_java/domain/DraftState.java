package com.example.draft_server_java.domain;

import java.util.List;

public record DraftState(List<String> turnOrder, String onClock, List<Pick> picks) {}
