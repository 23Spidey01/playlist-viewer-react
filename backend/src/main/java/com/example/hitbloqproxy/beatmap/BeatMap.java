package com.example.hitbloqproxy.beatmap;

import com.example.hitbloqproxy.poolentry.PoolBeatMapEntry;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import java.util.HashSet;
import java.util.Set;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
public class BeatMap {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(lombok.AccessLevel.NONE)
    private Long id;
    private String hitbloqId;
    private String name;
    @OneToMany(mappedBy = "beatMap", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<PoolBeatMapEntry> poolEntries = new HashSet<>();

    public BeatMap() {
    }
}
