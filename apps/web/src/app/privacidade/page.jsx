import { Link } from 'react-router-dom';

/**
 * Política de Privacidade — página pública (sem login).
 * Exigida pelas lojas (Google Play / App Store) porque o app coleta CPF e
 * dados pessoais. Base: LGPD (Lei 13.709/2018).
 *
 * ⚠️ Campos a confirmar com o cliente antes de considerar definitivo:
 *   - RESPONSAVEL (razão social / CNPJ do controlador)
 *   - CONTATO (e-mail do canal de privacidade)
 */
const RESPONSAVEL = 'VV8 TV Sistema Brasileiro de Televisão LTDA';
const CNPJ = '67.130.052/0001-53';
const CONTATO = 'vv8tv.dev@gmail.com';
const VIGENCIA = '24 de setembro de 2026';

function Secao({ titulo, children }) {
  return (
    <section style={{ marginTop: 34 }}>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: '#0a1628',
          margin: '0 0 10px',
        }}
      >
        {titulo}
      </h2>
      <div style={{ fontSize: 15.5, lineHeight: 1.7, color: '#374151' }}>{children}</div>
    </section>
  );
}

export default function PrivacidadePage() {
  return (
    <div style={{ background: '#f6f8fa', minHeight: '100vh', padding: '0 16px' }}>
      <div
        style={{
          maxWidth: 760,
          margin: '0 auto',
          background: '#ffffff',
          border: '1px solid #e4e9f2',
          borderRadius: 16,
          padding: 'clamp(24px, 5vw, 48px)',
          margin: '32px auto 64px',
          boxShadow: '0 6px 24px rgba(10,22,40,.06)',
        }}
      >
        <p
          style={{
            fontSize: 12,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: '#1C4E86',
            fontWeight: 700,
            margin: '0 0 8px',
          }}
        >
          OpinAI
        </p>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: '#0a1628', margin: '0 0 6px' }}>
          Política de Privacidade
        </h1>
        <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
          Vigente desde {VIGENCIA}
        </p>

        <div style={{ fontSize: 15.5, lineHeight: 1.7, color: '#374151', marginTop: 24 }}>
          Esta Política descreve como o <strong>OpinAI</strong> — sistema web
          (opina-ai.com) e aplicativo de celular — coleta, usa, armazena e protege os
          dados pessoais dos seus usuários, em conformidade com a{' '}
          <strong>Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong>.
          Ao usar o OpinAI, você concorda com as práticas aqui descritas.
        </div>

        <Secao titulo="1. Quem é o responsável">
          O responsável pelo tratamento dos seus dados (controlador) é{' '}
          <strong>{RESPONSAVEL}</strong> (CNPJ {CNPJ}). Para qualquer assunto relacionado à
          privacidade e aos seus dados, o canal de contato é o e-mail{' '}
          <a href={`mailto:${CONTATO}`} style={{ color: '#1C4E86', fontWeight: 600 }}>
            {CONTATO}
          </a>
          .
        </Secao>

        <Secao titulo="2. Quais dados coletamos">
          <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
            <li>
              <strong>Cadastro:</strong> nome, e-mail e telefone informados na criação
              da conta.
            </li>
            <li>
              <strong>CPF:</strong> usado para identificar de forma única a conta do
              aplicativo, evitar cadastros duplicados e fraude na participação em
              pesquisas.
            </li>
            <li>
              <strong>Respostas de pesquisas:</strong> as respostas que você fornece
              aos formulários e pesquisas disponíveis no app.
            </li>
            <li>
              <strong>Dados de uso:</strong> informações técnicas necessárias ao
              funcionamento (autenticação/sessão) e ao suporte.
            </li>
          </ul>
        </Secao>

        <Secao titulo="3. Para que usamos os dados">
          <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
            <li>Autenticar seu acesso e manter sua sessão segura.</li>
            <li>
              Controlar o acesso aos planos e assinaturas (no sistema web) e a
              participação nas pesquisas (no app).
            </li>
            <li>
              Creditar moedas e permitir o resgate de recompensas/cupons no
              aplicativo.
            </li>
            <li>Prestar suporte e responder às suas solicitações.</li>
            <li>Cumprir obrigações legais e prevenir fraudes.</li>
          </ul>
        </Secao>

        <Secao titulo="4. Base legal">
          O tratamento se apoia nas hipóteses da LGPD, principalmente: execução de
          contrato e procedimentos preliminares (art. 7º, V), cumprimento de obrigação
          legal (art. 7º, II), legítimo interesse para segurança e prevenção à fraude
          (art. 7º, IX) e, quando aplicável, o seu consentimento (art. 7º, I).
        </Secao>

        <Secao titulo="5. Com quem compartilhamos">
          O OpinAI <strong>não vende</strong> seus dados. Eles são processados apenas
          por prestadores de serviço essenciais ao funcionamento, que atuam como
          operadores:
          <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            <li>
              <strong>Supabase</strong> — banco de dados e autenticação.
            </li>
            <li>
              <strong>Asaas</strong> — processamento de pagamentos das assinaturas
              (quando aplicável).
            </li>
            <li>
              <strong>Groq</strong> — inteligência artificial do atendimento de
              suporte.
            </li>
          </ul>
          Também poderemos compartilhar dados quando exigido por lei ou autoridade
          competente.
        </Secao>

        <Secao titulo="6. Como protegemos seus dados">
          Adotamos medidas técnicas de segurança, incluindo: tráfego criptografado
          (HTTPS), o CPF armazenado de forma protegida por <em>hash</em> (não em texto
          puro), verificação de identidade em todas as operações sensíveis e
          armazenamento seguro da sessão no dispositivo. O acesso aos dados é restrito
          e feito por meio de servidores controlados.
        </Secao>

        <Secao titulo="7. Por quanto tempo guardamos">
          Mantemos seus dados enquanto sua conta existir e pelo período necessário ao
          cumprimento das finalidades acima e de obrigações legais. Você pode solicitar
          a exclusão a qualquer momento (ver seção 8).
        </Secao>

        <Secao titulo="8. Seus direitos">
          Nos termos da LGPD, você pode, a qualquer momento: confirmar a existência de
          tratamento; acessar seus dados; corrigir dados incompletos ou desatualizados;
          solicitar a anonimização ou exclusão; solicitar a portabilidade; e revogar o
          consentimento. Para exercer qualquer direito, escreva para{' '}
          <a href={`mailto:${CONTATO}`} style={{ color: '#1C4E86', fontWeight: 600 }}>
            {CONTATO}
          </a>
          .
        </Secao>

        <Secao titulo="9. Dados de menores">
          O OpinAI não é destinado a menores de 18 anos e não coleta intencionalmente
          seus dados. Caso identifiquemos um cadastro nessas condições, a conta poderá
          ser removida.
        </Secao>

        <Secao titulo="10. Alterações desta política">
          Podemos atualizar esta Política periodicamente. A data de vigência no topo
          indica a versão atual; alterações relevantes serão comunicadas pelos canais
          do serviço.
        </Secao>

        <div
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: '1px solid #e4e9f2',
            fontSize: 14,
          }}
        >
          <Link to="/" style={{ color: '#1C4E86', fontWeight: 600, textDecoration: 'none' }}>
            ← Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
