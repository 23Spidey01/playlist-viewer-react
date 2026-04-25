package com.example.hitbloqproxy.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@RestController
@RequestMapping("/proxy")
public class HitbloqProxyController {

    private static final Logger log = LoggerFactory.getLogger(HitbloqProxyController.class);
    private static final URI HITBLOQ_API_BASE_URL = URI.create("https://hitbloq.com/api/");

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public HitbloqProxyController(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();
    }

    @PostMapping(value = "/unrank", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> unrank(@RequestBody String requestBody) throws IOException, InterruptedException {
        return proxyPost("pools/unrank", requestBody);
    }

    @PostMapping(value = "/rank", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> rank(@RequestBody String requestBody) throws IOException, InterruptedException {
        return proxyPost("pools/rank", requestBody);
    }

    @GetMapping("/map_pools_detailed")
    public ResponseEntity<?> mapPoolsDetailed() throws IOException, InterruptedException {
        return proxyGet("map_pools_detailed");
    }

    @GetMapping("/ranked_list_detailed/{pool_id}/{page}")
    public ResponseEntity<?> rankedListDetailed(
            @PathVariable("pool_id") String poolId,
            @PathVariable("page") String page
    ) throws IOException, InterruptedException {
        return proxyGet("ranked_list_detailed/%s/%s".formatted(poolId, page));
    }

    @PostMapping(value = "/recalculate_cr", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> recalculateCr(@RequestBody String requestBody) throws IOException, InterruptedException {
        return proxyPost("pools/recalculate_cr", requestBody);
    }

    @PostMapping(value = "/set_manual", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> setManual(@RequestBody String requestBody) throws IOException, InterruptedException {
        return proxyPost("pools/set_manual", requestBody);
    }

    @PostMapping(value = "/set_automatic", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> setAutomatic(@RequestBody String requestBody) throws IOException, InterruptedException {
        return proxyPost("pools/set_automatic", requestBody);
    }

    private ResponseEntity<?> proxyPost(String hitbloqPath, String requestBody) throws IOException, InterruptedException {
        URI url = HITBLOQ_API_BASE_URL.resolve(hitbloqPath);
        log.info("Proxying: POST {} {}", url, requestBody);

        HttpRequest request = HttpRequest.newBuilder(url)
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .header("Accept", MediaType.APPLICATION_JSON_VALUE)
                .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        return parseLikeOriginalExpressProxy(response.body());
    }

    private ResponseEntity<?> proxyGet(String hitbloqPath) throws IOException, InterruptedException {
        URI url = HITBLOQ_API_BASE_URL.resolve(hitbloqPath);
        log.info("Proxying: GET {}", url);

        HttpRequest request = HttpRequest.newBuilder(url)
                .timeout(Duration.ofSeconds(30))
                .header("Accept", MediaType.APPLICATION_JSON_VALUE)
                .GET()
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        return parseLikeOriginalExpressProxy(response.body());
    }

    /**
     * Mirrors the original Express behavior:
     * - If the upstream response body is valid JSON, return it as JSON.
     * - If it is not valid JSON, return HTTP 500 with the raw text body.
     */
    private ResponseEntity<?> parseLikeOriginalExpressProxy(String text) {
        log.info("Hitbloq Response: {}", text);

        try {
            JsonNode json = objectMapper.readTree(text);
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(json);
        } catch (JsonProcessingException ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.TEXT_PLAIN)
                    .body(text);
        }
    }

    @ExceptionHandler({IOException.class, InterruptedException.class})
    public ResponseEntity<String> handleProxyError(Exception exception, HttpServletRequest request) {
        if (exception instanceof InterruptedException) {
            Thread.currentThread().interrupt();
        }

        log.error("Proxy error while handling {} {}", request.getMethod(), request.getRequestURI(), exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .contentType(MediaType.TEXT_PLAIN)
                .body("Proxy error: " + exception.getMessage());
    }
}
