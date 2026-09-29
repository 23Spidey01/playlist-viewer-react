package com.example.hitbloqproxy;

import com.example.hitbloqproxy.auth.RegistrationService;
import com.example.hitbloqproxy.security.PasswordPolicy;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class BcryptBoundaryTests extends SecurityIntegrationTestSupport {
    @Autowired RegistrationService registration;

    @Test
    void patchedEncoderDoesNotMatchAnAddedSuffix() {
        String prefix = "A".repeat(72);
        String hash = encoder.encode(prefix);
        assertThat(encoder.matches(prefix, hash)).isTrue();
        assertThat(encoder.matches(prefix + "different", hash)).isFalse();
    }

    @Test
    void utf8ByteLimitAppliesToRegistrationAndPasswordChange() throws Exception {
        String boundary = "é".repeat(36);
        assertThatCode(() -> PasswordPolicy.validate(boundary)).doesNotThrowAnyException();
        assertThatThrownBy(() -> PasswordPolicy.validate(boundary + "é"))
                .isInstanceOf(ResponseStatusException.class);
        registration.register("boundary", "boundary@example.com", boundary);
        var session = login("boundary", boundary);
        mvc.perform(put("/api/account/password").session(session).with(csrf()).contentType("application/json")
                        .content("{\"currentPassword\":\"" + boundary + "\",\"newPassword\":\"" + boundary + "é\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void overlongLoginCannotAuthenticateWithMatchingPrefix() throws Exception {
        String prefix = "A".repeat(72);
        registration.register("longlogin", "longlogin@example.com", prefix);
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", "longlogin")
                        .param("password", prefix + "suffix"))
                .andExpect(status().isBadRequest());
        login("longlogin", prefix);
    }
}
