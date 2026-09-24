package com.flux.dto;

public class OtpRequestResponse {

    private final String maskedPhone;
    private final int expiresInSeconds;
    private final int resendAfterSeconds;

    public OtpRequestResponse(
            String maskedPhone,
            int expiresInSeconds,
            int resendAfterSeconds) {
        this.maskedPhone = maskedPhone;
        this.expiresInSeconds = expiresInSeconds;
        this.resendAfterSeconds = resendAfterSeconds;
    }

    public String getMaskedPhone() { return maskedPhone; }
    public int getExpiresInSeconds() { return expiresInSeconds; }
    public int getResendAfterSeconds() { return resendAfterSeconds; }
}
