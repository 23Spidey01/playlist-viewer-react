package com.example.hitbloqproxy.poolentry;

import com.example.hitbloqproxy.beatmap.BeatMap;
import com.example.hitbloqproxy.pool.Pool;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"beatmap_id", "pool_id"})
    }
)
public class PoolBeatMapEntry {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(lombok.AccessLevel.NONE)
    private Long id;

    
    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "beatmap_id", nullable = false)
    private BeatMap beatMap;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "pool_id", nullable = false)
    private Pool pool;

    private boolean isDeleted = false;
}
