package com.example.hitbloqproxy.apikey;

import com.example.hitbloqproxy.user.UserAccount;
import com.example.hitbloqproxy.user.UserAccountRepository;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserApiKeyService {
    private static final int MAX_POOL_LENGTH = 255;
    private final UserApiKeyRepository apiKeyRepository;
    private final UserAccountRepository userRepository;
    private final ApiKeyCryptoService cryptoService;
    private final EntityManager entityManager;
    private final ApiKeyLimits limits;

    public UserApiKeyService(
            UserApiKeyRepository apiKeyRepository,
            UserAccountRepository userRepository,
            ApiKeyCryptoService cryptoService,
            EntityManager entityManager,
            ApiKeyLimits limits
    ) {
        this.apiKeyRepository = apiKeyRepository;
        this.userRepository = userRepository;
        this.cryptoService = cryptoService;
        this.entityManager = entityManager;
        this.limits = limits;
    }

    @Transactional(readOnly = true)
    public List<UserApiKeySummary> findAll(UUID userId, int page, int size) {
        UserAccount user = requireUser(userId);

        return apiKeyRepository
            .findAllByUser_Id(user.getId(), pageRequest(page, size))
            .stream()
            .map(this::toSummary)
            .toList();
    }

    @Transactional
    public UserApiKeySummary create(UUID userId, String pool, String plainApiKey) {
        // Every creation locks the same owner row, so parallel requests cannot exceed the quota.
        UserAccount user = userRepository.findLockedById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));

        String normalizedPool = normalizePool(pool);

        validateApiKey(plainApiKey);

        if (apiKeyRepository.countByUser_Id(userId) >= limits.getMaxPerUser()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "API key quota reached");
        }

        UUID apiKeyId = UUID.randomUUID();

        ApiKeyCryptoService.EncryptedValue encrypted =
                cryptoService.encrypt(user.getId(), apiKeyId, normalizedPool, plainApiKey);

        UserApiKey entity = new UserApiKey(
                apiKeyId,
                user,
                normalizedPool,
                encrypted.ciphertext(),
                encrypted.nonce(),
                encrypted.keyVersion()
        );
        /*
     * The UUID is intentionally assigned before persistence,
     * because it is included in the AES-GCM authenticated data.
     *
     * EntityManager.persist() is used instead of repository.save()
     * so JPA treats this application-assigned UUID entity as new.
     */
        entityManager.persist(entity);

        return toSummary(entity);
    }

    @Transactional
    public UserApiKeySummary update(UUID userId, UUID apiKeyId, String pool, String plainApiKey) {
        UserAccount user = requireUser(userId);

        UserApiKey entity = requireApiKey(user.getId(), apiKeyId);

        String normalizedPool = normalizePool(pool);

        validateApiKey(plainApiKey);
        /*
     * We always re-encrypt when the pair is updated because
     * pool is part of the authenticated encryption context.
     */
        ApiKeyCryptoService.EncryptedValue encrypted =
                cryptoService.encrypt(user.getId(), entity.getId(), normalizedPool, plainApiKey);

        entity.setPool(normalizedPool);

        entity.setEncryptedApiKey(encrypted.ciphertext());

        entity.setNonce(encrypted.nonce());

        entity.setEncryptionKeyVersion(encrypted.keyVersion());

        entity.touch();

        return toSummary(entity);
    }

    @Transactional
    public void delete(UUID userId, UUID apiKeyId) {
        UserAccount user = requireUser(userId);

        UserApiKey entity = requireApiKey(user.getId(), apiKeyId);

        apiKeyRepository.delete(entity);
    }

    /*
   * INTERNAL BACKEND METHOD.
   *
   * Do not expose this directly through a REST controller.
   *
   * Use this when your backend needs the actual API key
   * to contact the external service.
   */
    @Transactional(readOnly = true)
    public String getDecryptedApiKeyForUse(UUID userId, UUID apiKeyId) {
        UserAccount user = requireUser(userId);

        UserApiKey entity = requireApiKey(user.getId(), apiKeyId);

        return cryptoService.decrypt(entity);
    }

    @Transactional(readOnly = true)
    public List<DecryptedApiKeyResponse> findDecryptedByPool(UUID userId, String pool, int page, int size) {
        UserAccount user = requireUser(userId);

        String normalizedPool = normalizePool(pool);

        return apiKeyRepository
            .findAllByUser_IdAndPool(user.getId(), normalizedPool, pageRequest(page, size))
            .stream()
            .map(entity -> new DecryptedApiKeyResponse(entity.getId(), cryptoService
                // entity.getPool(),
                .decrypt(entity)))
            .toList();
    }

    private UserAccount requireUser(UUID userId) {
        return userRepository
            .findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticated user does not exist"));
    }

    private UserApiKey requireApiKey(UUID userId, UUID apiKeyId) {
        return apiKeyRepository
            .findByIdAndUser_Id(apiKeyId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "API key not found"));
    }

    private String normalizePool(String pool) {
        if (pool == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pool must not be null");
        }

        String result = pool.trim();

        if (result.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pool must not be empty");
        }

        if (result.length() > MAX_POOL_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pool must not exceed " + MAX_POOL_LENGTH + " characters"
            );
        }

        return result;
    }

    private void validateApiKey(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "API key must not be empty");
        }
        if (apiKey.length() > limits.getMaxKeyBytes()
                || apiKey.getBytes(StandardCharsets.UTF_8).length > limits.getMaxKeyBytes()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "API key must not exceed " + limits.getMaxKeyBytes() + " UTF-8 bytes");
        }
    }

    private PageRequest pageRequest(int page, int size) {
        if (page < 0 || page > 10000 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Page must be 0–10000 and size must be 1–100");
        }
        return PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id")));
    }

    private UserApiKeySummary toSummary(UserApiKey entity) {
        return new UserApiKeySummary(entity.getId(), entity.getPool(), entity.getCreatedAt(), entity.getUpdatedAt());
    }
}
