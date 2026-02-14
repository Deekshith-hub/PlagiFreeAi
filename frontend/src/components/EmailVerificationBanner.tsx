import React, { useState } from 'react';
import { AlertCircle, Mail, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

interface EmailVerificationBannerProps {
  onDismiss?: () => void;
}

export default function EmailVerificationBanner({ onDismiss }: EmailVerificationBannerProps): React.JSX.Element | null {
  const [sending, setSending] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  const handleResend = async (): Promise<void> => {
    setSending(true);
    try {
      await axios.post(`${API}/auth/resend-verification`);
      toast.success('Verification email sent! Please check your inbox.');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to send verification email');
    } finally {
      setSending(false);
    }
  };

  if (dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3" data-testid="verification-banner">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Verify your email</span> to start rewriting text.
            Check your inbox for the verification link.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResend}
            disabled={sending}
            className="text-sm bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            data-testid="resend-verification-btn"
          >
            {sending ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-3 h-3" />
                Resend
              </>
            )}
          </button>
          <button
            onClick={() => {
              setDismissed(true);
              if (onDismiss) onDismiss();
            }}
            className="text-amber-600 hover:text-amber-800 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
