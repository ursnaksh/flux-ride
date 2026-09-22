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

    public MatchResult(
            Long sharedTripId,
            String destination,
            LocalDateTime departureTime,
            double compatibilityScore,
            List<String> reasons,
            int currentMembers,
            int availableSeats) {

        this.sharedTripId = sharedTripId;
        this.destination = destination;
        this.departureTime = departureTime;
        this.compatibilityScore = compatibilityScore;
        this.reasons = reasons == null
                ? new ArrayList<>()
                : new ArrayList<>(reasons);
        this.currentMembers = currentMembers;
        this.availableSeats = availableSeats;
    }

    public Long getSharedTripId() {
        return sharedTripId;
    }

    public void setSharedTripId(Long sharedTripId) {
        this.sharedTripId = sharedTripId;
    }

    public String getDestination() {
        return destination;
    }

    public void setDestination(String destination) {
        this.destination = destination;
    }

    public LocalDateTime getDepartureTime() {
        return departureTime;
    }

    public void setDepartureTime(LocalDateTime departureTime) {
        this.departureTime = departureTime;
    }

    public double getCompatibilityScore() {
        return compatibilityScore;
    }

    public void setCompatibilityScore(double compatibilityScore) {
        this.compatibilityScore = compatibilityScore;
    }

    public List<String> getReasons() {
        return new ArrayList<>(reasons);
    }

    public void setReasons(List<String> reasons) {
        this.reasons = reasons == null
                ? new ArrayList<>()
                : new ArrayList<>(reasons);
    }

    public int getCurrentMembers() {
        return currentMembers;
    }

    public void setCurrentMembers(int currentMembers) {
        this.currentMembers = currentMembers;
    }

    public int getAvailableSeats() {
        return availableSeats;
    }

    public void setAvailableSeats(int availableSeats) {
        this.availableSeats = availableSeats;
    }
}