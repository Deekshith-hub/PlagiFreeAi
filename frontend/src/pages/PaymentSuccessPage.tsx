import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

type PaymentStatus = 'checking' | 'success' | 'error';

interface PaymentStatusResponse {
  status: 'completed' | 'pending' | 'expired';
  message?: string;
  credits_added?: number;
}

export default function PaymentSuccessPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { fetchUserData } = useAuth();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus>('checking');
  const [creditsAdded, setCreditsAdded] = useState<number>(0);
  
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus(sessionId);
    } else {
      setStatus('error');
    }
  }, [sessionId]);

  const pollPaymentStatus = async (sessionId: string, attempts: number = 0): Promise<void> => {
    const maxAttempts = 5;
    
    if (attempts >= maxAttempts) {
      setStatus('error');
      toast.error('Payment verification timed out');
      return;
    }

    try {
      const response = await axios.get<PaymentStatusResponse>(`${API}/payments/status/${sessionId}`);
      
      if (response.data.status === 'completed') {
        setStatus('success');
        setCreditsAdded(response.data.credits_added || 20);
        await fetchUserData();
        toast.success(response.data.message || 'Payment successful');
      } else if (response.data.status === 'expired') {
        setStatus('error');
        toast.error('Payment session expired');
      } else {
        // Continue polling
        setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), 2000);
      }
    } catch (error: any) {
      console.error('Payment status check failed:', error);
      setStatus('error');
      toast.error('Failed to verify payment');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center">
          {status === 'checking' && (
            <>
              <Loader2 className="w-16 h-16 text-indigo-600 mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-jakarta font-bold text-slate-900 mb-2">
                Verifying Payment
              </h2>
              <p className="text-slate-600">Please wait while we confirm your payment...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-2xl font-jakarta font-bold text-slate-900 mb-2">
                Payment Successful!
              </h2>
              <p className="text-slate-600 mb-6">
                {creditsAdded} credits have been added to your account.
              </p>
              <button
                data-testid="continue-rewriting-btn"
                onClick={() => navigate('/editor')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 py-3 font-semibold transition-colors"
              >
                Continue Rewriting
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✕</span>
              </div>
              <h2 className="text-2xl font-jakarta font-bold text-slate-900 mb-2">
                Payment Failed
              </h2>
              <p className="text-slate-600 mb-6">
                We couldn't verify your payment. Please try again or contact support.
              </p>
              <button
                data-testid="back-to-editor-btn"
                onClick={() => navigate('/editor')}
                className="bg-slate-600 hover:bg-slate-700 text-white rounded-full px-8 py-3 font-semibold transition-colors"
              >
                Back to Editor
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}