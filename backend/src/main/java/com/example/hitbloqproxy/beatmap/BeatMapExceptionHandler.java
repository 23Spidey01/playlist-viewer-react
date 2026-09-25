package com.example.hitbloqproxy.beatmap;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class BeatMapExceptionHandler {
    @ExceptionHandler(BeatMapNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Map<String, String> handleBeatMapNotFound(BeatMapNotFoundException exception) {
        return Map.of("error", exception.getMessage());
    }
}
