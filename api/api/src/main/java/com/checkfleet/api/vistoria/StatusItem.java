package com.checkfleet.api.vistoria;

/**
 * Situação de um item do checklist de vistoria (RF01).
 *
 * ATENCAO foi adicionado depois (item que ainda passa, mas precisa de
 * acompanhamento). DEFEITO mantém o nome original para não quebrar as
 * vistorias já gravadas; na interface ele aparece como "Reprovado".
 */
public enum StatusItem {
    OK,
    ATENCAO,
    DEFEITO
}
