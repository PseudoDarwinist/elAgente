/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Product, JournalArticle } from './types';

export const PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Skyward NoiseGuard',
    tagline: 'Silence the engine.',
    description: 'Premium active noise-cancelling headphones optimized for cabin frequencies.',
    longDescription: 'Designed specifically for the frequent flyer, the Skyward NoiseGuard headphones feature adaptive frequency cancellation that targets engine drone and cabin noise. With 40 hours of battery life, plush memory foam earcups, and seamless Bluetooth connectivity, they turn your seat into a private sanctuary.',
    price: 349,
    category: 'Electronics',
    imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=1000',
    gallery: [
      'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=1000',
      'https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3?auto=format&fit=crop&q=80&w=1000'
    ],
    features: ['Adaptive ANC', '40h Battery', 'Flight Adapter Included']
  },
  {
    id: 'p2',
    name: 'First Class Comfort Set',
    tagline: 'Rest anywhere.',
    description: 'A luxury amenity kit featuring a silk eye mask, cashmere socks, and earplugs.',
    longDescription: 'Elevate your rest with our signature First Class Comfort Set. Enclosed in a vegan leather pouch, you will find a mulberry silk eye mask to block out cabin light, soft cashmere blend socks for warmth, and high-fidelity earplugs. Arrive at your destination refreshed.',
    price: 85,
    category: 'Comfort',
    imageUrl: 'https://images.unsplash.com/photo-1512413914633-b5043f4041ea?auto=format&fit=crop&q=80&w=1000',
    gallery: [
        'https://images.unsplash.com/photo-1512413914633-b5043f4041ea?auto=format&fit=crop&q=80&w=1000',
        'https://images.unsplash.com/photo-1584617066928-1b6c0032cb07?auto=format&fit=crop&q=80&w=1000'
    ],
    features: ['Mulberry Silk Mask', 'Cashmere Blend Socks', 'Leather Pouch']
  },
  {
    id: 'p3',
    name: 'Voyager Universal Adapter',
    tagline: 'Power globally.',
    description: 'All-in-one travel adapter compatible with outlets in over 150 countries.',
    longDescription: 'Never worry about charging again. The Voyager Universal Adapter features sliding plugs for US, UK, EU, and AU outlets, plus two USB-C PD ports for fast charging your laptop and phone simultaneously. Compact, durable, and essential for the international traveler.',
    price: 45,
    category: 'Electronics',
    imageUrl: 'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&q=80&w=1000',
    gallery: [
        'https://images.unsplash.com/photo-1585338107529-13afc5f02586?auto=format&fit=crop&q=80&w=1000'
    ],
    features: ['150+ Countries', 'Dual USB-C PD', 'Surge Protection']
  },
  {
    id: 'p4',
    name: 'Skyward A350 Model',
    tagline: 'Own the fleet.',
    description: '1:400 scale die-cast model of our signature Airbus A350-1000 aircraft.',
    longDescription: 'A collector’s favorite. This high-precision 1:400 scale model replicates the Skyward Airbus A350-1000 down to the finest detail, including rolling landing gear and accurate livery. A perfect memento of your journey or gift for the aviation enthusiast.',
    price: 65,
    category: 'Souvenirs',
    imageUrl: 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?auto=format&fit=crop&q=80&w=1000',
    gallery: [
        'https://images.unsplash.com/photo-1474302770737-173ee21bab63?auto=format&fit=crop&q=80&w=1000'
    ],
    features: ['Die-cast Metal', '1:400 Scale', 'Display Stand']
  },
  {
    id: 'p5',
    name: 'L\'Air de Nuit Perfume',
    tagline: 'Captivating scent.',
    description: 'Exclusive duty-free fragrance with notes of bergamot, jasmine, and amber.',
    longDescription: 'Created exclusively for Skyward by master perfumers in Grasse. L\'Air de Nuit captures the romance of night flight. Top notes of crisp bergamot fade into a heart of jasmine and white tea, resting on a warm base of amber and sandalwood. 50ml Eau de Parfum.',
    price: 110,
    category: 'Duty Free',
    imageUrl: 'https://images.unsplash.com/photo-1594035910387-fea4779426e9?auto=format&fit=crop&q=80&w=1000',
    gallery: [
        'https://images.unsplash.com/photo-1594035910387-fea4779426e9?auto=format&fit=crop&q=80&w=1000'
    ],
    features: ['Duty Free Exclusive', '50ml', 'Gift Boxed']
  },
  {
    id: 'p6',
    name: 'Alpine Chocolate Selection',
    tagline: 'Sweet altitude.',
    description: 'A curated box of Swiss pralines and truffles. Perfect for sharing or gifting.',
    longDescription: 'Indulge in the finest cocoa from the Swiss Alps. This 12-piece selection includes dark chocolate truffle, hazelnut praline, and sea salt caramel. Packaged in our signature Skyward gold-foil box. Contains nuts and dairy.',
    price: 35,
    category: 'Duty Free',
    imageUrl: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&q=80&w=1000',
    gallery: [
        'https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&q=80&w=1000'
    ],
    features: ['Swiss Made', '12 Pieces', 'Gift Ready']
  }
];

