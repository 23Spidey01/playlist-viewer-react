package com.example.hitbloqproxy.security;

import com.example.hitbloqproxy.user.UserAccount;
import com.example.hitbloqproxy.user.UserAccountRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class DatabaseUserDetailsService implements UserDetailsService {
    private final UserAccountRepository userRepository;

    public DatabaseUserDetailsService(UserAccountRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String login) {
        UserAccount user = userRepository
            .findUniqueByLogin(login)
            .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        return new AccountPrincipal(user);
    }
}
