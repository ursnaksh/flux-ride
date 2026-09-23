package com.flux.dto;

import java.time.LocalDateTime;

import com.flux.model.SharedTrip;

public class InviteGroupSummary {

    private final Long id;
    private final String destinationLabel;
    private final Double destinationLatitude;
    private final Double destinationLongitude;
    private final LocalDateTime departureTime;
    private final String status;
    private final int currentMembers;
    private final int availableSeats;
    private final Double routeDistanceKm;
    private final Double routeDurationMinutes;

    public InviteGroupSummary(SharedTrip trip) {
        this.id = trip.getId();
        this.destinationLabel = trip.getDestinationLabel();
        this.destinationLatitude = trip.getDestinationLatitude();
        this.destinationLongitude = trip.getDestinationLongitude();
        this.departureTime = trip.getDepartureTime();
        this.status = trip.getStatus().name();
        this.currentMembers = trip.getMembers().size();
        this.availableSeats = Math.max(0, SharedTrip.MAX_MEMBERS - currentMembers);
        this.routeDistanceKm = trip.getRouteDistanceKm();
        this.routeDurationMinutes = trip.getRouteDurationMinutes();
    }

    public Long getId() { return id; }
    public String getDestinationLabel() { return destinationLabel; }
    public Double getDestinationLatitude() { return destinationLatitude; }
    public Double getDestinationLongitude() { return destinationLongitude; }
    public LocalDateTime getDepartureTime() { return departureTime; }
    public String getStatus() { return status; }
    public int getCurrentMembers() { return currentMembers; }
    public int getAvailableSeats() { return availableSeats; }
    public Double getRouteDistanceKm() { return routeDistanceKm; }
    public Double getRouteDurationMinutes() { return routeDurationMinutes; }
}
