package com.example.hitbloqproxy.user;

import jakarta.validation.Validator;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class AccountIdentifiers {
    private final Validator validator;
    private final UserAccountRepository users;

    public AccountIdentifiers(Validator validator, UserAccountRepository users) {
        this.validator = validator;
        this.users = users;
    }

    public static String normalizeLogin(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    public String username(String value) {
        String normalized = normalizeLogin(value);
        if (!normalized.matches("[a-z0-9._-]{3,50}")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Username must contain 3 to 50 letters, numbers, '.', '_' or '-'");
        }
        return normalized;
    }

    public String email(String value) {
        if (value == null || value.isBlank()) return null;
        String normalized = normalizeLogin(value);
        if (!normalized.contains("@") || !validator.validate(new EmailAddress(normalized)).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid email address");
        }
        return normalized;
    }

    public void requireAvailable(String identifier, UUID currentUserId) {
        if (identifier != null && users.findAllByLogin(identifier).stream()
                .anyMatch(user -> !user.getId().equals(currentUserId))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username or email already registered");
        }
    }

    private record EmailAddress(@NotBlank @Email @Size(max = 320) String value) {}
}
