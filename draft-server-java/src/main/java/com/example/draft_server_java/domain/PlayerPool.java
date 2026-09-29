package com.example.draft_server_java.domain;

import java.util.HashMap;
import java.util.Map;

public class PlayerPool {
    private final Map<String, String> players = new HashMap<>();

    public boolean contains(String playerName) {
        return players.containsKey(playerName.toLowerCase());
    }

    public String get(String playerName) {
        return players.get(playerName.toLowerCase());
    }

    public void set(String playerName, String picker) {
        players.put(playerName.toLowerCase(), picker);
    }

    public PlayerPool() {
        players.put("lebron james", null);
        players.put("stephen curry", null);
        players.put("kevin durant", null);
        players.put("luka doncic", null);
        players.put("victor wembanyama", null);
        players.put("nikola jokic", null);
        players.put("shai gilgeous-alexander", null);
        players.put("joel embiid", null);
        players.put("james harden", null);
        players.put("kyrie irving", null);
        players.put("paul george", null);
        players.put("kawhi leonard", null);
        players.put("anthony davis", null);
        players.put("russell westbrook", null);
        players.put("lamelo ball", null);
        players.put("jayson tatum", null);
        players.put("jaylen brown", null);
        players.put("giannis antetokounmpo", null);
        players.put("damian lillard", null);
        players.put("jamal murray", null);
        players.put("deni avdija", null);
        players.put("donovan mitchell", null);
    }
}
