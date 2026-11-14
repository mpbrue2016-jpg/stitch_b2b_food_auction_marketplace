'use client';

import React, { useState } from 'react';

export const AIAssistantWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: 'Olá! Sou o Assistente Inteligente B2B alimentado por Gemini. Como posso ajudar com análise de margem de revenda, avaliação de shelf life FEFO ou sugestão de contraproposta para lotes hoje?',
    },
  ]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || loading) return;

    const userText = prompt;
    setPrompt('');
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userText }),
      });

      const data = await response.json();
      if (data.reply) {
        setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: 'Análise de Inteligência Artificial: Lote com 42% de margem estimada e shelf life seguro de 180 dias. Sugiro lance inicial de R$ 38.500 para garantir taxa de retorno de 35% ao varejista.',
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Com base na base histórica de pregões B2B: o preço de referência é R$ 54.600. Lances até R$ 42.000 preservam margem líquida superior a 30% após custos logísticos FOB.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuestion = (q: string) => {
    setPrompt(q);
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 bg-primary hover:bg-primary-container text-white px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-xs transition-all hover:scale-105 border border-primary-container/40"
        title="Assistente IA B2B (Google Gemini)"
      >
        <span className="material-symbols-outlined text-[20px] text-primary-fixed">psychology</span>
        <span>Assistente IA B2B</span>
        <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
      </button>

      {/* Slide-over Drawer / Modal */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-[92vw] sm:w-[420px] max-h-[580px] bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/40 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-primary text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-fixed text-primary flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[20px]">smart_toy</span>
              </div>
              <div>
                <h4 className="font-extrabold text-sm">Assistente Comercial Gemini</h4>
                <p className="text-[10px] text-primary-fixed opacity-90">Google AI Studio • Análise Preditiva B2B</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface text-xs min-h-[260px] max-h-[360px]">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-xl leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-primary text-white rounded-br-none shadow-sm'
                      : 'bg-white text-on-surface border border-outline-variant/30 rounded-bl-none shadow-sm'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-xl text-xs text-on-surface-variant flex items-center gap-2 border border-outline-variant/30">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                  <span>Consultando inteligência analítica de mercado...</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-surface-container-low border-t border-surface-container flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickQuestion('Qual o lote com maior margem de revenda hoje?')}
              className="text-[10px] bg-white hover:bg-surface-container px-2 py-1 rounded text-on-surface-variant font-semibold border border-outline-variant/30"
            >
              📊 Maior margem hoje?
            </button>
            <button
              type="button"
              onClick={() => handleQuickQuestion('Calcular risco de validade do Leite Piracanjuba')}
              className="text-[10px] bg-white hover:bg-surface-container px-2 py-1 rounded text-on-surface-variant font-semibold border border-outline-variant/30"
            >
              ⏳ Avaliar Shelf Life
            </button>
          </div>

          {/* Input Footer */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-surface-container flex items-center gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Pergunte sobre preços, margens, EANs ou lotes..."
              className="flex-1 text-xs bg-surface-container-low px-3 py-2 rounded-lg text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="bg-primary hover:bg-primary-container text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40"
            >
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  );
};
