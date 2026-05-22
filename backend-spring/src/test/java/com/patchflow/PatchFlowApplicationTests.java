package com.patchflow;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@TestPropertySource(properties = {
    "spring.jpa.hibernate.ddl-auto=none",
    "DATABASE_URL=jdbc:postgresql://localhost/test"
})
class PatchFlowApplicationTests {

    @Test
    void contextLoads() {
        // Smoke test: Spring context starts without error
    }
}
