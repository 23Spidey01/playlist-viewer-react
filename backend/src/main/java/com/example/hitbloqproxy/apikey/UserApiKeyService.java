package com.example.hitbloqproxy.apikey;

import com.example.hitbloqproxy.user.UserAccount;
import com.example.hitbloqproxy.user.UserAccountRepository;

import jakarta.persistence.EntityManager;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class UserApiKeyService {

    private static final int MAX_POOL_LENGTH = 255;

    private final UserApiKeyRepository apiKeyRepository;

    private final UserAccountRepository userRepository;

    private final ApiKeyCryptoService cryptoService;

    private final EntityManager entityManager;

    public UserApiKeyService(
            UserApiKeyRepository apiKeyRepository,
            UserAccountRepository userRepository,
            ApiKeyCryptoService cryptoService,
            EntityManager entityManager
    ) {
        this.apiKeyRepository = apiKeyRepository;
        this.userRepository = userRepository;
        this.cryptoService = cryptoService;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public List<UserApiKeySummary> findAll(
            String email
    ) {
        UserAccount user =
                requireUser(email);

        return apiKeyRepository
                .findAllByUser_IdOrderByCreatedAtDesc(
                        user.getId()
                )
                .stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional
    public UserApiKeySummary create(
            String email,
            String pool,
            String plainApiKey
    ) {
        UserAccount user =
                requireUser(email);

        String normalizedPool =
                normalizePool(pool);

        validateApiKey(plainApiKey);

        UUID apiKeyId =
                UUID.randomUUID();

        ApiKeyCryptoService.EncryptedValue encrypted =
                cryptoService.encrypt(
                        user.getId(),
                        apiKeyId,
                        normalizedPool,
                        plainApiKey
                );

        UserApiKey entity =
                new UserApiKey(
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
    public UserApiKeySummary update(
            String email,
            UUID apiKeyId,
            String pool,
            String plainApiKey
    ) {
        UserAccount user =
                requireUser(email);

        UserApiKey entity =
                requireApiKey(
                        user.getId(),
                        apiKeyId
                );

        String normalizedPool =
                normalizePool(pool);

        validateApiKey(plainApiKey);

        /*
         * We always re-encrypt when the pair is updated because
         * pool is part of the authenticated encryption context.
         */
        ApiKeyCryptoService.EncryptedValue encrypted =
                cryptoService.encrypt(
                        user.getId(),
                        entity.getId(),
                        normalizedPool,
                        plainApiKey
                );

        entity.setPool(normalizedPool);

        entity.setEncryptedApiKey(
                encrypted.ciphertext()
        );

        entity.setNonce(
                encrypted.nonce()
        );

        entity.setEncryptionKeyVersion(
                encrypted.keyVersion()
        );

        entity.touch();

        return toSummary(entity);
    }

    @Transactional
    public void delete(
            String email,
            UUID apiKeyId
    ) {
        UserAccount user =
                requireUser(email);

        UserApiKey entity =
                requireApiKey(
                        user.getId(),
                        apiKeyId
                );

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
    public String getDecryptedApiKeyForUse(
            String email,
            UUID apiKeyId
    ) {
        UserAccount user =
                requireUser(email);

        UserApiKey entity =
                requireApiKey(
                        user.getId(),
                        apiKeyId
                );

        return cryptoService.decrypt(entity);
    }

    @Transactional(readOnly = true)
        public List<DecryptedApiKeyResponse> findDecryptedByPool(
                String email,
                String pool
        ) {

        UserAccount user =
                requireUser(email);

        String normalizedPool =
                normalizePool(pool);

        return apiKeyRepository
                .findAllByUser_IdAndPoolOrderByCreatedAtDesc(
                        user.getId(),
                        normalizedPool
                )
                .stream()
                .map(entity ->
                        new DecryptedApiKeyResponse(
                                entity.getId(),
                                // entity.getPool(),
                                cryptoService.decrypt(entity)
                        )
                )
                .toList();
        }

    private UserAccount requireUser(
            String email
    ) {
        return userRepository
                .findByEmailIgnoreCase(email)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "Authenticated user does not exist"
                        )
                );
    }

    private UserApiKey requireApiKey(
            UUID userId,
            UUID apiKeyId
    ) {
        return apiKeyRepository
                .findByIdAndUser_Id(
                        apiKeyId,
                        userId
                )
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "API key not found"
                        )
                );
    }

    private String normalizePool(
            String pool
    ) {
        if (pool == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pool must not be null"
            );
        }

        String result =
                pool.trim();

        if (result.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pool must not be empty"
            );
        }

        if (result.length() > MAX_POOL_LENGTH) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Pool must not exceed "
                            + MAX_POOL_LENGTH
                            + " characters"
            );
        }

        return result;
    }

    private void validateApiKey(
            String apiKey
    ) {
        if (apiKey == null ||
                apiKey.isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "API key must not be empty"
            );
        }
    }

    private UserApiKeySummary toSummary(
            UserApiKey entity
    ) {
        return new UserApiKeySummary(
                entity.getId(),
                entity.getPool(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}