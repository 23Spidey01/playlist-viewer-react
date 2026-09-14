package com.example.hitbloqproxy.apikey;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/api-keys")
public class UserApiKeyController {

    private final UserApiKeyService apiKeyService;

    public UserApiKeyController(
            UserApiKeyService apiKeyService
    ) {
        this.apiKeyService = apiKeyService;
    }

    @GetMapping
    public List<UserApiKeySummary> getAll(
            Authentication authentication
    ) {
        return apiKeyService.findAll(
                requireAuthenticatedEmail(
                        authentication
                )
        );
    }

    @PostMapping
    public ResponseEntity<UserApiKeySummary> create(
            @RequestBody ApiKeyRequest request,
            Authentication authentication
    ) {
        UserApiKeySummary created =
                apiKeyService.create(
                        requireAuthenticatedEmail(
                                authentication
                        ),
                        request.pool(),
                        request.apiKey()
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(created);
    }

    @PutMapping("/{id}")
    public UserApiKeySummary update(
            @PathVariable UUID id,
            @RequestBody ApiKeyRequest request,
            Authentication authentication
    ) {
        return apiKeyService.update(
                requireAuthenticatedEmail(
                        authentication
                ),
                id,
                request.pool(),
                request.apiKey()
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID id,
            Authentication authentication
    ) {
        apiKeyService.delete(
                requireAuthenticatedEmail(
                        authentication
                ),
                id
        );

        return ResponseEntity
                .noContent()
                .build();
    }

    private String requireAuthenticatedEmail(
            Authentication authentication
    ) {
        if (authentication == null ||
                !authentication.isAuthenticated()) {

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED
            );
        }

        return authentication.getName();
    }

    public record ApiKeyRequest(
            String pool,
            String apiKey
    ) {
    }
}