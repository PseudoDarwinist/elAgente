/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';

const Hero: React.FC = () => {
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      // Manual scroll calculation to account for fixed header
      const headerOffset = 85;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
      
      // Update URL hash without jumping, safely ignoring errors in sandboxed environments
      try {
        window.history.pushState(null, '', `#${targetId}`);
      } catch (err) {
        // Ignore SecurityError in restricted environments
      }
    }
  };

  return (
    <section className="relative w-full h-screen min-h-[800px] overflow-hidden bg-slate-900">
      
      {/* Background Image - Clouds/Airplane View */}
      <div className="absolute inset-0 w-full h-full">
        <img 
            src="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&q=80&w=2000" 
            alt="View from airplane window" 
            className="w-full h-full object-cover opacity-90"
        />
        {/* Blue Overlay for Corporate Feel */}
        <div className="absolute inset-0 bg-blue-900/30 mix-blend-multiply"></div>
        {/* Gradient for Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent"></div>
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-center items-start text-left md:items-center md:text-center px-6">
        <div className="animate-fade-in-up w-full md:w-auto">
          <span className="block text-xs md:text-sm font-medium uppercase tracking-[0.2em] text-white/90 mb-6 backdrop-blur-sm bg-white/10 px-4 py-2 rounded-full mx-0 md:mx-auto w-fit border border-white/20">
            Welcome Aboard
          </span>
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-serif font-normal text-white tracking-tight mb-8 drop-shadow-lg">
            Elevate Your <span className="italic text-blue-100">Journey.</span>
          </h1>
          <p className="max-w-lg mx-0 md:mx-auto text-lg md:text-xl text-white/90 font-light leading-relaxed mb-12 text-shadow-sm">
            Shop duty-free exclusives and travel essentials from the comfort of your seat. <br/>
            We'll deliver directly to you before landing.
          </p>
          
          <a 
            href="#products" 
            onClick={(e) => handleNavClick(e, 'products')}
            className="group relative px-10 py-4 bg-white text-slate-900 rounded-sm text-sm font-semibold uppercase tracking-widest hover:bg-blue-50 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-xl inline-block"
          >
            <span className="relative z-10 group-hover:text-blue-900">Start Shopping</span>
          </a>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce text-white/50">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
};

export default Hero;