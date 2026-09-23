package com.flux.service;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.flux.dto.CreateTripRequest;
import com.flux.exception.ResourceNotFoundException;
import com.flux.model.TripRequest;
import com.flux.repository.TripRequestRepository;

@Service
public class TripRequestService {

    private static final double BASE_FARE = 15.0;
    private static final double RATE_PER_KM = 12.0;

    private final TripRequestRepository tripRequestRepository;
    private final SharedTripService sharedTripService;

    @Autowired
    public TripRequestService(
            TripRequestRepository tripRequestRepository,
            SharedTripService sharedTripService) {

        this.tripRequestRepository = tripRequestRepository;
        this.sharedTripService = sharedTripService;
    }

    public static double calculateFare(double distanceKm) {
        return Math.round(
                (BASE_FARE + RATE_PER_KM * distanceKm) * 100.0
        ) / 100.0;
    }

    public TripRequest createTripRequest(
            CreateTripRequest request) {

        TripRequest tripRequest = new TripRequest();

        tripRequest.setUserId(request.getUserId());

        tripRequest.setPickup(
                request.getPickup().trim()
        );

        tripRequest.setDrop(
                request.getDrop().trim()
        );

        tripRequest.setDistanceKm(
                request.getDistanceKm()
        );

        tripRequest.setFare(
                calculateFare(request.getDistanceKm())
        );

        tripRequest.setDepartureTime(
                request.getDepartureTime()
        );

        tripRequest.setStatus(
                TripRequest.TripRequestStatus.SEARCHING
        );

        TripRequest saved = tripRequestRepository.save(tripRequest);
        sharedTripService.ensureGroupForRequest(saved);
        return saved;
    }

    public List<TripRequest> getRequestsForUser(
            Long userId) {

        return tripRequestRepository
                .findByUserIdOrderByCreatedAtDesc(userId);
    }

    public TripRequest getById(Long id) {

        return tripRequestRepository
                .findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Trip request not found: " + id
                        )
                );
    }

    public List<TripRequest> getOpenRequests() {

        return tripRequestRepository
                .findByStatusOrderByCreatedAtAsc(
                        TripRequest.TripRequestStatus.SEARCHING
                );
    }
}