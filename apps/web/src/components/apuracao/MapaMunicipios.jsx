import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { feature, mesh } from 'topojson-client';
import { Avatar } from './ui.jsx';
import { fmtPct } from './formato.js';
import { liderDe } from './MapaBrasil.jsx';

/**
 * Mapa da apuração em Canvas 2D: 5.570 municípios pintados pela cor do líder,
 * intensidade pela margem, divisas de estado por cima, rótulos/pílulas por UF,
 * tooltip no mouse, zoom (roda, pinça, duplo clique, botões) e arrastar.
 *
 * A malha vem pré-projetada (0..1000) de public/apuracao/br-mun.topo.json —
 * gerada por scripts/build-mapa.mjs. Nada de d3 em runtime.
 */

const VERSAO_MALHA = '3';
const FUNDO = '#0b0b0d';
const SEM_DADO = '#1f1f25';
const PASSOS_MARGEM = [10, 25, 45];           // legenda: até 10 · 25 · 45 · mais pontos
const FATORES = [0.4, 0.6, 0.8, 1];           // margem pequena = mais escuro
const LATERAIS = ['RN', 'PB', 'PE', 'AL', 'SE', 'ES', 'RJ'];
const UF_IBGE = {
  11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI',
  23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE', 27: 'AL', 28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES',
  33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF',
};
const CEL = 25; // célula do índice espacial (unidades do mapa)

// ── cor ─────────────────────────────────────────────────────────────────────
const cacheCor = new Map();
function misturar(hex, f) {
  const chave = hex + f;
  let c = cacheCor.get(chave);
  if (!c) {
    const n = parseInt(hex.slice(1), 16), b = parseInt(FUNDO.slice(1), 16);
    const mix = (s) => Math.round(((b >> s) & 255) + ((((n >> s) & 255) - ((b >> s) & 255)) * f));
    c = `rgb(${mix(16)},${mix(8)},${mix(0)})`;
    cacheCor.set(chave, c);
  }
  return c;
}
export function corPorMargem(hex, margem) {
  const i = margem < PASSOS_MARGEM[0] ? 0 : margem < PASSOS_MARGEM[1] ? 1 : margem < PASSOS_MARGEM[2] ? 2 : 3;
  return misturar(hex || '#4B5563', FATORES[i]);
}
export const ESCALA_LEGENDA = FATORES;

// ── geometria ───────────────────────────────────────────────────────────────
function pathPoligono(g) {
  const p = new Path2D();
  const anel = (r) => { for (let i = 0; i < r.length; i++) i ? p.lineTo(r[i][0], r[i][1]) : p.moveTo(r[i][0], r[i][1]); p.closePath(); };
  if (g.type === 'Polygon') g.coordinates.forEach(anel);
  else g.coordinates.forEach((pol) => pol.forEach(anel));
  return p;
}
function pathLinhas(g) {
  const p = new Path2D();
  for (const l of g.coordinates) for (let i = 0; i < l.length; i++) i ? p.lineTo(l[i][0], l[i][1]) : p.moveTo(l[i][0], l[i][1]);
  return p;
}
function bboxDe(g) {
  const b = [1e9, 1e9, -1e9, -1e9];
  const ver = (r) => { for (const [x, y] of r) { if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; } };
  if (g.type === 'Polygon') g.coordinates.forEach(ver); else g.coordinates.forEach((p) => p.forEach(ver));
  return b;
}
function centroideDe(g) {
  const aneis = g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]);
  let melhor = null, maior = 0;
  for (const r of aneis) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < r.length - 1; i++) {
      const f = r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
      a += f; cx += (r[i][0] + r[i + 1][0]) * f; cy += (r[i][1] + r[i + 1][1]) * f;
    }
    if (Math.abs(a) > maior) { maior = Math.abs(a); melhor = [cx / (3 * a), cy / (3 * a)]; }
  }
  return melhor || [0, 0];
}

const reduzMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const easing = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ═════════════════════════════════════════════════════════════════════════════
export default function MapaMunicipios({
  dadosUF, resumo, info, mapaCand, modo = 'municipios', candidatoFiltro,
  ufSel, munSel, onSelecionar,
}) {
  const caixaRef = useRef(null);
  const canvasRef = useRef(null);
  const baseRef = useRef(null);      // camada-base (preenchimentos + divisas) em cache
  const anteriorRef = useRef(null);  // cópia para a transição suave de cores
  const geo = useRef(null);
  const vista = useRef({ k: 1, x: 0, y: 0 });
  const encaixe = useRef(null);
  const tam = useRef({ w: 0, h: 0 });
  const hoverRef = useRef(-1);
  const animRef = useRef(0);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState(false);
  const [, setTick] = useState(0);   // re-render das camadas HTML quando a vista muda
  const [hover, setHover] = useState(null); // { idx, sx, sy }
  const rerender = () => setTick((t) => (t + 1) % 1e9);
  // Cores e seleção via ref: as funções de desenho ficam estáveis e nunca usam
  // valores velhos (resize, roda do mouse e animação registram callbacks uma vez).
  const coresRef = useRef(null);
  const selRef = useRef({ ufSel, munSel });
  selRef.current = { ufSel, munSel };

  // ── carga da malha (uma vez) ──────────────────────────────────────────────
  useEffect(() => {
    let vivo = true;
    Promise.all([
      fetch(`/apuracao/br-mun.topo.json?v=${VERSAO_MALHA}`).then((r) => { if (!r.ok) throw 0; return r.json(); }),
      fetch(`/apuracao/uf-paths.json?v=${VERSAO_MALHA}`).then((r) => { if (!r.ok) throw 0; return r.json(); }),
    ]).then(([topo, ufp]) => {
      if (!vivo) return;
      const obj = topo.objects.mun;
      const feats = feature(topo, obj).features.map((f) => {
        const id = String(f.id);
        return { id, uf: UF_IBGE[id.slice(0, 2)], path: pathPoligono(f.geometry), bbox: bboxDe(f.geometry), c: centroideDe(f.geometry) };
      });
      const porId = new Map(feats.map((f, i) => [f.id, i]));
      const grade = new Map();
      const bboxUF = {};
      const total = [1e9, 1e9, -1e9, -1e9];
      feats.forEach((f, i) => {
        const [a, b, c, d] = f.bbox;
        for (let gx = Math.floor(a / CEL); gx <= Math.floor(c / CEL); gx++)
          for (let gy = Math.floor(b / CEL); gy <= Math.floor(d / CEL); gy++) {
            const k = gx + ',' + gy;
            if (!grade.has(k)) grade.set(k, []);
            grade.get(k).push(i);
          }
        const u = (bboxUF[f.uf] ||= [1e9, 1e9, -1e9, -1e9]);
        u[0] = Math.min(u[0], a); u[1] = Math.min(u[1], b); u[2] = Math.max(u[2], c); u[3] = Math.max(u[3], d);
        total[0] = Math.min(total[0], a); total[1] = Math.min(total[1], b); total[2] = Math.max(total[2], c); total[3] = Math.max(total[3], d);
      });
      const contornos = new Map();
      geo.current = {
        feats, porId, grade, bboxUF, total,
        ufs: ufp.ufs,
        bordasMun: pathLinhas(mesh(topo, obj, (a, b) => a !== b)),
        bordasUF: pathLinhas(mesh(topo, obj, (a, b) => a === b || String(a.id).slice(0, 2) !== String(b.id).slice(0, 2))),
        contorno(uf) {
          if (!contornos.has(uf)) {
            const em = (g) => UF_IBGE[String(g.id).slice(0, 2)] === uf;
            contornos.set(uf, pathLinhas(mesh(topo, obj, (a, b) => (a === b ? em(a) : em(a) !== em(b)))));
          }
          return contornos.get(uf);
        },
        hitCtx: document.createElement('canvas').getContext('2d'),
      };
      setPronto(true);
    }).catch(() => vivo && setErro(true));
    return () => { vivo = false; };
  }, []);

  // ── cores por município (recalcula só quando dado/modo muda) ──────────────
  const cores = useMemo(() => {
    const G = geo.current;
    if (!pronto || !G) return null;
    const corUF = {};
    for (const [uf, d] of Object.entries(dadosUF || {})) {
      const l = liderDe(d, mapaCand);
      corUF[uf] = l ? corPorMargem(l.cand?.cor, l.margem) : SEM_DADO;
    }
    return G.feats.map((f) => {
      const r = resumo?.[f.id];
      if (modo === 'estados' || !resumo) return corUF[f.uf] || SEM_DADO;
      if (!r || !r[5]) return SEM_DADO;
      if (modo === 'apurado') return misturar('#E8E8EA', Math.max(0.12, r[0] / 100));
      if (modo === 'candidato') {
        const v = r[1] === candidatoFiltro ? r[2] : r[3] === candidatoFiltro ? r[4] : 0;
        const share = v / r[5];
        return misturar(mapaCand[candidatoFiltro]?.cor || '#4B5563', Math.min(1, 0.15 + share * 1.2));
      }
      if (modo === 'vantagem') return misturar('#E8E8EA', Math.min(1, 0.12 + ((r[2] - r[4]) / r[5]) * 1.6));
      return corPorMargem(mapaCand[r[1]]?.cor, ((r[2] - r[4]) / r[5]) * 100);
    });
  }, [pronto, resumo, dadosUF, mapaCand, modo, candidatoFiltro]);
  coresRef.current = cores;

  // ── desenho ───────────────────────────────────────────────────────────────
  const desenharBase = useCallback(() => {
    const G = geo.current, cv = canvasRef.current, base = baseRef.current, cores = coresRef.current;
    const { ufSel } = selRef.current;
    if (!G || !cv || !base || !cores) return;
    const dpr = window.devicePixelRatio || 1;
    const { k, x, y } = vista.current;
    const ctx = base.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, base.width, base.height);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y);
    for (let i = 0; i < G.feats.length; i++) { ctx.fillStyle = cores[i]; ctx.fill(G.feats[i].path, 'evenodd'); }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(11,11,13,0.42)'; ctx.lineWidth = 0.32 / k; ctx.stroke(G.bordasMun);
    if (ufSel && G.bboxUF[ufSel]) {
      // Esmaece o resto do país e repinta só a UF escolhida.
      ctx.fillStyle = 'rgba(11,11,13,0.66)'; ctx.fillRect(-2000, -2000, 5000, 5000);
      for (let i = 0; i < G.feats.length; i++) {
        if (G.feats[i].uf !== ufSel) continue;
        ctx.fillStyle = cores[i]; ctx.fill(G.feats[i].path, 'evenodd');
      }
      ctx.strokeStyle = 'rgba(11,11,13,0.5)'; ctx.lineWidth = 0.32 / k; ctx.stroke(G.bordasMun);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.92)'; ctx.lineWidth = 1.2 / k; ctx.stroke(G.bordasUF);
    if (ufSel && G.bboxUF[ufSel]) { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6 / k; ctx.stroke(G.contorno(ufSel)); }
  }, []);

  const compor = useCallback((alfaNovo = 1) => {
    const cv = canvasRef.current, base = baseRef.current, G = geo.current;
    const { munSel } = selRef.current;
    if (!cv || !base || !G) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (alfaNovo < 1 && anteriorRef.current) { ctx.drawImage(anteriorRef.current, 0, 0); ctx.globalAlpha = alfaNovo; }
    ctx.drawImage(base, 0, 0);
    ctx.globalAlpha = 1;
    const { k, x, y } = vista.current;
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y);
    ctx.lineJoin = 'round';
    const contornar = (idx, w) => { if (idx >= 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = w / k; ctx.stroke(G.feats[idx].path); } };
    contornar(munSel ? G.porId.get(munSel) ?? -1 : -1, 2.4);
    contornar(hoverRef.current, 1.8);
  }, []);

  const desenhar = useCallback(() => { desenharBase(); compor(); }, [desenharBase, compor]);

  // ── tamanho do canvas + encaixe inicial ───────────────────────────────────
  const calcularEncaixe = useCallback((bbox, folga = 0.9, reservaDireita = 0) => {
    const { w, h } = tam.current;
    const [a, b, c, d] = bbox;
    const lw = Math.max(1, w - reservaDireita);
    const k = Math.min(lw / (c - a), h / (d - b)) * folga;
    return { k, x: lw / 2 - ((a + c) / 2) * k, y: h / 2 - ((b + d) / 2) * k };
  }, []);

  useEffect(() => {
    if (!pronto) return;
    const caixa = caixaRef.current;
    const ro = new ResizeObserver(() => {
      const w = caixa.clientWidth, h = caixa.clientHeight;
      if (!w || !h) return;
      const dpr = window.devicePixelRatio || 1;
      tam.current = { w, h };
      for (const cv of [canvasRef.current, (baseRef.current ||= document.createElement('canvas')), (anteriorRef.current ||= document.createElement('canvas'))]) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      }
      encaixe.current = calcularEncaixe(geo.current.total, 0.94, w > 560 ? 96 : 0);
      vista.current = alvoDaSelecao() || encaixe.current;
      desenhar(); rerender();
    });
    ro.observe(caixa);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto]);

  // ── animação de vista ─────────────────────────────────────────────────────
  const animarPara = useCallback((alvo, ms = 500) => {
    cancelAnimationFrame(animRef.current);
    if (!alvo) return;
    if (reduzMovimento()) { vista.current = alvo; desenhar(); rerender(); return; }
    const de = { ...vista.current }, t0 = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / ms), e = easing(p);
      vista.current = { k: de.k + (alvo.k - de.k) * e, x: de.x + (alvo.x - de.x) * e, y: de.y + (alvo.y - de.y) * e };
      desenhar(); rerender();
      if (p < 1) animRef.current = requestAnimationFrame(passo);
    };
    animRef.current = requestAnimationFrame(passo);
  }, [desenhar]);

  function alvoDaSelecao() {
    const G = geo.current;
    const { ufSel, munSel } = selRef.current;
    if (!G || !tam.current.w) return null;
    if (munSel && G.porId.has(munSel)) {
      const [a, b, c, d] = G.feats[G.porId.get(munSel)].bbox;
      const cx = (a + c) / 2, cy = (b + d) / 2, m = Math.max(c - a, d - b, 28) * 1.6;
      return calcularEncaixe([cx - m / 2, cy - m / 2, cx + m / 2, cy + m / 2], 0.9);
    }
    if (ufSel && G.bboxUF[ufSel]) return calcularEncaixe(G.bboxUF[ufSel], 0.86);
    return encaixe.current;
  }

  // Seleção mudou (clique, breadcrumb, Esc, URL) → anima até o enquadramento.
  useEffect(() => {
    if (!pronto || !tam.current.w) return;
    animarPara(alvoDaSelecao());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ufSel, munSel, pronto]);

  // Dados novos → transição suave de cores (o mapa não "pisca").
  const coresAnteriores = useRef(null);
  useEffect(() => {
    if (!pronto || !cores || !baseRef.current) return;
    const primeira = coresAnteriores.current === null;
    coresAnteriores.current = cores;
    if (primeira || reduzMovimento()) { desenhar(); return; }
    const ant = anteriorRef.current, actx = ant.getContext('2d');
    actx.setTransform(1, 0, 0, 1, 0, 0); actx.clearRect(0, 0, ant.width, ant.height);
    actx.drawImage(canvasRef.current, 0, 0);
    desenharBase();
    const t0 = performance.now();
    const passo = (t) => { const p = Math.min(1, (t - t0) / 450); compor(p); if (p < 1) requestAnimationFrame(passo); };
    requestAnimationFrame(passo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cores]);

  useEffect(() => { if (pronto) desenhar(); }, [ufSel, munSel, desenhar, pronto]);

  // ── interação ─────────────────────────────────────────────────────────────
  const paraMundo = (sx, sy) => { const { k, x, y } = vista.current; return [(sx - x) / k, (sy - y) / k]; };
  const acertar = (sx, sy) => {
    const G = geo.current; if (!G) return -1;
    const [wx, wy] = paraMundo(sx, sy);
    const lista = G.grade.get(Math.floor(wx / CEL) + ',' + Math.floor(wy / CEL));
    if (!lista) return -1;
    for (const i of lista) {
      const [a, b, c, d] = G.feats[i].bbox;
      if (wx < a || wx > c || wy < b || wy > d) continue;
      if (G.hitCtx.isPointInPath(G.feats[i].path, wx, wy, 'evenodd')) return i;
    }
    return -1;
  };
  const zoomEm = (sx, sy, fator) => {
    const v = vista.current, e = encaixe.current;
    const k = Math.max(e.k * 0.85, Math.min(e.k * 60, v.k * fator));
    vista.current = { k, x: sx - (sx - v.x) * (k / v.k), y: sy - (sy - v.y) * (k / v.k) };
    desenhar(); rerender();
  };

  const ponteiros = useRef(new Map());
  const arrasto = useRef(null);
  const pinca = useRef(null);
  const posRel = (e) => { const r = canvasRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  const onPointerDown = (e) => {
    canvasRef.current.setPointerCapture(e.pointerId);
    ponteiros.current.set(e.pointerId, posRel(e));
    if (ponteiros.current.size === 2) {
      const [p1, p2] = [...ponteiros.current.values()];
      pinca.current = { d: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) };
      arrasto.current = null;
    } else {
      const [sx, sy] = posRel(e);
      arrasto.current = { sx, sy, x0: vista.current.x, y0: vista.current.y, moveu: false };
    }
  };
  const onPointerMove = (e) => {
    const [sx, sy] = posRel(e);
    if (ponteiros.current.has(e.pointerId)) ponteiros.current.set(e.pointerId, [sx, sy]);
    if (pinca.current && ponteiros.current.size === 2) {
      const [p1, p2] = [...ponteiros.current.values()];
      const d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
      zoomEm((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, d / pinca.current.d);
      pinca.current.d = d;
      return;
    }
    const a = arrasto.current;
    if (a) {
      const dx = sx - a.sx, dy = sy - a.sy;
      if (!a.moveu && Math.hypot(dx, dy) > 4) a.moveu = true;
      if (a.moveu) {
        cancelAnimationFrame(animRef.current);
        vista.current = { ...vista.current, x: a.x0 + dx, y: a.y0 + dy };
        hoverRef.current = -1; setHover(null);
        desenhar(); rerender();
        return;
      }
    }
    const idx = acertar(sx, sy);
    if (idx !== hoverRef.current) { hoverRef.current = idx; compor(); }
    setHover(idx >= 0 ? { idx, sx, sy } : null);
  };
  const onPointerUp = (e) => {
    ponteiros.current.delete(e.pointerId);
    if (ponteiros.current.size < 2) pinca.current = null;
    const a = arrasto.current;
    arrasto.current = null;
    if (!a || a.moveu) return;
    const [sx, sy] = posRel(e);
    const idx = acertar(sx, sy);
    if (idx < 0) return;
    const f = geo.current.feats[idx];
    if (ufSel !== f.uf) onSelecionar?.({ uf: f.uf, mun: null });
    else onSelecionar?.({ uf: f.uf, mun: f.id });
  };
  const onPointerLeave = () => { if (hoverRef.current !== -1) { hoverRef.current = -1; compor(); } setHover(null); };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const roda = (e) => { e.preventDefault(); const [sx, sy] = posRel(e); cancelAnimationFrame(animRef.current); zoomEm(sx, sy, Math.exp(-e.deltaY * 0.0016)); };
    cv.addEventListener('wheel', roda, { passive: false });
    return () => cv.removeEventListener('wheel', roda);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto]);

  // ── camadas HTML (rótulos, pílulas, tooltip) ──────────────────────────────
  if (erro) return <div className="p-6 text-sm text-[#9CA3AF]">Não foi possível carregar o mapa.</div>;

  const G = geo.current;
  const { k, x, y } = vista.current;
  const e = encaixe.current;
  const tela = (wx, wy) => [wx * k + x, wy * k + y];
  const pertoDoBrasil = e && k < e.k * 1.6 && !ufSel;
  const rotulos = [];
  const pilulas = [];
  if (pronto && G && e) {
    for (const u of G.ufs) {
      const l = liderDe(dadosUF?.[u.uf], mapaCand);
      if (ufSel && ufSel !== u.uf) continue;
      const [sx, sy] = tela(u.cx, u.cy);
      if (pertoDoBrasil && LATERAIS.includes(u.uf)) pilulas.push({ u, l, sx, sy });
      else if (!ufSel || k < e.k * 6) rotulos.push({ u, l, sx, sy });
    }
    // Pílulas empilhadas à direita do Nordeste/Sudeste, sem sobreposição.
    const xPil = Math.min(tam.current.w - 74, tela(G.total[2] + 6, 0)[0] + 18);
    pilulas.sort((a, b) => a.sy - b.sy);
    let ultimo = -1e9;
    for (const p of pilulas) { p.py = Math.max(p.sy - 11, ultimo + 26); ultimo = p.py; p.px = xPil; }
  }
  const capitais = [];
  if (pronto && G && info && (ufSel || k > (e?.k ?? 1) * 3)) {
    for (const f of G.feats) {
      const inf = info[f.id];
      if (!inf) continue;
      const mostrar = f.id === munSel || (inf[2] && (!ufSel || f.uf === ufSel));
      if (!mostrar) continue;
      const [sx, sy] = tela(f.c[0], f.c[1]);
      if (sx < 0 || sy < 0 || sx > tam.current.w || sy > tam.current.h) continue;
      capitais.push({ id: f.id, nome: inf[0], sx, sy });
    }
  }

  const hf = hover && G ? G.feats[hover.idx] : null;
  const exterior = dadosUF?.ZZ ? liderDe(dadosUF.ZZ, mapaCand) : null;

  return (
    <div ref={caixaRef} className="relative w-full h-full select-none overflow-hidden">
      {!pronto && <div className="absolute inset-0 flex items-center justify-center text-sm text-[#6B7280] animate-pulse">Carregando mapa…</div>}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full touch-none"
        style={{ cursor: arrasto.current?.moveu ? 'grabbing' : hover ? 'pointer' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onDoubleClick={(ev) => { const [sx, sy] = posRel(ev); zoomEm(sx, sy, 2); }}
      />

      {/* linhas das pílulas laterais */}
      {pilulas.length > 0 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {pilulas.map((p) => (
            <line key={p.u.uf} x1={p.sx} y1={p.sy} x2={p.px} y2={p.py + 11} stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
          ))}
        </svg>
      )}

      {rotulos.map(({ u, l, sx, sy }) => (
        <div key={u.uf} className="absolute pointer-events-none text-center leading-none" style={{ left: sx, top: sy, transform: 'translate(-50%,-50%)', textShadow: '0 1px 3px rgba(0,0,0,.9)' }}>
          <div className="text-[11px] font-bold text-white tracking-wide">{u.uf}</div>
          {l && (
            <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-white/90 tabular-nums">
              <span className="w-1.5 h-1.5 rounded-[1px]" style={{ background: l.cand?.cor }} />{Math.round(l.pct)}%
            </div>
          )}
        </div>
      ))}

      {pilulas.map(({ u, l, px, py }) => (
        <button
          key={u.uf}
          onClick={() => onSelecionar?.({ uf: u.uf, mun: null })}
          className="absolute flex items-center gap-2 px-2 h-[22px] rounded-md text-[11px] font-semibold text-white tabular-nums shadow"
          style={{ left: px, top: py, background: l?.cand?.cor ?? '#374151' }}
        >
          <span>{u.uf}</span><span className="opacity-90">{l ? `${Math.round(l.pct)}%` : '—'}</span>
        </button>
      ))}
      {pertoDoBrasil && exterior && pilulas.length > 0 && (
        <button
          onClick={() => onSelecionar?.({ uf: 'ZZ', mun: null })}
          title="Exterior"
          className="absolute flex items-center gap-2 px-2 h-[22px] rounded-md text-[11px] font-semibold text-white tabular-nums shadow"
          style={{ left: pilulas[0].px, top: pilulas[pilulas.length - 1].py + 40, background: exterior.cand?.cor }}
        >
          <span aria-hidden>🌐</span><span>{Math.round(exterior.pct)}%</span>
        </button>
      )}

      {capitais.map((c) => (
        <div key={c.id} className="absolute pointer-events-none text-[10px] font-medium text-white whitespace-nowrap" style={{ left: c.sx, top: c.sy, transform: 'translate(-50%,-50%)', textShadow: '0 1px 3px rgba(0,0,0,.95)' }}>
          {c.nome}
        </div>
      ))}

      {/* zoom */}
      <div className="absolute left-3 bottom-3 flex flex-col gap-1">
        {[['+', 1.6], ['−', 1 / 1.6]].map(([t, f]) => (
          <button key={t} onClick={() => zoomEm(tam.current.w / 2, tam.current.h / 2, f)} className="w-8 h-8 rounded-md bg-[#17171c] border border-[#26262c] text-white text-lg leading-none hover:bg-[#202027]" aria-label={t === '+' ? 'Aproximar' : 'Afastar'}>{t}</button>
        ))}
      </div>

      {hf && <Tooltip f={hf} sx={hover.sx} sy={hover.sy} resumo={resumo} info={info} dadosUF={dadosUF} mapaCand={mapaCand} tam={tam.current} />}
    </div>
  );
}

