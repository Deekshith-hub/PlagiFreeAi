import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Copy, Download, History, LogOut, BarChart3, FileText, CreditCard } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import ReactDiffViewer from 'react-diff-viewer-continued';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function EditorPage() {
  const navigate = useNavigate();
  const { user, logout, fetchUserData } = useAuth();
  const [originalText, setOriginalText] = useState('');
  const [rewrittenText, setRewrittenText] = useState('');
  const [mode, setMode] = useState('standard');
  const [tone, setTone] = useState('professional');
  const [loading, setLoading] = useState(false);
  const [plagiarismScore, setPlagiarismScore] = useState(null);
  const [showDiff, setShowDiff] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentHistoryId, setCurrentHistoryId] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  const modes = [
    { value: 'light', label: 'Light' },
    { value: 'standard', label: 'Standard' },
    { value: 'aggressive', label: 'Aggressive' },
    { value: 'human-like', label: 'Human-Like' }
  ];

  const tones = [
    { value: 'academic', label: 'Academic' },
    { value: 'professional', label: 'Professional' },
    { value: 'casual', label: 'Casual' },
    { value: 'creative', label: 'Creative' },
    { value: 'formal', label: 'Formal' }
  ];

  const handleRewrite = async () => {
    if (!originalText.trim()) {
      toast.error('Please enter text to rewrite');
      return;
    }

    const totalAvailable = (user.daily_limit - user.rewrites_today) + (user.credits || 0);
    
    if (totalAvailable <= 0) {
      setShowPaymentModal(true);
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API}/rewrite`, {
        text: originalText,
        mode,
        tone
      });

      setRewrittenText(response.data.rewritten_text);
      setPlagiarismScore(response.data.plagiarism_percentage);
      setCurrentHistoryId(response.data.id);
      toast.success('Text rewritten successfully!');
      
      await fetchUserData();
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to rewrite text';
      if (message.includes('No rewrites remaining')) {
        setShowPaymentModal(true);
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!rewrittenText) {
      toast.error('No text to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(rewrittenText);
      toast.success('Copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    if (!rewrittenText) {
      toast.error('No text to download');
      return;
    }

    const blob = new Blob([rewrittenText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rewritten-text.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Downloaded as .txt!');
  };

  const handleDownloadDocx = async () => {
    if (!currentHistoryId) {
      toast.error('No text to download');
      return;
    }

    try {
      const response = await axios.get(`${API}/download/${currentHistoryId}/docx`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rewritten-text-${currentHistoryId.substring(0, 8)}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Downloaded as .docx!');
    } catch (error) {
      toast.error('Failed to download .docx file');
    }
  };

  const handlePurchaseCredits = async () => {
    setProcessingPayment(true);
    
    try {
      const originUrl = window.location.origin;
      const response = await axios.post(`${API}/payments/purchase-credits`, {
        package_id: 'extra_20',
        origin_url: originUrl
      });

      window.location.href = response.data.checkout_url;
    } catch (error) {
      toast.error('Failed to initiate payment');
      setProcessingPayment(false);
    }
  };

  const wordCount = (text) => {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  };

  const charCount = (text) => {
    return text.length;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="backdrop-blur-xl bg-white/80 border-b border-white/20 supports-[backdrop-filter]:bg-white/60 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-indigo-400 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-jakarta font-bold text-slate-900">PlagiFree AI</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-sm">
                <div className="text-slate-600">
                  <span className="font-semibold text-indigo-600">{(user?.daily_limit || 10) - (user?.rewrites_today || 0)}</span> free left
                </div>
                {user?.credits > 0 && (
                  <div className="text-slate-600 flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-amber-600">{user.credits}</span> credits
                  </div>
                )}
              </div>
              <button
                data-testid="dashboard-btn"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-full px-4 py-2 font-medium transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                Dashboard
              </button>
              <button
                data-testid="logout-btn"
                onClick={() => {
                  logout();
                  navigate('/');
                  toast.success('Logged out successfully');
                }}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Editor */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mode & Tone Selectors */}
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Rewrite Mode</label>
            <div className="flex flex-wrap gap-2">
              {modes.map((m) => (
                <button
                  key={m.value}
                  data-testid={`mode-${m.value}-btn`}
                  onClick={() => setMode(m.value)}
                  className={`px-4 py-2 rounded-full font-medium transition-all ${
                    mode === m.value
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Tone</label>
            <div className="flex flex-wrap gap-2">
              {tones.map((t) => (
                <button
                  key={t.value}
                  data-testid={`tone-${t.value}-btn`}
                  onClick={() => setTone(t.value)}
                  className={`px-4 py-2 rounded-full font-medium transition-all ${
                    tone === t.value
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Two-Panel Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-280px)] min-h-[600px]">
          {/* Original Text Panel */}
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col h-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-jakarta font-semibold text-slate-900">Original Text</h3>
              <div className="text-sm text-slate-500">
                <span data-testid="original-word-count">{wordCount(originalText)}</span> words | <span data-testid="original-char-count">{charCount(originalText)}</span> chars
              </div>
            </div>
            <textarea
              data-testid="original-text-input"
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              placeholder="Paste your text here..."
              className="editor-textarea flex-1 w-full resize-none border-none focus:ring-0 p-6 text-lg font-source bg-transparent outline-none placeholder:text-slate-300"
            />
          </div>

          {/* Rewritten Text Panel */}
          <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 flex flex-col h-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-jakarta font-semibold text-slate-900">Plagiarism-Free Text</h3>
                <div className="flex items-center gap-2">
                  {plagiarismScore !== null && (
                    <div className="flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-full">
                      <span className="text-xs font-semibold text-emerald-700">{plagiarismScore}% Unique</span>
                    </div>
                  )}
                  {rewrittenText && (
                    <button
                      onClick={() => setShowDiff(!showDiff)}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1 rounded-full font-medium transition-colors"
                      data-testid="toggle-diff-btn"
                    >
                      {showDiff ? 'Hide' : 'Show'} Changes
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-slate-500">
                  <span data-testid="rewritten-word-count">{wordCount(rewrittenText)}</span> words | <span data-testid="rewritten-char-count">{charCount(rewrittenText)}</span> chars
                </div>
                <button
                  data-testid="copy-btn"
                  onClick={handleCopy}
                  disabled={!rewrittenText}
                  className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  data-testid="download-txt-btn"
                  onClick={handleDownload}
                  disabled={!rewrittenText}
                  className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Download as .txt"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  data-testid="download-docx-btn"
                  onClick={handleDownloadDocx}
                  disabled={!currentHistoryId}
                  className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Download as .docx"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-6 text-lg font-source text-slate-800 overflow-y-auto editor-textarea">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-slate-600">Rewriting your text...</p>
                  </div>
                </div>
              ) : rewrittenText ? (
                showDiff ? (
                  <div className="text-sm">
                    <ReactDiffViewer
                      oldValue={originalText}
                      newValue={rewrittenText}
                      splitView={false}
                      showDiffOnly={false}
                      useDarkTheme={false}
                      styles={{
                        variables: {
                          light: {
                            diffViewerBackground: '#ffffff',
                            addedBackground: '#d4f8d4',
                            removedBackground: '#ffd4d4'
                          }
                        }
                      }}
                    />
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    data-testid="rewritten-text-output"
                  >
                    {rewrittenText}
                  </motion.div>
                )
              ) : (
                <p className="text-slate-300 text-center h-full flex items-center justify-center">
                  Your rewritten text will appear here...
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Rewrite Button */}
      <AnimatePresence>
        {originalText.trim() && !loading && (
          <motion.button
            data-testid="rewrite-sticky-btn"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            onClick={handleRewrite}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 shadow-2xl shadow-indigo-500/40 bg-indigo-600 text-white rounded-full px-10 py-4 text-lg font-bold flex items-center gap-2 hover:scale-105 transition-transform"
          >
            <Sparkles className="w-5 h-5" />
            Rewrite Text
          </motion.button>
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !processingPayment && setShowPaymentModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
              data-testid="payment-modal"
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-jakarta font-bold text-slate-900 mb-2">
                  Out of Rewrites
                </h3>
                <p className="text-slate-600">
                  You've used all your free daily rewrites. Purchase extra credits to continue!
                </p>
              </div>

              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-6 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-700 font-semibold">20 Extra Rewrites</span>
                  <span className="text-2xl font-jakarta font-bold text-indigo-600">₹50</span>
                </div>
                <p className="text-sm text-slate-600">
                  One-time purchase • Never expires
                </p>
              </div>

              <div className="space-y-3">
                <button
                  data-testid="purchase-credits-btn"
                  onClick={handlePurchaseCredits}
                  disabled={processingPayment}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 py-3 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processingPayment ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      Purchase Credits
                    </>
                  )}
                </button>
                <button
                  data-testid="cancel-payment-btn"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={processingPayment}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-6 py-3 font-semibold transition-colors disabled:opacity-50"
                >
                  Maybe Later
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}