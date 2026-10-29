package com.checkfleet.api.vistoria;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

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
        return repository.findAll(Sort.by(Sort.Direction.DESC, "dataHora"));
    }

    /**
     * Cadastra uma vistoria (RF01).
     *
     * Idempotente (RF09 / RNF05): se o id enviado já existir, devolve o registro
     * existente em vez de criar um novo.
     */
    @PostMapping
    public ResponseEntity<Vistoria> cadastrar(@Valid @RequestBody VistoriaRequest request,
                                              @AuthenticationPrincipal Jwt usuario) {
        Optional<Vistoria> existente = repository.findById(request.id());
        if (existente.isPresent()) {
            return ResponseEntity.ok(existente.get());
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(salvar(request, usuario));
    }

    /**
     * Sincronização em lote (RF06): recebe de uma vez todas as vistorias que
     * ficaram na fila do aparelho enquanto ele estava offline.
     *
     * Cada vistoria é tratada de forma idempotente (RF09 / RNF05). Se a conexão
     * cair no meio do envio e o aparelho reenviar o lote inteiro, as que já
     * tinham sido gravadas são apenas devolvidas, sem duplicar.
     */
    @PostMapping("/lote")
    public List<Vistoria> sincronizarLote(@RequestBody @Size(max = 50) List<@Valid VistoriaRequest> lote,
                                          @AuthenticationPrincipal Jwt usuario) {
        return lote.stream()
                .map(request -> repository.findById(request.id()).orElseGet(() -> salvar(request, usuario)))
                .toList();
    }

    /**
     * O vistoriador vem do token do Google já validado pelo Spring Security
     * (ver SecurityConfig), e não do JSON, para que ninguém registre uma
     * vistoria em nome de outra pessoa.
     */
    private Vistoria salvar(VistoriaRequest request, Jwt usuario) {
        List<ItemVistoria> itens = request.itens().stream()
                .map(item -> new ItemVistoria(item.nome(), item.status(), item.observacao()))
                .toList();
        List<FotoVistoria> fotos = request.fotos() == null ? List.of() : request.fotos().stream()
                .map(foto -> new FotoVistoria(foto.legenda(), foto.dataUrl()))
                .toList();
        Instant dataHora = request.dataHora() != null ? request.dataHora() : Instant.now();
        Vistoria vistoria = new Vistoria(request.id(), request.placa(), dataHora,
                request.finalidade(), request.hodometro(),
                usuario.getClaimAsString("email"), usuario.getClaimAsString("name"),
                itens, fotos);
        return repository.save(vistoria);
    }
}
