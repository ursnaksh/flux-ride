package com.flux.dto;

public class OtpRequestResponse {

    private final String maskedPhone;
    private final int expiresInSeconds;
    private final int resendAfterSeconds;
    private final boolean demoMode;
    private final String demoCode;

    public OtpRequestResponse(
            String maskedPhone,
            int expiresInSeconds,
            int resendAfterSeconds,
            boolean demoMode,
            String demoCode) {
        this.maskedPhone = maskedPhone;
        this.expiresInSeconds = expiresInSeconds;
        this.resendAfterSeconds = resendAfterSeconds;
        this.demoMode = demoMode;
        this.demoCode = demoCode;
    }

    public String getMaskedPhone() { return maskedPhone; }
    public int getExpiresInSeconds() { return expiresInSeconds; }
    public int getResendAfterSeconds() { return resendAfterSeconds; }
    public boolean isDemoMode() { return demoMode; }
    public String getDemoCode() { return demoCode; }
}
