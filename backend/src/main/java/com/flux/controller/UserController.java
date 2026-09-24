package com.flux.controller;

import com.flux.dto.ApiResponse;
import com.flux.dto.AuthResponse;
import com.flux.dto.OtpRequestResponse;
import com.flux.dto.StudentVerificationRequestResponse;
import com.flux.model.User;
import com.flux.security.AuthContext;
import com.flux.service.JwtService;
import com.flux.service.PhoneOtpService;
import com.flux.service.StudentVerificationService;
import com.flux.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final PhoneOtpService phoneOtpService;
    private final JwtService jwtService;
    private final StudentVerificationService studentVerificationService;

    @Autowired
    public UserController(
            UserService userService,
            PhoneOtpService phoneOtpService,
            JwtService jwtService,
            StudentVerificationService studentVerificationService) {
        this.userService = userService;
        this.phoneOtpService = phoneOtpService;
        this.jwtService = jwtService;
        this.studentVerificationService = studentVerificationService;
    }

    public static class RegisterRequest {
        @NotBlank(message = "name is required")
        public String name;

        @NotBlank(message = "phone is required")
        public String phone;
    }

    public static class LoginRequest {
        @NotBlank(message = "phone is required")
        public String phone;
    }

    public static class OtpStartRequest {
        public String name;

        @NotBlank(message = "phone is required")
        public String phone;

        @NotBlank(message = "purpose is required")
        public String purpose;
    }

    public static class OtpVerifyRequest {
        public String name;

        @NotBlank(message = "phone is required")
        public String phone;

        @NotBlank(message = "purpose is required")
        public String purpose;

        @NotBlank(message = "otp is required")
        @Pattern(regexp = "\\d{6}", message = "otp must be 6 digits")
        public String otp;
    }

    public static class StudentEmailRequest {
        @NotBlank(message = "email is required")
        public String email;
    }

    public static class StudentEmailVerifyRequest {
        @NotBlank(message = "email is required")
        public String email;

        @NotBlank(message = "code is required")
        @Pattern(regexp = "\\d{6}", message = "code must be 6 digits")
        public String code;
    }

    private enum AuthPurpose {
        REGISTER,
        LOGIN
    }

    @GetMapping("/auth-config")
    public ResponseEntity<ApiResponse<Map<String, Object>>> authConfig() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("otpRequired", phoneOtpService.isRequired());
        config.put("otpAvailable", phoneOtpService.isAvailable());
        config.put("channel", "sms");
        config.put("codeLength", phoneOtpService.getOtpLength());
        config.put("resendAfterSeconds", phoneOtpService.getResendSeconds());
        config.put("expiresInSeconds", phoneOtpService.getExpirySeconds());
        config.put("session", "jwt");

        return ResponseEntity.ok(
                ApiResponse.success("Auth configuration fetched", config)
        );
    }

    @PostMapping("/otp/request")
    public ResponseEntity<ApiResponse<OtpRequestResponse>> requestOtp(
            @Valid @RequestBody OtpStartRequest request) {

        AuthPurpose purpose = parsePurpose(request.purpose);
        String canonicalPhone =
                phoneOtpService.normalizePhone(request.phone);

        if (purpose == AuthPurpose.LOGIN
                && !userService.existsByAnyPhone(canonicalPhone)) {
            throw new com.flux.exception.ResourceNotFoundException(
                    "No account found for this phone. Please create an account first."
            );
        }

        if (purpose == AuthPurpose.REGISTER
                && (request.name == null
                || request.name.trim().length() < 2)) {
            throw new IllegalArgumentException(
                    "Please enter your name."
            );
        }

        OtpRequestResponse result =
                phoneOtpService.requestOtp(canonicalPhone);

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Verification code sent",
                        result
                )
        );
    }

    @PostMapping("/otp/verify")
    public ResponseEntity<ApiResponse<AuthResponse>> verifyOtp(
            @Valid @RequestBody OtpVerifyRequest request) {

        AuthPurpose purpose = parsePurpose(request.purpose);
        String canonicalPhone =
                phoneOtpService.normalizePhone(request.phone);

        phoneOtpService.verifyOtp(
                canonicalPhone,
                request.otp
        );

        User user = purpose == AuthPurpose.REGISTER
                ? userService.registerVerified(
                        request.name,
                        canonicalPhone
                )
                : userService.loginVerified(
                        canonicalPhone
                );

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Phone verified successfully",
                        authResponse(user)
                )
        );
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(
            @Valid @RequestBody RegisterRequest request) {

        if (phoneOtpService.isRequired()) {
            throw new IllegalArgumentException(
                    "Phone verification is required. Request an OTP first."
            );
        }

        User user =
                userService.register(
                        request.name,
                        request.phone
                );

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(
                        "Registered successfully",
                        authResponse(user)
                ));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(
            @Valid @RequestBody LoginRequest request) {

        if (phoneOtpService.isRequired()) {
            throw new IllegalArgumentException(
                    "Phone verification is required. Request an OTP first."
            );
        }

        User user = userService.login(request.phone);

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Logged in successfully",
                        authResponse(user)
                )
        );
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<User>> me(
            HttpServletRequest request) {

        User user = userService.getById(
                AuthContext.requireUserId(request)
        );

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Current user fetched",
                        user
                )
        );
    }

    @GetMapping("/student-verification/config")
    public ResponseEntity<ApiResponse<Map<String, Object>>> studentConfig() {

        Map<String, Object> config = new LinkedHashMap<>();
        config.put(
                "enabled",
                studentVerificationService.isEnabled()
        );
        config.put(
                "available",
                studentVerificationService.isAvailable()
        );
        config.put(
                "domain",
                studentVerificationService.getAllowedDomain()
        );
        config.put(
                "codeLength",
                studentVerificationService.getCodeLength()
        );
        config.put(
                "expiresInSeconds",
                studentVerificationService.getExpirySeconds()
        );
        config.put(
                "resendAfterSeconds",
                studentVerificationService.getResendSeconds()
        );

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Student verification configuration fetched",
                        config
                )
        );
    }

    @PostMapping("/student-verification/request")
    public ResponseEntity<ApiResponse<StudentVerificationRequestResponse>>
            requestStudentVerification(
                    HttpServletRequest httpRequest,
                    @Valid @RequestBody StudentEmailRequest request) {

        Long userId = AuthContext.requireUserId(httpRequest);

        StudentVerificationRequestResponse result =
                studentVerificationService.requestCode(
                        userId,
                        request.email
                );

        return ResponseEntity.ok(
                ApiResponse.success(
                        "Verification code sent to your VIT email",
                        result
                )
        );
    }

    @PostMapping("/student-verification/verify")
    public ResponseEntity<ApiResponse<User>> verifyStudentEmail(
            HttpServletRequest httpRequest,
            @Valid @RequestBody StudentEmailVerifyRequest request) {

        Long userId = AuthContext.requireUserId(httpRequest);

        User user = studentVerificationService.verifyCode(
                userId,
                request.email,
                request.code
        );

        return ResponseEntity.ok(
                ApiResponse.success(
                        "VIT student email verified",
                        user
                )
        );
    }

    private AuthResponse authResponse(User user) {
        JwtService.TokenResult token = jwtService.issue(user);

        return new AuthResponse(
                user,
                token.token(),
                token.expiresAtEpochSeconds()
        );
    }

    private AuthPurpose parsePurpose(String rawPurpose) {
        try {
            return AuthPurpose.valueOf(
                    rawPurpose.trim().toUpperCase(Locale.ROOT)
            );
        } catch (Exception ex) {
            throw new IllegalArgumentException(
                    "purpose must be REGISTER or LOGIN"
            );
        }
    }
}
