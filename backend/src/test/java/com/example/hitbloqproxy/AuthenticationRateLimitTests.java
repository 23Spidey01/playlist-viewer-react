package com.example.hitbloqproxy;

import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:ratelimits;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "app.auth-rate-limit.login-per-account=2", "app.auth-rate-limit.login-per-ip=4",
        "app.auth-rate-limit.registration-per-ip=2", "app.auth-rate-limit.changes-per-account=2"
})
class AuthenticationRateLimitTests extends SecurityIntegrationTestSupport {
    @Test
    void usernameAndEmailShareAccountBudgetAcrossIps() throws Exception {
        var owner = account("limited");
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", "limited").param("password", "wrong")
                        .with(request -> { request.setRemoteAddr("192.0.2.1"); return request; }))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", owner.getEmail().toUpperCase())
                        .param("password", "wrong").with(request -> { request.setRemoteAddr("192.0.2.2"); return request; }))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", "limited").param("password", PASSWORD)
                        .with(request -> { request.setRemoteAddr("192.0.2.3"); return request; }))
                .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"));
    }

    @Test
    void spoofedForwardingHeadersDoNotBypassIpLimit() throws Exception {
        for (int i = 0; i < 5; i++) {
            String name = "ipuser" + i;
            account(name);
            mvc.perform(post("/api/auth/login").with(csrf()).param("username", name).param("password", "wrong")
                            .header("X-Forwarded-For", "198.51.100." + i)
                            .with(request -> { request.setRemoteAddr("192.0.2.10"); return request; }))
                    .andExpect(status().is(i < 4 ? 401 : 429));
        }
    }

    @Test
    void registrationsAreLimitedBeforePasswordHashing() throws Exception {
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json")
                            .content("{\"username\":\"bad\",\"password\":\"x\"}")
                            .with(request -> { request.setRemoteAddr("192.0.2.20"); return request; }))
                    .andExpect(status().is(i < 2 ? 400 : 429));
        }
    }

    @Test
    void currentPasswordGuessesShareBudgetAcrossAccountEndpoints() throws Exception {
        account("changes");
        var session = login("changes");
        for (int i = 0; i < 3; i++) {
            mvc.perform(put("/api/account/" + (i == 1 ? "username" : "password")).session(session).with(csrf())
                            .contentType("application/json")
                            .content("{\"currentPassword\":\"wrong\",\"newPassword\":\"Another-password!\",\"newUsername\":\"renamed\"}"))
                    .andExpect(status().is(i < 2 ? 401 : 429));
        }
    }
}
