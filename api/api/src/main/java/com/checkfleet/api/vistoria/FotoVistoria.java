package com.checkfleet.api.vistoria;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * Foto anexada a uma vistoria (evidência para o laudo).
 *
 * A imagem chega do front-end já comprimida, como data URL em base64
 * ("data:image/jpeg;base64,..."). Guardar o texto direto no banco é a opção
 * mais simples para a PoC: a foto viaja junto com a vistoria no mesmo JSON,
 * então a sincronização continua sendo uma única requisição idempotente.
 */
@Embeddable
public class FotoVistoria {

    private String legenda;

    @Column(name = "data_url", columnDefinition = "TEXT")
    private String dataUrl;

    protected FotoVistoria() {
        // exigido pelo JPA
    }

    public FotoVistoria(String legenda, String dataUrl) {
        this.legenda = legenda;
        this.dataUrl = dataUrl;
    }

    public String getLegenda() {
        return legenda;
    }

    public String getDataUrl() {
        return dataUrl;
    }
}
