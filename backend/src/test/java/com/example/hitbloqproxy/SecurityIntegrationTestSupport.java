package com.example.hitbloqproxy;

import com.example.hitbloqproxy.apikey.UserApiKeyRepository;
import com.example.hitbloqproxy.apikey.UserApiKeyService;
import com.example.hitbloqproxy.user.UserAccount;
import com.example.hitbloqproxy.user.UserAccountRepository;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class SecurityIntegrationTestSupport {
    protected static final String PASSWORD = "Valid-password-123!";
    @Autowired protected MockMvc mvc;
    @Autowired protected UserAccountRepository users;
    @Autowired protected UserApiKeyRepository keys;
    @Autowired protected UserApiKeyService keyService;
    @Autowired protected PasswordEncoder encoder;

    @BeforeEach
    void cleanAccounts() {
        keys.deleteAll();
        users.deleteAll();
    }

    protected UserAccount account(String username) {
        UserAccount user = new UserAccount();
        user.setUsername(username);
        user.setEmail(username + "@example.com");
        user.setPasswordHash(encoder.encode(PASSWORD));
        return users.saveAndFlush(user);
    }

    protected MockHttpSession login(String username) throws Exception {
        return login(username, PASSWORD);
    }

    protected MockHttpSession login(String username, String password) throws Exception {
        return (MockHttpSession) mvc.perform(post("/api/auth/login").with(csrf())
                        .param("username", username).param("password", password))
                .andExpect(status().isNoContent()).andReturn().getRequest().getSession(false);
    }
}
