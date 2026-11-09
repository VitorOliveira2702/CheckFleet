package com.checkfleet.api.teste;

import com.checkfleet.api.vistoria.Vistoria;
import com.checkfleet.api.vistoria.VistoriaRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Apoio aos testes da monografia (T05 a T08). Só existe quando a API roda com
 * o perfil "teste":
 *
 *   ./mvnw spring-boot:run -Dspring-boot.run.profiles=teste
 *
 * As vistorias de teste são as que têm a placa começando com TST (geradas
 * pelo comando checkfleet.gerar do front-end); as demais nunca são tocadas.
 */
@RestController
@RequestMapping("/api/teste")
@CrossOrigin(origins = "http://localhost:4200")
@Profile("teste")
public class TesteController {

    private static final String PREFIXO_PLACA = "TST";

    private final VistoriaRepository repository;
    private final FalhaSimulada falhaSimulada;

    public TesteController(VistoriaRepository repository, FalhaSimulada falhaSimulada) {
        this.repository = repository;
        this.falhaSimulada = falhaSimulada;
    }

    /** Faz a API gravar `apos` vistorias e responder erro 500 na seguinte (T07). */
    @PostMapping("/falha")
    public Map<String, Object> armarFalha(@RequestParam("apos") int apos) {
        falhaSimulada.armar(apos);
        return Map.of("falhaArmada", true, "gravacoesAntesDaFalha", apos);
    }

    @DeleteMapping("/falha")
    public Map<String, Object> desarmarFalha() {
        falhaSimulada.desarmar();
        return Map.of("falhaArmada", false);
    }

    /** Contagem direta no banco, para comparar com o que o aparelho gerou. */
    @GetMapping("/resumo")
    public Map<String, Object> resumo() {
        return Map.of(
                "vistoriasDeTeste", repository.countByPlacaStartingWith(PREFIXO_PLACA),
                "falhaArmada", falhaSimulada.armada());
    }

    /** Apaga as vistorias de teste, para repetir um teste com o banco limpo. */
    @DeleteMapping("/vistorias")
    public Map<String, Object> apagarVistoriasDeTeste() {
        List<Vistoria> deTeste = repository.findByPlacaStartingWith(PREFIXO_PLACA);
        repository.deleteAll(deTeste);
        falhaSimulada.desarmar();
        return Map.of("apagadas", deTeste.size());
    }
}
