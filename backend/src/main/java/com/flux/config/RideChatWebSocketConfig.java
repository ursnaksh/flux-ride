package com.flux.config;

import com.flux.chat.ChatHandshakeInterceptor;
import com.flux.chat.RideChatWebSocketHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class RideChatWebSocketConfig implements WebSocketConfigurer {

    private final RideChatWebSocketHandler chatHandler;
    private final ChatHandshakeInterceptor handshakeInterceptor;

    @Value("${CORS_ALLOWED_ORIGINS:http://localhost:5173,http://localhost:3000}")
    private String[] allowedOrigins;

    public RideChatWebSocketConfig(
            RideChatWebSocketHandler chatHandler,
            ChatHandshakeInterceptor handshakeInterceptor) {
        this.chatHandler = chatHandler;
        this.handshakeInterceptor = handshakeInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(chatHandler, "/ws/chat")
                .addInterceptors(handshakeInterceptor)
                .setAllowedOrigins(allowedOrigins);
    }
}
