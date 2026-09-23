package com.flux.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.flux.model.SharedTrip;

public interface SharedTripRepository
        extends JpaRepository<SharedTrip, Long> {

    List<SharedTrip> findByStatusOrderByCreatedAtDesc(
            SharedTrip.SharedTripStatus status
    );

    @Query("""
            SELECT DISTINCT sharedTrip
            FROM SharedTrip sharedTrip
            JOIN sharedTrip.members member
            WHERE member.userId = :userId
            ORDER BY sharedTrip.createdAt DESC
            """)
    List<SharedTrip> findSharedTripsByMemberUserId(
            @Param("userId") Long userId
    );

    Optional<SharedTrip> findBySourceTripRequestId(Long sourceTripRequestId);

    long countByStatus(
            SharedTrip.SharedTripStatus status
    );
}