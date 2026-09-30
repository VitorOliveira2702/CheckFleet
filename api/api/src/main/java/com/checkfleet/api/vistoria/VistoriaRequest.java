package com.checkfleet.api.vistoria;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

/**
 * Corpo esperado em POST /api/vistorias.
 *
 * O id vem pronto do front-end (ver {@link Vistoria}) — é o que possibilita a
 * verificação de idempotência no controller.
 */
public record VistoriaRequest(
        @NotNull UUID id,
        @NotBlank String placa,
        @NotEmpty @Valid List<ItemRequest> itens
) {
    public record ItemRequest(
            @NotBlank String nome,
            @NotNull StatusItem status,
            String observacao
    ) {
    }
}
