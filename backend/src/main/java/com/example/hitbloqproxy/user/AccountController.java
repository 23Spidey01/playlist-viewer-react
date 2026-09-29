package com.example.hitbloqproxy.user;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.web.bind.annotation.*;
import com.example.hitbloqproxy.security.AccountPrincipal;

@RestController
@RequestMapping("/api/account")
public class AccountController {
    private final AccountService accountService;
    private final SecurityContextLogoutHandler logoutHandler = new SecurityContextLogoutHandler();

    public AccountController(AccountService accountService) {
        this.accountService = accountService;
    }

    @PutMapping("/email")
    public ResponseEntity<Void> changeEmail(
            @Valid @RequestBody ChangeEmailRequest request,
            Authentication authentication,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        var userId = AccountPrincipal.requireUserId(authentication);

        accountService.changeEmail(userId, request.currentPassword(), request.newEmail());

        logout(servletRequest, servletResponse, authentication);

        return ResponseEntity.noContent().build();
    }

    @PutMapping("/username")
    public ResponseEntity<Void> changeUsername(
            @Valid @RequestBody ChangeUsernameRequest request,
            Authentication authentication,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        var userId = AccountPrincipal.requireUserId(authentication);

        accountService.changeUsername(userId, request.currentPassword(), request.newUsername());

        logout(servletRequest, servletResponse, authentication);

        return ResponseEntity.noContent().build();
    }

    @PutMapping("/password")
    public ResponseEntity<Void> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            Authentication authentication,
            HttpServletRequest servletRequest,
            HttpServletResponse servletResponse
    ) {
        var userId = AccountPrincipal.requireUserId(authentication);

        accountService.changePassword(userId, request.currentPassword(), request.newPassword());

        logout(servletRequest, servletResponse, authentication);

        return ResponseEntity.noContent().build();
    }

    private void logout(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        logoutHandler.logout(request, response, authentication);
    }

    public record ChangeEmailRequest(@NotBlank @Email String newEmail, @NotBlank String currentPassword) {}

    public record ChangeUsernameRequest(
            @NotBlank @Size(min = 3, max = 50) String newUsername,
            @NotBlank String currentPassword
    ) {}

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 12, max = 128) String newPassword
    ) {}
}
