package com.example.hitbloqproxy;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import com.example.hitbloqproxy.beatmap.BeatMap;
import com.example.hitbloqproxy.beatmap.BeatMapRepository;
import com.example.hitbloqproxy.pool.Pool;
import com.example.hitbloqproxy.pool.PoolRepository;
import com.example.hitbloqproxy.poolentry.PoolBeatMapEntryService;

@Component
public class DataSeeder implements CommandLineRunner {

    private final BeatMapRepository beatMapRepository;
    private final PoolRepository poolRepository;
    private final PoolBeatMapEntryService poolBeatMapEntryService;

    public DataSeeder(BeatMapRepository beatMapRepository, PoolRepository poolRepository, PoolBeatMapEntryService poolBeatMapEntryService) {
        this.beatMapRepository = beatMapRepository;
        this.poolRepository = poolRepository;
        this.poolBeatMapEntryService = poolBeatMapEntryService;
    }

    @Override
    public void run(String... args) {
        if (beatMapRepository.count() == 0) {
            BeatMap beatMap1 = new BeatMap();
            beatMap1.setHitbloqId("example-hitbloq-id");
            beatMap1.setName("Example BeatMap");
            beatMapRepository.save(beatMap1);

            Pool pool1 = new Pool();
            pool1.setName("Example Pool");
            poolRepository.save(pool1);

            poolBeatMapEntryService.addBeatMapToPool(beatMap1.getId(), pool1.getId());
        }
    }
}
