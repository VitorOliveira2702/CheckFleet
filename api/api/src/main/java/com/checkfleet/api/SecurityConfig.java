package com.checkfleet.api;

import com.checkfleet.api.auth.TokenService;
import com.nimbusds.jwt.JWTParser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtAudienceValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.SupplierJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

import java.text.ParseException;

/**
 * Autenticação por token (JWT), aceitando dois tipos de login:
 *
 * - Google: o front-end faz o login com o Google e recebe um ID token. Aqui o
 *   Spring confere a assinatura com as chaves públicas do Google e se o token
 *   foi emitido para o nosso Client ID (ver application.properties).
 * - E-mail e senha: o AuthController confere a senha e a própria API emite o
 *   token (ver TokenService).
 *
 * Toda requisição manda o token no cabeçalho "Authorization: Bearer ...". Não
 * há sessão no servidor: cada requisição se autentica sozinha, o que combina
 * com a fila de sincronização offline.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(Customizer.withDefaults()) // usa o @CrossOrigin dos controllers
                .csrf(csrf -> csrf.disable()) // API sem cookies, então CSRF não se aplica
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/actuator/health").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/cadastro", "/api/auth/login").permitAll()
                        // Rota interna para onde o Spring manda as respostas de erro. Sem liberar,
                        // um 409 ou 400 do cadastro chegaria ao navegador como 401.
                        .requestMatchers("/error").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()));
        return http.build();
    }

    /** Hash de senha com BCrypt: lento de propósito, para dificultar ataques de força bruta. */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Escolhe quem confere o token pelo emissor ("iss"). A escolha usa o token
     * ainda sem verificar, mas isso não abre brecha: a assinatura é sempre
     * conferida em seguida pelo decoder escolhido.
     */
    @Bean
    JwtDecoder jwtDecoder(TokenService tokenService,
                          @Value("${spring.security.oauth2.resourceserver.jwt.issuer-uri}") String emissorGoogle,
                          @Value("${spring.security.oauth2.resourceserver.jwt.audiences}") String clientIdGoogle) {
        JwtDecoder google = decoderGoogle(emissorGoogle, clientIdGoogle);
        JwtDecoder local = tokenService.decoder();
        return token -> TokenService.EMISSOR.equals(emissor(token)) ? local.decode(token) : google.decode(token);
    }

    /**
     * SupplierJwtDecoder só busca as chaves públicas do Google na primeira vez
     * que um token do Google chega. Assim a API sobe mesmo sem internet, e o
     * login com e-mail e senha funciona offline.
     */
    private static JwtDecoder decoderGoogle(String emissor, String clientId) {
        return new SupplierJwtDecoder(() -> {
            NimbusJwtDecoder decoder = NimbusJwtDecoder.withIssuerLocation(emissor).build();
            decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                    JwtValidators.createDefaultWithIssuer(emissor),
                    new JwtAudienceValidator(clientId)));
            return decoder;
        });
    }

    private static String emissor(String token) {
        try {
            return JWTParser.parse(token).getJWTClaimsSet().getIssuer();
        } catch (ParseException e) {
            throw new BadJwtException("Token malformado", e);
        }
    }
}
