import { useState, useEffect, useRef } from 'react';
import { fetchServer, supabase } from '../utils/supabase';
import { Send, Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  rideId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export function Chat() {
  const [user, setUser] = useState<any>(null);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      setUser(user);
      const role = user.user_metadata?.role || 'passenger';
      try {
        const rides = await fetchServer(`/rides/user/${user.id}?role=${role}`);
        const active = rides.find((r: any) => !['completed', 'cancelled'].includes(r.status));
        if (active) {
          setActiveRide(active);
          loadMessages(active.id);
        }
      } catch {}
      setLoading(false);
    });
  }, []);

  // Poll messages every 3 s
  useEffect(() => {
    if (!activeRide) return;
    const id = setInterval(() => loadMessages(activeRide.id), 3000);
    return () => clearInterval(id);
  }, [activeRide?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async (rideId: string) => {
    try {
      const msgs = await fetchServer(`/messages/${rideId}`);
      setMessages(msgs || []);
    } catch {}
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !activeRide || !user) return;
    setSending(true);
    try {
      await fetchServer('/messages/send', {
        method: 'POST',
        body: JSON.stringify({
          rideId: activeRide.id,
          senderId: user.id,
          senderName: user.user_metadata?.name || 'User',
          text: text.trim(),
        }),
      });
      setText('');
      await loadMessages(activeRide.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (!activeRide) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center">
          <MessageSquare className="w-8 h-8 text-neutral-300" />
        </div>
        <p className="text-neutral-700 font-semibold">No active ride</p>
        <p className="text-sm text-neutral-500">
          Chat is available once you have an accepted ride in progress.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 py-4 shadow-sm">
        <h2 className="font-bold text-neutral-900">Ride Chat</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          {activeRide.pickup} → {activeRide.dropoff}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-neutral-50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-20 text-neutral-400">
            <MessageSquare className="w-8 h-8" />
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMine = msg.senderId === user?.id;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  isMine
                    ? 'bg-green-600 text-white rounded-br-sm'
                    : 'bg-white text-neutral-900 border border-neutral-100 shadow-sm rounded-bl-sm'
                }`}>
                  {!isMine && (
                    <p className="text-xs font-semibold mb-0.5 opacity-70">{msg.senderName}</p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-green-100' : 'text-neutral-400'} text-right`}>
                    {new Date(msg.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="bg-white border-t border-neutral-100 px-4 py-3 flex gap-3 items-end">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-neutral-50"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="flex items-center justify-center w-10 h-10 bg-green-600 hover:bg-green-700 disabled:bg-neutral-200 text-white rounded-xl transition-colors shrink-0"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
