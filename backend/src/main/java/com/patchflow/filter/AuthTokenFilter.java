package com.patchflow.filter;

import com.patchflow.entity.Session;
import com.patchflow.entity.User;
import com.patchflow.repository.SessionRepository;
import com.patchflow.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Replaces auth.middleware.ts.
 * Reads the Bearer token from the Authorization header, hashes it with SHA-256,
 * looks it up in the Session table, and attaches the authenticated user to the request.
 */
@Component
@RequiredArgsConstructor
public class AuthTokenFilter extends OncePerRequestFilter {

    public static final String USER_ATTR = "authenticatedUser";

    private final SessionRepository sessionRepository;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            String tokenHash = sha256(token);

            Optional<Session> sessionOpt = sessionRepository.findByTokenHash(tokenHash);
            if (sessionOpt.isPresent()) {
                Session session = sessionOpt.get();
                if (session.getExpiresAt().isAfter(Instant.now())) {
                    Optional<User> userOpt = userRepository.findById(session.getUserId());
                    if (userOpt.isPresent() && userOpt.get().isActive()) {
                        User user = userOpt.get();
                        request.setAttribute(USER_ATTR, user);
                        // Fire-and-forget cleanup of expired sessions
                        try {
                            sessionRepository.deleteExpiredByUserId(user.getUserId(), Instant.now());
                        } catch (Exception ignored) {}
                    }
                }
            }
        }

        chain.doFilter(request, response);
    }

    public static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
