package com.example.hitbloqproxy.beatmap;

public class BeatMapNotFoundException extends RuntimeException {

    public BeatMapNotFoundException(Long id) {
        super("BeatMap not found with id: " + id);
    }
}