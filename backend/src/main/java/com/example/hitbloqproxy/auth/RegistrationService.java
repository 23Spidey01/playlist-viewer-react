package com.example.hitbloqproxy.auth;

import com.example.hitbloqproxy.user.UserAccount;
import com.example.hitbloqproxy.user.UserAccountRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class RegistrationService {
    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;

    public RegistrationService(UserAccountRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    public void register(String username, String email, String password) {
        // findByUsernameIgnoreCaseOrEmailIgnoreCase's generated query
        // turns a null email parameter into "email IS NULL" (Spring
        // Data JPA's standard null-parameter handling for a derived
        // query), not "skip this condition" — so once any user has
        // registered without an email, every later no-email
        // registration matches THAT row's null email and gets
        // rejected as a duplicate, regardless of username. Only
        // include the email side of the check when an email was
        // actually given.
        boolean duplicate =
                email != null && !email.isBlank()
                        ? users.findByUsernameIgnoreCaseOrEmailIgnoreCase(username, email).isPresent()
                        : users.findByUsernameIgnoreCase(username).isPresent();

        if (duplicate) {
            throw new IllegalArgumentException("Username or email already registered");
        }

        UserAccount user = new UserAccount();

        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setEnabled(true);
        if (email != null) {
            user.setEmail(email.trim().toLowerCase());
        }

        users.save(user);
    }

    public void registerOnlyEmail(String email, String password) {
        register(email, email, password);
    }

    public void registerOnlyUsername(String username, String password) {
        register(username, null, password);
    }
}
