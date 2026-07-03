package com.patchflow.config;

import com.patchflow.entity.User;
import com.patchflow.filter.AuthTokenFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.List;

/**
 * Utility helpers shared across controllers.
 * Replaces the authenticate / authorize middleware pattern from Express.
 */
public class Auth {

    /** Get the authenticated user or throw 401. */
    public static User require(HttpServletRequest req) {
        User user = (User) req.getAttribute(AuthTokenFilter.USER_ATTR);
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized: Missing or invalid token");
        return user;
    }

    /** Get the authenticated user or throw 401; also check role or throw 403. */
    public static User requireRole(HttpServletRequest req, String... roles) {
        User user = require(req);
        List<String> allowed = Arrays.asList(roles);
        if (!allowed.contains(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Forbidden: Insufficient permissions");
        }
        return user;
    }

    public static boolean isAdmin(String role) {
        return "SUPER_ADMIN".equals(role);
    }
}
