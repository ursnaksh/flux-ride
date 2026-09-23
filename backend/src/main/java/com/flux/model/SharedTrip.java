package com.flux.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "pools")
public class SharedTrip {

    public static final int MAX_MEMBERS = 4;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Normalized destination used internally for matching.
     */
    @Column(nullable = false)
    private String destination;

    /**
     * Original human-readable destination.
     */
    @Column(nullable = false)
    private String destinationLabel;

    /**
     * Planned departure time for this shared trip.
     * New passengers can be matched against this time.
     */
    @Column(nullable = false)
    private LocalDateTime departureTime;

    /**
     * Estimated total transportation fare.
     * This can be divided among members for cost estimation.
     */
    @Column(nullable = false)
    private Double totalFare;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SharedTripStatus status;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    /** Trip request that originally opened this group. */
    @Column(unique = true)
    private Long sourceTripRequestId;

    @OneToMany(
            mappedBy = "sharedTrip",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.EAGER
    )
    private List<SharedTripMember> members = new ArrayList<>();

    public enum SharedTripStatus {
        FORMING,
        READY,
        BOOKED_EXTERNALLY,
        COMPLETED,
        CANCELLED
    }

    public SharedTrip() {
    }

    @PrePersist
    protected void onCreate() {

        this.createdAt = LocalDateTime.now();

        if (this.status == null) {
            this.status = SharedTripStatus.FORMING;
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDestination() {
        return destination;
    }

    public void setDestination(String destination) {
        this.destination = destination;
    }

    public String getDestinationLabel() {
        return destinationLabel;
    }

    public void setDestinationLabel(String destinationLabel) {
        this.destinationLabel = destinationLabel;
    }

    public LocalDateTime getDepartureTime() {
        return departureTime;
    }

    public void setDepartureTime(LocalDateTime departureTime) {
        this.departureTime = departureTime;
    }

    public Double getTotalFare() {
        return totalFare;
    }

    public void setTotalFare(Double totalFare) {
        this.totalFare = totalFare;
    }

    public SharedTripStatus getStatus() {
        return status;
    }

    public void setStatus(SharedTripStatus status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public Long getSourceTripRequestId() {
        return sourceTripRequestId;
    }

    public void setSourceTripRequestId(Long sourceTripRequestId) {
        this.sourceTripRequestId = sourceTripRequestId;
    }

    public List<SharedTripMember> getMembers() {
        return members;
    }

    public void setMembers(List<SharedTripMember> members) {
        this.members = members;
    }

    /**
     * Estimated fare per member based on current group size.
     */
    public double getFarePerMember() {

        int memberCount = members.size();

        if (memberCount == 0) {
            return totalFare;
        }

        return Math.round(
                (totalFare / memberCount) * 100.0
        ) / 100.0;
    }
}