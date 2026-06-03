import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Bot, Loader2, MessageCircle } from 'lucide-react';

export default function SupportChat({
  isOpen,
  onClose,
  isDarkMode,
  chatEndpoint = '/api/support/chat',
  welcomeMessage = 'Olá! Sou o assistente de suporte do OpinAI. Como posso te ajudar hoje?',
  authToken = null,
}) {
  const [messages, setMessages] = useState([{ role: 'assistant', content: welcomeMessage }]);
  // Reinicia mensagens quando o endpoint mudar (ex: trocar entre chat normal e retaguarda)
  const prevEndpointRef = useRef(chatEndpoint);
  useEffect(() => {
    if (prevEndpointRef.current !== chatEndpoint) {
      prevEndpointRef.current = chatEndpoint;
      setMessages([{ role: 'assistant', content: welcomeMessage }]);
    }
  }, [chatEndpoint, welcomeMessage]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const response = await fetch(chatEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: newMessages.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => `status ${response.status}`);
        throw new Error(errText || `status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // { stream: true } garante que caracteres UTF-8 cortados entre chunks sejam remontados corretamente
        const chunk = decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return updated;
        });
      }
    } catch (err) {
      console.error('[SupportChat] erro:', err);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `Erro ao conectar com o suporte. Detalhe: ${err?.message ?? 'desconhecido'}`,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isOpen) return null;

  const dark = isDarkMode;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
      style={{ width: 380, height: 520 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ background: '#1570FF' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-none">Suporte OpinAI</p>
            <p className="text-blue-100 text-xs mt-0.5">Assistente virtual</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        style={{ background: dark ? '#1C1F2E' : '#F8FAFB' }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mr-2 mt-1"
                style={{ background: '#1570FF' }}
              >
                <Bot className="w-3 h-3 text-white" />
              </div>
            )}
            <div
              className="max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed"
              style={
                msg.role === 'user'
                  ? { background: '#1570FF', color: '#fff', borderBottomRightRadius: 4 }
                  : {
                      background: dark ? '#2A2E45' : '#fff',
                      color: dark ? '#E4E9F2' : '#2A2E45',
                      borderBottomLeftRadius: 4,
                      border: `1px solid ${dark ? '#3A3E55' : '#E4E9F2'}`,
                    }
              }
            >
              {msg.content || (loading && i === messages.length - 1 ? (
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: dark ? '#B0B5C9' : '#8A8FA6' }} />
              ) : null)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="flex items-end gap-2 px-3 py-3 flex-shrink-0"
        style={{
          background: dark ? '#212529' : '#fff',
          borderTop: `1px solid ${dark ? '#3A3E55' : '#E4E9F2'}`,
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Digite sua dúvida..."
          disabled={loading}
          className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none transition-colors"
          style={{
            background: dark ? '#2A2E45' : '#F3F4F6',
            color: dark ? '#E4E9F2' : '#2A2E45',
            border: `1px solid ${dark ? '#3A3E55' : '#E4E9F2'}`,
            maxHeight: 80,
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-opacity"
          style={{
            background: '#1570FF',
            opacity: !input.trim() || loading ? 0.5 : 1,
          }}
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
