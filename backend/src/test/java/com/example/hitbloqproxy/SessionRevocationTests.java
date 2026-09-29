package com.example.hitbloqproxy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SessionRevocationTests extends SecurityIntegrationTestSupport {
    @Test
    void passwordChangeRevokesOtherSessionsButNewLoginWorks() throws Exception {
        account("owner");
        var changingSession = login("owner");
        var otherSession = login("owner");
        mvc.perform(put("/api/account/password").session(changingSession).with(csrf())
                        .contentType("application/json")
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"New-password-456!\"}"))
                .andExpect(status().isNoContent());
        assertThat(changingSession.isInvalid()).isTrue();
        mvc.perform(get("/api/api-keys").session(otherSession)).andExpect(status().isUnauthorized());
        assertThat(otherSession.isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me").session(login("owner", "New-password-456!")))
                .andExpect(status().isOk());
    }

    @ParameterizedTest
    @CsvSource({"username,newUsername,renamed", "email,newEmail,changed@example.com"})
    void identityChangeRevokesOtherSessions(String path, String field, String value) throws Exception {
        account("owner");
        var first = login("owner");
        var second = login("owner");
        mvc.perform(put("/api/account/" + path).session(first).with(csrf()).contentType("application/json")
                        .content("{\"currentPassword\":\"" + PASSWORD + "\",\"" + field + "\":\"" + value + "\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/api-keys").session(second)).andExpect(status().isUnauthorized());
    }

    @Test
    void failedPasswordChangeDoesNotRevokeOtherSessions() throws Exception {
        account("owner");
        var first = login("owner");
        var second = login("owner");
        mvc.perform(put("/api/account/password").session(first).with(csrf()).contentType("application/json")
                        .content("{\"currentPassword\":\"wrong-password\",\"newPassword\":\"New-password-456!\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").session(second)).andExpect(status().isOk());
    }

    @Test
    void disabledAccountLosesExistingSession() throws Exception {
        var owner = account("owner");
        var session = login("owner");
        owner.setEnabled(false);
        users.saveAndFlush(owner);
        mvc.perform(get("/api/api-keys").session(session)).andExpect(status().isUnauthorized());
    }
}
