package com.example.hitbloqproxy;

import com.example.hitbloqproxy.apikey.ApiKeyLimits;
import com.example.hitbloqproxy.apikey.ApiKeyRequestSizeFilter;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.assertj.core.api.Assertions.assertThat;

class ApiKeyRequestSizeTests {
    @Test
    void missingOrUnderstatedContentLengthCannotBypassLimit() throws Exception {
        var limits = new ApiKeyLimits();
        limits.setMaxRequestBytes(256);
        for (long advertised : new long[]{-1, 1}) {
            var request = new MockHttpServletRequest("POST", "/api/api-keys") {
                @Override public long getContentLengthLong() { return advertised; }
            };
            request.setContent("x".repeat(257).getBytes(StandardCharsets.UTF_8));
            var response = new MockHttpServletResponse();
            AtomicBoolean called = new AtomicBoolean();
            new ApiKeyRequestSizeFilter(limits).doFilter(request, response, (req, res) -> called.set(true));
            assertThat(response.getStatus()).isEqualTo(413);
            assertThat(called).isFalse();
        }
    }

    @Test
    void exactBoundaryBodyIsPreservedForController() throws Exception {
        var limits = new ApiKeyLimits();
        limits.setMaxRequestBytes(256);
        var request = new MockHttpServletRequest("PUT", "/api/api-keys/example");
        byte[] body = "x".repeat(256).getBytes(StandardCharsets.UTF_8);
        request.setContent(body);
        AtomicBoolean called = new AtomicBoolean();
        new ApiKeyRequestSizeFilter(limits).doFilter(request, new MockHttpServletResponse(), (req, res) -> {
            assertThat(req.getInputStream().readAllBytes()).isEqualTo(body);
            called.set(true);
        });
        assertThat(called).isTrue();
    }
}