function Tooltip({ f, sx, sy, resumo, info, dadosUF, mapaCand, tam }) {
  const r = resumo?.[f.id];
  const nome = info?.[f.id]?.[0];
  let linhas = [];
  let pctSecoes = null;
  if (r && r[5]) {
    pctSecoes = r[0];
    linhas = [[r[1], r[2]], [r[3], r[4]]].filter(([n]) => n).map(([n, v]) => ({ cand: mapaCand[n], pct: (v / r[5]) * 100 }));
  } else if (dadosUF?.[f.uf]) {
    const d = dadosUF[f.uf];
    const tot = Object.values(d.votos || {}).reduce((s, v) => s + v, 0) || 1;
    pctSecoes = d.secoes ? (d.totalizadas / d.secoes) * 100 : 0;
    linhas = Object.entries(d.votos || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n, v]) => ({ cand: mapaCand[n], pct: (v / tot) * 100 }));
  }
  const W = 260, H = 150;
  const left = sx + 18 + W > tam.w ? sx - W - 14 : sx + 18;
  const top = Math.max(8, Math.min(sy + 14, tam.h - H - 8));
  return (
    <div className="absolute pointer-events-none z-10 rounded-xl border border-[#2a2a31] bg-[#141418]/95 backdrop-blur p-3 shadow-2xl" style={{ left, top, width: W }}>
      <div className="flex items-start gap-2">
        <span className="px-1.5 py-0.5 rounded bg-[#26262c] text-[10px] font-semibold text-[#C9C9D1]">{f.uf}</span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{nome || f.uf}</div>
          {pctSecoes != null && <div className="text-[11px] text-[#8b8b95] tabular-nums">{fmtPct(pctSecoes, pctSecoes >= 100 ? 0 : 1)} das seções</div>}
        </div>
      </div>
      <div className="mt-2.5 space-y-2">
        {linhas.map(({ cand, pct }, i) => cand && (
          <div key={i} className="flex items-center gap-2">
            <Avatar cand={cand} tamanho={30} />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-white truncate">{cand.nome}</div>
              <div className="text-[10px] font-semibold" style={{ color: cand.cor }}>{cand.partido} {cand.numero}</div>
            </div>
            <div className="text-[13px] font-semibold text-white tabular-nums">{fmtPct(pct, 1)}</div>
          </div>
        ))}
        {linhas.length === 0 && <div className="text-xs text-[#6c6c76]">Aguardando resultados</div>}
      </div>
    </div>
  );
}
