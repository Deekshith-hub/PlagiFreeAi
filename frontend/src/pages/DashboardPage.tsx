import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, LogOut, FileEdit, BarChart3, Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { motion } from 'framer-motion';
import { HistoryItem } from '@/types/api';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DashboardPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async (): Promise<void> => {
    try {
      const response = await axios.get<HistoryItem[]>(`${API}/history`);
      setHistory(response.data);
    } catch (error: any) {
      toast.error('Failed to fetch history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
              <button
                data-testid="editor-btn"
                onClick={() => navigate('/editor')}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6 py-2 font-semibold transition-colors shadow-md shadow-indigo-500/30"
              >
                <FileEdit className="w-4 h-4" />
                Editor
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-jakarta font-bold text-slate-900 mb-2">Dashboard</h1>
          <p className="text-slate-600">Track your rewriting activity and usage</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-white rounded-2xl shadow-md border border-slate-100 p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-indigo-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-600">Rewrites Today</h3>
            </div>
            <p className="text-3xl font-jakarta font-bold text-slate-900" data-testid="rewrites-today">
              {user?.rewrites_today || 0}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-white rounded-2xl shadow-md border border-slate-100 p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-600">Remaining</h3>
            </div>
            <p className="text-3xl font-jakarta font-bold text-emerald-600" data-testid="remaining-rewrites">
              {user?.remaining || 0}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-white rounded-2xl shadow-md border border-slate-100 p-6"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-violet-50 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-violet-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-600">Daily Limit</h3>
            </div>
            <p className="text-3xl font-jakarta font-bold text-slate-900" data-testid="daily-limit">
              {user?.daily_limit || 10}
            </p>
          </motion.div>
        </div>

        {/* History Section */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
          <h2 className="text-xl font-jakarta font-bold text-slate-900 mb-6">Rewrite History</h2>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <FileEdit className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">No rewrite history yet</p>
              <button
                data-testid="start-rewriting-btn"
                onClick={() => navigate('/editor')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-6 py-2 font-semibold transition-colors"
              >
                Start Rewriting
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow"
                  data-testid={`history-item-${index}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                        {item.mode}
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        {item.tone}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{formatDate(item.timestamp)}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-1">Original ({item.original_word_count} words)</p>
                      <p className="text-sm text-slate-700 line-clamp-3">{item.original_text}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-600 mb-1">Rewritten ({item.rewritten_word_count} words)</p>
                      <p className="text-sm text-slate-700 line-clamp-3">{item.rewritten_text}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}