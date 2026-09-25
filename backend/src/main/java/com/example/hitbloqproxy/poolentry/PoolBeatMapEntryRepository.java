package com.example.hitbloqproxy.poolentry;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PoolBeatMapEntryRepository extends JpaRepository<PoolBeatMapEntry, Long> {
    List<PoolBeatMapEntry> findByPoolId(Long poolId);

    List<PoolBeatMapEntry> findByBeatMapId(Long beatMapId);

    boolean existsByBeatMapIdAndPoolId(Long beatMapId, Long poolId);
}
