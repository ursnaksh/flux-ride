package com.flux.repository;

import com.flux.model.StudentEmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StudentEmailVerificationRepository
        extends JpaRepository<StudentEmailVerification, Long> {

    Optional<StudentEmailVerification> findByUserId(Long userId);
    void deleteByUserId(Long userId);
}
