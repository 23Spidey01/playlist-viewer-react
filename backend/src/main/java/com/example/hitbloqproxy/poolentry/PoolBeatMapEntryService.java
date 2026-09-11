package com.example.hitbloqproxy.poolentry;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.hitbloqproxy.beatmap.BeatMap;
import com.example.hitbloqproxy.beatmap.BeatMapRepository;
import com.example.hitbloqproxy.pool.Pool;
import com.example.hitbloqproxy.pool.PoolRepository;

@Service
public class PoolBeatMapEntryService {

    private final BeatMapRepository beatMapRepository;
    private final PoolRepository poolRepository;
    private final PoolBeatMapEntryRepository poolBeatMapEntryRepository;

    public PoolBeatMapEntryService(
            BeatMapRepository beatMapRepository,
            PoolRepository poolRepository,
            PoolBeatMapEntryRepository poolBeatMapEntryRepository
    ) {
        this.beatMapRepository = beatMapRepository;
        this.poolRepository = poolRepository;
        this.poolBeatMapEntryRepository = poolBeatMapEntryRepository;
    }

    @Transactional
    public PoolBeatMapEntry addBeatMapToPool(Long beatMapId, Long poolId) {
        if (poolBeatMapEntryRepository.existsByBeatMapIdAndPoolId(beatMapId, poolId)) {
            throw new IllegalStateException("Beatmap is already in this pool.");
        }

        BeatMap beatMap = beatMapRepository.findById(beatMapId)
                .orElseThrow(() -> new IllegalArgumentException("Beatmap not found."));

        Pool pool = poolRepository.findById(poolId)
                .orElseThrow(() -> new IllegalArgumentException("Pool not found."));

        PoolBeatMapEntry entry = new PoolBeatMapEntry();
        entry.setBeatMap(beatMap);
        entry.setPool(pool);

        return poolBeatMapEntryRepository.save(entry);
    }
}
