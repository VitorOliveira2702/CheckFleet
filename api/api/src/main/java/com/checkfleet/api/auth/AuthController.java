package com.checkfleet.api.auth;

import com.checkfleet.api.usuario.Usuario;
import com.checkfleet.api.usuario.UsuarioRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

/**
 * Login com e-mail e senha, alternativa ao login com Google.
 *
 * As duas rotas são públicas (ver SecurityConfig) e devolvem um token emitido
 * pela própria API, que o front-end usa exatamente como usa o token do Google.
 */
@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "http://localhost:4200")
public class AuthController {

    private final UsuarioRepository usuarios;
    private final PasswordEncoder senhas;
    private final TokenService tokens;

    public AuthController(UsuarioRepository usuarios, PasswordEncoder senhas, TokenService tokens) {
        this.usuarios = usuarios;
        this.senhas = senhas;
        this.tokens = tokens;
    }

    public record CadastroRequest(
            @NotBlank String nome,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 8, max = 72) String senha
    ) {
    }

    public record LoginRequest(@NotBlank String email, @NotBlank String senha) {
    }

    public record TokenResponse(String token) {
    }

    @PostMapping("/cadastro")
    @ResponseStatus(HttpStatus.CREATED)
    public TokenResponse cadastrar(@Valid @RequestBody CadastroRequest request) {
        String email = normalizar(request.email());
        if (usuarios.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "E-mail já cadastrado");
        }
        Usuario usuario = new Usuario(UUID.randomUUID(), request.nome().trim(), email,
                senhas.encode(request.senha()), Instant.now());
        usuarios.save(usuario);
        return new TokenResponse(tokens.gerar(usuario));
    }

    /**
     * A mensagem de erro é a mesma para e-mail inexistente e senha errada, para
     * não revelar quais e-mails estão cadastrados.
     */
    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        Usuario usuario = usuarios.findByEmail(normalizar(request.email()))
                .filter(u -> senhas.matches(request.senha(), u.getSenhaHash()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "E-mail ou senha inválidos"));
        return new TokenResponse(tokens.gerar(usuario));
    }

    /** "Joao@Email.com " e "joao@email.com" são o mesmo usuário. */
    private static String normalizar(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
