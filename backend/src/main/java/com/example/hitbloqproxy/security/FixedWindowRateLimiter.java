package com.example.hitbloqproxy.security;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.function.LongSupplier;

/** Bounded, atomic per-process counters. Never evict active buckets to admit new identities. */
public final class FixedWindowRateLimiter {
    private final Map<String, Bucket> buckets = new HashMap<>();
    private final long windowNanos;
    private final int maxBuckets;
    private final LongSupplier clock;

    public FixedWindowRateLimiter(Duration window, int maxBuckets, LongSupplier clock) {
        this.windowNanos = window.toNanos();
        this.maxBuckets = maxBuckets;
        this.clock = clock;
    }

    /** Returns zero if admitted, otherwise a Retry-After value in seconds. */
    public synchronized long acquire(String key, int limit) {
        long now = clock.getAsLong();
        Bucket bucket = buckets.get(key);
        if (bucket != null && now - bucket.start >= windowNanos) {
            buckets.remove(key);
            bucket = null;
        }
        if (bucket == null) {
            if (buckets.size() >= maxBuckets) {
                buckets.values().removeIf(value -> now - value.start >= windowNanos);
            }
            if (buckets.size() >= maxBuckets) {
                return seconds(windowNanos);
            }
            bucket = new Bucket(now);
            buckets.put(key, bucket);
        }
        if (bucket.count >= limit) {
            return seconds(windowNanos - (now - bucket.start));
        }
        bucket.count++;
        return 0;
    }

    private long seconds(long nanos) {
        return Math.max(1, (nanos + 999_999_999L) / 1_000_000_000L);
    }

    private static final class Bucket {
        private final long start;
        private int count;
        private Bucket(long start) { this.start = start; }
    }
}
