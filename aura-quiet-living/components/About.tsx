/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';

const About: React.FC = () => {
  return (
    <section id="about" className="bg-slate-100">
      
      {/* Introduction / Story */}
      <div className="py-24 px-6 md:px-12 max-w-[1800px] mx-auto flex flex-col md:flex-row items-start gap-16 md:gap-32">
        <div className="md:w-1/3">
          <h2 className="text-4xl md:text-6xl font-serif text-slate-900 leading-tight">
            Above the clouds, <br/> beyond expectation.
          </h2>
        </div>
        <div className="md:w-2/3 max-w-2xl">
          <p className="text-lg md:text-xl text-slate-600 font-light leading-relaxed mb-8">
            Skyward Airlines was founded on the belief that the journey should be as memorable as the destination. We don't just transport you; we host you.
          </p>
          <p className="text-lg md:text-xl text-slate-600 font-light leading-relaxed mb-8">
            From our state-of-the-art A350 fleet to our curated in-flight boutique, every detail is designed for your comfort. Sit back, relax, and let us bring the world to your seat.
          </p>
          <img 
            src="https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&q=80&w=1200" 
            alt="Skyward Fleet" 
            className="w-full h-[400px] object-cover mt-12 shadow-lg"
          />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-4">
            Skyward A350-1000 - "The Horizon"
          </p>
        </div>
      </div>

      {/* Philosophy Blocks (Formerly Features) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[80vh]">
        <div className="order-2 lg:order-1 relative h-[500px] lg:h-auto overflow-hidden group">
           <img 
             src="https://images.unsplash.com/photo-1517400508447-f8dd518b86db?auto=format&fit=crop&q=80&w=1200" 
             alt="First Class Cabin" 
             className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-105"
           />
        </div>
        <div className="order-1 lg:order-2 flex flex-col justify-center p-12 lg:p-24 bg-white">
           <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-900 mb-6">Comfort</span>
           <h3 className="text-4xl md:text-5xl font-serif mb-8 text-slate-900 leading-tight">
             Your sanctuary <br/> in the sky.
           </h3>
           <p className="text-lg text-slate-600 font-light leading-relaxed mb-12 max-w-md">
             Our cabins are designed with calmness in mind. Ergonomic seating, mood lighting that reduces jet lag, and whisper-quiet engines ensure you arrive refreshed.
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[80vh]">
        <div className="flex flex-col justify-center p-12 lg:p-24 bg-slate-900 text-white">
           <span className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200 mb-6">Service</span>
           <h3 className="text-4xl md:text-5xl font-serif mb-8 text-white leading-tight">
             At your service.
           </h3>
           <p className="text-lg text-slate-300 font-light leading-relaxed mb-12 max-w-md">
             Our flight attendants are your concierge. Whether you need a travel recommendation, a duty-free exclusive, or simply a glass of champagne, we are here to serve.
           </p>
        </div>
        <div className="relative h-[500px] lg:h-auto overflow-hidden group">
           <img 
             src="https://images.unsplash.com/photo-1540339832862-437954c39121?auto=format&fit=crop&q=80&w=1200" 
             alt="Stewardess serving drink" 
             className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-105 opacity-90"
           />
        </div>
      </div>
    </section>
  );
};

export default About;