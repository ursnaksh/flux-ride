package com.flux.dto;

import java.time.LocalDateTime;

public class LiveLocationView {

    private final Long userId;
    private final String userName;
    private final Double latitude;
    private final Double longitude;
    private final LocalDateTime updatedAt;

    public LiveLocationView(
            Long userId,
            String userName,
            Double latitude,
            Double longitude,
            LocalDateTime updatedAt) {
        this.userId = userId;
        this.userName = userName;
        this.latitude = latitude;
        this.longitude = longitude;
        this.updatedAt = updatedAt;
    }

    public Long getUserId() { return userId; }
    public String getUserName() { return userName; }
    public Double getLatitude() { return latitude; }
    public Double getLongitude() { return longitude; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
