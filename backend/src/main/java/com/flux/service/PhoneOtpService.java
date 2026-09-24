package com.flux.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flux.dto.OtpRequestResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PhoneOtpService {

    private static final int OTP_LENGTH = 6;
    private static final int MAX_SENDS_PER_WINDOW = 5;
    private static final int MAX_VERIFY_ATTEMPTS = 5;
    private static final long RATE_WINDOW_MS = 15 * 60 * 1000L;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final SecureRandom secureRandom = new SecureRandom();

    private final ConcurrentHashMap<String, Deque<Long>> sendHistory =
            new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, DemoChallenge> demoChallenges =
            new ConcurrentHashMap<>();

    @Value("${auth.otp.enabled:false}")
    private boolean otpEnabled;

    @Value("${auth.otp.provider:msg91}")
    private String provider;

    @Value("${auth.otp.msg91.auth-key:}")
    private String authKey;

    @Value("${auth.otp.msg91.template-id:}")
    private String templateId;

    @Value("${auth.otp.expiry-minutes:5}")
    private int expiryMinutes;

    @Value("${auth.otp.resend-seconds:30}")
    private int resendSeconds;

    @Value("${auth.otp.demo.expose-code:false}")
    private boolean exposeDemoCode;

    @Value("${auth.otp.demo.secret:flux-demo-otp-secret}")
    private String demoSecret;

    public PhoneOtpService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .build();
    }

    public boolean isRequired() {
        return otpEnabled;
    }

    public boolean isDemoMode() {
        return otpEnabled && "demo".equalsIgnoreCase(provider);
    }

    public boolean isAvailable() {
        if (!otpEnabled) return false;

        if (isDemoMode()) {
            return true;
        }

        return authKey != null && !authKey.isBlank()
                && templateId != null && !templateId.isBlank();
    }

    public int getResendSeconds() {
        return resendSeconds;
    }

    public int getExpirySeconds() {
        return Math.max(1, expiryMinutes) * 60;
    }

    public int getOtpLength() {
        return OTP_LENGTH;
    }

    public String normalizePhone(String rawPhone) {
        if (rawPhone == null || rawPhone.isBlank()) {
            throw new IllegalArgumentException("Phone number is required.");
        }

        String compact = rawPhone.trim()
                .replace(" ", "")
                .replace("-", "")
                .replace("(", "")
                .replace(")", "");

        String digits = compact.startsWith("+")
                ? compact.substring(1)
                : compact;

        if (!digits.chars().allMatch(Character::isDigit)) {
            throw new IllegalArgumentException("Enter a valid phone number.");
        }

        if (digits.length() == 10) {
            digits = "91" + digits;
        }

        if (digits.length() < 8 || digits.length() > 15) {
            throw new IllegalArgumentException(
                    "Enter a valid phone number with country code."
            );
        }

        return "+" + digits;
    }

    public OtpRequestResponse requestOtp(String rawPhone) {
        ensureAvailable();
        String phone = normalizePhone(rawPhone);
        checkRateLimit(phone);

        if (isDemoMode()) {
            return createDemoOtp(phone);
        }

        String mobile = phone.substring(1);
        String url = "https://control.msg91.com/api/v5/otp"
                + "?template_id=" + encode(templateId)
                + "&mobile=" + encode(mobile)
                + "&otp_expiry=" + Math.max(1, expiryMinutes)
                + "&otp_length=" + OTP_LENGTH;

        JsonNode response = sendProviderRequest(
                url,
                true
        );

        if (!isSuccess(response)) {
            throw new IllegalArgumentException(
                    "We could not send the verification code. Please try again."
            );
        }

        return new OtpRequestResponse(
                maskPhone(phone),
                getExpirySeconds(),
                resendSeconds,
                false,
                null
        );
    }

    public void verifyOtp(String rawPhone, String otp) {
        ensureAvailable();
        String phone = normalizePhone(rawPhone);

        String cleanOtp = otp == null ? "" : otp.trim();
        if (!cleanOtp.matches("\\d{" + OTP_LENGTH + "}")) {
            throw new IllegalArgumentException(
                    "Enter the " + OTP_LENGTH + "-digit verification code."
            );
        }

        if (isDemoMode()) {
            verifyDemoOtp(phone, cleanOtp);
            return;
        }

        String mobile = phone.substring(1);
        String url = "https://control.msg91.com/api/v5/otp/verify"
                + "?otp=" + encode(cleanOtp)
                + "&mobile=" + encode(mobile);

        JsonNode response = sendProviderRequest(
                url,
                false
        );

        String type = response.path("type").asText("");
        String message = response.path("message").asText("")
                .toLowerCase(Locale.ROOT);

        boolean verified = "success".equalsIgnoreCase(type)
                || message.contains("verified success")
                || message.contains("number_verified_successfully");

        if (!verified) {
            throw new IllegalArgumentException(
                    "That code is invalid or expired. Request a new OTP and try again."
            );
        }
    }

    private OtpRequestResponse createDemoOtp(String phone) {
        String code = String.format(
                "%06d",
                secureRandom.nextInt(1_000_000)
        );

        long expiresAt =
                System.currentTimeMillis()
                        + getExpirySeconds() * 1000L;

        demoChallenges.put(
                phone,
                new DemoChallenge(
                        hashDemoCode(phone, code),
                        expiresAt,
                        0
                )
        );

        return new OtpRequestResponse(
                maskPhone(phone),
                getExpirySeconds(),
                resendSeconds,
                true,
                exposeDemoCode ? code : null
        );
    }

    private void verifyDemoOtp(
            String phone,
            String code) {

        DemoChallenge challenge =
                demoChallenges.get(phone);

        if (challenge == null) {
            throw new IllegalArgumentException(
                    "Request a new OTP first."
            );
        }

        if (System.currentTimeMillis()
                > challenge.expiresAtMs()) {
            demoChallenges.remove(phone);
            throw new IllegalArgumentException(
                    "That code has expired. Request a new OTP."
            );
        }

        if (challenge.attempts()
                >= MAX_VERIFY_ATTEMPTS) {
            demoChallenges.remove(phone);
            throw new IllegalArgumentException(
                    "Too many incorrect attempts. Request a new OTP."
            );
        }

        String suppliedHash =
                hashDemoCode(phone, code);

        boolean matches =
                MessageDigest.isEqual(
                        challenge.codeHash()
                                .getBytes(StandardCharsets.UTF_8),
                        suppliedHash
                                .getBytes(StandardCharsets.UTF_8)
                );

        if (!matches) {
            demoChallenges.put(
                    phone,
                    new DemoChallenge(
                            challenge.codeHash(),
                            challenge.expiresAtMs(),
                            challenge.attempts() + 1
                    )
            );

            throw new IllegalArgumentException(
                    "That OTP is incorrect."
            );
        }

        demoChallenges.remove(phone);
    }

    private String hashDemoCode(
            String phone,
            String code) {

        try {
            MessageDigest digest =
                    MessageDigest.getInstance("SHA-256");

            byte[] result = digest.digest(
                    (demoSecret + "|" + phone + "|" + code)
                            .getBytes(StandardCharsets.UTF_8)
            );

            return java.util.HexFormat.of()
                    .formatHex(result);
        } catch (Exception ex) {
            throw new IllegalStateException(
                    "Could not secure demo OTP",
                    ex
            );
        }
    }

    private void ensureAvailable() {
        if (!otpEnabled) {
            throw new IllegalArgumentException(
                    "Phone verification is not enabled yet."
            );
        }

        if (!isAvailable()) {
            throw new IllegalArgumentException(
                    "Phone verification is temporarily unavailable."
            );
        }
    }

    private synchronized void checkRateLimit(String phone) {
        long now = System.currentTimeMillis();
        Deque<Long> history = sendHistory.computeIfAbsent(
                phone,
                ignored -> new ArrayDeque<>()
        );

        while (!history.isEmpty()
                && now - history.peekFirst() > RATE_WINDOW_MS) {
            history.removeFirst();
        }

        if (!history.isEmpty()
                && now - history.peekLast()
                < resendSeconds * 1000L) {

            long waitSeconds = Math.max(
                    1,
                    resendSeconds
                            - ((now - history.peekLast()) / 1000L)
            );

            throw new IllegalArgumentException(
                    "Please wait " + waitSeconds
                            + " seconds before requesting another OTP."
            );
        }

        if (history.size()
                >= MAX_SENDS_PER_WINDOW) {
            throw new IllegalArgumentException(
                    "Too many OTP requests. Try again in a few minutes."
            );
        }

        history.addLast(now);
    }

    private JsonNode sendProviderRequest(
            String url,
            boolean post) {

        try {
            HttpRequest.Builder builder =
                    HttpRequest.newBuilder()
                            .uri(URI.create(url))
                            .timeout(Duration.ofSeconds(12))
                            .header("Accept", "application/json")
                            .header("authkey", authKey);

            HttpRequest request = post
                    ? builder.POST(
                            HttpRequest.BodyPublishers.noBody()
                    ).build()
                    : builder.GET().build();

            HttpResponse<String> response =
                    httpClient.send(
                            request,
                            HttpResponse.BodyHandlers.ofString()
                    );

            if (response.statusCode() < 200
                    || response.statusCode() >= 300) {
                throw new IllegalArgumentException(
                        "Verification provider is temporarily unavailable."
                );
            }

            return objectMapper.readTree(
                    response.body()
            );

        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException(
                    "Verification provider is temporarily unavailable."
            );
        }
    }

    private boolean isSuccess(JsonNode response) {
        String type =
                response.path("type").asText("");
        String message =
                response.path("message")
                        .asText("")
                        .toLowerCase(Locale.ROOT);

        return "success".equalsIgnoreCase(type)
                || message.contains("otp_sent")
                || message.contains("sent successfully");
    }

    private String maskPhone(String phone) {
        if (phone.length() <= 6) {
            return phone;
        }

        return phone.substring(
                    0,
                    Math.min(3, phone.length())
                )
                + "••••••"
                + phone.substring(
                    phone.length() - 4
                );
    }

    private String encode(String value) {
        return URLEncoder.encode(
                value,
                StandardCharsets.UTF_8
        );
    }

    private record DemoChallenge(
            String codeHash,
            long expiresAtMs,
            int attempts) {
    }
}
