package com.example.hitbloqproxy.pool;

import java.util.HashSet;
import java.util.Set;

import com.example.hitbloqproxy.poolentry.PoolBeatMapEntry;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
public class Pool {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Setter(lombok.AccessLevel.NONE)
    private Long id;

    // This is the Hitbloq ID of the pool
    private String name;

    @OneToMany(
        mappedBy = "pool",
        cascade = CascadeType.ALL,
        orphanRemoval = true
    )
    private Set<PoolBeatMapEntry> poolEntries = new HashSet<>();
}
