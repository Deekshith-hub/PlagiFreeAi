import { useNavigate } from 'react-router-dom';
import { Sparkles, FileText, Zap, Shield, History, Download } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Sparkles className="w-6 h-6 text-indigo-600" />,
      title: "AI-Powered Rewriting",
      description: "Advanced GPT-5.2 technology ensures your text is 100% plagiarism-free while preserving meaning."
    },
    {
      icon: <Zap className="w-6 h-6 text-indigo-600" />,
      title: "Multiple Modes",
      description: "Choose from Light, Standard, Aggressive, or Human-Like rewriting modes for perfect results."
    },
    {
      icon: <FileText className="w-6 h-6 text-indigo-600" />,
      title: "Tone Control",
      description: "Select Academic, Professional, Casual, Creative, or Formal tone to match your needs."
    },
    {
      icon: <Shield className="w-6 h-6 text-indigo-600" />,
      title: "Grammar Perfect",
      description: "Automatic grammar correction ensures your rewritten text is flawless and natural."
    },
    {
      icon: <History className="w-6 h-6 text-indigo-600" />,
      title: "History Tracking",
      description: "Access your rewrite history anytime and keep track of all your work."
    },
    {
      icon: <Download className="w-6 h-6 text-indigo-600" />,
      title: "Easy Export",
      description: "Download your rewritten text as .txt or .docx files with one click."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="backdrop-blur-xl bg-white/80 border-b border-white/20 supports-[backdrop-filter]:bg-white/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-indigo-400 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-jakarta font-bold text-slate-900">PlagiFree AI</span>
            </div>
            <div className="flex gap-3">
              <button
                data-testid="header-login-btn"
                onClick={() => navigate('/login')}
                className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-full px-6 py-2 font-medium transition-colors"
              >
                Login
              </button>
              <button
                data-testid="header-signup-btn"
                onClick={() => navigate('/signup')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 rounded-full px-6 py-2 font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24">
        <div className="gradient-bg absolute inset-0"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-jakarta font-bold tracking-tight text-slate-900 mb-6">
              Make Your Text<br />
              <span className="text-indigo-600">100% Plagiarism-Free</span>
            </h1>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed">
              Advanced AI-powered text rewriting that preserves meaning, improves grammar, and ensures originality. Perfect for students, writers, and professionals.
            </p>
            <button
              data-testid="hero-get-started-btn"
              onClick={() => navigate('/signup')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 rounded-full px-10 py-4 text-lg font-bold inline-flex items-center gap-2 transition-all hover:-translate-y-1 active:translate-y-0"
            >
              <Sparkles className="w-5 h-5" />
              Start Rewriting Free
            </button>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-jakarta font-bold text-slate-900 mb-4">
              Powerful Features
            </h2>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
              Everything you need to create unique, high-quality content
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300 p-8"
                data-testid={`feature-card-${index}`}
              >
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-jakarta font-semibold text-slate-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-gradient-to-br from-indigo-600 to-indigo-500 rounded-3xl shadow-xl shadow-indigo-500/40 p-12"
          >
            <h2 className="text-3xl sm:text-4xl font-jakarta font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-indigo-100 text-base sm:text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of users who trust PlagiFree AI for their content rewriting needs.
            </p>
            <button
              data-testid="cta-signup-btn"
              onClick={() => navigate('/signup')}
              className="bg-white text-indigo-600 hover:bg-slate-50 rounded-full px-10 py-4 text-lg font-bold inline-flex items-center gap-2 transition-all hover:-translate-y-1 active:translate-y-0 shadow-lg"
            >
              Create Free Account
            </button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-slate-600">
          <p>© 2025 PlagiFree AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}