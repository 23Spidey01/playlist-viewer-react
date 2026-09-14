package com.example.hitbloqproxy.apikey;

import java.time.Instant;
import java.util.UUID;

public record UserApiKeySummary(
        UUID id,
        String pool,
        Instant createdAt,
        Instant updatedAt
) {
}