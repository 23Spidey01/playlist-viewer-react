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
        if (users.findByUsernameIgnoreCaseOrEmailIgnoreCase(username, email).isPresent()) {
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
