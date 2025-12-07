/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  return (
    <div className="group flex flex-col gap-6 cursor-pointer" onClick={() => onClick(product)}>
      <div className="relative w-full aspect-[4/5] overflow-hidden bg-slate-100">
        <img 
          src={product.imageUrl} 
          alt={product.name} 
          className="w-full h-full object-cover transition-transform duration-1000 ease-in-out group-hover:scale-110"
        />
        
        {/* Hover overlay with "Quick View" - minimalistic */}
        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors duration-500 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                <span className="bg-white shadow-lg text-slate-900 px-6 py-3 text-xs uppercase tracking-widest font-bold hover:bg-blue-50">
                    View Details
                </span>
            </div>
        </div>
      </div>
      
      <div className="text-center">
        <h3 className="text-2xl font-serif font-medium text-slate-900 mb-1 group-hover:text-blue-900 transition-colors">{product.name}</h3>
        <p className="text-sm font-medium text-slate-500 mb-3 tracking-wide uppercase">{product.category}</p>
        <span className="text-lg font-semibold text-slate-900 block">${product.price}</span>
      </div>
    </div>
  );
};

export default ProductCard;