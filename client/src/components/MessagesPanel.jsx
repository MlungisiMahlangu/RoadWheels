import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const MessagesPanel = ({ onRead }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selected, setSelected] = useState(null);
  const [readErrors, setReadErrors] = useState({});
  const [readingIds, setReadingIds] = useState([]);
  const readsInFlight = useRef(new Set());

  useEffect(() => {
    let current = true;
    const fetchMessages = async () => {
      setLoading(true);
      setFetchError('');
      try {
        const data = await api.getContactMessages();
        if (current) setMessages(data);
      } catch (err) {
        if (current) setFetchError(err.message || 'Unable to load messages. Please try again.');
      } finally {
        if (current) setLoading(false);
      }
    };
    fetchMessages();
    return () => { current = false; };
  }, [loadAttempt]);

  const markRead = async (msg) => {
    const id = msg._id;
    if (msg.isRead || readsInFlight.current.has(id)) return;
    readsInFlight.current.add(id);
    setReadingIds([...readsInFlight.current]);
    setReadErrors((errors) => ({ ...errors, [id]: '' }));
    try {
      await api.markMessageRead(id);
    } catch (err) {
      setReadErrors((errors) => ({ ...errors, [id]: err.message || 'Unable to mark this message as read. Please try again.' }));
      return;
    } finally {
      readsInFlight.current.delete(id);
      setReadingIds([...readsInFlight.current]);
    }
    setMessages((current) => current.map((message) => message._id === id ? { ...message, isRead: true } : message));
    setSelected((current) => current?._id === id ? { ...current, isRead: true } : current);
    onRead?.();
  };

  const openMessage = (msg) => {
    setSelected(msg);
    markRead(msg);
  };

  if (loading) return <p className="panel text-center py-16 text-sm text-[var(--color-text-muted)]" role="status">Loading messages...</p>;
  if (fetchError) return (
    <div className="notice-error flex flex-wrap items-center justify-between gap-3" role="alert">
      <p>{fetchError}</p>
      <button type="button" className="btn-secondary" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry loading messages</button>
    </div>
  );

  return (
    <div className="grid md:grid-cols-[1fr_1.3fr] gap-6">
      <div className={`panel overflow-hidden divide-y divide-[var(--color-border)] max-h-[600px] overflow-y-auto ${selected ? 'hidden md:block' : ''}`}>
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

      <div className={`panel p-6 ${selected ? '' : 'hidden md:block'}`}>
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

            {readingIds.includes(selected._id) && <p role="status" className="mt-4 text-sm text-[var(--color-text-muted)]">Marking as read...</p>}
            {readErrors[selected._id] && (
              <div className="notice-error mt-4" role="alert">
                <p>{readErrors[selected._id]}</p>
                <button type="button" onClick={() => markRead(selected)} disabled={readingIds.includes(selected._id)} className="btn-secondary mt-3">Retry marking as read</button>
              </div>
            )}

            <a
              href={`mailto:${selected.email}?subject=Re: Your message to RoadWheels`}
              className="btn-primary mt-6"
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