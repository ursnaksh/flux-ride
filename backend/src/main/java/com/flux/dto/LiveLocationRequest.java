package com.flux.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public class LiveLocationRequest {

    @NotNull
    private Boolean sharing;

    @DecimalMin("-90.0") @DecimalMax("90.0")
    private Double latitude;

    @DecimalMin("-180.0") @DecimalMax("180.0")
    private Double longitude;

    @PositiveOrZero
    private Double accuracyMeters;

    @PositiveOrZero
    private Double speedMetersPerSecond;

    @DecimalMin("0.0") @DecimalMax("360.0")
    private Double headingDegrees;

    public Boolean getSharing() { return sharing; }
    public void setSharing(Boolean sharing) { this.sharing = sharing; }

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }

    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public Double getAccuracyMeters() { return accuracyMeters; }
    public void setAccuracyMeters(Double accuracyMeters) { this.accuracyMeters = accuracyMeters; }

    public Double getSpeedMetersPerSecond() { return speedMetersPerSecond; }
    public void setSpeedMetersPerSecond(Double speedMetersPerSecond) { this.speedMetersPerSecond = speedMetersPerSecond; }

    public Double getHeadingDegrees() { return headingDegrees; }
    public void setHeadingDegrees(Double headingDegrees) { this.headingDegrees = headingDegrees; }
}
