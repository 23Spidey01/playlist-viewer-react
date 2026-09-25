package com.example.hitbloqproxy.apikey;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserApiKeyRepository extends JpaRepository<UserApiKey, UUID> {
    List<UserApiKey> findAllByUser_IdOrderByCreatedAtDesc(UUID userId);

    Optional<UserApiKey> findByIdAndUser_Id(UUID id, UUID userId);

    List<UserApiKey> findAllByUser_IdAndPoolOrderByCreatedAtDesc(UUID userId, String pool);
}
