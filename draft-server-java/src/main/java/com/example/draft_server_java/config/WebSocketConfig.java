package com.example.draft_server_java.config;

import com.example.draft_server_java.websocket.DraftWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    private final DraftWebSocketHandler draftWebSocketHandler;

    public WebSocketConfig(DraftWebSocketHandler draftWebSocketHandler) {
        this.draftWebSocketHandler = draftWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(draftWebSocketHandler, "/").setAllowedOriginPatterns("*");
    }
}
