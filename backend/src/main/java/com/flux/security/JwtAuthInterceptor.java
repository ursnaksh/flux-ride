package com.flux.security;

import com.flux.service.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;

@Component
public class JwtAuthInterceptor implements HandlerInterceptor {

    private final JwtService jwtService;

    public JwtAuthInterceptor(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler) throws IOException {

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String header = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (header == null || !header.startsWith("Bearer ")) {
            writeUnauthorized(response, "Please log in to continue.");
            return false;
        }

        String token = header.substring(7).trim();
        if (token.isEmpty()) {
            writeUnauthorized(response, "Please log in to continue.");
            return false;
        }

        try {
            JwtService.AuthenticatedIdentity identity =
                    jwtService.verify(token);

            request.setAttribute(
                    AuthContext.USER_ID_ATTRIBUTE,
                    identity.userId()
            );

            request.setAttribute(
                    AuthContext.USER_NAME_ATTRIBUTE,
                    identity.name()
            );

            return true;
        } catch (Exception ex) {
            writeUnauthorized(
                    response,
                    "Your session has expired. Please log in again."
            );
            return false;
        }
    }

    private void writeUnauthorized(
            HttpServletResponse response,
            String message) throws IOException {

        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setCharacterEncoding("UTF-8");
        response.setContentType("application/json");

        String safeMessage = message.replace("\\", "\\\\")
                .replace("\"", "\\\"");

        response.getWriter().write(
                "{\"success\":false,\"message\":\""
                        + safeMessage
                        + "\",\"data\":null}"
        );
    }
}
