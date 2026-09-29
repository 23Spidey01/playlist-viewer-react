package com.example.hitbloqproxy.security;

import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

/** Preserve existing hash formats while rejecting input that BCrypt would truncate. */
public final class StrictPasswordEncoder implements PasswordEncoder {
    private final PasswordEncoder delegate = PasswordEncoderFactories.createDelegatingPasswordEncoder();

    @Override
    public String encode(CharSequence rawPassword) {
        if (rawPassword == null || PasswordPolicy.exceedsBcryptLimit(rawPassword.toString())) {
            throw new IllegalArgumentException("Password must not exceed 72 UTF-8 bytes");
        }
        return delegate.encode(rawPassword);
    }

    @Override
    public boolean matches(CharSequence rawPassword, String encodedPassword) {
        return rawPassword != null && !PasswordPolicy.exceedsBcryptLimit(rawPassword.toString())
                && delegate.matches(rawPassword, encodedPassword);
    }

    @Override
    public boolean upgradeEncoding(String encodedPassword) {
        return delegate.upgradeEncoding(encodedPassword);
    }
}
