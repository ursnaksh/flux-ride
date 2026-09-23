package com.flux.dto;

import java.time.LocalDateTime;

import jakarta.validation.constraints.DecimalMax;
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

    @DecimalMin(value = "-90.0")
    @DecimalMax(value = "90.0")
    private Double pickupLatitude;

    @DecimalMin(value = "-180.0")
    @DecimalMax(value = "180.0")
    private Double pickupLongitude;

    @DecimalMin(value = "-90.0")
    @DecimalMax(value = "90.0")
    private Double dropLatitude;

    @DecimalMin(value = "-180.0")
    @DecimalMax(value = "180.0")
    private Double dropLongitude;

    @NotNull(message = "distanceKm is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "distanceKm must be positive")
    private Double distanceKm;

    @NotNull(message = "departureTime is required")
    @Future(message = "departureTime must be in the future")
    private LocalDateTime departureTime;

    public Long getUserId() { return userId; }
    public void setUserId(Long value) { userId = value; }
    public String getPickup() { return pickup; }
    public void setPickup(String value) { pickup = value; }
    public String getDrop() { return drop; }
    public void setDrop(String value) { drop = value; }
    public Double getPickupLatitude() { return pickupLatitude; }
    public void setPickupLatitude(Double value) { pickupLatitude = value; }
    public Double getPickupLongitude() { return pickupLongitude; }
    public void setPickupLongitude(Double value) { pickupLongitude = value; }
    public Double getDropLatitude() { return dropLatitude; }
    public void setDropLatitude(Double value) { dropLatitude = value; }
    public Double getDropLongitude() { return dropLongitude; }
    public void setDropLongitude(Double value) { dropLongitude = value; }
    public Double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(Double value) { distanceKm = value; }
    public LocalDateTime getDepartureTime() { return departureTime; }
    public void setDepartureTime(LocalDateTime value) { departureTime = value; }
}
