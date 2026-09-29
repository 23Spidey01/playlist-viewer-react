package com.example.hitbloqproxy.security;

import com.example.hitbloqproxy.user.UserAccountRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.SecurityContextHolderFilter;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, UserAccountRepository users,
            AuthRateLimitProperties rateLimits) throws Exception {
        http
            .cors(Customizer.withDefaults())
            .addFilterAfter(new AccountSessionFilter(users), SecurityContextHolderFilter.class)
            .addFilterBefore(new AuthRateLimitFilter(rateLimits, users), UsernamePasswordAuthenticationFilter.class)
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
                .usernameParameter("username")
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
