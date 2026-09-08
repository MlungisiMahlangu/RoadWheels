import { useState, useEffect } from 'react';
import { api } from '../services/api';

const MessagesPanel = ({ onRead }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const data = await api.getContactMessages();
      setMessages(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMessages(); }, []);

  const openMessage = async (msg) => {
    setSelected(msg);
    if (!msg.isRead) {
      await api.markMessageRead(msg._id);
      fetchMessages();
      onRead?.();
    }
  };

  if (loading) return <p className="text-center py-16">Loading...</p>;

  return (
    <div className="grid md:grid-cols-[1fr_1.3fr] gap-6">
      <div className={`bg-white border border-[var(--color-border)] rounded-2xl overflow-hidden divide-y divide-[var(--color-border)] max-h-[600px] overflow-y-auto ${selected ? 'hidden md:block' : ''}`}>
        {messages.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[var(--color-text-muted)]">No messages yet.</p>
        ) : (
          messages.map((msg) => (
            <button
              key={msg._id}
              onClick={() => openMessage(msg)}
              className={`w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors ${selected?._id === msg._id ? 'bg-gray-50' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className={`text-sm ${msg.isRead ? 'font-medium' : 'font-bold'}`}>{msg.name}</p>
                {!msg.isRead && <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] truncate">{msg.message}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{new Date(msg.createdAt).toLocaleDateString()}</p>
            </button>
          ))
        )}
      </div>

      <div className={`bg-white border border-[var(--color-border)] rounded-2xl p-6 ${selected ? '' : 'hidden md:block'}`}>
        {!selected ? (
          <p className="text-center text-sm text-[var(--color-text-muted)] py-16">Select a message to read it.</p>
        ) : (
          <>
            <button
              onClick={() => setSelected(null)}
              className="md:hidden text-sm text-[var(--color-accent)] font-medium mb-4"
            >
              ← Back to messages
            </button>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg">{selected.name}</h3>
                <a href={`mailto:${selected.email}`} className="text-sm text-[var(--color-accent)] hover:underline">{selected.email}</a>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">{new Date(selected.createdAt).toLocaleString()}</p>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] whitespace-pre-wrap">{selected.message}</p>

            <a
              href={`mailto:${selected.email}?subject=Re: Your message to RoadWheels`}
              className="inline-block mt-6 px-5 py-2.5 rounded-full bg-[var(--color-accent)] text-white text-sm font-medium hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Reply via Email
            </a>
          </>
        )}
      </div>
    </div>
  );
};

export default MessagesPanel;