package com.example.hitbloqproxy.apikey;

import java.util.UUID;

public record DecryptedApiKeyResponse(
        UUID id,
        // String pool,
        String apiKey
) {
}
