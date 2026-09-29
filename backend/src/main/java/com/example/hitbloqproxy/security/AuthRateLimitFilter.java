package com.example.hitbloqproxy.security;

import com.example.hitbloqproxy.user.UserAccountRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Locale;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public final class AuthRateLimitFilter extends OncePerRequestFilter {
    private final AuthRateLimitProperties limits;
    private final UserAccountRepository users;
    private final FixedWindowRateLimiter limiter;

    public AuthRateLimitFilter(AuthRateLimitProperties limits, UserAccountRepository users) {
        this.limits = limits;
        this.users = users;
        this.limiter = new FixedWindowRateLimiter(Duration.ofSeconds(limits.getWindowSeconds()),
                limits.getMaxBuckets(), System::nanoTime);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        // Do not trust caller-supplied Forwarded/X-Forwarded-For headers as a rate-limit identity.
        String ip = request.getRemoteAddr();
        if ("POST".equals(request.getMethod()) && "/api/auth/login".equals(path)) {
            if (deny(response, limiter.acquire("login-ip:" + ip, limits.getLoginPerIp()))) return;
            String login = request.getParameter("username");
            login = login == null ? "" : login.trim().toLowerCase(Locale.ROOT);
            String password = request.getParameter("password");
            if (login.length() > 320 || (password != null && password.length() > 128)) {
                response.sendError(HttpServletResponse.SC_BAD_REQUEST);
                return;
            }
            String identity = users.findUniqueByLogin(login)
                    .map(user -> user.getId().toString())
                    .orElseGet(() -> "unknown");
            // Unknown users share a bucket; avoid unbounded attacker-controlled login strings.
            if (deny(response, limiter.acquire("login-account:" + identity, limits.getLoginPerAccount()))) return;
        } else if ("POST".equals(request.getMethod()) && "/api/auth/register".equals(path)) {
            if (deny(response, limiter.acquire("register-ip:" + ip, limits.getRegistrationPerIp()))) return;
        } else if ("PUT".equals(request.getMethod()) && ("/api/account/password".equals(path)
                || "/api/account/email".equals(path) || "/api/account/username".equals(path))) {
            if (deny(response, limiter.acquire("change-ip:" + ip, limits.getChangesPerIp()))) return;
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.getPrincipal() instanceof AccountPrincipal principal
                    && deny(response, limiter.acquire("change-account:" + principal.getUserId(), limits.getChangesPerAccount()))) return;
        }
        chain.doFilter(request, response);
    }

    private boolean deny(HttpServletResponse response, long retryAfter) throws IOException {
        if (retryAfter == 0) return false;
        response.setHeader("Retry-After", Long.toString(retryAfter));
        response.sendError(429, "Too many attempts. Try again later.");
        return true;
    }
}
