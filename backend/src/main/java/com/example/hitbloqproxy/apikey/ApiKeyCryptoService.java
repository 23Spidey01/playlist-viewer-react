package com.example.hitbloqproxy.apikey;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

@Service
public class ApiKeyCryptoService {
    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int NONCE_LENGTH_BYTES = 12;
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int AES_256_KEY_LENGTH_BYTES = 32;
    private final SecureRandom secureRandom = new SecureRandom();
    private final ApiKeyCryptoProperties properties;
    private SecretKey encryptionKey;

    public ApiKeyCryptoService(ApiKeyCryptoProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    void initialize() {
        String encodedKey = loadEncodedKey();

        byte[] keyBytes;

        try {
            keyBytes = Base64.getDecoder().decode(encodedKey);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("API key encryption key is not valid Base64", exception);
        }

        if (keyBytes.length != AES_256_KEY_LENGTH_BYTES) {
            throw new IllegalStateException(
                    "API key encryption key must contain exactly " + AES_256_KEY_LENGTH_BYTES + " bytes after Base64 decoding"
            );
        }

        encryptionKey = new SecretKeySpec(keyBytes, "AES");
    }

    public EncryptedValue encrypt(UUID userId, UUID apiKeyId, String pool, String plainApiKey) {
        try {
            byte[] nonce = new byte[NONCE_LENGTH_BYTES];

            secureRandom.nextBytes(nonce);

            Cipher cipher = Cipher.getInstance(ALGORITHM);

            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH_BITS, nonce);

            cipher.init(Cipher.ENCRYPT_MODE, encryptionKey, parameterSpec);

            cipher.updateAAD(createAdditionalAuthenticatedData(userId, apiKeyId, pool));

            byte[] encrypted = cipher.doFinal(plainApiKey.getBytes(StandardCharsets.UTF_8));

            return new EncryptedValue(encrypted, nonce, properties.getKeyVersion());
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Could not encrypt API key", exception);
        }
    }

    public String decrypt(UserApiKey userApiKey) {
        if (userApiKey.getEncryptionKeyVersion() != properties.getKeyVersion()) {
            throw new IllegalStateException(
                    "Unsupported encryption key version: " + userApiKey.getEncryptionKeyVersion()
            );
        }

        try {
            Cipher cipher = Cipher.getInstance(ALGORITHM);

            GCMParameterSpec parameterSpec = new GCMParameterSpec(GCM_TAG_LENGTH_BITS, userApiKey.getNonce());

            cipher.init(Cipher.DECRYPT_MODE, encryptionKey, parameterSpec);

            cipher.updateAAD(
                    createAdditionalAuthenticatedData(
                            userApiKey.getUser().getId(),
                            userApiKey.getId(),
                            userApiKey.getPool()
                    )
            );

            byte[] decrypted = cipher.doFinal(userApiKey.getEncryptedApiKey());

            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("Could not decrypt API key", exception);
        }
    }

    private byte[] createAdditionalAuthenticatedData(UUID userId, UUID apiKeyId, String pool) {
        String aad = userId + "\n" + apiKeyId + "\n" + pool;

        return aad.getBytes(StandardCharsets.UTF_8);
    }

    private String loadEncodedKey() {
        String keyFile = properties.getKeyFile();

        if (keyFile != null && !keyFile.isBlank()) {
            try {
                return Files.readString(Path.of(keyFile)).trim();
            } catch (IOException exception) {
                throw new IllegalStateException("Could not read API encryption key file: " + keyFile, exception);
            }
        }

        String key = properties.getKeyBase64();

        if (key != null && !key.isBlank()) {
            return key.trim();
        }

        throw new IllegalStateException(
                "No API key encryption key configured. " + "Set API_KEY_ENCRYPTION_KEY_FILE " + "or API_KEY_ENCRYPTION_KEY_BASE64."
        );
    }

    public record EncryptedValue(byte[] ciphertext, byte[] nonce, int keyVersion) {}
}