export const JOURNAL_ARTICLES: JournalArticle[] = [
    {
        id: 1,
        title: "Tokyo: Neon & Tradition",
        date: "May 2025 Issue",
        excerpt: "Navigating the electric streets of Shinjuku and the quiet temples of Asakusa.",
        image: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&q=80&w=1000",
        content: React.createElement(React.Fragment, null,
            React.createElement("p", { className: "mb-6 first-letter:text-5xl first-letter:font-serif first-letter:mr-3 first-letter:float-left text-slate-600" },
                "Tokyo is a city of contradictions. Step off the train at Shinjuku Station, the busiest transport hub in the world, and you are assaulted by light and sound. Yet, just a few stops away, Meiji Shrine offers a forest so dense you forget the city exists."
            ),
            React.createElement("p", { className: "mb-8 text-slate-600" },
                "Our flight crew recommends starting your day at Tsukiji Outer Market for fresh sushi breakfast, then heading to the Mori Art Museum for contemporary views over the sprawling metropolis."
            ),
            React.createElement("blockquote", { className: "border-l-2 border-slate-900 pl-6 italic text-xl text-slate-900 my-10 font-serif" },
                "\"The future and the past live side by side here.\""
            ),
            React.createElement("p", { className: "mb-6 text-slate-600" },
                "Don't miss the cherry blossoms along the Meguro River if you are flying with us in April. It is a reminder that even in a city of concrete, nature dictates the rhythm of life."
            )
        )
    },
    {
        id: 2,
        title: "The Art of Altitude Dining",
        date: "April 2025 Issue",
        excerpt: "How our chefs design menus that taste perfect at 35,000 feet.",
        image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&q=80&w=1000",
        content: React.createElement(React.Fragment, null,
            React.createElement("p", { className: "mb-6 text-slate-600" },
                "Did you know your sense of taste changes when you fly? The lower humidity and cabin pressure can reduce sensitivity to sweet and salty foods by up to 30%."
            ),
            React.createElement("p", { className: "mb-8 text-slate-600" },
                "At Skyward, our culinary team counters this by using bold umami flavors—mushrooms, tomatoes, soy sauce, and slow-cooked stocks. We pair these rich bases with crisp, high-altitude wines selected by our sommelier."
            ),
            React.createElement("div", { className: "my-12 p-8 bg-slate-100 font-serif text-slate-900 italic text-center" },
                React.createElement("p", null, "Flavor is not just ingredients."),
                React.createElement("p", null, "It is atmosphere."),
                React.createElement("p", null, "It is altitude."),
                React.createElement("p", null, "It is the journey.")
            ),
            React.createElement("p", { className: "mb-6 text-slate-600" },
                "Next time you order the braised short rib or the miso-glazed cod, savor the science behind the seasoning."
            )
        )
    },
    {
        id: 3,
        title: "Hidden Gems of Paris",
        date: "March 2025 Issue",
        excerpt: "Beyond the Eiffel Tower: Where the locals actually go.",
        image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&q=80&w=1000",
        content: React.createElement(React.Fragment, null,
            React.createElement("p", { className: "mb-6 text-slate-600" },
                "Paris is the most visited city in the world, but it still holds secrets. Skip the Louvre queues and head to the Musée de la Vie Romantique, tucked away in the 9th arrondissement."
            ),
            React.createElement("p", { className: "mb-8 text-slate-600" },
                "For coffee, avoid the expensive boulevards. Find a seat at Fragments in the Marais for the best espresso in town. And for sunset? The Canal Saint-Martin offers a local vibe with wine, cheese, and music by the water."
            ),
             React.createElement("div", { className: "my-12 p-8 bg-slate-900 text-white font-serif italic text-center" },
                React.createElement("p", null, "Paris is not a city."),
                React.createElement("p", null, "It is a world."),
            )
        )
    }
];

export const BRAND_NAME = 'Skyward';