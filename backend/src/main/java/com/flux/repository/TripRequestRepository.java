package com.flux.repository;

import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.flux.model.TripRequest;

public interface TripRequestRepository
        extends JpaRepository<TripRequest, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select request from TripRequest request where request.id = :id")
    Optional<TripRequest> findByIdForUpdate(@Param("id") Long id);

    List<TripRequest> findByUserIdOrderByCreatedAtDesc(
            Long userId
    );

    List<TripRequest> findByStatusOrderByCreatedAtAsc(
            TripRequest.TripRequestStatus status
    );
}