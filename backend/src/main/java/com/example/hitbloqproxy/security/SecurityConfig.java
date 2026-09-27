package com.example.hitbloqproxy.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // /proxy/** (rank, unrank, recalculate_cr, ...) is a plain
            // JSON API with no login required — the Hitbloq API key in
            // the request body is what authorizes the action, not the
            // caller's session/cookie, so CSRF protection (meant to
            // stop a third-party site from riding a victim's cookie)
            // doesn't apply here. Without this, every POST to /proxy/**
            // gets rejected with a bare 403 before it ever reaches
            // Hitbloq, regardless of whether the API key is valid.
            .csrf(csrf -> csrf.ignoringRequestMatchers("/proxy/**"))
            .authorizeHttpRequests(auth -> auth
                // React application
                .requestMatchers("/", "/index.html", "/assets/**", "/favicon.ico")
                .permitAll()
                .requestMatchers("/api/auth/register", "/api/auth/login", "/api/auth/csrf")
                .permitAll()
                .requestMatchers("/api/auth/me")
                .authenticated()
                // Everything below /api requires login
                .requestMatchers("/api/**")
                .authenticated()
                // React SPA/static content
                .anyRequest()
                .permitAll())
            .formLogin(form -> form
                .loginPage("/login")
                .loginProcessingUrl("/api/auth/login")
                .usernameParameter("email")
                .successHandler((request, response, authentication) -> {
                    response.setStatus(204);
                })
                .failureHandler((request, response, exception) -> {
                    response.sendError(401);
                }))
            .logout(logout -> logout
                .logoutUrl("/api/auth/logout")
                .logoutSuccessHandler((request, response, authentication) -> {
                    response.setStatus(204);
                }));

        return http.build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }
}
