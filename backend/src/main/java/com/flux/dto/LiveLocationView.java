package com.flux.dto;

import java.time.LocalDateTime;

public class LiveLocationView {

    private final Long userId;
    private final String userName;
    private final Double latitude;
    private final Double longitude;
    private final Double accuracyMeters;
    private final Double speedMetersPerSecond;
    private final Double headingDegrees;
    private final LocalDateTime updatedAt;

    public LiveLocationView(
            Long userId,
            String userName,
            Double latitude,
            Double longitude,
            Double accuracyMeters,
            Double speedMetersPerSecond,
            Double headingDegrees,
            LocalDateTime updatedAt) {
        this.userId = userId;
        this.userName = userName;
        this.latitude = latitude;
        this.longitude = longitude;
        this.accuracyMeters = accuracyMeters;
        this.speedMetersPerSecond = speedMetersPerSecond;
        this.headingDegrees = headingDegrees;
        this.updatedAt = updatedAt;
    }

    public Long getUserId() { return userId; }
    public String getUserName() { return userName; }
    public Double getLatitude() { return latitude; }
    public Double getLongitude() { return longitude; }
    public Double getAccuracyMeters() { return accuracyMeters; }
    public Double getSpeedMetersPerSecond() { return speedMetersPerSecond; }
    public Double getHeadingDegrees() { return headingDegrees; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
