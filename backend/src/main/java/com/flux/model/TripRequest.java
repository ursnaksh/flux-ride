package com.flux.model;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "rides")
public class TripRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String pickup;

    @Column(name = "drop_location", nullable = false)
    private String drop;

    private Double pickupLatitude;
    private Double pickupLongitude;
    private Double dropLatitude;
    private Double dropLongitude;

    @Column(nullable = false)
    private Double distanceKm;

    @Column(nullable = false)
    private Double fare;

    @Column(nullable = false)
    private LocalDateTime departureTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TripRequestStatus status;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public enum TripRequestStatus {
        SEARCHING,
        MATCHED,
        COMPLETED,
        CANCELLED
    }

    public TripRequest() {}

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.status == null) this.status = TripRequestStatus.SEARCHING;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getPickup() { return pickup; }
    public void setPickup(String pickup) { this.pickup = pickup; }
    public String getDrop() { return drop; }
    public void setDrop(String drop) { this.drop = drop; }
    public Double getPickupLatitude() { return pickupLatitude; }
    public void setPickupLatitude(Double value) { pickupLatitude = value; }
    public Double getPickupLongitude() { return pickupLongitude; }
    public void setPickupLongitude(Double value) { pickupLongitude = value; }
    public Double getDropLatitude() { return dropLatitude; }
    public void setDropLatitude(Double value) { dropLatitude = value; }
    public Double getDropLongitude() { return dropLongitude; }
    public void setDropLongitude(Double value) { dropLongitude = value; }
    public Double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(Double distanceKm) { this.distanceKm = distanceKm; }
    public Double getFare() { return fare; }
    public void setFare(Double fare) { this.fare = fare; }
    public LocalDateTime getDepartureTime() { return departureTime; }
    public void setDepartureTime(LocalDateTime departureTime) { this.departureTime = departureTime; }
    public TripRequestStatus getStatus() { return status; }
    public void setStatus(TripRequestStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
