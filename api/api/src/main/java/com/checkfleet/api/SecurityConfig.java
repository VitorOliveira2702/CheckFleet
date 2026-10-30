package com.checkfleet.api;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Autenticação via Google.
 *
 * O front-end faz o login com o Google e recebe um ID token (JWT). Toda
 * requisição à API manda esse token no cabeçalho "Authorization: Bearer ...".
 * Aqui o Spring confere a assinatura do token com as chaves públicas do Google
 * e se ele foi emitido para o nosso Client ID (ver application.properties).
 * Não há sessão no servidor: cada requisição se autentica sozinha, o que
 * combina com a fila de sincronização offline.
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
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()));
        return http.build();
    }
}
