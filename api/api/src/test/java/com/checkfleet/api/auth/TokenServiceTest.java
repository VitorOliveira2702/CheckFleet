package com.checkfleet.api.auth;

import com.checkfleet.api.usuario.Usuario;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TokenServiceTest {

	private static final String SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres";

	private final Usuario usuario = new Usuario(UUID.randomUUID(), "Maria Inspetora", "maria@empresa.com", "hash", Instant.now());

	@Test
	void tokenGeradoTemAsMesmasClaimsQueOTokenDoGoogle() {
		TokenService tokens = new TokenService(SEGREDO, 12);

		Jwt jwt = tokens.decoder().decode(tokens.gerar(usuario));

		assertEquals(TokenService.EMISSOR, jwt.getClaimAsString("iss"));
		assertEquals(usuario.getId().toString(), jwt.getSubject());
		assertEquals("maria@empresa.com", jwt.getClaimAsString("email"));
		assertEquals("Maria Inspetora", jwt.getClaimAsString("name"));
		assertTrue(jwt.getExpiresAt().isAfter(Instant.now().plusSeconds(11 * 3600)));
	}

	@Test
	void recusaTokenAssinadoComOutraChave() {
		TokenService falsificador = new TokenService("outra-chave-que-a-api-nao-conhece-1234", 12);
		TokenService api = new TokenService(SEGREDO, 12);

		String falso = falsificador.gerar(usuario);

		assertThrows(JwtException.class, () -> api.decoder().decode(falso));
	}

	@Test
	void recusaTokenVencido() {
		// Token com a assinatura certa, mas que venceu há 1 hora.
		SecretKey chave = new SecretKeySpec(SEGREDO.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
		Instant agora = Instant.now();
		JwtClaimsSet claims = JwtClaimsSet.builder()
				.issuer(TokenService.EMISSOR)
				.subject(usuario.getId().toString())
				.issuedAt(agora.minus(Duration.ofHours(13)))
				.expiresAt(agora.minus(Duration.ofHours(1)))
				.build();
		String vencido = new NimbusJwtEncoder(new ImmutableSecret<>(chave))
				.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
				.getTokenValue();

		TokenService tokens = new TokenService(SEGREDO, 12);

		assertThrows(JwtException.class, () -> tokens.decoder().decode(vencido));
	}

	@Test
	void exigeSegredoDePeloMenos32Caracteres() {
		assertThrows(IllegalStateException.class, () -> new TokenService("curto", 12));
	}
}
