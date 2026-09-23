package com.flux.dto;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class MatchResult {

    private Long sharedTripId;
    private String destination;
    private LocalDateTime departureTime;
    private double compatibilityScore;
    private List<String> reasons;
    private int currentMembers;
    private int availableSeats;
    private double routeOverlapScore;
    private Double estimatedDetourKm;

    public MatchResult(
            Long sharedTripId,
            String destination,
            LocalDateTime departureTime,
            double compatibilityScore,
            List<String> reasons,
            int currentMembers,
            int availableSeats,
            double routeOverlapScore,
            Double estimatedDetourKm) {

        this.sharedTripId = sharedTripId;
        this.destination = destination;
        this.departureTime = departureTime;
        this.compatibilityScore = compatibilityScore;
        this.reasons = reasons == null ? new ArrayList<>() : new ArrayList<>(reasons);
        this.currentMembers = currentMembers;
        this.availableSeats = availableSeats;
        this.routeOverlapScore = routeOverlapScore;
        this.estimatedDetourKm = estimatedDetourKm;
    }

    public Long getSharedTripId() { return sharedTripId; }
    public void setSharedTripId(Long value) { sharedTripId = value; }
    public String getDestination() { return destination; }
    public void setDestination(String value) { destination = value; }
    public LocalDateTime getDepartureTime() { return departureTime; }
    public void setDepartureTime(LocalDateTime value) { departureTime = value; }
    public double getCompatibilityScore() { return compatibilityScore; }
    public void setCompatibilityScore(double value) { compatibilityScore = value; }
    public List<String> getReasons() { return new ArrayList<>(reasons); }
    public void setReasons(List<String> value) { reasons = value == null ? new ArrayList<>() : new ArrayList<>(value); }
    public int getCurrentMembers() { return currentMembers; }
    public void setCurrentMembers(int value) { currentMembers = value; }
    public int getAvailableSeats() { return availableSeats; }
    public void setAvailableSeats(int value) { availableSeats = value; }
    public double getRouteOverlapScore() { return routeOverlapScore; }
    public void setRouteOverlapScore(double value) { routeOverlapScore = value; }
    public Double getEstimatedDetourKm() { return estimatedDetourKm; }
    public void setEstimatedDetourKm(Double value) { estimatedDetourKm = value; }
}
