"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface InvitePreview {
  shop_name: string;
  role: string;
  role_label: string;
  email: string;
}

export default function InvitePage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchInvite() {
      if (!token) return;
      
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
        const res = await fetch(`${baseUrl}/invites/${token}/`);
        
        if (!res.ok) {
          setError("This invitation is no longer valid. It may have expired or been revoked.");
          return;
        }

        const data = await res.json();
        setInvite(data);
      } catch (err) {
        setError("Failed to load invitation details. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchInvite();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password.length < 8) {
      setFormError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
      const res = await fetch(`${baseUrl}/invites/accept/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          name,
          password
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFormError(data.detail || data.error || "Failed to accept invitation. Please try again.");
        return;
      }

      setSuccess(true);
    } catch (err) {
      setFormError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050912]">
        <title>Loading Invitation...</title>
        <div className="animate-pulse text-[var(--text-secondary)]">Loading invitation...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050912] p-4 relative overflow-hidden">
      <title>Accept Invitation</title>
      
      {/* Background gradients */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--accent)] opacity-[0.03] blur-[100px] rounded-full pointer-events-none" />

      <div className="panel-soft rounded-[28px] p-8 w-full max-w-md relative z-10">
        {error ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.2)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-[var(--warning)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-medium text-[var(--text-primary)]">Invalid Invitation</h1>
            <p className="text-[var(--text-secondary)] text-sm">{error}</p>
          </div>
        ) : success && invite ? (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-[rgba(52,211,153,0.12)] border border-[rgba(52,211,153,0.2)] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-medium text-[var(--text-primary)] mb-2">Welcome aboard!</h1>
              <p className="text-[var(--text-secondary)]">
                You've joined <strong className="text-[var(--text-primary)] font-medium">{invite.shop_name}</strong> as <strong className="text-[var(--text-primary)] font-medium">{invite.role_label}</strong>!
              </p>
            </div>
            <div className="pt-4">
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center px-4 py-3 rounded-xl border border-[rgba(71,176,255,0.16)] bg-[rgba(71,176,255,0.12)] text-[var(--accent)] hover:bg-[rgba(71,176,255,0.16)] transition-colors font-medium"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        ) : invite ? (
          <div>
            <div className="text-center mb-8">
              <div className="eyebrow mb-2">You've been invited</div>
              <h1 className="text-2xl font-medium text-[var(--text-primary)] mb-2">Join {invite.shop_name}</h1>
              <p className="text-[var(--text-secondary)] text-sm">
                Accept your invitation to join as <strong className="text-[var(--text-primary)] font-medium">{invite.role_label}</strong>.
              </p>
              <div className="mt-4 py-2 px-3 bg-[rgba(13,18,28,0.68)] rounded-lg border border-[rgba(152,164,189,0.12)] inline-block">
                <p className="text-sm text-[var(--text-secondary)]">{invite.email}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[rgba(13,18,28,0.68)] border border-[rgba(152,164,189,0.12)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] placeholder-[rgba(152,164,189,0.4)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[rgba(13,18,28,0.68)] border border-[rgba(152,164,189,0.12)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] placeholder-[rgba(152,164,189,0.4)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[rgba(13,18,28,0.68)] border border-[rgba(152,164,189,0.12)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] placeholder-[rgba(152,164,189,0.4)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-all"
                  placeholder="••••••••"
                />
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.16)] text-[var(--warning)] text-sm flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{formError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-6 px-4 py-3 rounded-xl border border-[rgba(71,176,255,0.16)] bg-[rgba(71,176,255,0.12)] text-[var(--accent)] hover:bg-[rgba(71,176,255,0.16)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-[var(--accent)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Accepting...
                  </span>
                ) : (
                  "Accept Invitation"
                )}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
