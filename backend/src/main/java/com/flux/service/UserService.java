package com.flux.service;

import com.flux.exception.ResourceNotFoundException;
import com.flux.model.User;
import com.flux.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

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
                        "No account found for phone " + phone + ". Please register first."));
    }

    public User getById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + id));
    }
}
