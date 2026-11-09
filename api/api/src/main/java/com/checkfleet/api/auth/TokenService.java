package com.checkfleet.api.auth;

import com.checkfleet.api.usuario.Usuario;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

/**
 * Emite e confere os tokens (JWT) de quem entra com e-mail e senha.
 *
 * O token tem o mesmo formato do token do Google, com as claims "email" e
 * "name", para o resto da API tratar os dois logins do mesmo jeito. A
 * diferença é o emissor ("iss"): checkfleet-api em vez de accounts.google.com.
 * É por ele que o SecurityConfig decide quem confere cada token.
 *
 * A assinatura usa HMAC-SHA256 com uma chave secreta que só a API conhece.
 */
@Service
public class TokenService {

    public static final String EMISSOR = "checkfleet-api";

    private final JwtEncoder encoder;
    private final JwtDecoder decoder;
    private final Duration validade;

    public TokenService(@Value("${checkfleet.jwt.segredo}") String segredo,
                        @Value("${checkfleet.jwt.validade-horas}") long validadeHoras) {
        byte[] bytes = segredo.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("checkfleet.jwt.segredo precisa ter pelo menos 32 caracteres (256 bits)");
        }
        SecretKey chave = new SecretKeySpec(bytes, "HmacSHA256");

        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(chave));

        NimbusJwtDecoder nimbusDecoder = NimbusJwtDecoder.withSecretKey(chave).macAlgorithm(MacAlgorithm.HS256).build();
        // Confere a validade (exp) e se o token foi emitido por esta API.
        nimbusDecoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(EMISSOR));
        this.decoder = nimbusDecoder;

        this.validade = Duration.ofHours(validadeHoras);
    }

    public String gerar(Usuario usuario) {
        Instant agora = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(EMISSOR)
                .subject(usuario.getId().toString())
                .issuedAt(agora)
                .expiresAt(agora.plus(validade))
                .claim("email", usuario.getEmail())
                .claim("name", usuario.getNome())
                .build();
        JwsHeader cabecalho = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(cabecalho, claims)).getTokenValue();
    }

    /** Decoder usado pelo SecurityConfig para os tokens emitidos aqui. */
    public JwtDecoder decoder() {
        return decoder;
    }
}
