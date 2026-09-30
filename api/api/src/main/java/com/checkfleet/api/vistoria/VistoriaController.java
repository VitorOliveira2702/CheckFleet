package com.checkfleet.api.vistoria;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/vistorias")
@CrossOrigin(origins = "http://localhost:4200") // origem do `ng serve` em desenvolvimento
public class VistoriaController {

    private final VistoriaRepository repository;

    public VistoriaController(VistoriaRepository repository) {
        this.repository = repository;
    }

    @GetMapping
    public List<Vistoria> listar() {
        return repository.findAll();
    }

    /**
     * Cadastra uma vistoria (RF01).
     *
     * Idempotente (RF09 / RNF05): se o id enviado já existir, devolve o registro
     * existente em vez de criar um novo. É o mesmo comportamento que a fila de
     * sincronização offline vai reaproveitar mais adiante, quando reenviar
     * vistorias que já tinham sido aceitas pelo servidor.
     */
    @PostMapping
    public ResponseEntity<Vistoria> cadastrar(@Valid @RequestBody VistoriaRequest request) {
        return repository.findById(request.id())
                .map(ResponseEntity::ok)
                .orElseGet(() -> {
                    List<ItemVistoria> itens = request.itens().stream()
                            .map(item -> new ItemVistoria(item.nome(), item.status(), item.observacao()))
                            .toList();
                    Vistoria vistoria = new Vistoria(request.id(), request.placa(), Instant.now(), itens);
                    Vistoria salva = repository.save(vistoria);
                    return ResponseEntity.status(HttpStatus.CREATED).body(salva);
                });
    }
}
