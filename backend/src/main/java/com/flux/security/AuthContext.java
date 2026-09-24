package com.flux.security;

import jakarta.servlet.http.HttpServletRequest;

public final class AuthContext {

    public static final String USER_ID_ATTRIBUTE = "fluxAuthenticatedUserId";
    public static final String USER_NAME_ATTRIBUTE = "fluxAuthenticatedUserName";

    private AuthContext() {
    }

    public static Long requireUserId(HttpServletRequest request) {
        Object value = request.getAttribute(USER_ID_ATTRIBUTE);

        if (value instanceof Long userId && userId > 0) {
            return userId;
        }

        throw new IllegalArgumentException("Authentication is required");
    }

    public static void requireSameUser(
            HttpServletRequest request,
            Long requestedUserId) {

        Long authenticatedUserId = requireUserId(request);

        if (!authenticatedUserId.equals(requestedUserId)) {
            throw new IllegalArgumentException(
                    "You cannot access another user's account data"
            );
        }
    }
}
