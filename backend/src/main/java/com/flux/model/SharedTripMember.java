package com.flux.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "pool_members")
public class SharedTripMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pool_id", nullable = false)
    private SharedTrip sharedTrip;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String userName;

    @Column(nullable = false)
    private String pickup;

    private Double pickupLatitude;
    private Double pickupLongitude;

    public SharedTripMember() {}

    public SharedTripMember(SharedTrip sharedTrip, Long userId, String userName, String pickup) {
        this(sharedTrip, userId, userName, pickup, null, null);
    }

    public SharedTripMember(
            SharedTrip sharedTrip,
            Long userId,
            String userName,
            String pickup,
            Double pickupLatitude,
            Double pickupLongitude) {

        this.sharedTrip = sharedTrip;
        this.userId = userId;
        this.userName = userName;
        this.pickup = pickup;
        this.pickupLatitude = pickupLatitude;
        this.pickupLongitude = pickupLongitude;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public SharedTrip getSharedTrip() { return sharedTrip; }
    public void setSharedTrip(SharedTrip sharedTrip) { this.sharedTrip = sharedTrip; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getPickup() { return pickup; }
    public void setPickup(String pickup) { this.pickup = pickup; }
    public Double getPickupLatitude() { return pickupLatitude; }
    public void setPickupLatitude(Double value) { pickupLatitude = value; }
    public Double getPickupLongitude() { return pickupLongitude; }
    public void setPickupLongitude(Double value) { pickupLongitude = value; }

    public String getInitials() {
        if (userName == null || userName.isBlank()) return "?";
        String[] parts = userName.trim().split("\\s+");
        if (parts.length == 1) {
            return parts[0].substring(0, Math.min(2, parts[0].length())).toUpperCase();
        }
        return ("" + parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
}
