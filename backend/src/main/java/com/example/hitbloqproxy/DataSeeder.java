package com.example.hitbloqproxy;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import com.example.hitbloqproxy.beatmap.BeatMap;
import com.example.hitbloqproxy.beatmap.BeatMapRepository;

@Component
public class DataSeeder implements CommandLineRunner {

    private final BeatMapRepository beatMapRepository;

    public DataSeeder(BeatMapRepository beatMapRepository) {
        this.beatMapRepository = beatMapRepository;
    }

    @Override
    public void run(String... args) {
        if (beatMapRepository.count() == 0) {
            beatMapRepository.save(new BeatMap("Example BeatMap"));
        }
    }
}
