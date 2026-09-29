package com.example.hitbloqproxy.apikey;

import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import com.example.hitbloqproxy.security.AccountPrincipal;

@RestController
@RequestMapping("/api/api-keys")
public class UserApiKeyController {
    private final UserApiKeyService apiKeyService;

    public UserApiKeyController(UserApiKeyService apiKeyService) {
        this.apiKeyService = apiKeyService;
    }

    @GetMapping
    public List<UserApiKeySummary> getAll(Authentication authentication,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        return apiKeyService.findAll(AccountPrincipal.requireUserId(authentication), page, size);
    }

    @GetMapping(params = "pool")
    public ResponseEntity<List<DecryptedApiKeyResponse>> getByPool(
            @RequestParam String pool,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            Authentication authentication
    ) {
        List<DecryptedApiKeyResponse> result =
                apiKeyService.findDecryptedByPool(AccountPrincipal.requireUserId(authentication), pool, page, size);

        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).header("Pragma", "no-cache").body(result);
    }

    @PostMapping
    public ResponseEntity<UserApiKeySummary> create(@RequestBody ApiKeyRequest request, Authentication authentication) {
        UserApiKeySummary created =
                apiKeyService.create(AccountPrincipal.requireUserId(authentication), request.pool(), request.apiKey());

        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public UserApiKeySummary update(
            @PathVariable UUID id,
            @RequestBody ApiKeyRequest request,
            Authentication authentication
    ) {
        return apiKeyService.update(AccountPrincipal.requireUserId(authentication), id, request.pool(), request.apiKey());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication authentication) {
        apiKeyService.delete(AccountPrincipal.requireUserId(authentication), id);

        return ResponseEntity.noContent().build();
    }


    public record ApiKeyRequest(String pool, String apiKey) {}
}
