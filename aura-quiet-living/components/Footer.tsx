/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState } from 'react';

interface FooterProps {
  onLinkClick: (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => void;
}

const Footer: React.FC<FooterProps> = ({ onLinkClick }) => {
  const [subscribeStatus, setSubscribeStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [email, setEmail] = useState('');

  const handleSubscribe = () => {
    if (!email) return;
    setSubscribeStatus('loading');
    setTimeout(() => {
      setSubscribeStatus('success');
      setEmail('');
    }, 1500);
  };

  return (
    <footer className="bg-slate-50 pt-24 pb-12 px-6 text-slate-600 border-t border-slate-200">
      <div className="max-w-[1800px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-12">
        
        <div className="md:col-span-4">
          <h4 className="text-2xl font-serif text-slate-900 mb-6 italic">Skyward</h4>
          <p className="max-w-xs font-light leading-relaxed text-sm">
            Redefining the art of air travel. From our fleet to our food, experience the difference of Skyward.
          </p>
        </div>

        <div className="md:col-span-2">
          <h4 className="font-bold text-slate-900 mb-6 tracking-widest text-xs uppercase">Boutique</h4>
          <ul className="space-y-4 font-light text-sm">
            <li><a href="#products" onClick={(e) => onLinkClick(e, 'products')} className="hover:text-blue-900 transition-colors">All Duty Free</a></li>
            <li><a href="#products" onClick={(e) => onLinkClick(e, 'products')} className="hover:text-blue-900 transition-colors">Exclusives</a></li>
            <li><a href="#products" onClick={(e) => onLinkClick(e, 'products')} className="hover:text-blue-900 transition-colors">Travel Essentials</a></li>
          </ul>
        </div>
        
        <div className="md:col-span-2">
          <h4 className="font-bold text-slate-900 mb-6 tracking-widest text-xs uppercase">The Airline</h4>
          <ul className="space-y-4 font-light text-sm">
            <li><a href="#about" onClick={(e) => onLinkClick(e, 'about')} className="hover:text-blue-900 transition-colors">Our Fleet</a></li>
            <li><a href="#about" onClick={(e) => onLinkClick(e, 'about')} className="hover:text-blue-900 transition-colors">Sustainability</a></li>
            <li><a href="#journal" onClick={(e) => onLinkClick(e, 'journal')} className="hover:text-blue-900 transition-colors">Destinations</a></li>
          </ul>
        </div>

        <div className="md:col-span-4">
          <h4 className="font-bold text-slate-900 mb-6 tracking-widest text-xs uppercase">Frequent Flyer News</h4>
          <div className="flex flex-col gap-4">
            <input 
              type="email" 
              placeholder="Enter your email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={subscribeStatus === 'loading' || subscribeStatus === 'success'}
              className="bg-transparent border-b border-slate-300 py-2 text-lg outline-none focus:border-blue-900 transition-colors placeholder-slate-400 text-slate-900 disabled:opacity-50" 
            />
            <button 
              onClick={handleSubscribe}
              disabled={subscribeStatus !== 'idle' || !email}
              className="self-start text-xs font-bold uppercase tracking-widest mt-2 hover:text-blue-900 disabled:cursor-default disabled:hover:text-slate-600 disabled:opacity-50 transition-opacity"
            >
              {subscribeStatus === 'idle' && 'Join Skyward Club'}
              {subscribeStatus === 'loading' && 'Processing...'}
              {subscribeStatus === 'success' && 'Welcome Aboard'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto mt-20 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-[10px] uppercase tracking-widest text-slate-400">
        <p>© 2025 Skyward Airlines. All rights reserved.</p>
        <div className="flex gap-8 mt-4 md:mt-0">
            <span>Privacy Policy</span>
            <span>Conditions of Carriage</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;