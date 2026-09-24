package com.flux.config;

import com.flux.security.JwtAuthInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class AuthWebConfig implements WebMvcConfigurer {

    private final JwtAuthInterceptor authInterceptor;

    public AuthWebConfig(JwtAuthInterceptor authInterceptor) {
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/users/auth-config",
                        "/api/users/register",
                        "/api/users/login",
                        "/api/users/otp/**",
                        "/api/pools/*/invite"
                );
    }
}
