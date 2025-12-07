/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */


import React from 'react';
import { Product } from '../types';
import ErrorSplitView from './ErrorSplitView';

interface CheckoutProps {
  items: Product[];
  onBack: () => void;
}

const Checkout: React.FC<CheckoutProps> = ({ items, onBack }) => {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const total = subtotal;

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorStartTime, setErrorStartTime] = React.useState<number | null>(null);
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [sreAgentStatus, setSreAgentStatus] = React.useState<{
    step: 'detecting' | 'logs' | 'analyzing' | 'fixing' | 'validating' | 'done';
    message?: string;
  }>({ step: 'detecting', message: 'Error detected. Starting investigation...' });

  // Simulate SRE Agent progress
  React.useEffect(() => {
    if (!error || !errorStartTime) return;

    const steps: Array<{
      step: 'detecting' | 'logs' | 'analyzing' | 'fixing' | 'validating' | 'done';
      message: string;
      delay: number;
    }> = [
        { step: 'detecting', message: 'Error detected. Starting investigation...', delay: 0 },
        { step: 'logs', message: 'Retrieving application logs and traces...', delay: 3000 },
        { step: 'analyzing', message: 'Analyzing root cause: Payment gateway timeout...', delay: 6000 },
        { step: 'fixing', message: 'Deploying hotfix: Increasing timeout threshold...', delay: 10000 },
        { step: 'validating', message: 'Validating fix in staging environment...', delay: 14000 },
      ];

    const timers: NodeJS.Timeout[] = [];

    steps.forEach(({ step, message, delay }) => {
      const timer = setTimeout(() => {
        setSreAgentStatus({ step, message });
      }, delay);
      timers.push(timer);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [error, errorStartTime]);

  const handlePayment = async () => {
    setIsProcessing(true);
    setError(null);
    setErrorStartTime(null);

    try {
      const response = await fetch('http://localhost:4000/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: items,
          email: 'test@example.com' // Mock email
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      // Success
      alert(`Order placed successfully! ID: ${data.orderId}`);
      onBack();

    } catch (err: any) {
      const errorMessage = err.message || 'Something went wrong';
      setError(errorMessage);
      setErrorStartTime(Date.now());
      setSreAgentStatus({ step: 'detecting', message: 'Error detected. Starting investigation...' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);

    try {
      const response = await fetch('http://localhost:4000/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: items,
          email: 'test@example.com'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      // Success - close split view
      setError(null);
      setErrorStartTime(null);
      alert(`Order placed successfully! ID: ${data.orderId}`);
      onBack();

    } catch (err: any) {
      // Still failing, update message but keep split view open
      setError(err.message || 'Something went wrong');
    } finally {
      setIsRetrying(false);
    }
  };

  const checkoutContent = (
    <div className="min-h-screen pt-24 pb-24 px-6 bg-slate-50 animate-fade-in-up">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={onBack}
          className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors mb-12"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 group-hover:-translate-x-1 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Boutique
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">

          {/* Left Column: Form */}
          <div>
            <h1 className="text-3xl font-serif text-slate-900 mb-4">Secure Checkout</h1>
            <p className="text-sm text-slate-500 mb-12">Items will be delivered to your seat by cabin crew.</p>

            <div className="space-y-12">
              {/* Section 1: Passenger Info */}
              <div>
                <h2 className="text-xl font-serif text-slate-900 mb-6">Passenger Details</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Seat Number (e.g., 12A)" className="w-full bg-white border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-900 transition-colors rounded-sm" />
                    <input type="text" placeholder="Flight Number" value="SK902" readOnly className="w-full bg-slate-100 border border-slate-200 px-4 py-3 text-slate-500 outline-none cursor-not-allowed rounded-sm" />
                  </div>
                  <input type="email" placeholder="Email address for receipt" className="w-full bg-white border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-900 transition-colors rounded-sm" />
                </div>
              </div>

              {/* Section 2: Identity */}
              <div>
                <h2 className="text-xl font-serif text-slate-900 mb-6">Identification</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="First name" className="w-full bg-white border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-900 transition-colors rounded-sm" />
                    <input type="text" placeholder="Last name" className="w-full bg-white border border-slate-200 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-900 transition-colors rounded-sm" />
                  </div>
                </div>
              </div>

              {/* Section 3: Payment (Mock) */}
              <div>
                <h2 className="text-xl font-serif text-slate-900 mb-6">Payment</h2>
                <div className="p-6 border border-slate-200 bg-white rounded-sm space-y-4">
                  <p className="text-sm text-slate-500 mb-2 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    Encrypted In-Flight Connection
                  </p>
                  <input type="text" placeholder="Card number" defaultValue="4242 4242 4242 4242" className="w-full bg-transparent border-b border-slate-200 py-3 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-900 transition-colors" />
                  <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="Expiration (MM/YY)" defaultValue="12/25" className="w-full bg-transparent border-b border-slate-200 py-3 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-900 transition-colors" />
                    <input type="text" placeholder="Security code" defaultValue="123" className="w-full bg-transparent border-b border-slate-200 py-3 text-slate-900 placeholder-slate-400 outline-none focus:border-blue-900 transition-colors" />
                  </div>
                </div>
              </div>

              <div>
                <button
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className={`w-full py-5 uppercase tracking-widest text-sm font-bold rounded-sm transition-all ${isProcessing
                    ? 'bg-slate-300 text-slate-500 cursor-wait'
                    : 'bg-blue-900 text-white hover:bg-blue-800 shadow-lg hover:shadow-xl'
                    }`}
                >
                  {isProcessing ? 'Processing Payment...' : `Pay Now — $${total}`}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Summary */}
          <div className="lg:pl-12 lg:border-l border-slate-200">
            <h2 className="text-xl font-serif text-slate-900 mb-8">Order Summary</h2>

            <div className="space-y-6 mb-8">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-16 h-16 bg-slate-100 relative rounded-sm overflow-hidden">
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    <span className="absolute top-0 right-0 w-5 h-5 bg-blue-900 text-white text-[10px] flex items-center justify-center rounded-bl-sm font-bold">1</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-serif text-slate-900 text-base">{item.name}</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">{item.category}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">${item.price}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-6 space-y-2">
              <div className="flex justify-between text-sm text-slate-500">
                <span>Subtotal</span>
                <span>${subtotal}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500">
                <span>Seat Delivery</span>
                <span>Free</span>
              </div>
            </div>

            <div className="border-t border-slate-200 mt-6 pt-6">
              <div className="flex justify-between items-center">
                <span className="font-serif text-xl text-slate-900">Total</span>
                <div className="flex items-end gap-2">
                  <span className="text-xs text-slate-400 mb-1 font-bold">USD</span>
                  <span className="font-serif text-2xl text-slate-900">${total}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <ErrorSplitView
      isActive={!!error && !!errorStartTime}
      errorStartTime={errorStartTime || Date.now()}
      errorMessage={error || ''}
      onRetry={handleRetry}
      isRetrying={isRetrying}
      sreAgentStatus={sreAgentStatus}
    >
      {checkoutContent}
    </ErrorSplitView>
  );
};

export default Checkout;