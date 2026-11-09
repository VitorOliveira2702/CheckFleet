package com.checkfleet.api.vistoria;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface VistoriaRepository extends JpaRepository<Vistoria, UUID> {

    // Usados só pelo TesteController, para contar e apagar as vistorias de teste (placa TST...).
    long countByPlacaStartingWith(String prefixo);

    List<Vistoria> findByPlacaStartingWith(String prefixo);
}
