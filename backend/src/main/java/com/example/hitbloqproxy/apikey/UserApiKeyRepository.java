package com.example.hitbloqproxy.apikey;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserApiKeyRepository extends JpaRepository<UserApiKey, UUID> {
        List<UserApiKey> findAllByUser_IdOrderByCreatedAtDesc(
                        UUID userId);

        Optional<UserApiKey> findByIdAndUser_Id(
                        UUID id,
                        UUID userId);

        List<UserApiKey> findAllByUser_IdAndPoolOrderByCreatedAtDesc(
                        UUID userId,
                        String pool);
}