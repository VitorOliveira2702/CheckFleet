package com.checkfleet.api.vistoria;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface VistoriaRepository extends JpaRepository<Vistoria, UUID> {
}
