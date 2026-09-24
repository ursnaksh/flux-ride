package com.flux.service;

import com.flux.dto.StudentVerificationRequestResponse;
import com.flux.exception.ResourceNotFoundException;
import com.flux.model.StudentEmailVerification;
import com.flux.model.User;
import com.flux.repository.StudentEmailVerificationRepository;
import com.flux.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Locale;

@Service
public class StudentVerificationService {

    private static final int CODE_LENGTH = 6;
    private static final int MAX_VERIFY_ATTEMPTS = 5;

    private final StudentEmailVerificationRepository verificationRepository;
    private final UserRepository userRepository;
    private final JavaMailSender mailSender;
    private final SecureRandom random = new SecureRandom();

    @Value("${student.verification.enabled:true}")
    private boolean enabled;

    @Value("${student.verification.domain:vit.edu}")
    private String allowedDomain;

    @Value("${student.verification.code-secret}")
    private String codeSecret;

    @Value("${student.verification.expiry-minutes:10}")
    private int expiryMinutes;

    @Value("${student.verification.resend-seconds:60}")
    private int resendSeconds;

    @Value("${spring.mail.host:}")
    private String smtpHost;

    @Value("${spring.mail.username:}")
    private String smtpUsername;

    @Value("${spring.mail.password:}")
    private String smtpPassword;

    @Value("${student.verification.from:}")
    private String fromAddress;

    public StudentVerificationService(
            StudentEmailVerificationRepository verificationRepository,
            UserRepository userRepository,
            JavaMailSender mailSender) {
        this.verificationRepository = verificationRepository;
        this.userRepository = userRepository;
        this.mailSender = mailSender;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public boolean isAvailable() {
        return enabled
                && smtpHost != null && !smtpHost.isBlank()
                && smtpUsername != null && !smtpUsername.isBlank()
                && smtpPassword != null && !smtpPassword.isBlank()
                && fromAddress != null && !fromAddress.isBlank();
    }

    public String getAllowedDomain() {
        return allowedDomain == null || allowedDomain.isBlank()
                ? "vit.edu"
                : allowedDomain.trim().toLowerCase(Locale.ROOT);
    }

    public int getCodeLength() {
        return CODE_LENGTH;
    }

    public int getExpirySeconds() {
        return Math.max(1, expiryMinutes) * 60;
    }

    public int getResendSeconds() {
        return Math.max(15, resendSeconds);
    }

    public String normalizeStudentEmail(String rawEmail) {
        if (rawEmail == null || rawEmail.isBlank()) {
            throw new IllegalArgumentException(
                    "Enter your VIT email address."
            );
        }

        String email = rawEmail.trim().toLowerCase(Locale.ROOT);
        int at = email.lastIndexOf('@');

        if (at <= 0 || at == email.length() - 1
                || email.contains(" ")
                || !email.substring(at + 1).equals(getAllowedDomain())) {
            throw new IllegalArgumentException(
                    "Use your @" + getAllowedDomain() + " student email."
            );
        }

        return email;
    }

    @Transactional
    public StudentVerificationRequestResponse requestCode(
            Long userId,
            String rawEmail) {

        ensureAvailable();

        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "User not found: " + userId
                        )
                );

        String email = normalizeStudentEmail(rawEmail);

        if (user.isStudentVerified()
                && email.equalsIgnoreCase(user.getStudentEmail())) {
            throw new IllegalArgumentException(
                    "This VIT email is already verified."
            );
        }

