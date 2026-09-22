package com.flux.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.flux.model.TripRequest;

public interface TripRequestRepository
        extends JpaRepository<TripRequest, Long> {

    List<TripRequest> findByUserIdOrderByCreatedAtDesc(
            Long userId
    );

    List<TripRequest> findByStatusOrderByCreatedAtAsc(
            TripRequest.TripRequestStatus status
    );
}