package com.example.hitbloqproxy.beatmap;

import org.springframework.data.jpa.repository.JpaRepository;

public interface BeatMapRepository extends JpaRepository<BeatMap, Long> {
    
}