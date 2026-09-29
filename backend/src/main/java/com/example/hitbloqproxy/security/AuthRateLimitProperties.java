package com.example.hitbloqproxy.security;

import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Component
@ConfigurationProperties(prefix = "app.auth-rate-limit")
@Validated
@Getter
@Setter
public class AuthRateLimitProperties {
    @Min(1) private int windowSeconds = 900;
    @Min(1) private int maxBuckets = 10000;
    @Min(1) private int loginPerIp = 50;
    @Min(1) private int loginPerAccount = 10;
    @Min(1) private int registrationPerIp = 5;
    @Min(1) private int changesPerIp = 30;
    @Min(1) private int changesPerAccount = 10;
}
