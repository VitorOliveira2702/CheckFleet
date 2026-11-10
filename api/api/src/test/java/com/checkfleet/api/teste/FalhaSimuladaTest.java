package com.checkfleet.api.teste;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class FalhaSimuladaTest {

	@Test
	void desarmadaNuncaFalha() {
		FalhaSimulada falha = new FalhaSimulada();

		for (int i = 0; i < 100; i++) {
			assertDoesNotThrow(falha::antesDeGravar);
		}
	}

	@Test
	void deixaPassarAQuantidadePedidaEFalhaUmaVezSo() {
		FalhaSimulada falha = new FalhaSimulada();
		falha.armar(3);

		// as 3 primeiras gravações passam
		assertDoesNotThrow(falha::antesDeGravar);
		assertDoesNotThrow(falha::antesDeGravar);
		assertDoesNotThrow(falha::antesDeGravar);
		// a quarta responde erro 500
		assertThrows(ResponseStatusException.class, falha::antesDeGravar);
		// e o reenvio seguinte já encontra a API normal
		assertFalse(falha.armada());
		assertDoesNotThrow(falha::antesDeGravar);
	}
}
