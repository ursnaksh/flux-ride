package com.flux.service;

import com.flux.exception.ResourceNotFoundException;
import com.flux.model.User;
import com.flux.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

@Service
public class UserService {

    private final UserRepository userRepository;

    @Autowired
    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Registers a new user. If the phone number already exists we simply log
     * the existing user in instead of throwing - this keeps the demo flow
     * friction-free (no "user already exists" dead end) while still being a
     * real, deliberate behaviour rather than a workaround.
     */
    public User register(String name, String phone) {
        return userRepository.findByPhone(phone)
                .orElseGet(() -> userRepository.save(new User(name.trim(), phone.trim())));
    }

    public User login(String phone) {
        return userRepository.findByPhone(phone.trim())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No account found for this phone. Please register first."));
    }

    public Optional<User> findByAnyPhone(String canonicalPhone) {
        Set<String> variants = new LinkedHashSet<>();
        variants.add(canonicalPhone);

        String digits = canonicalPhone.startsWith("+")
                ? canonicalPhone.substring(1)
                : canonicalPhone;
        variants.add(digits);

        if (digits.startsWith("91") && digits.length() == 12) {
            variants.add(digits.substring(2));
        }

        return userRepository.findFirstByPhoneIn(variants);
    }

    public boolean existsByAnyPhone(String canonicalPhone) {
        return findByAnyPhone(canonicalPhone).isPresent();
    }

    public User registerVerified(String name, String canonicalPhone) {
        if (name == null || name.trim().length() < 2) {
            throw new IllegalArgumentException("Please enter your name.");
        }

        User user = findByAnyPhone(canonicalPhone)
                .orElseGet(() -> userRepository.save(
                        new User(name.trim(), canonicalPhone)
                ));

        return markPhoneVerified(user);
    }

    public User loginVerified(String canonicalPhone) {
        User user = findByAnyPhone(canonicalPhone)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No account found for this phone. Please register first."
                ));

        return markPhoneVerified(user);
    }

    public User markPhoneVerified(User user) {
        user.setPhoneVerified(true);
        user.setPhoneVerifiedAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    public User getById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
    }
}
