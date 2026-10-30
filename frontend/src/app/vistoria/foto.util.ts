/**
 * Reduz uma foto da câmera (vários MB) para um JPEG de ~100–200 KB.
 *
 * Isso importa para o offline-first: a foto viaja junto com a vistoria no
 * mesmo JSON (e, mais adiante, fica guardada no IndexedDB), então quanto
 * menor, mais rápido sincroniza em conexão ruim.
 */
export function comprimirImagem(arquivo: File, ladoMaximo = 1280, qualidade = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const imagem = new Image();

    imagem.onload = () => {
      const escala = Math.min(1, ladoMaximo / Math.max(imagem.width, imagem.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(imagem.width * escala);
      canvas.height = Math.round(imagem.height * escala);
      canvas.getContext('2d')!.drawImage(imagem, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', qualidade));
    };
    imagem.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Arquivo de imagem inválido.'));
    };

    imagem.src = url;
  });
}
