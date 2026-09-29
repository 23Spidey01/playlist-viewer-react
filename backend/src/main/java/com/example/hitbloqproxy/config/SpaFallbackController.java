package com.example.hitbloqproxy.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class SpaFallbackController {
    /*
     * A direct navigation or refresh on a client-side route hits the
     * server for that exact path. Spring only knows real files and the
     * /api and /proxy endpoints, so without this it 404s instead of
     * loading the app. Mirrors the <Route> list in App.tsx — add new
     * client-side routes here too, or they'll 404 on direct load.
     */
    @RequestMapping({"/pool/{id}", "/pool/{poolId}/rank-new", "/song/{id}", "/login", "/api-keys", "/account"})
    public String forward() {
        return "forward:/index.html";
    }
}
