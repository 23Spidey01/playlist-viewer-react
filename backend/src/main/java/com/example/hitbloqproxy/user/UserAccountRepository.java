package com.example.hitbloqproxy.user;

import java.util.Optional;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UserAccount u where u.id = :id")
    Optional<UserAccount> findLockedById(@Param("id") UUID id);

    Optional<UserAccount> findByEmailIgnoreCase(String email);

    Optional<UserAccount> findByUsernameIgnoreCase(String username);

    @Query("select u from UserAccount u where lower(trim(u.username)) = :login or lower(trim(u.email)) = :login")
    List<UserAccount> findAllByLogin(@Param("login") String login);

    default Optional<UserAccount> findUniqueByLogin(String login) {
        List<UserAccount> matches = findAllByLogin(AccountIdentifiers.normalizeLogin(login));
        // Ambiguous legacy identifiers must never choose an arbitrary owner or cause a 500.
        return matches.size() == 1 ? Optional.of(matches.get(0)) : Optional.empty();
    }

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByUsernameIgnoreCase(String username);
}
