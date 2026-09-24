package com.flux.controller;

import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.flux.chat.RideChatWebSocketHandler;
import com.flux.dto.ApiResponse;
import com.flux.dto.GroupMessageRequest;
import com.flux.model.GroupMessage;
import com.flux.model.SharedTrip;
import com.flux.model.User;
import com.flux.repository.GroupMessageRepository;
import com.flux.service.SharedTripService;
import com.flux.service.UserService;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/pools/{sharedTripId}/messages")
public class GroupMessageController {
    private final GroupMessageRepository messages;
    private final SharedTripService trips;
    private final UserService users;
    private final RideChatWebSocketHandler chatSocket;

    public GroupMessageController(
            GroupMessageRepository messages,
            SharedTripService trips,
            UserService users,
            RideChatWebSocketHandler chatSocket) {
        this.messages = messages;
        this.trips = trips;
        this.users = users;
        this.chatSocket = chatSocket;
    }

    private SharedTrip requireMember(Long tripId, Long userId) {
        SharedTrip trip=trips.getById(tripId);
        boolean member=trip.getMembers().stream().anyMatch(m -> m.getUserId().equals(userId));
        if(!member) throw new IllegalArgumentException("Only group members can access this chat");
        return trip;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<GroupMessage>>> list(@PathVariable Long sharedTripId, @RequestParam Long userId) {
        requireMember(sharedTripId,userId);
        return ResponseEntity.ok(ApiResponse.success("Group messages fetched", messages.findBySharedTripIdOrderByCreatedAtAsc(sharedTripId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<GroupMessage>> send(@PathVariable Long sharedTripId, @Valid @RequestBody GroupMessageRequest request) {
        requireMember(sharedTripId,request.getUserId());
        User user=users.getById(request.getUserId());
        GroupMessage m=new GroupMessage();
        m.setSharedTripId(sharedTripId);
        m.setUserId(user.getId());
        m.setUserName(user.getName());
        m.setMessage(request.getMessage().trim());

        GroupMessage saved = messages.save(m);
        chatSocket.broadcastMessage(saved);

        return ResponseEntity.ok(
                ApiResponse.success("Message sent", saved)
        );
    }
}