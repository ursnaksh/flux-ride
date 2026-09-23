package com.flux.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

import com.flux.dto.ApiResponse;
import com.flux.dto.MatchResult;
import com.flux.dto.PoolRequest;
import com.flux.model.SharedTrip;
import com.flux.model.TripRequest;
import com.flux.service.SharedTripService;
import com.flux.service.TripRequestService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/pools")
public class SharedTripController {

    private final SharedTripService sharedTripService;
    private final TripRequestService tripRequestService;

    @Autowired
    public SharedTripController(
            SharedTripService sharedTripService,
            TripRequestService tripRequestService) {

        this.sharedTripService = sharedTripService;
        this.tripRequestService = tripRequestService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<SharedTrip>> joinOrCreate(
            @Valid @RequestBody PoolRequest request) {

        SharedTrip sharedTrip =
                sharedTripService.joinOrCreate(request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(
                        ApiResponse.success(
                                "Shared trip created or joined successfully",
                                sharedTrip
                        )
                );
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<SharedTrip>>> getFormingTrips() {

        List<SharedTrip> sharedTrips =
                sharedTripService.getFormingTrips();

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Shared trips fetched",
                        sharedTrips
                )
        );
    }

    /**
     * Returns compatible shared trips for an existing trip request.
     */
    @GetMapping("/matches/{tripRequestId}")
    public ResponseEntity<ApiResponse<List<MatchResult>>> findMatches(
            @PathVariable Long tripRequestId) {

        TripRequest tripRequest =
                tripRequestService.getById(tripRequestId);

        List<MatchResult> matches =
                sharedTripService.findMatches(tripRequest);

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Compatible shared trips fetched",
                        matches
                )
        );
    }

    /**
     * Joins a passenger to a specific shared trip selected
     * from the match results.
     */
    @PostMapping("/{sharedTripId}/join/{tripRequestId}")
    public ResponseEntity<ApiResponse<SharedTrip>> joinSharedTrip(
            @PathVariable Long sharedTripId,
            @PathVariable Long tripRequestId) {

        SharedTrip sharedTrip =
                sharedTripService.joinSharedTrip(
                        sharedTripId,
                        tripRequestId
                );

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Joined shared trip successfully",
                        sharedTrip
                )
        );
    }

    @PostMapping("/from-request/{tripRequestId}")
    public ResponseEntity<ApiResponse<SharedTrip>> createFromRequest(
            @PathVariable Long tripRequestId) {
        SharedTrip group = sharedTripService.createFromRequest(tripRequestId);
        return ResponseEntity.status(HttpStatus.CREATED).body(
                ApiResponse.success("Shared trip created successfully", group)
        );
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<List<SharedTrip>>> getUserSharedTrips(
            @PathVariable Long userId) {

        List<SharedTrip> sharedTrips =
                sharedTripService.getSharedTripsForUser(userId);

        return ResponseEntity.ok(
                ApiResponse.success(
                        "User shared trips fetched",
                        sharedTrips
                )
        );
    }

    @PostMapping("/{sharedTripId}/ready/{userId}")
    public ResponseEntity<ApiResponse<SharedTrip>> updateReady(
            @PathVariable Long sharedTripId,
            @PathVariable Long userId,
            @RequestParam boolean ready) {

        SharedTrip sharedTrip =
                sharedTripService.updateReady(
                        sharedTripId,
                        userId,
                        ready
                );

        return ResponseEntity.ok(
                ApiResponse.success(
                        ready
                                ? "Passenger marked ready"
                                : "Passenger marked not ready",
                        sharedTrip
                )
        );
    }

    @DeleteMapping("/{sharedTripId}/members/{userId}")
    public ResponseEntity<ApiResponse<SharedTrip>> leaveSharedTrip(
            @PathVariable Long sharedTripId,
            @PathVariable Long userId) {

        SharedTrip sharedTrip =
                sharedTripService.leaveSharedTrip(
                        sharedTripId,
                        userId
                );

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Left shared trip successfully",
                        sharedTrip
                )
        );
    }

    @GetMapping("/active/count")
    public ResponseEntity<ApiResponse<Long>> countActiveSharedTrips() {

        long count =
                sharedTripService.countActiveSharedTrips();

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Active shared trip count fetched",
                        count
                )
        );
    }
}