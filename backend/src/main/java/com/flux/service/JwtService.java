package com.flux.service;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.auth0.jwt.interfaces.JWTVerifier;
import com.flux.model.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

@Service
public class JwtService {

    private final Algorithm algorithm;
    private final JWTVerifier verifier;
    private final long ttlHours;

    public JwtService(
            @Value("${auth.jwt.secret}") String secret,
            @Value("${auth.jwt.ttl-hours:168}") long ttlHours) {

        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException(
                    "JWT secret must be at least 32 characters long"
            );
        }

        this.algorithm = Algorithm.HMAC256(secret);
        this.verifier = JWT.require(algorithm)
                .withIssuer("flux-ride")
                .build();
        this.ttlHours = Math.max(1, ttlHours);
    }

    public TokenResult issue(User user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(ttlHours, ChronoUnit.HOURS);

        String token = JWT.create()
                .withIssuer("flux-ride")
                .withSubject(String.valueOf(user.getId()))
                .withClaim("name", user.getName())
                .withIssuedAt(Date.from(now))
                .withExpiresAt(Date.from(expiresAt))
                .sign(algorithm);

        return new TokenResult(
                token,
                expiresAt.getEpochSecond()
        );
    }

    public AuthenticatedIdentity verify(String token) {
        DecodedJWT decoded = verifier.verify(token);

        Long userId;
        try {
            userId = Long.valueOf(decoded.getSubject());
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid authentication token");
        }

        return new AuthenticatedIdentity(
                userId,
                decoded.getClaim("name").asString()
        );
    }

    public record TokenResult(
            String token,
            long expiresAtEpochSeconds) {
    }

    public record AuthenticatedIdentity(
            Long userId,
            String name) {
    }
}
