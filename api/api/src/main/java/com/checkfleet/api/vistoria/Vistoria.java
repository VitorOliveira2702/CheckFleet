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

    /** Cautelar, Transferência ou Prévia de seguro (opcional). */
    private String finalidade;

    private Integer hodometro;

    /** Quem fez a vistoria, lido do token do Google (não do corpo da requisição). */
    @Column(name = "vistoriador_email")
    private String vistoriadorEmail;

    @Column(name = "vistoriador_nome")
    private String vistoriadorNome;

    @ElementCollection
    @CollectionTable(name = "vistoria_itens", joinColumns = @JoinColumn(name = "vistoria_id"))
    private List<ItemVistoria> itens = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "vistoria_fotos", joinColumns = @JoinColumn(name = "vistoria_id"))
    private List<FotoVistoria> fotos = new ArrayList<>();

    protected Vistoria() {
        // exigido pelo JPA
    }

    public Vistoria(UUID id, String placa, Instant dataHora, String finalidade, Integer hodometro,
                    String vistoriadorEmail, String vistoriadorNome,
                    List<ItemVistoria> itens, List<FotoVistoria> fotos) {
        this.id = id;
        this.placa = placa;
        this.dataHora = dataHora;
        this.finalidade = finalidade;
        this.hodometro = hodometro;
        this.vistoriadorEmail = vistoriadorEmail;
        this.vistoriadorNome = vistoriadorNome;
        this.itens = itens;
        this.fotos = fotos;
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

    public String getFinalidade() {
        return finalidade;
    }

    public Integer getHodometro() {
        return hodometro;
    }

    public String getVistoriadorEmail() {
        return vistoriadorEmail;
    }

    public String getVistoriadorNome() {
        return vistoriadorNome;
    }

    public List<ItemVistoria> getItens() {
        return itens;
    }

    public List<FotoVistoria> getFotos() {
        return fotos;
    }
}
