package com.example.hitbloqproxy;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import com.example.hitbloqproxy.apikey.UserApiKeyService;
import com.example.hitbloqproxy.auth.RegistrationService;
import com.example.hitbloqproxy.beatmap.BeatMap;
import com.example.hitbloqproxy.beatmap.BeatMapRepository;
import com.example.hitbloqproxy.pool.Pool;
import com.example.hitbloqproxy.pool.PoolRepository;
import com.example.hitbloqproxy.poolentry.PoolBeatMapEntryService;

@Component
public class DataSeeder implements CommandLineRunner {
    @Value("${app.test-data.enabled}")
    private boolean enabled;

    private final BeatMapRepository beatMapRepository;
    private final PoolRepository poolRepository;
    private final PoolBeatMapEntryService poolBeatMapEntryService;
    private final RegistrationService registrationService;
    private final UserApiKeyService userApiKeyService;

    public DataSeeder(BeatMapRepository beatMapRepository, PoolRepository poolRepository, PoolBeatMapEntryService poolBeatMapEntryService, RegistrationService registrationService, UserApiKeyService userApiKeyService) {
        this.beatMapRepository = beatMapRepository;
        this.poolRepository = poolRepository;
        this.poolBeatMapEntryService = poolBeatMapEntryService;
        this.registrationService = registrationService;
        this.userApiKeyService = userApiKeyService;
    }

    @Override
    public void run(String... args) {
        if (enabled) {
            BeatMap beatMap1 = new BeatMap();
            String pool1name = "Example Pool";
            String email1 = "a@a.com";

            beatMap1.setHitbloqId("example-hitbloq-id");
            beatMap1.setName("Example BeatMap");
            beatMapRepository.save(beatMap1);

            Pool pool1 = new Pool();
            pool1.setName(pool1name);
            poolRepository.save(pool1);

            poolBeatMapEntryService.addBeatMapToPool(beatMap1.getId(), pool1.getId());

            registrationService.register(email1, "admin");
            userApiKeyService.create(email1, pool1name, "TEST-API-KEY-TEST");
        }
    }
}
