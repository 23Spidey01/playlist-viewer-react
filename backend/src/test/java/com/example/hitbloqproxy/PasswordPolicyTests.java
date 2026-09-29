package com.example.hitbloqproxy;

import com.example.hitbloqproxy.auth.RegistrationService;
import com.example.hitbloqproxy.user.AccountService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PasswordPolicyTests extends SecurityIntegrationTestSupport {
    @Autowired RegistrationService registration;
    @Autowired AccountService accounts;

    @Test
    void registrationRejectsWeakPasswordAndAcceptsValidPassword() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json")
                        .content("{\"username\":\"newuser\",\"email\":\"new@example.com\",\"password\":\"x\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json")
                        .content("{\"username\":\"newuser\",\"email\":\"new@example.com\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isCreated());
        login("newuser");
    }

    @Test
    void policyAlsoAppliesToServiceCallers() {
        var owner = account("policyowner");
        assertThatThrownBy(() -> registration.register("weak", "weak@example.com", "x"))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> accounts.changePassword(owner.getId(), PASSWORD, "x"))
                .isInstanceOf(ResponseStatusException.class);
    }
}
