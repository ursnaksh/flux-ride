package com.flux.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.flux.dto.ApiResponse;
import com.flux.dto.CreateTripRequest;
import com.flux.model.TripRequest;
import com.flux.security.AuthContext;
import com.flux.service.TripRequestService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/rides")
public class TripRequestController {

    private final TripRequestService tripRequestService;

    @Autowired
    public TripRequestController(
            TripRequestService tripRequestService) {

        this.tripRequestService = tripRequestService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TripRequest>> createTripRequest(
            HttpServletRequest httpRequest,
            @Valid @RequestBody CreateTripRequest request) {

        request.setUserId(
                AuthContext.requireUserId(httpRequest)
        );

        TripRequest tripRequest =
                tripRequestService.createTripRequest(request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(
                        ApiResponse.success(
                                "Trip request created successfully",
                                tripRequest
                        )
                );
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<List<TripRequest>>> getUserTripRequests(
            HttpServletRequest request,
            @PathVariable Long userId) {

        AuthContext.requireSameUser(request, userId);

        List<TripRequest> tripRequests =
                tripRequestService.getRequestsForUser(userId);

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Trip requests fetched",
                        tripRequests
                )
        );
    }
}