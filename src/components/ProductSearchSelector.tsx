import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Product, Currency, Unit, InvoiceType } from '../types';
import { useAccounting } from '../context/AccountingContext';
import { formatNumber, formatCurrency } from '../utils/formatters';
import { Search, Package, ChevronDown, Check, X, Boxes, AlertCircle, Warehouse } from 'lucide-react';

export interface ProductSearchSelectorProps {
  products?: Product[];
  selectedProductId?: string;
  onSelectProduct: (product: Product) => void;
  onClear?: () => void;
  warehouseId?: string;
  currency?: Currency;
  priceType?: 'sell' | 'buy' | InvoiceType;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  id?: string;
  className?: string;
}

export const ProductSearchSelector: React.FC<ProductSearchSelectorProps> = ({
  products: propsProducts,
  selectedProductId,
  onSelectProduct,
  onClear,
  warehouseId,
  currency = 'AFN',
  priceType = 'sell',
  placeholder = 'جستجو نام، کد یا دسته کالا...',
  disabled = false,
  compact = false,
  required = false,
  autoFocus = false,
  id,
  className = '',
}) => {
  const { products: contextProducts, getProductStock, warehouses } = useAccounting();
  const products = propsProducts && propsProducts.length > 0 ? propsProducts : (contextProducts || []);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; placeAbove: boolean }>({
    top: 0,
    left: 0,
    width: 280,
    placeAbove: false,
  });

  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // Update dropdown coordinates relative to window/viewport
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = 320; // approximate max height of dropdown
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setCoords({
      top: placeAbove ? rect.top : rect.bottom,
      left: rect.left,
      width: Math.max(rect.width, 320),
      placeAbove,
    });
  };

  // Recalculate position when opened or when scrolling/resizing
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Filter products by search term
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) {
      return products;
    }
    const cleanTerm = searchTerm.trim().toLowerCase();
    return products.filter(p => {
      const nameMatch = p.name.toLowerCase().includes(cleanTerm);
      const codeMatch = p.code ? p.code.toLowerCase().includes(cleanTerm) : false;
      const numCodeMatch = p.numericCode ? String(p.numericCode).includes(cleanTerm) : false;
      const categoryMatch = p.category ? p.category.toLowerCase().includes(cleanTerm) : false;
      return nameMatch || codeMatch || numCodeMatch || categoryMatch;
    });
  }, [products, searchTerm]);

  // Reset highlighted index when filter changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  const handleOpenDropdown = () => {
    if (disabled) return;
    updatePosition();
    setIsOpen(true);
    setSearchTerm('');
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 40);
  };

  const handleSelect = (product: Product) => {
    onSelectProduct(product);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    }
    setSearchTerm('');
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleOpenDropdown();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1 < filteredProducts.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : filteredProducts.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts[highlightedIndex]) {
        handleSelect(filteredProducts[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const selectedWarehouse = warehouses?.find(w => w.id === warehouseId);

  return (
    <div className={`relative w-full ${className}`}>
      {/* Trigger Button / Display */}
      <div
        ref={triggerRef}
        id={id}
        tabIndex={disabled ? -1 : 0}
        onClick={handleOpenDropdown}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-1.5 transition select-none cursor-pointer ${
          compact
            ? 'px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs'
            : 'px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold'
        } ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
            : 'hover:border-slate-400'
        } ${disabled ? 'opacity-60 bg-slate-100 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Search className={`shrink-0 text-slate-400 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
          {selectedProduct ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-extrabold text-slate-900 truncate">
                {selectedProduct.name}
              </span>
              {selectedProduct.code && (
                <span className="shrink-0 px-1.5 py-0.2 bg-slate-100 text-slate-600 font-mono text-[10px] rounded border border-slate-200">
                  {selectedProduct.code}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 truncate text-[11px] sm:text-xs">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedProduct && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title="پاک کردن انتخاب کالا"
              className="p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown
            className={`text-slate-400 transition-transform duration-200 ${
              compact ? 'w-3.5 h-3.5' : 'w-4 h-4'
            } ${isOpen ? 'rotate-180 text-emerald-600' : ''}`}
          />
        </div>
      </div>

      {/* Floating Dropdown using React Portal to prevent any table overflow clipping */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: coords.placeAbove ? 'auto' : `${coords.top + 4}px`,
              bottom: coords.placeAbove ? `${window.innerHeight - coords.top + 4}px` : 'auto',
              left: `${Math.max(8, Math.min(coords.left, window.innerWidth - coords.width - 12))}px`,
              width: `${Math.min(coords.width, window.innerWidth - 24)}px`,
              zIndex: 99999,
            }}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[360px]"
            dir="rtl"
          >
            {/* Search Header Input */}
            <div className="p-2.5 border-b border-slate-100 bg-slate-50/90 flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-600 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="تایپ کنید (نام کالا، کد یا دسته بندی)..."
                className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-900 placeholder:text-slate-400 outline-none"
                autoFocus
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Status / Hint Bar */}
            <div className="px-3 py-1.5 bg-slate-100/60 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-bold">
              <span>
                {filteredProducts.length} کالا یافت شد
                {searchTerm && ` برای «${searchTerm}»`}
              </span>
              {selectedWarehouse && (
                <span className="flex items-center gap-1 text-slate-600 truncate max-w-[150px]">
                  <Warehouse className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">{selectedWarehouse.name}</span>
                </span>
              )}
            </div>

            {/* Products List */}
            <div className="overflow-y-auto divide-y divide-slate-100 flex-1 p-1">
              {filteredProducts.length === 0 ? (
                <div className="p-6 text-center space-y-1">
                  <Package className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">کالایی با این مشخصات یافت نشد!</p>
                  <p className="text-[11px] text-slate-400">نام یا کد کالا را دوباره بررسی نمایید.</p>
                </div>
              ) : (
                filteredProducts.map((p, index) => {
                  const isSelected = p.id === selectedProductId;
                  const isHighlighted = index === highlightedIndex;
                  const stock = getProductStock(p.id, warehouseId);
                  const isOutOfStock = stock.tons <= 0 && stock.bags <= 0;
                  const isSellType = priceType === 'sell' || priceType === 'return_sell';
                  const price =
                    isSellType
                      ? currency === 'AFN'
                        ? p.sellPriceAFN || p.priceAFN || 0
                        : p.sellPriceUSD || p.priceUSD || 0
                      : currency === 'AFN'
                      ? p.buyPriceAFN || 0
                      : p.buyPriceUSD || 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelect(p)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      className={`p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-emerald-50 border border-emerald-300'
                          : isHighlighted
                          ? 'bg-slate-100/90'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : isOutOfStock
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          <Package className="w-3.5 h-3.5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-xs text-slate-900 truncate">
                              {p.name}
                            </span>
                            {p.code && (
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-[10px] rounded font-bold border border-slate-200">
                                {p.code}
                              </span>
                            )}
                            {p.category && (
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] rounded font-bold border border-emerald-200">
                                {p.category}
                              </span>
                            )}
                          </div>

                          {/* Secondary info: Stock & Approximate Price */}
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 flex-wrap">
                            <span
                              className={`font-mono font-bold flex items-center gap-0.5 ${
                                isOutOfStock ? 'text-rose-600' : 'text-slate-600'
                              }`}
                            >
                              <Boxes className="w-2.5 h-2.5" />
                              <span>موجودی:</span>
                              <span>
                                {formatNumber(stock.tons)} تن ({formatNumber(stock.bags)} کیسه)
                              </span>
                            </span>

                            {price > 0 && (
                              <span className="text-slate-400 border-r border-slate-200 pr-2">
                                نرخ پایه: {formatNumber(price)} {currency === 'AFN' ? '؋' : '$'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Keyboard Nav Help */}
            <div className="p-2 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-[10px] text-slate-400">
              <span>از کلیدهای ↑ و ↓ برای پیمایش و Enter برای انتخاب استفاده کنید</span>
              <span>Esc: بستن</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
