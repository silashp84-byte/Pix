/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, CheckCircle, AlertCircle, CreditCard, History, Info, ArrowRight } from 'lucide-react';
import axios from 'axios';

interface Transfer {
  id: string;
  key: string;
  value: string;
  date: string;
  status: 'success' | 'failed';
  message?: string;
}

export default function App() {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<Transfer[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [status, setStatus] = useState<{ mode: string; configured: boolean; usingCertificate: boolean; maxTransferValue: number; simulationEnabled: boolean } | null>(null);

  // Load history and status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get('/api/pix/status');
        setStatus(response.data);
      } catch (e) {
        console.error('Error fetching status', e);
      }
    };
    fetchStatus();

    const savedHistory = localStorage.getItem('pix_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Error parsing history', e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem('pix_history', JSON.stringify(history));
  }, [history]);

  const handleTransfer = async (e: FormEvent) => {
    e.preventDefault();
    if (!key || !value) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await axios.post('/api/pix/transfer', { key, value });
      const data = response.data;

      const newTransfer: Transfer = {
        id: data.txid || Math.random().toString(36).substr(2, 9),
        key,
        value,
        date: new Date().toLocaleString('pt-BR'),
        status: 'success',
        message: data.message
      };

      setHistory(prev => [newTransfer, ...prev]);
      setResult({ success: true, message: data.message || 'Transferência realizada com sucesso!' });
      setKey('');
      setValue('');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Erro ao processar transferência.';
      setResult({ success: false, message: errorMsg });
      
      const failedTransfer: Transfer = {
        id: Math.random().toString(36).substr(2, 9),
        key,
        value,
        date: new Date().toLocaleString('pt-BR'),
        status: 'failed',
        message: errorMsg
      };
      setHistory(prev => [failedTransfer, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans p-4 md:p-8">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-light tracking-tight flex items-center gap-2">
              <CreditCard className="w-8 h-8 text-emerald-600" />
              Pix<span className="font-semibold">Connect</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
              Transferências instantâneas e seguras
              {status && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  status.mode === 'public' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {status.mode === 'public' ? 'Client Público' : 'Client Privado'}
                </span>
              )}
            </p>
          </div>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 rounded-full hover:bg-white transition-colors shadow-sm cursor-pointer"
            title="Histórico"
          >
            <History className="w-6 h-6 text-gray-600" />
          </button>
        </header>

        <main>
          {/* Main Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-sm border border-black/5 p-6 md:p-8 mb-6"
          >
            <form onSubmit={handleTransfer} className="space-y-6">
              <div>
                <label htmlFor="key" className="block text-xs font-medium uppercase tracking-wider text-gray-400 mb-2">
                  Chave PIX (CPF, E-mail, Telefone ou Aleatória)
                </label>
                <input
                  id="key"
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Ex: 123.456.789-00"
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  required
                />
              </div>

              <div>
                <label htmlFor="value" className="block text-xs font-medium uppercase tracking-wider text-gray-400 mb-2">
                  Valor (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-lg">R$</span>
                  <input
                    id="value"
                    type="number"
                    step="0.01"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0,00"
                    max={status?.maxTransferValue}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    required
                  />
                </div>
                {status && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Limite máximo por transferência: <span className="font-semibold text-gray-600">R$ {status.maxTransferValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 rounded-2xl font-semibold text-white transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 active:scale-[0.98]'
                }`}
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Enviar PIX
                  </>
                )}
              </button>
            </form>

            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`mt-6 p-4 rounded-2xl flex items-start gap-3 ${
                    result.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
                  }`}
                >
                  {result.success ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                  <p className="text-sm font-medium">{result.message}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Info Banner */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3 items-start">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 leading-relaxed">
              <p className="font-semibold mb-1">Dica de Segurança</p>
              Confira sempre os dados do destinatário antes de confirmar a transferência. O PIX é instantâneo e não pode ser cancelado após o envio.
            </div>
          </div>
        </main>

        {/* History Drawer/Section */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="fixed right-0 top-0 h-full w-full md:w-96 bg-white shadow-2xl z-50 p-6 overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <History className="w-5 h-5 text-gray-400" />
                  Histórico
                </h2>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {history.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <p>Nenhuma transferência encontrada.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="p-4 rounded-2xl border border-gray-100 hover:border-gray-200 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          item.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {item.status === 'success' ? 'Sucesso' : 'Falhou'}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">{item.date}</span>
                      </div>
                      <p className="text-sm font-medium truncate mb-1">{item.key}</p>
                      <p className="text-lg font-bold text-gray-900">R$ {parseFloat(item.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      {item.message && <p className="text-[10px] text-gray-500 mt-2 italic">{item.message}</p>}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overlay for history */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:block"
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
