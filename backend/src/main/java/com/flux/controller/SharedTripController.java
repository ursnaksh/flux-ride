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
import com.flux.dto.InviteGroupSummary;
import com.flux.dto.LiveLocationRequest;
import com.flux.dto.LiveLocationView;
import com.flux.dto.MatchResult;
import com.flux.dto.PoolRequest;
import com.flux.model.SharedTrip;
import com.flux.model.TripRequest;
import com.flux.security.AuthContext;
import com.flux.service.SharedTripService;
import com.flux.service.TripRequestService;

import jakarta.servlet.http.HttpServletRequest;
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
            HttpServletRequest httpRequest,
            @Valid @RequestBody PoolRequest request) {

        request.setUserId(
                AuthContext.requireUserId(httpRequest)
        );

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
            HttpServletRequest request,
            @PathVariable Long tripRequestId) {

        TripRequest tripRequest =
                tripRequestService.getById(tripRequestId);

        AuthContext.requireSameUser(
                request,
                tripRequest.getUserId()
        );

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
            HttpServletRequest request,
            @PathVariable Long sharedTripId,
            @PathVariable Long tripRequestId) {

        AuthContext.requireSameUser(
                request,
                tripRequestService.getById(tripRequestId).getUserId()
        );

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
            HttpServletRequest request,
            @PathVariable Long tripRequestId) {

        AuthContext.requireSameUser(
                request,
                tripRequestService.getById(tripRequestId).getUserId()
        );

        SharedTrip group = sharedTripService.createFromRequest(tripRequestId);
        return ResponseEntity.status(HttpStatus.CREATED).body(
                ApiResponse.success("Shared trip created successfully", group)
        );
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<List<SharedTrip>>> getUserSharedTrips(
            HttpServletRequest request,
            @PathVariable Long userId) {

        AuthContext.requireSameUser(request, userId);

        List<SharedTrip> sharedTrips =
                sharedTripService.getSharedTripsForUser(userId);

        return ResponseEntity.ok(
                ApiResponse.success(
                        "User shared trips fetched",
                        sharedTrips
                )
        );
    }


    @GetMapping("/{sharedTripId}/invite")
    public ResponseEntity<ApiResponse<InviteGroupSummary>> getInviteSummary(
            @PathVariable Long sharedTripId) {

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Invite summary fetched",
                        sharedTripService.getInviteSummary(sharedTripId)
                )
        );
    }

    @GetMapping("/{sharedTripId}/live-locations")
    public ResponseEntity<ApiResponse<List<LiveLocationView>>> getLiveLocations(
            HttpServletRequest request,
            @PathVariable Long sharedTripId,
            @RequestParam(required = false) Long userId) {

        Long authenticatedUserId =
                AuthContext.requireUserId(request);

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Live locations fetched",
                        sharedTripService.getLiveLocations(
                                sharedTripId,
                                authenticatedUserId
                        )
                )
        );
    }

    @PostMapping("/{sharedTripId}/location/{userId}")
    public ResponseEntity<ApiResponse<SharedTrip>> updateLiveLocation(
            HttpServletRequest httpRequest,
            @PathVariable Long sharedTripId,
            @PathVariable Long userId,
            @Valid @RequestBody LiveLocationRequest request) {

        AuthContext.requireSameUser(httpRequest, userId);
        Long authenticatedUserId =
                AuthContext.requireUserId(httpRequest);

        SharedTrip sharedTrip =
                sharedTripService.updateLiveLocation(
                        sharedTripId,
                        authenticatedUserId,
                        Boolean.TRUE.equals(request.getSharing()),
                        request.getLatitude(),
                        request.getLongitude()
                );

        return ResponseEntity.ok(
                ApiResponse.success(
                        Boolean.TRUE.equals(request.getSharing())
                                ? "Live location updated"
                                : "Live location sharing stopped",
                        sharedTrip
                )
        );
    }

    @PostMapping("/{sharedTripId}/ready/{userId}")
    public ResponseEntity<ApiResponse<SharedTrip>> updateReady(
            HttpServletRequest request,
            @PathVariable Long sharedTripId,
            @PathVariable Long userId,
            @RequestParam boolean ready) {

        AuthContext.requireSameUser(request, userId);
        Long authenticatedUserId =
                AuthContext.requireUserId(request);

        SharedTrip sharedTrip =
                sharedTripService.updateReady(
                        sharedTripId,
                        authenticatedUserId,
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
            HttpServletRequest request,
            @PathVariable Long sharedTripId,
            @PathVariable Long userId) {

        AuthContext.requireSameUser(request, userId);
        Long authenticatedUserId =
                AuthContext.requireUserId(request);

        SharedTrip sharedTrip =
                sharedTripService.leaveSharedTrip(
                        sharedTripId,
                        authenticatedUserId
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