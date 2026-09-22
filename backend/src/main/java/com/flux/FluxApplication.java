package com.flux;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the Flux backend.
 * Boots an embedded Tomcat server on port 8080 (see application.properties)
 * and wires up all @Component / @Service / @RestController / @Repository beans
 * found under the com.flux package (component scanning is automatic since
 * this class lives at the root of that package).
 */
@SpringBootApplication
public class FluxApplication {
    public static void main(String[] args) {
        SpringApplication.run(FluxApplication.class, args);
    }
}
