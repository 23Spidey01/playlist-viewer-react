package com.example.hitbloqproxy.auth;

import com.example.hitbloqproxy.user.UserAccount;
import com.example.hitbloqproxy.user.UserAccountRepository;
import com.example.hitbloqproxy.security.PasswordPolicy;
import com.example.hitbloqproxy.user.AccountIdentifiers;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class RegistrationService {
    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AccountIdentifiers identifiers;

    public RegistrationService(UserAccountRepository users, PasswordEncoder passwordEncoder, AccountIdentifiers identifiers) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.identifiers = identifiers;
    }

    @Transactional
    public UserAccount register(String username, String email, String password) {
        PasswordPolicy.validate(password);
        String normalizedEmail = identifiers.email(email);
        // Preserve email-only signup without placing an email in the username namespace.
        String normalizedUsername = identifiers.username(
                (username == null || username.isBlank()) && normalizedEmail != null
                        ? "user_" + UUID.randomUUID().toString().replace("-", "") : username);
        identifiers.requireAvailable(normalizedUsername, null);
        identifiers.requireAvailable(normalizedEmail, null);

        UserAccount user = new UserAccount();

        user.setUsername(normalizedUsername);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setEnabled(true);
        user.setEmail(normalizedEmail);

        return users.saveAndFlush(user);
    }

    public void registerOnlyEmail(String email, String password) {
        register(null, email, password);
    }

    public void registerOnlyUsername(String username, String password) {
        register(username, null, password);
    }
}
