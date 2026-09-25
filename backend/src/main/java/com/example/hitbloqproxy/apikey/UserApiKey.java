package com.example.hitbloqproxy.apikey;

import com.example.hitbloqproxy.user.UserAccount;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_api_keys", indexes = {@Index(name = "idx_user_api_keys_user_id", columnList = "user_id")})
public class UserApiKey {
    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, foreignKey = @ForeignKey(name = "fk_user_api_keys_user"))
    private UserAccount user;
    @Column(nullable = false, length = 255)
    private String pool;
    @Column(name = "encrypted_api_key", nullable = false, columnDefinition = "bytea")
    private byte[] encryptedApiKey;
    @Column(name = "nonce", nullable = false, columnDefinition = "bytea")
    private byte[] nonce;
    @Column(name = "encryption_key_version", nullable = false)
    private int encryptionKeyVersion;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserApiKey() {
        // Required by Hibernate
    }

    public UserApiKey(
            UUID id,
            UserAccount user,
            String pool,
            byte[] encryptedApiKey,
            byte[] nonce,
            int encryptionKeyVersion
    ) {
        this.id = id;
        this.user = user;
        this.pool = pool;
        this.encryptedApiKey = encryptedApiKey;
        this.nonce = nonce;
        this.encryptionKeyVersion = encryptionKeyVersion;

        Instant now = Instant.now();

        this.createdAt = now;
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public UserAccount getUser() {
        return user;
    }

    public String getPool() {
        return pool;
    }

    public void setPool(String pool) {
        this.pool = pool;
    }

    public byte[] getEncryptedApiKey() {
        return encryptedApiKey;
    }

    public void setEncryptedApiKey(byte[] encryptedApiKey) {
        this.encryptedApiKey = encryptedApiKey;
    }

    public byte[] getNonce() {
        return nonce;
    }

    public void setNonce(byte[] nonce) {
        this.nonce = nonce;
    }

    public int getEncryptionKeyVersion() {
        return encryptionKeyVersion;
    }

    public void setEncryptionKeyVersion(int encryptionKeyVersion) {
        this.encryptionKeyVersion = encryptionKeyVersion;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void touch() {
        this.updatedAt = Instant.now();
    }
}