        userRepository.findByStudentEmailIgnoreCase(email)
                .filter(existing -> !existing.getId().equals(userId))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException(
                            "This VIT email is already linked to another FLUX account."
                    );
                });

        LocalDateTime now = LocalDateTime.now();

        StudentEmailVerification verification =
                verificationRepository.findByUserId(userId)
                        .orElseGet(StudentEmailVerification::new);

        if (verification.getLastSentAt() != null) {
            long secondsSinceLastSend =
                    Duration.between(
                            verification.getLastSentAt(),
                            now
                    ).getSeconds();

            if (secondsSinceLastSend < getResendSeconds()) {
                long wait = getResendSeconds() - secondsSinceLastSend;
                throw new IllegalArgumentException(
                        "Please wait " + wait
                                + " seconds before requesting another code."
                );
            }
        }

        String code = String.format(
                "%06d",
                random.nextInt(1_000_000)
        );

        verification.setUserId(userId);
        verification.setEmail(email);
        verification.setCodeHash(hashCode(userId, email, code));
        verification.setExpiresAt(
                now.plusMinutes(Math.max(1, expiryMinutes))
        );
        verification.setLastSentAt(now);
        verification.setAttempts(0);

        verificationRepository.save(verification);

        try {
            sendVerificationEmail(user, email, code);
        } catch (RuntimeException ex) {
            verificationRepository.delete(verification);
            throw ex;
        }

        return new StudentVerificationRequestResponse(
                maskEmail(email),
                getExpirySeconds(),
                getResendSeconds()
        );
    }

    @Transactional
    public User verifyCode(
            Long userId,
            String rawEmail,
            String rawCode) {

        String email = normalizeStudentEmail(rawEmail);
        String code = rawCode == null ? "" : rawCode.trim();

        if (!code.matches("\\d{" + CODE_LENGTH + "}")) {
            throw new IllegalArgumentException(
                    "Enter the " + CODE_LENGTH
                            + "-digit verification code."
            );
        }

        StudentEmailVerification verification =
                verificationRepository.findByUserId(userId)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Request a verification code first."
                                )
                        );

        if (!email.equalsIgnoreCase(verification.getEmail())) {
            throw new IllegalArgumentException(
                    "This code was sent to a different email address."
            );
        }

        if (verification.getExpiresAt() == null
                || verification.getExpiresAt()
                        .isBefore(LocalDateTime.now())) {
            verificationRepository.delete(verification);
            throw new IllegalArgumentException(
                    "That code has expired. Request a new one."
            );
        }

        int attempts = verification.getAttempts() == null
                ? 0
                : verification.getAttempts();

        if (attempts >= MAX_VERIFY_ATTEMPTS) {
            verificationRepository.delete(verification);
            throw new IllegalArgumentException(
                    "Too many incorrect attempts. Request a new code."
            );
        }

        String suppliedHash = hashCode(userId, email, code);

        boolean matches = MessageDigest.isEqual(
                verification.getCodeHash()
                        .getBytes(StandardCharsets.UTF_8),
                suppliedHash.getBytes(StandardCharsets.UTF_8)
        );

        if (!matches) {
            verification.setAttempts(attempts + 1);
            verificationRepository.save(verification);
            throw new IllegalArgumentException(
                    "That verification code is incorrect."
            );
        }

        userRepository.findByStudentEmailIgnoreCase(email)
                .filter(existing -> !existing.getId().equals(userId))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException(
                            "This VIT email is already linked to another FLUX account."
                    );
                });

        User user = userRepository.findById(userId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "User not found: " + userId
                        )
                );

        user.setStudentEmail(email);
        user.setStudentVerified(true);
        user.setStudentVerifiedAt(LocalDateTime.now());

        User saved = userRepository.save(user);
        verificationRepository.delete(verification);
        return saved;
    }

    private void ensureAvailable() {
        if (!enabled) {
            throw new IllegalArgumentException(
                    "Student verification is not enabled."
            );
        }

        if (!isAvailable()) {
            throw new IllegalArgumentException(
                    "Student email delivery is not connected yet."
            );
        }
    }

    private void sendVerificationEmail(
            User user,
            String email,
            String code) {

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(email);
            message.setSubject("Your FLUX RIDE student verification code");
            message.setText(
                    "Hi " + user.getName() + ",\n\n"
                            + "Your FLUX RIDE VIT student verification code is: "
                            + code
                            + "\n\nThis code expires in "
                            + Math.max(1, expiryMinutes)
                            + " minutes.\n\n"
                            + "If you did not request this, you can ignore this email.\n\n"
                            + "Team FLUX"
            );
            mailSender.send(message);
        } catch (Exception ex) {
            throw new IllegalArgumentException(
                    "We could not send the student verification email. Try again shortly."
            );
        }
    }

    private String hashCode(
            Long userId,
            String email,
            String code) {

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                    codeSecret.getBytes(StandardCharsets.UTF_8),
                    "HmacSHA256"
            ));

            byte[] digest = mac.doFinal(
                    (userId + "|" + email + "|" + code)
                            .getBytes(StandardCharsets.UTF_8)
            );

            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException(
                    "Could not secure verification code",
                    ex
            );
        }
    }

    private String maskEmail(String email) {
        int at = email.indexOf('@');
        String local = email.substring(0, at);
        String domain = email.substring(at + 1);

        String visible = local.length() <= 2
                ? local.substring(0, 1)
                : local.substring(0, 2);

        return visible + "••••@" + domain;
    }
}
