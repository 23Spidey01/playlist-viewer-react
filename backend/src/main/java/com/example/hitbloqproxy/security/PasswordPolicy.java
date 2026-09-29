package com.example.hitbloqproxy.security;

import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class PasswordPolicy {
    private PasswordPolicy() {}

    public static void validate(String password) {
        if (password == null || password.isBlank() || password.length() < 12 || exceedsBcryptLimit(password)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Password must contain at least 12 characters and no more than 72 UTF-8 bytes");
        }
    }

    public static boolean exceedsBcryptLimit(String password) {
        return password != null && (password.length() > 72 || password.getBytes(StandardCharsets.UTF_8).length > 72);
    }
}
