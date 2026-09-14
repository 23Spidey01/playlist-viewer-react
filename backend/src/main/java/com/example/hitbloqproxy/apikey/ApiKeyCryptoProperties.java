package com.example.hitbloqproxy.apikey;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.api-key-crypto")
public class ApiKeyCryptoProperties {

    private String keyBase64;

    private String keyFile;

    private int keyVersion = 1;

    public String getKeyBase64() {
        return keyBase64;
    }

    public void setKeyBase64(String keyBase64) {
        this.keyBase64 = keyBase64;
    }

    public String getKeyFile() {
        return keyFile;
    }

    public void setKeyFile(String keyFile) {
        this.keyFile = keyFile;
    }

    public int getKeyVersion() {
        return keyVersion;
    }

    public void setKeyVersion(int keyVersion) {
        this.keyVersion = keyVersion;
    }
}