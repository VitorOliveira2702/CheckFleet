package com.checkfleet.api.vistoria;

import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

/**
 * Um item do checklist (ex.: "Pneus", "Freios"). É @Embeddable porque não existe
 * sozinho no banco: ele só faz sentido dentro de uma Vistoria (ver
 * {@link Vistoria#getItens()}).
 */
@Embeddable
public class ItemVistoria {

    private String nome;

    @Enumerated(EnumType.STRING)
    private StatusItem status;

    private String observacao;

    protected ItemVistoria() {
        // exigido pelo JPA
    }

    public ItemVistoria(String nome, StatusItem status, String observacao) {
        this.nome = nome;
        this.status = status;
        this.observacao = observacao;
    }

    public String getNome() {
        return nome;
    }

    public StatusItem getStatus() {
        return status;
    }

    public String getObservacao() {
        return observacao;
    }
}
