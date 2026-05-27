package com.patchflow.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@Configuration
public class SecurityConfig {

    /**
     * BCryptPasswordEncoder bean — used only for password hashing.
     * We do NOT use full Spring Security (no SecurityFilterChain, no UserDetailsService)
     * because auth is handled via custom session tokens in AuthTokenFilter.
     */
    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
