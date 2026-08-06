"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  Hash,
  Send,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

export interface LocalChatChannel {
  id: string;
  name: string;
  description?: string;
  is_private: boolean;
  unread_count: number;
  last_message_at?: string | null;
}

export interface LocalChatMessage {
  id: string;
  channel_id?: string;
  sender_id: string;
  sender_name: string;
  sender_role?: string;
  sender_email?: string;
  content: string;
  created_at: string;
}

const SEED_CHANNELS: LocalChatChannel[] = [
  { id: "ch-1", name: "general", is_private: false, unread_count: 0 },
  { id: "ch-2", name: "pos-desk", is_private: false, unread_count: 2 },
  { id: "ch-3", name: "inventory-alerts", is_private: false, unread_count: 1 },
];

const SEED_MESSAGES: Record<string, LocalChatMessage[]> = {
  "ch-1": [
    {
      id: "msg-1",
      sender_id: "user-1",
      sender_name: "Murtaza J",
      sender_role: "Owner",
      content: "Good morning team! We have our monthly stock audit scheduled today after 8 PM.",
      created_at: "2026-08-02T09:00:00Z",
    },
    {
      id: "msg-2",
      sender_id: "user-2",
      sender_name: "Rashi Cashier",
      sender_role: "Cashier",
      content: "Understood! I will ensure all cash and day-close registers are reconciled beforehand.",
      created_at: "2026-08-02T09:05:00Z",
    },
    {
      id: "msg-3",
      sender_id: "user-3",
      sender_name: "Amit Sharma",
      sender_role: "Manager",
      content: "National FMCG delivery of edible oils just arrived at the godown. Starting inward counts now.",
      created_at: "2026-08-02T10:15:00Z",
    },
  ],
  "ch-2": [
    {
      id: "msg-201",
      sender_id: "user-2",
      sender_name: "Rashi Cashier",
      sender_role: "Cashier",
      content: "Desk #1 thermal printer roll replaced. Good to go for rush hour.",
      created_at: "2026-08-02T11:00:00Z",
    },
  ],
  "ch-3": [
    {
      id: "msg-301",
      sender_id: "system",
      sender_name: "System Bot",
      sender_role: "System",
      content: "⚠️ Low Stock Alert: Cadbury Dairy Milk Silk 150g is down to 4 units (Reorder level: 10).",
      created_at: "2026-08-02T11:30:00Z",
    },
  ],
};

interface TeamChatProps {
  currentUserName?: string;
}

export function TeamChat({ currentUserName = "Manager" }: TeamChatProps) {
  const [channels] = useState<LocalChatChannel[]>(SEED_CHANNELS);
  const [activeChannelId, setActiveChannelId] = useState<string>("ch-1");
  const [messages, setMessages] = useState<Record<string, LocalChatMessage[]>>(SEED_MESSAGES);
  const [inputMessage, setInputMessage] = useState("");

  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];
  const activeChatList = messages[activeChannelId] || [];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMsg: LocalChatMessage = {
      id: `msg-${Date.now()}`,
      sender_id: "current-user",
      sender_name: "You",
      sender_role: "Cashier #1",
      content: inputMessage.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => ({
      ...prev,
      [activeChannelId]: [...(prev[activeChannelId] || []), newMsg],
    }));

    setInputMessage("");
  };

  return (
    <div className="bg-[var(--surface)] border border-[var(--border-soft)] rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row h-[calc(100vh-10rem)]">
      {/* Channels Sidebar */}
      <div className="w-full md:w-64 bg-[var(--bg-deep)] border-b md:border-b-0 md:border-r border-[var(--border-soft)] flex flex-col shrink-0">
        <div className="p-3.5 border-b border-[var(--border-soft)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--primary-light)]" />
            <span className="font-bold text-xs text-white">Store Channels</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="text-[10px] uppercase font-bold text-[var(--text-tertiary)] px-2 py-1">
            Channels
          </div>
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveChannelId(c.id)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                activeChannelId === c.id
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5" />
                <span>{c.name}</span>
              </div>
              {c.unread_count > 0 && activeChannelId !== c.id && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-blue-500 text-white">
                  {c.unread_count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface)]">
        {/* Active Header */}
        <div className="p-3.5 border-b border-[var(--border-soft)] bg-[var(--bg-soft)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-[var(--text-tertiary)]" />
            <span className="font-bold text-xs text-white">{activeChannel.name}</span>
          </div>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeChatList.map((msg) => (
            <div key={msg.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--surface-strong)] border border-[var(--border-soft)] flex items-center justify-center text-xs font-bold text-white shrink-0">
                {msg.sender_name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-xs text-white">{msg.sender_name}</span>
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                    {msg.sender_role}
                  </span>
                  <span className="text-[10px] text-[var(--text-disabled)]">
                    {formatDate(msg.created_at, true)}
                  </span>
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed bg-[var(--bg-deep)] p-2.5 rounded-xl border border-[var(--border-soft)] inline-block max-w-xl">
                  {msg.content}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 border-t border-[var(--border-soft)] bg-[var(--bg-soft)] flex items-center gap-2"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={`Message #${activeChannel.name}...`}
            className="flex-1 px-4 py-2.5 bg-[var(--bg-deep)] border border-[var(--border-soft)] focus:border-[var(--primary)] rounded-xl text-xs text-white placeholder-[var(--text-tertiary)] outline-none"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="p-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white rounded-xl shadow-md transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
