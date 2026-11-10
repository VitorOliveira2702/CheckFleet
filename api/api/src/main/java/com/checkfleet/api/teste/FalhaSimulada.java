package com.checkfleet.api.teste;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Falha controlada para o teste T07 (queda da API no meio do envio de um lote).
 *
 * Depois de armada com {@link #armar(int)}, deixa passar a quantidade pedida de
 * gravações e faz a seguinte responder erro 500. A falha acontece uma única
 * vez: o reenvio feito pelo aparelho em seguida já encontra a API normal.
 *
 * Fica sempre desarmada, a menos que alguém a arme pelo {@link TesteController},
 * que só existe quando a API roda com o perfil "teste".
 */
@Component
public class FalhaSimulada {

    private static final int DESARMADA = -1;

    /** Quantas gravações ainda passam antes da falha. */
    private final AtomicInteger gravacoesRestantes = new AtomicInteger(DESARMADA);

    public void armar(int gravacoesAntesDaFalha) {
        gravacoesRestantes.set(gravacoesAntesDaFalha);
    }

    public void desarmar() {
        gravacoesRestantes.set(DESARMADA);
    }

    public boolean armada() {
        return gravacoesRestantes.get() != DESARMADA;
    }

    /** Chamado pelo VistoriaController antes de gravar cada vistoria nova. */
    public void antesDeGravar() {
        if (!armada()) {
            return;
        }
        if (gravacoesRestantes.getAndDecrement() == 0) {
            desarmar();
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Falha simulada para teste");
        }
    }
}
