package com.example.hitbloqproxy.user;

import com.example.hitbloqproxy.security.PasswordPolicy;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@Service
public class AccountService {

    private final UserAccountRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AccountIdentifiers identifiers;

    public AccountService(UserAccountRepository userRepository, PasswordEncoder passwordEncoder, AccountIdentifiers identifiers) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.identifiers = identifiers;
    }

    @Transactional
    public void changeEmail(UUID userId, String currentPassword, String newEmail) {
        UserAccount user = requireUser(userId);

        verifyCurrentPassword(user, currentPassword);

        String normalizedEmail = identifiers.email(newEmail);
        if (normalizedEmail == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email must not be empty");
        }

        if (normalizedEmail.equalsIgnoreCase(user.getEmail())) {
            return;
        }

        identifiers.requireAvailable(normalizedEmail, userId);

        user.setEmail(normalizedEmail);
        user.setSessionVersion(user.getSessionVersion() + 1);
    }

    @Transactional
    public void changeUsername(UUID userId, String currentPassword, String newUsername) {
        UserAccount user = requireUser(userId);

        verifyCurrentPassword(user, currentPassword);

        String normalizedUsername = identifiers.username(newUsername);

        if (normalizedUsername.equalsIgnoreCase(user.getUsername())) {
            return;
        }

        identifiers.requireAvailable(normalizedUsername, userId);

        user.setUsername(normalizedUsername);
        user.setSessionVersion(user.getSessionVersion() + 1);
    }

    @Transactional
    public void changePassword(UUID userId, String currentPassword, String newPassword) {
        PasswordPolicy.validate(newPassword);
        UserAccount user = requireUser(userId);

        verifyCurrentPassword(user, currentPassword);

        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "New password must differ from current password");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setSessionVersion(user.getSessionVersion() + 1);
    }

    private UserAccount requireUser(UUID userId) {
        return userRepository
            .findLockedById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    private void verifyCurrentPassword(UserAccount user, String password) {
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Current password is incorrect");
        }
    }

}
