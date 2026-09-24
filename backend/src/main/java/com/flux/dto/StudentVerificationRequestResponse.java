package com.flux.dto;

public class StudentVerificationRequestResponse {

    private final String maskedEmail;
    private final int expiresInSeconds;
    private final int resendAfterSeconds;

    public StudentVerificationRequestResponse(
            String maskedEmail,
            int expiresInSeconds,
            int resendAfterSeconds) {
        this.maskedEmail = maskedEmail;
        this.expiresInSeconds = expiresInSeconds;
        this.resendAfterSeconds = resendAfterSeconds;
    }

    public String getMaskedEmail() { return maskedEmail; }
    public int getExpiresInSeconds() { return expiresInSeconds; }
    public int getResendAfterSeconds() { return resendAfterSeconds; }
}
