package com.example.hitbloqproxy.poolentry;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PoolBeatMapEntryRepository extends JpaRepository<PoolBeatMapEntry, Long> {

    List<PoolBeatMapEntry> findByPoolId(Long poolId);

    List<PoolBeatMapEntry> findByBeatMapId(Long beatMapId);

    boolean existsByBeatMapIdAndPoolId(Long beatMapId, Long poolId);
}
