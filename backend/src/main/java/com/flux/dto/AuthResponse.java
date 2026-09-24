package com.flux.dto;

import com.flux.model.User;

public class AuthResponse {

    private final User user;
    private final String token;
    private final long expiresAtEpochSeconds;

    public AuthResponse(
            User user,
            String token,
            long expiresAtEpochSeconds) {
        this.user = user;
        this.token = token;
        this.expiresAtEpochSeconds = expiresAtEpochSeconds;
    }

    public User getUser() {
        return user;
    }

    public String getToken() {
        return token;
    }

    public long getExpiresAtEpochSeconds() {
        return expiresAtEpochSeconds;
    }

    // Backward-compatible top-level fields while older frontend builds
    // transition from returning User directly to returning AuthResponse.
    public Long getId() {
        return user.getId();
    }

    public String getName() {
        return user.getName();
    }

    public boolean isPhoneVerified() {
        return user.isPhoneVerified();
    }

    public boolean isStudentVerified() {
        return user.isStudentVerified();
    }

    public String getStudentEmail() {
        return user.getStudentEmail();
    }
}
