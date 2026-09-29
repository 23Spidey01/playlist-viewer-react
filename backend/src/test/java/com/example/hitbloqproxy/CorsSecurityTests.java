package com.example.hitbloqproxy;

import org.junit.jupiter.api.Test;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CorsSecurityTests extends SecurityIntegrationTestSupport {
    @Test
    void untrustedOriginCannotReadPlaintextKeysOrCsrfToken() throws Exception {
        var owner = account("corsowner");
        var session = login("corsowner");
        keyService.create(owner.getId(), "pool", "secret");
        mvc.perform(get("/api/api-keys").param("pool", "pool").session(session)
                        .header("Origin", "https://attacker.example.com"))
                .andExpect(status().isForbidden()).andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
        mvc.perform(get("/api/auth/csrf").session(session).header("Origin", "https://attacker.example.com"))
                .andExpect(status().isForbidden());
    }

    @Test
    void onlyExactTrustedOriginReceivesCredentialedPreflight() throws Exception {
        mvc.perform(options("/api/auth/login").header("Origin", "https://frontend.example.com")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type,x-csrf-token"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://frontend.example.com"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
        mvc.perform(options("/api/auth/login").header("Origin", "https://frontend.example.com.attacker.invalid")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }

    @Test
    void trustedOriginAndSameOriginCanStillReadKeys() throws Exception {
        var owner = account("corsowner");
        var session = login("corsowner");
        keyService.create(owner.getId(), "pool", "intended-plaintext-key");
        mvc.perform(get("/api/api-keys").param("pool", "pool").session(session)
                        .header("Origin", "https://frontend.example.com"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].apiKey").value("intended-plaintext-key"));
        mvc.perform(get("/api/api-keys").param("pool", "pool").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].apiKey").value("intended-plaintext-key"));
    }
}
