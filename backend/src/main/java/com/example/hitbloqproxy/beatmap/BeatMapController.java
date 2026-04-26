package com.example.hitbloqproxy.beatmap;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/beatmaps")
public class BeatMapController {

    private final BeatMapRepository beatMapRepository;

    public BeatMapController(BeatMapRepository beatMapRepository) {
        this.beatMapRepository = beatMapRepository;
    }

    @GetMapping
    public List<BeatMap> getAllBeatMaps() {
        return beatMapRepository.findAll();
    }

    @GetMapping("/{id}")
    public BeatMap getBeatMapById(@PathVariable Long id) {
        return beatMapRepository.findById(id).orElseThrow(() -> new BeatMapNotFoundException(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BeatMap createBeatMap(@RequestBody CreateBeatMapRequest request) {
        BeatMap beatMap = new BeatMap(request.name());
        return beatMapRepository.save(beatMap);
    }
}