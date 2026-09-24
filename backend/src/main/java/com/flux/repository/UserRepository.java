package com.flux.repository;

import com.flux.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByPhone(String phone);
    Optional<User> findFirstByPhoneIn(Collection<String> phones);
    boolean existsByPhone(String phone);
    Optional<User> findByStudentEmailIgnoreCase(String studentEmail);
}
