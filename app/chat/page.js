'use client';

import { useEffect, useRef, useState } from 'react';
import { getChatMessages, sendChatMessage, getProfile, setProfileName } from '../../lib/store';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    setMessages(getChatMessages());
    setName(getProfile().name);
    function onStorage() {
      setMessages(getChatMessages());
    }
    window.addEventListener('hidakaxin:storage', onStorage);
    return () => window.removeEventListener('hidakaxin:storage', onStorage);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  function handleSend(e) {
    e.preventDefault();
    if (!text.trim()) return;
    const author = name.trim() || 'Anonim';
    setProfileName(author);
    const msg = sendChatMessage({ author, text: text.trim() });
    setMessages((prev) => [...prev, msg]);
    setText('');
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-64px-84px)] max-w-3xl flex-col px-4 py-4">
      <div className="mb-3">
        <h1 className="font-display text-xl font-extrabold text-ink">Chat Publik</h1>
        <p className="text-xs text-ink-faint">
          Sementara chat cuma tersimpan di HP ini (belum realtime antar-user). Nanti dipindah ke Supabase/Firebase biar beneran publik.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-line bg-paper-card p-3 shadow-card">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-faint">Belum ada obrolan. Mulai duluan yuk!</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-50 text-xs font-bold text-accent">
              {m.author.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <p className="text-sm font-bold text-ink">{m.author}</p>
                <p className="text-[10px] text-ink-faint">{formatTime(m.createdAt)}</p>
              </div>
              <p className="break-words text-sm text-ink-soft">{m.text}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="mt-3 flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama"
          className="w-24 flex-shrink-0 rounded-full border border-line bg-paper-card px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tulis pesan.."
          className="flex-1 rounded-full border border-line bg-paper-card px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button type="submit" className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
