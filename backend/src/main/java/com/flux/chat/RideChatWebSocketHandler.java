package com.flux.chat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flux.model.GroupMessage;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RideChatWebSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper;
    private final Map<Long, Set<WebSocketSession>> sessionsByGroup =
            new ConcurrentHashMap<>();

    public RideChatWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long groupId = groupId(session);
        if (groupId == null) return;

        sessionsByGroup
                .computeIfAbsent(groupId, ignored -> ConcurrentHashMap.newKeySet())
                .add(session);

        broadcastPresence(groupId);
    }

    @Override
    protected void handleTextMessage(
            WebSocketSession session,
            TextMessage message) throws Exception {

        Long groupId = groupId(session);
        Long userId = userId(session);
        String userName = userName(session);

        if (groupId == null || userId == null) return;

        JsonNode payload = objectMapper.readTree(message.getPayload());
        String type = payload.path("type").asText("");

        if ("typing".equals(type)) {
            Map<String, Object> event = new LinkedHashMap<>();
            event.put("type", "typing");
            event.put("groupId", groupId);
            event.put("userId", userId);
            event.put("userName", userName);
            event.put("typing", payload.path("typing").asBoolean(false));
            broadcast(groupId, event, session);
        }
    }

    @Override
    public void afterConnectionClosed(
            WebSocketSession session,
            CloseStatus status) {

        removeSession(session);
    }

    @Override
    public void handleTransportError(
            WebSocketSession session,
            Throwable exception) {

        removeSession(session);
        try {
            if (session.isOpen()) {
                session.close(CloseStatus.SERVER_ERROR);
            }
        } catch (IOException ignored) {
        }
    }

    public void broadcastMessage(GroupMessage message) {
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", "message");
        event.put("message", message);
        broadcast(message.getSharedTripId(), event, null);
    }

    private void broadcastPresence(Long groupId) {
        Set<WebSocketSession> groupSessions = sessionsByGroup.get(groupId);
        if (groupSessions == null) return;

        Map<Long, String> uniqueUsers = new LinkedHashMap<>();
        groupSessions.stream()
                .filter(WebSocketSession::isOpen)
                .sorted(Comparator.comparing(session -> String.valueOf(session.getId())))
                .forEach(session -> {
                    Long id = userId(session);
                    String name = userName(session);
                    if (id != null) uniqueUsers.putIfAbsent(id, name);
                });

        List<Map<String, Object>> users = new ArrayList<>();
        uniqueUsers.forEach((id, name) -> {
            Map<String, Object> user = new LinkedHashMap<>();
            user.put("userId", id);
            user.put("userName", name);
            users.add(user);
        });

        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", "presence");
        event.put("groupId", groupId);
        event.put("users", users);
        broadcast(groupId, event, null);
    }

    private void removeSession(WebSocketSession session) {
        Long groupId = groupId(session);
        if (groupId == null) return;

        Set<WebSocketSession> sessions = sessionsByGroup.get(groupId);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) {
                sessionsByGroup.remove(groupId);
            }
        }

        broadcastPresence(groupId);
    }

    private void broadcast(
            Long groupId,
            Object payload,
            WebSocketSession exclude) {

        Set<WebSocketSession> sessions = sessionsByGroup.get(groupId);
        if (sessions == null || sessions.isEmpty()) return;

        final String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (Exception ex) {
            return;
        }

        TextMessage textMessage = new TextMessage(json);

        for (WebSocketSession session : sessions) {
            if (session == exclude || !session.isOpen()) continue;

            try {
                synchronized (session) {
                    session.sendMessage(textMessage);
                }
            } catch (IOException ignored) {
            }
        }
    }

    private Long groupId(WebSocketSession session) {
        return (Long) session.getAttributes().get("groupId");
    }

    private Long userId(WebSocketSession session) {
        return (Long) session.getAttributes().get("userId");
    }

    private String userName(WebSocketSession session) {
        Object value = session.getAttributes().get("userName");
        return value == null ? "Passenger" : String.valueOf(value);
    }
}
