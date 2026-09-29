package com.example.hitbloqproxy;

import com.example.hitbloqproxy.security.FixedWindowRateLimiter;
import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class FixedWindowRateLimiterTests {
    @Test
    void exhaustedBudgetRecoversOnlyAfterWindowExpires() {
        AtomicLong clock = new AtomicLong();
        var limiter = new FixedWindowRateLimiter(Duration.ofSeconds(10), 2, clock::get);
        assertThat(limiter.acquire("one", 1)).isZero();
        assertThat(limiter.acquire("one", 1)).isEqualTo(10);
        clock.set(Duration.ofSeconds(9).toNanos());
        assertThat(limiter.acquire("one", 1)).isEqualTo(1);
        clock.set(Duration.ofSeconds(10).toNanos());
        assertThat(limiter.acquire("one", 1)).isZero();
    }

    @Test
    void capacityDoesNotEvictActiveLimitsAndExpiredEntriesAreReclaimed() {
        AtomicLong clock = new AtomicLong();
        var limiter = new FixedWindowRateLimiter(Duration.ofSeconds(10), 1, clock::get);
        assertThat(limiter.acquire("one", 1)).isZero();
        assertThat(limiter.acquire("two", 1)).isPositive();
        assertThat(limiter.acquire("one", 1)).isPositive();
        clock.set(Duration.ofSeconds(10).toNanos());
        assertThat(limiter.acquire("two", 1)).isZero();
    }

    @Test
    void concurrentAttemptsCannotExceedBudget() throws Exception {
        var limiter = new FixedWindowRateLimiter(Duration.ofMinutes(1), 100, System::nanoTime);
        var executor = Executors.newFixedThreadPool(8);
        try {
            var attempts = IntStream.range(0, 40)
                    .<java.util.concurrent.Callable<Long>>mapToObj(i -> () -> limiter.acquire("same", 5)).toList();
            int admitted = 0;
            for (var result : executor.invokeAll(attempts)) if (result.get() == 0) admitted++;
            assertThat(admitted).isEqualTo(5);
        } finally {
            executor.shutdownNow();
        }
    }
}
