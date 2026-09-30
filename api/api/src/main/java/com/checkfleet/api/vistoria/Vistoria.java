package com.checkfleet.api.vistoria;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Vistoria de um veículo (RF01): placa + checklist de itens.
 *
 * O id é um UUID gerado no front-end (crypto.randomUUID()) no momento em que o
 * inspetor preenche o checklist, mesmo offline. Usar esse UUID como chave
 * primária é o que permite a sincronização idempotente (RF09 / RNF05): se a
 * mesma vistoria for enviada de novo ao servidor (por exemplo, depois de uma
 * queda de conexão), o id já existente evita que ela seja duplicada.
 */
@Entity
@Table(name = "vistorias")
public class Vistoria {

    @Id
    private UUID id;

    @Column(nullable = false)
    private String placa;

    @Column(name = "data_hora", nullable = false)
    private Instant dataHora;

    @ElementCollection
    @CollectionTable(name = "vistoria_itens", joinColumns = @JoinColumn(name = "vistoria_id"))
    private List<ItemVistoria> itens = new ArrayList<>();

    protected Vistoria() {
        // exigido pelo JPA
    }

    public Vistoria(UUID id, String placa, Instant dataHora, List<ItemVistoria> itens) {
        this.id = id;
        this.placa = placa;
        this.dataHora = dataHora;
        this.itens = itens;
    }

    public UUID getId() {
        return id;
    }

    public String getPlaca() {
        return placa;
    }

    public Instant getDataHora() {
        return dataHora;
    }

    public List<ItemVistoria> getItens() {
        return itens;
    }
}
