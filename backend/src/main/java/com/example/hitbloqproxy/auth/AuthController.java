package com.example.hitbloqproxy.auth;

import com.example.hitbloqproxy.security.AccountPrincipal;
import com.example.hitbloqproxy.user.UserAccountRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuthController {
    private final UserAccountRepository users;

    public AuthController(UserAccountRepository users) {
        this.users = users;
    }

    @GetMapping("/api/auth/me")
    public CurrentUserResponse me(Authentication authentication) {
        var user = users.findById(AccountPrincipal.requireUserId(authentication))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        return new CurrentUserResponse(user.getUsername());
    }

    public record CurrentUserResponse(String username) {}
}
