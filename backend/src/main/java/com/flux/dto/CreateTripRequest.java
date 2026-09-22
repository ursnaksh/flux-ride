package com.flux.dto;

import java.time.LocalDateTime;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CreateTripRequest {

    @NotNull(message = "userId is required")
    private Long userId;

    @NotBlank(message = "pickup is required")
    private String pickup;

    @NotBlank(message = "drop is required")
    private String drop;

    @NotNull(message = "distanceKm is required")
    @DecimalMin(
        value = "0.0",
        inclusive = false,
        message = "distanceKm must be positive"
    )
    private Double distanceKm;

    @NotNull(message = "departureTime is required")
    @Future(message = "departureTime must be in the future")
    private LocalDateTime departureTime;

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getPickup() {
        return pickup;
    }

    public void setPickup(String pickup) {
        this.pickup = pickup;
    }

    public String getDrop() {
        return drop;
    }

    public void setDrop(String drop) {
        this.drop = drop;
    }

    public Double getDistanceKm() {
        return distanceKm;
    }

    public void setDistanceKm(Double distanceKm) {
        this.distanceKm = distanceKm;
    }

    public LocalDateTime getDepartureTime() {
        return departureTime;
    }

    public void setDepartureTime(LocalDateTime departureTime) {
        this.departureTime = departureTime;
    }
}