package com.flux.controller;

import com.flux.dto.ApiResponse;
import com.flux.model.User;
import com.flux.service.UserService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    @Autowired
    public UserController(UserService userService) {
        this.userService = userService;
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

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<User>> register(@Valid @RequestBody RegisterRequest request) {
        User user = userService.register(request.name, request.phone);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Registered successfully", user));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<User>> login(@Valid @RequestBody LoginRequest request) {
        User user = userService.login(request.phone);
        return ResponseEntity.ok(ApiResponse.success("Logged in successfully", user));
    }
}
