import { useState } from 'react';

/** Foto do candidato com borda na cor do partido; cai nas iniciais se a foto falhar. */
export function Avatar({ cand, tamanho = 36 }) {
  const [falhou, setFalhou] = useState(false);
  if (!cand) return null;
  const ini = String(cand.nome || '?').split(' ').map((p) => p[0]).slice(0, 2).join('');
  const estilo = { width: tamanho, height: tamanho, borderColor: cand.cor };
  if (cand.foto && !falhou) {
    return (
      <img
        src={cand.foto}
        alt={cand.nome}
        onError={() => setFalhou(true)}
        style={estilo}
        className="rounded-full object-cover border-2 shrink-0 bg-[#1b1b20]"
      />
    );
  }
  return (
    <div
      style={{ ...estilo, background: cand.cor, fontSize: tamanho * 0.34 }}
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
    >
      {ini}
    </div>
  );
}
