package com.example.hitbloqproxy;

import com.example.hitbloqproxy.auth.RegistrationService;
import com.example.hitbloqproxy.user.AccountIdentifierSchema;
import com.example.hitbloqproxy.user.UserAccount;
import java.util.concurrent.Executors;
import java.util.concurrent.CountDownLatch;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AccountIdentifierTests extends SecurityIntegrationTestSupport {
    @Autowired RegistrationService registration;
    @Autowired AccountIdentifierSchema schema;

    @Test
    void registrationNormalizesAndRejectsCaseVariants() throws Exception {
        registration.register(" Mixed.User ", " Mixed@Example.com ", PASSWORD);
        login("MIXED.USER");
        login(" mixed@example.com ");
        mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json")
                        .content("{\"username\":\"MIXED.USER\",\"email\":\"other@example.com\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void emailShapedUsernamesAndMalformedEmailsAreRejected() {
        assertThatThrownBy(() -> registration.register("victim@example.com", "attacker@example.com", PASSWORD))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> registration.register("validuser", "not-an-email", PASSWORD))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void emailOnlySignupStillWorks() throws Exception {
        mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json")
                        .content("{\"email\":\"emailonly@example.com\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isCreated());
        var session = login("emailonly@example.com");
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk());
    }

    @Test
    void databaseRejectsCaseVariantEvenWithoutServiceValidation() {
        account("unique");
        var duplicate = new UserAccount();
        duplicate.setUsername("UNIQUE");
        duplicate.setEmail("different@example.com");
        duplicate.setPasswordHash(encoder.encode(PASSWORD));
        assertThatThrownBy(() -> users.saveAndFlush(duplicate)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void concurrentSignupsCannotCreateCaseDuplicates() throws Exception {
        var executor = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        try {
            var first = executor.submit(() -> signupAfter(start, "Concurrent", "first@example.com"));
            var second = executor.submit(() -> signupAfter(start, "concurrent", "second@example.com"));
            start.countDown();
            assertThat(first.get() + second.get()).isEqualTo(1);
            assertThat(users.findAllByLogin("concurrent")).hasSize(1);
        } finally {
            executor.shutdownNow();
        }
    }

    private int signupAfter(CountDownLatch start, String username, String email) throws Exception {
        start.await();
        try {
            registration.register(username, email, PASSWORD);
            return 1;
        } catch (DataIntegrityViolationException | ResponseStatusException expectedConflict) {
            return 0;
        }
    }

    @Test
    void legacyCrossColumnCollisionFailsClosedAndIsDetectedAtStartup() throws Exception {
        var legacy = account("legacy");
        legacy.setUsername("victim@example.com");
        users.saveAndFlush(legacy);
        account("victim");
        mvc.perform(post("/api/auth/login").with(csrf()).param("username", "victim@example.com").param("password", PASSWORD))
                .andExpect(status().isUnauthorized());
        assertThatThrownBy(() -> schema.afterPropertiesSet()).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Conflicting account identifiers");
    }

    @Test
    void emailChangeCannotClaimLegacyUsername() throws Exception {
        var legacy = account("legacy");
        legacy.setUsername("reserved@example.com");
        users.saveAndFlush(legacy);
        account("changer");
        var session = login("changer");
        mvc.perform(put("/api/account/email").session(session).with(csrf()).contentType("application/json")
                        .content("{\"newEmail\":\"RESERVED@example.com\",\"currentPassword\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isConflict());
    }
}
