package com.example.hitbloqproxy;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:keylimits;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "app.api-keys.max-per-user=3", "app.api-keys.max-key-bytes=32", "app.api-keys.max-request-bytes=1024"
})
class ApiKeyLimitTests extends SecurityIntegrationTestSupport {
    @Test
    void createAndUpdateEnforceUtf8KeyByteLimit() throws Exception {
        var owner = account("keyowner");
        var session = login("keyowner");
        var key = keyService.create(owner.getId(), "pool", "é".repeat(16));
        mvc.perform(post("/api/api-keys").session(session).with(csrf()).contentType("application/json")
                        .content("{\"pool\":\"pool\",\"apiKey\":\"" + "é".repeat(17) + "\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/api-keys/" + key.id()).session(session).with(csrf()).contentType("application/json")
                        .content("{\"pool\":\"pool\",\"apiKey\":\"" + "x".repeat(33) + "\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/api-keys").param("pool", "pool").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].apiKey").value("é".repeat(16)));
    }

    @Test
    void oversizedRequestIsRejectedBeforeJsonBinding() throws Exception {
        account("bodyowner");
        var session = login("bodyowner");
        mvc.perform(post("/api/api-keys").session(session).with(csrf()).contentType("application/json")
                        .content("{\"pool\":\"pool\",\"apiKey\":\"key\",\"ignored\":\"" + "x".repeat(1024) + "\"}"))
                .andExpect(status().is(413));
        assertThat(keys.count()).isZero();
    }

    @Test
    void atQuotaExistingKeysCanBeUpdatedAndDeletedAndOtherUsersAreIndependent() {
        var owner = account("quotaowner");
        var other = account("otherowner");
        var first = keyService.create(owner.getId(), "pool", "one");
        keyService.create(owner.getId(), "pool", "two");
        keyService.create(owner.getId(), "pool", "three");
        assertThatThrownBy(() -> keyService.create(owner.getId(), "pool", "four"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        error -> assertThat(error.getStatusCode().value()).isEqualTo(409));
        keyService.update(owner.getId(), first.id(), "pool", "updated");
        keyService.create(other.getId(), "pool", "independent");
        keyService.delete(owner.getId(), first.id());
        keyService.create(owner.getId(), "pool", "replacement");
        assertThat(keys.countByUser_Id(owner.getId())).isEqualTo(3);
    }

    @Test
    void concurrentCreatesCannotOverrunQuota() throws Exception {
        var owner = account("parallelowner");
        keyService.create(owner.getId(), "pool", "one");
        keyService.create(owner.getId(), "pool", "two");
        var executor = Executors.newFixedThreadPool(6);
        var start = new CountDownLatch(1);
        try {
            var attempts = IntStream.range(0, 6).mapToObj(i -> executor.submit(() -> {
                start.await();
                try {
                    keyService.create(owner.getId(), "pool", "concurrent" + i);
                    return 1;
                } catch (ResponseStatusException quota) {
                    assertThat(quota.getStatusCode().value()).isEqualTo(409);
                    return 0;
                }
            })).toList();
            start.countDown();
            int created = 0;
            for (var attempt : attempts) created += attempt.get();
            assertThat(created).isEqualTo(1);
            assertThat(keys.countByUser_Id(owner.getId())).isEqualTo(3);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void bothQueriesArePagedAndScopedToOwner() throws Exception {
        var owner = account("pageowner");
        var other = account("pageother");
        for (int i = 0; i < 3; i++) keyService.create(owner.getId(), "pool", "key" + i);
        keyService.create(other.getId(), "pool", "other-secret");
        var session = login("pageowner");
        mvc.perform(get("/api/api-keys").session(session).param("size", "2")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2)).andExpect(jsonPath("$[0].apiKey").doesNotExist());
        mvc.perform(get("/api/api-keys").session(session).param("size", "2").param("page", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/api-keys").session(session).param("pool", "pool").param("size", "2").param("page", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].apiKey").value("key0"));
        var first = keyService.findAll(owner.getId(), 0, 2);
        var second = keyService.findAll(owner.getId(), 1, 2);
        assertThat(first.stream().map(key -> key.id()).toList()).doesNotContain(second.get(0).id());
    }

    @Test
    void paginationCannotRequestUnboundedResults() throws Exception {
        account("pagebounds");
        var session = login("pagebounds");
        for (String size : new String[]{"0", "-1", "101", "2147483647"}) {
            mvc.perform(get("/api/api-keys").session(session).param("size", size)).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/api-keys").session(session).param("pool", "pool").param("page", "10001"))
                .andExpect(status().isBadRequest());
    }
}
