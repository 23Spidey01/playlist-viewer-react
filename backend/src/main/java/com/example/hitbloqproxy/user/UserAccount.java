package com.example.hitbloqproxy.user;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "users", uniqueConstraints = {@UniqueConstraint(name = "uk_users_email", columnNames = "email")})
@Getter
@Setter
public class UserAccount {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false, length = 320)
    private String email;
    @Column(name = "password_hash", length = 255)
    private String passwordHash;
    @Column(nullable = false)
    private boolean enabled = true;
    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified = false;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public UserAccount() {
    }
}
