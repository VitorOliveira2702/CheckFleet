package com.checkfleet.api;

import com.checkfleet.api.auth.TokenService;
import com.checkfleet.api.usuario.Usuario;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * O decoder da API aceita os dois logins. Aqui só o token próprio é testado:
 * conferir um token do Google exigiria buscar as chaves do Google na internet.
 */
class SecurityConfigTest {

	private final TokenService tokens = new TokenService("segredo-de-teste-com-mais-de-32-caracteres", 12);
	private final JwtDecoder decoder = new SecurityConfig()
			.jwtDecoder(tokens, "https://accounts.google.com", "client-id-de-teste");

	@Test
	void aceitaOTokenEmitidoPelaApiSemConsultarOGoogle() {
		Usuario usuario = new Usuario(UUID.randomUUID(), "Maria", "maria@empresa.com", "hash", Instant.now());

		String email = decoder.decode(tokens.gerar(usuario)).getClaimAsString("email");

		assertEquals("maria@empresa.com", email);
	}

	@Test
	void recusaTextoQueNaoEJwt() {
		assertThrows(BadJwtException.class, () -> decoder.decode("isto-nao-e-um-token"));
	}
}
