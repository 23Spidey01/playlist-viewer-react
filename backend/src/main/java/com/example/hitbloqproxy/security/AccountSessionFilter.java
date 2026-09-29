package com.example.hitbloqproxy.security;

import com.example.hitbloqproxy.user.UserAccountRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.filter.OncePerRequestFilter;

/** Check persisted revocation state, including sessions on other application instances. */
public final class AccountSessionFilter extends OncePerRequestFilter {
    private final UserAccountRepository users;

    public AccountSessionFilter(UserAccountRepository users) {
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            boolean valid = authentication.getPrincipal() instanceof AccountPrincipal principal
                    && users.findById(principal.getUserId())
                    .filter(user -> user.isEnabled() && user.getSessionVersion() == principal.getSessionVersion())
                    .isPresent();
            if (!valid) {
                new SecurityContextLogoutHandler().logout(request, response, authentication);
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
