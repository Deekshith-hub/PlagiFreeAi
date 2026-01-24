import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function EmailVerificationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [message, setMessage] = useState('');
  
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    } else {
      setStatus('error');
      setMessage('Invalid verification link');
    }
  }, [token]);

  const verifyEmail = async (token) => {
    try {
      const response = await axios.post(`${API}/auth/verify-email?token=${token}`);
      setStatus('success');
      setMessage(response.data.message);
      toast.success('Email verified successfully!');
      
      setTimeout(() => {
        navigate('/editor');
      }, 2000);
    } catch (error) {
      setStatus('error');
      setMessage(error.response?.data?.detail || 'Verification failed');
      toast.error('Email verification failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 text-center">
          {status === 'verifying' && (
            <>
              <Loader2 className="w-16 h-16 text-indigo-600 mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-jakarta font-bold text-slate-900 mb-2">
                Verifying Email
              </h2>
              <p className="text-slate-600">Please wait...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
              <h2 className="text-2xl font-jakarta font-bold text-slate-900 mb-2">
                Email Verified!
              </h2>
              <p className="text-slate-600 mb-6">
                {message || 'Your email has been verified successfully.'}
              </p>
              <p className="text-sm text-slate-500">
                Redirecting you to the editor...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h2 className="text-2xl font-jakarta font-bold text-slate-900 mb-2">
                Verification Failed
              </h2>
              <p className="text-slate-600 mb-6">
                {message}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 py-3 font-semibold transition-colors"
              >
                Go to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}