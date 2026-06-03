package com.patchflow.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import com.patchflow.PatchFlowApplication;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = PatchFlowApplication.class, webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class EntityMappingTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @SuppressWarnings("unchecked")
    @Test
    void testEndToEndUsersAndModules() {
        String baseUrl = "http://localhost:" + port;

        // 1. Login to get token
        Map<String, String> loginRequest = Map.of("username", "admin", "password", "upcl@123");
        ResponseEntity<Map> loginResponse = restTemplate.postForEntity(
                baseUrl + "/api/auth/login",
                loginRequest,
                Map.class
        );

        assertThat(loginResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        Map<String, Object> body = loginResponse.getBody();
        assertThat(body).isNotNull();
        String token = (String) body.get("token");
        assertThat(token).isNotBlank();

        // Prepare headers with Bearer token
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        // 2. Fetch users
        ResponseEntity<String> usersResponse = restTemplate.exchange(
                baseUrl + "/api/users?includeModules=true",
                HttpMethod.GET,
                entity,
                String.class
        );
        assertThat(usersResponse.getStatusCode()).isEqualTo(HttpStatus.OK);

        // 3. Fetch modules
        ResponseEntity<String> modulesResponse = restTemplate.exchange(
                baseUrl + "/api/modules",
                HttpMethod.GET,
                entity,
                String.class
        );
        assertThat(modulesResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
    }
}
