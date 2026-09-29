package com.example.hitbloqproxy.apikey;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Pageable;

public interface UserApiKeyRepository extends JpaRepository<UserApiKey, UUID> {
    List<UserApiKey> findAllByUser_Id(UUID userId, Pageable pageable);

    long countByUser_Id(UUID userId);

    Optional<UserApiKey> findByIdAndUser_Id(UUID id, UUID userId);

    List<UserApiKey> findAllByUser_IdAndPool(UUID userId, String pool, Pageable pageable);
}
