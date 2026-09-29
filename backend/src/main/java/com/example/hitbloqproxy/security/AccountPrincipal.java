package com.example.hitbloqproxy.security;

import com.example.hitbloqproxy.user.UserAccount;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.server.ResponseStatusException;

/** The username is display/login data; only the immutable ID establishes ownership. */
public final class AccountPrincipal extends User {
    private static final long serialVersionUID = 1L;
    private final UUID userId;
    private final long sessionVersion;

    public AccountPrincipal(UserAccount account) {
        super(account.getUsername(), account.getPasswordHash(), account.isEnabled(), true, true, true,
                List.of(new SimpleGrantedAuthority("ROLE_USER")));
        this.userId = account.getId();
        this.sessionVersion = account.getSessionVersion();
    }

    public UUID getUserId() {
        return userId;
    }

    public long getSessionVersion() {
        return sessionVersion;
    }

    public static UUID requireUserId(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof AccountPrincipal principal)) {
            // Old username-only sessions must authenticate again; never migrate by looking up their name.
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return principal.getUserId();
    }
}
