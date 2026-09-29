package com.example.hitbloqproxy;

import org.junit.jupiter.api.Test;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AccountIdentityTests extends SecurityIntegrationTestSupport {
    @Test
    void oldSessionNeverResolvesToNewOwnerOfUsername() throws Exception {
        var original = account("original");
        var session = login("original");
        keyService.create(original.getId(), "pool", "original-secret");
        // Simulate a rename from another session, then reuse of the old login.
        original.setUsername("renamed");
        users.saveAndFlush(original);
        var replacement = account("replacement");
        replacement.setUsername("original");
        users.saveAndFlush(replacement);
        var replacementKey = keyService.create(replacement.getId(), "pool", "replacement-secret");

        mvc.perform(get("/api/api-keys").param("pool", "pool").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].apiKey").value("original-secret"))
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(delete("/api/api-keys/" + replacementKey.id()).session(session).with(csrf()))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/auth/me").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.username").value("renamed"));
    }

    @Test
    void usernameOnlyLegacyPrincipalMustAuthenticateAgain() throws Exception {
        account("legacy");
        mvc.perform(get("/api/api-keys").with(user("legacy")))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").with(user("legacy")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deletedAccountSessionCannotAccessReplacement() throws Exception {
        var original = account("reused");
        var session = login("reused");
        users.delete(original);
        account("reused");
        mvc.perform(get("/api/api-keys").session(session)).andExpect(status().isUnauthorized());
    }
}
