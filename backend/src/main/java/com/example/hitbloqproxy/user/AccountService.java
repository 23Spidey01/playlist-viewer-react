package com.example.hitbloqproxy.user;

import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.Locale;

@Service
public class AccountService {
    private static final int MIN_USERNAME_LENGTH = 3;
    private static final int MAX_USERNAME_LENGTH = 50;
    private final UserAccountRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AccountService(UserAccountRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void changeEmail(String currentLoginIdentifier, String currentPassword, String newEmail) {
        UserAccount user = requireUser(currentLoginIdentifier);

        verifyCurrentPassword(user, currentPassword);

        String normalizedEmail = normalizeEmail(newEmail);

        if (normalizedEmail.equalsIgnoreCase(user.getEmail())) {
            return;
        }

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email address is already in use");
        }

        user.setEmail(normalizedEmail);
    }

    @Transactional
    public void changeUsername(String currentLoginIdentifier, String currentPassword, String newUsername) {
        UserAccount user = requireUser(currentLoginIdentifier);

        verifyCurrentPassword(user, currentPassword);

        String normalizedUsername = normalizeUsername(newUsername);

        if (normalizedUsername.equalsIgnoreCase(user.getUsername())) {
            return;
        }

        if (userRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username is already in use");
        }

        user.setUsername(normalizedUsername);
    }

    @Transactional
    public void changePassword(String currentLoginIdentifier, String currentPassword, String newPassword) {
        UserAccount user = requireUser(currentLoginIdentifier);

        verifyCurrentPassword(user, currentPassword);

        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password must differ from current password");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
    }

    private UserAccount requireUser(String loginIdentifier) {
        return userRepository
            .findByUsernameIgnoreCaseOrEmailIgnoreCase(loginIdentifier, loginIdentifier)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    private void verifyCurrentPassword(UserAccount user, String password) {
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Current password is incorrect");
        }
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeUsername(String username) {
        if (username == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username must not be null");
        }

        String result = username.trim();

        if (result.length() < MIN_USERNAME_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Username must contain at least " + MIN_USERNAME_LENGTH + " characters"
            );
        }

        if (result.length() > MAX_USERNAME_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Username must not exceed " + MAX_USERNAME_LENGTH + " characters"
            );
        }

        if (!result.matches("^[A-Za-z0-9._-]+$")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Username may only contain letters, numbers, '.', '_' and '-'"
            );
        }

        return result;
    }
}
