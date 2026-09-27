package com.example.hitbloqproxy.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class RegistrationController {
    private final RegistrationService registrationService;

    public RegistrationController(RegistrationService registrationService) {
        this.registrationService = registrationService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        if (request.email() == null || request.email().isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Email must not be empty"));
        }

        if (request.password() == null || request.password().isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponse("Password must not be empty"));
        }

        try {
            registrationService.register(request.email(), request.password());

            return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(new RegisterResponse("User registered successfully"));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(exception.getMessage()));
        }
    }

    public record RegisterRequest(String email, String password) {}

    public record RegisterResponse(String message) {}

    public record ErrorResponse(String message) {}
}
