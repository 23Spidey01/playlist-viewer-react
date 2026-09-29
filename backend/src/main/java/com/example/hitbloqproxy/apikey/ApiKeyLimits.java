package com.example.hitbloqproxy.apikey;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

@Component
@ConfigurationProperties(prefix = "app.api-keys")
@Validated
@Getter
@Setter
public class ApiKeyLimits {
    @Min(1) @Max(10000) private int maxPerUser = 100;
    @Min(1) @Max(65536) private int maxKeyBytes = 4096;
    @Min(256) @Max(1048576) private int maxRequestBytes = 65536;
}
