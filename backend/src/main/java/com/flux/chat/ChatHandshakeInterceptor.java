package com.flux.chat;

import com.flux.model.SharedTrip;
import com.flux.model.SharedTripMember;
import com.flux.service.JwtService;
import com.flux.service.SharedTripService;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;

@Component
public class ChatHandshakeInterceptor implements HandshakeInterceptor {

    private final SharedTripService sharedTripService;
    private final JwtService jwtService;

    public ChatHandshakeInterceptor(
            SharedTripService sharedTripService,
            JwtService jwtService) {
        this.sharedTripService = sharedTripService;
        this.jwtService = jwtService;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes) {

        Map<String, String> params = UriComponentsBuilder
                .fromUri(request.getURI())
                .build()
                .getQueryParams()
                .toSingleValueMap();

        Long groupId = parseLong(params.get("groupId"));
        String token = params.get("token");

        if (groupId == null || token == null || token.isBlank()) {
            return false;
        }

        JwtService.AuthenticatedIdentity identity;
        try {
            identity = jwtService.verify(token);
        } catch (Exception ex) {
            return false;
        }

        SharedTrip trip;
        try {
            trip = sharedTripService.getById(groupId);
        } catch (RuntimeException ex) {
            return false;
        }

        SharedTripMember member = trip.getMembers()
                .stream()
                .filter(item ->
                        item.getUserId().equals(identity.userId())
                )
                .findFirst()
                .orElse(null);

        if (member == null) {
            return false;
        }

        attributes.put("groupId", groupId);
        attributes.put("userId", identity.userId());
        attributes.put("userName", member.getUserName());
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception) {
    }

    private Long parseLong(String value) {
        try {
            return value == null ? null : Long.valueOf(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
