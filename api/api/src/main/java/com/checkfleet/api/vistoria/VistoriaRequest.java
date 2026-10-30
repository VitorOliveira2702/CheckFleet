package com.checkfleet.api.vistoria;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Corpo esperado em POST /api/vistorias (e em cada item de /api/vistorias/lote).
 *
 * O id vem pronto do front-end (ver {@link Vistoria}) — é o que possibilita a
 * verificação de idempotência no controller.
 *
 * dataHora é o momento em que a vistoria foi feita no aparelho. Uma vistoria
 * feita offline pode chegar horas depois; sem esse campo, o servidor gravaria
 * a hora da sincronização em vez da hora real da inspeção.
 */
public record VistoriaRequest(
        @NotNull UUID id,
        @NotBlank String placa,
        Instant dataHora,
        String finalidade,
        @PositiveOrZero Integer hodometro,
        @NotEmpty @Valid List<ItemRequest> itens,
        @Size(max = 12) @Valid List<FotoRequest> fotos
) {
    public record ItemRequest(
            @NotBlank String nome,
            @NotNull StatusItem status,
            String observacao
    ) {
    }

    public record FotoRequest(
            String legenda,
            @NotBlank String dataUrl
    ) {
    }
}
