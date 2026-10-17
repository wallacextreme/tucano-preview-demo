/**
 * Tucano Auto Peças - Shared Product Module
 * Design System: Precision Automotive & Technical Catalog
 * Handles dynamic product counting, quick index, related products, badges, and availability
 */

// ============================================
// PRODUCT COUNTER
// ============================================
class ProductCounter {
    constructor(options = {}) {
        this.selector = options.selector || '.product-card';
        this.counterSelector = options.counterSelector || '#category-counter-text';
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.count());
        } else {
            this.count();
        }
    }

    count() {
        const products = document.querySelectorAll(this.selector);
        const counter = document.querySelector(this.counterSelector);
        
        if (counter && products.length > 0) {
            counter.textContent = `${products.length} produto${products.length !== 1 ? 's' : ''}`;
        }
    }

    // Public method to recount (useful if products are added dynamically)
    recount() {
        this.count();
    }
}

// ============================================
// QUICK PRODUCT INDEX
// ============================================
class QuickProductIndex {
    constructor(options = {}) {
        this.productSelector = options.productSelector || '.product-card';
        this.indexContainerSelector = options.indexContainerSelector || '#quick-product-index';
        this.titleSelector = options.titleSelector || 'h3, h2, [id$="-title"]';
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.build());
        } else {
            this.build();
        }
    }

    build() {
        const container = document.querySelector(this.indexContainerSelector);
        if (!container) return;

        const products = document.querySelectorAll(this.productSelector);
        if (products.length === 0) return;

        const links = Array.from(products).map((product, index) => {
            const titleEl = product.querySelector(this.titleSelector);
            const title = titleEl ? titleEl.textContent.trim() : `Produto ${index + 1}`;
            const id = product.id || `product-${index + 1}`;
            
            // Ensure product has an ID for scrolling
            if (!product.id) {
                product.id = id;
            }

            return `<a href="#${id}" class="px-2.5 py-1 text-xs font-mono font-medium text-slate-700 hover:text-orange-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors whitespace-nowrap shadow-sm">${title}</a>`;
        }).join('');

        container.innerHTML = `
            <div class="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl" role="navigation" aria-label="Índice rápido de produtos">
                ${links}
            </div>
        `;

        // Add smooth scroll behavior
        container.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').slice(1);
                const target = document.getElementById(targetId);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    target.focus({ preventScroll: true });
                }
            });
        });
    }
}

// ============================================
// RELATED PRODUCTS
// ============================================
class RelatedProducts {
    constructor(options = {}) {
        this.containerSelector = options.containerSelector || '#related-products';
        this.currentProductId = options.currentProductId || null;
        this.category = options.category || null;
        this.maxProducts = options.maxProducts || 4;
        this.allProducts = options.allProducts || [];
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.render());
        } else {
            this.render();
        }
    }

    render() {
        const container = document.querySelector(this.containerSelector);
        if (!container) return;

        // Filter products: same category, exclude current
        let related = this.allProducts.filter(p => {
            if (this.currentProductId && p.id === this.currentProductId) return false;
            if (this.category && p.category !== this.category) return false;
            return true;
        });

        // Shuffle and limit
        related = this.shuffle(related).slice(0, this.maxProducts);

        if (related.length === 0) {
            container.style.display = 'none';
            return;
        }

        const html = related.map(product => `
            <article class="product-card group bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-md transition-all duration-200 relative reveal-scale flex flex-col justify-between" data-product-id="${product.id}">
                <div class="relative bg-slate-100/70 aspect-square p-6 flex items-center justify-center overflow-hidden border-b border-slate-200/80">
                    <img src="${product.image}" alt="${product.name}" class="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" loading="lazy" width="300" height="300" decoding="async">
                    ${product.badge ? `<span class="absolute top-3 left-3 ${this.getBadgeClass(product.badge)}">${product.badge}</span>` : ''}
                </div>
                <div class="p-5 flex flex-col flex-grow justify-between gap-3">
                    <div>
                        <span class="inline-block rounded-md px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 mb-2">${product.category || 'Peça Automotiva'}</span>
                        <h3 id="${product.id}-title" class="font-display text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-2">${product.name}</h3>
                        <p class="text-xs text-slate-600 line-clamp-2 mt-1.5">${product.shortDescription}</p>
                    </div>
                    <div class="flex items-center justify-between pt-3 border-t border-slate-200 mt-auto">
                        <span class="font-mono text-lg font-bold text-slate-900">${product.price}</span>
                        <a href="${product.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-sans text-xs font-semibold shadow-sm transition-all duration-150">
                            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            Orçar
                        </a>
                    </div>
                </div>
            </article>
        `).join('');

        container.innerHTML = `
            <section class="py-12 lg:py-16 bg-slate-50 border-t border-slate-200" aria-labelledby="related-title">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <header class="text-center mb-10 reveal slide-up">
                        <span class="inline-block rounded-md px-2.5 py-1 text-xs font-mono uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200 mb-2">Recomendados</span>
                        <h2 id="related-title" class="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Produtos Relacionados</h2>
                        <div class="w-12 h-1 bg-orange-600 rounded-full mx-auto mb-3"></div>
                        <p class="text-slate-600 text-sm max-w-2xl mx-auto">Outros produtos da mesma categoria que podem te interessar</p>
                    </header>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" role="list">
                        ${html}
                    </div>
                </div>
            </section>
        `;

        // Re-initialize reveal animations for new elements
        this.initRevealAnimations();
    }

    getBadgeClass(badge) {
        return ProductBadge.getBadgeClass(badge);
    }

    shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    initRevealAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

        document.querySelectorAll('.reveal-scale:not(.active)').forEach(el => observer.observe(el));
    }
}

// ============================================
// BACK TO TOP BUTTON
// ============================================
class BackToTop {
    constructor(options = {}) {
        this.selector = options.selector || '#back-to-top';
        this.showAfter = options.showAfter || 300;
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.createButton());
        } else {
            this.createButton();
        }
    }

    createButton() {
        // Check if button already exists
        if (document.querySelector(this.selector)) return;

        const button = document.createElement('button');
        button.id = this.selector.replace('#', '');
        button.className = 'fixed bottom-6 right-6 z-40 w-11 h-11 rounded-lg bg-slate-950 hover:bg-orange-600 text-white shadow-md border border-slate-800 transition-all duration-200 opacity-0 invisible transform translate-y-4 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-orange-500';
        button.setAttribute('aria-label', 'Voltar ao topo');
        button.innerHTML = `
            <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
            </svg>
        `;

        document.body.appendChild(button);

        // Show/hide on scroll
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    const scrollY = window.scrollY;
                    if (scrollY > this.showAfter) {
                        button.classList.remove('opacity-0', 'invisible', 'translate-y-4');
                        button.classList.add('opacity-100', 'visible', 'translate-y-0');
                    } else {
                        button.classList.remove('opacity-100', 'visible', 'translate-y-0');
                        button.classList.add('opacity-0', 'invisible', 'translate-y-4');
                    }
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        // Smooth scroll to top
        button.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Keyboard support
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
}

// ============================================
// BREADCRUMB WITH SCHEMA.ORG
// ============================================
class Breadcrumb {
    constructor(options = {}) {
        this.containerSelector = options.containerSelector || '#breadcrumb';
        this.items = options.items || [];
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.render());
        } else {
            this.render();
        }
    }

    render() {
        const container = document.querySelector(this.containerSelector);
        if (!container || this.items.length === 0) return;

        const breadcrumbHtml = this.items.map((item, index) => {
            const isLast = index === this.items.length - 1;
            return `
                <li itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem" class="flex items-center gap-1.5 font-mono text-xs ${isLast ? 'text-slate-900 font-semibold' : 'text-slate-500'}">
                    ${!isLast ? `<a href="${item.url}" itemprop="item" class="hover:text-orange-600 transition-colors"><span itemprop="name">${item.name}</span></a>` : `<span itemprop="name">${item.name}</span>`}
                    <meta itemprop="position" content="${index + 1}">
                    ${!isLast ? '<span class="text-slate-400" aria-hidden="true">/</span>' : ''}
                </li>
            `;
        }).join('');

        container.innerHTML = `
            <nav aria-label="Navegação estrutural" class="py-2.5">
                <ol itemscope itemtype="https://schema.org/BreadcrumbList" class="flex flex-wrap items-center gap-1.5">
                    ${breadcrumbHtml}
                </ol>
            </nav>
        `;
    }
}

// ============================================
// AVAILABILITY MESSAGES
// ============================================
class AvailabilityMessage {
    static getMessage(stock, options = {}) {
        const messages = {
            'in_stock': {
                text: '✓ Pronta entrega em Nova Friburgo',
                class: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                dot: 'bg-emerald-500',
                icon: '✓'
            },
            'low_stock': {
                text: `⚠ Apenas ${options.count || 'poucas'} unidades em estoque`,
                class: 'bg-amber-50 border-amber-200 text-amber-800',
                dot: 'bg-amber-500',
                icon: '⚠'
            },
            'pre_order': {
                text: '📦 Pré-venda - Entrega em ' + (options.days || '15') + ' dias úteis',
                class: 'bg-blue-50 border-blue-200 text-blue-700',
                dot: 'bg-blue-500',
                icon: '📦'
            },
            'out_of_stock': {
                text: '✗ Produto esgotado - Avise-me quando chegar',
                class: 'bg-rose-50 border-rose-200 text-rose-700',
                dot: 'bg-rose-500',
                icon: '✗'
            },
            'on_request': {
                text: '🔍 Sob consulta - Verifique disponibilidade',
                class: 'bg-slate-100 border-slate-300 text-slate-700',
                dot: 'bg-slate-500',
                icon: '🔍'
            }
        };
        return messages[stock] || messages['on_request'];
    }

    static render(stock, options = {}) {
        const msg = this.getMessage(stock, options);
        return `
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-md border ${msg.class} font-mono text-xs font-medium" role="status" aria-live="polite">
                <span class="w-2 h-2 rounded-full ${msg.dot} animate-pulse"></span>
                <span>${msg.text}</span>
            </div>
        `;
    }

    static applyToProductCards() {
        document.querySelectorAll('.product-card[data-availability]').forEach(card => {
            const availability = card.dataset.availability;
            const options = {};
            
            // Parse additional options from data attributes
            if (card.dataset.availabilityCount) {
                options.count = card.dataset.availabilityCount;
            }
            if (card.dataset.availabilityDays) {
                options.days = card.dataset.availabilityDays;
            }
            
            const container = card.querySelector('.availability-message');
            if (availability && !container) {
                // Find a suitable container to insert the availability message
                const priceContainer = card.querySelector('.price-container, [class*="price"], .flex.items-baseline.gap-2, .pt-2.border-t');
                if (priceContainer) {
                    priceContainer.insertAdjacentHTML('afterend', this.render(availability, options));
                }
            }
        });
    }
}

// ============================================
// PRODUCT BADGES
// ============================================
class ProductBadge {
    static getBadgeClass(badge) {
        const base = 'rounded-md px-2 py-0.5 text-[11px] font-mono uppercase tracking-wider border shadow-sm';
        const classes = {
            'Novo': `${base} bg-blue-50 text-blue-700 border-blue-200`,
            'Destaque': `${base} bg-orange-50 text-orange-700 border-orange-200`,
            'Promoção': `${base} bg-emerald-50 text-emerald-700 border-emerald-200`,
            'Mais Vendido': `${base} bg-amber-50 text-amber-800 border-amber-200`,
            'Ecológico': `${base} bg-emerald-50 text-emerald-700 border-emerald-200`,
            'Alta Performance': `${base} bg-rose-50 text-rose-700 border-rose-200`,
            'pH Neutro': `${base} bg-sky-50 text-sky-700 border-sky-200`,
            'Desengraxante': `${base} bg-orange-50 text-orange-700 border-orange-200`,
            'Biodegradável': `${base} bg-green-50 text-green-700 border-green-200`,
            'Multiuso': `${base} bg-purple-50 text-purple-700 border-purple-200`,
            'Rodas & Motores': `${base} bg-slate-100 text-slate-700 border-slate-200`,
            '25% OFF': `${base} bg-emerald-50 text-emerald-700 border-emerald-200`,
            'Profissional': `${base} bg-amber-50 text-amber-800 border-amber-200`,
            'Vidros': `${base} bg-cyan-50 text-cyan-700 border-cyan-200`,
            'Descontaminação': `${base} bg-indigo-50 text-indigo-700 border-indigo-200`,
            'Inspeção': `${base} bg-pink-50 text-pink-700 border-pink-200`,
            'Removedor': `${base} bg-rose-50 text-rose-700 border-rose-200`,
            'Econômico 5L': `${base} bg-teal-50 text-teal-700 border-teal-200`,
            'Premium': `${base} bg-amber-50 text-amber-800 border-amber-200`,
            '4 em 1': `${base} bg-violet-50 text-violet-700 border-violet-200`,
            'Vidros & Espelhos': `${base} bg-sky-50 text-sky-700 border-sky-200`,
            'Até 10 Meses': `${base} bg-amber-50 text-amber-800 border-amber-200`,
            'Bactericida': `${base} bg-rose-50 text-rose-700 border-rose-200`,
            'Couro & Bancos': `${base} bg-orange-50 text-orange-700 border-orange-200`,
            'Touchless': `${base} bg-indigo-50 text-indigo-700 border-indigo-200`,
            'Manutenção': `${base} bg-green-50 text-green-700 border-green-200`,
            '3 em 1 + SiO2': `${base} bg-purple-50 text-purple-700 border-purple-200`,
            'Cera Híbrida Spray': `${base} bg-orange-50 text-orange-700 border-orange-200`,
            'Maquiador Automotivo': `${base} bg-rose-50 text-rose-700 border-rose-200`,
            'Selante Pneus': `${base} bg-slate-100 text-slate-700 border-slate-200`
        };
        return classes[badge] || `${base} bg-slate-100 text-slate-700 border-slate-200`;
    }

    static render(badge) {
        if (!badge) return '';
        return `<span class="absolute top-3 left-3 ${this.getBadgeClass(badge)}">${badge}</span>`;
    }

    static applyToProductCards() {
        document.querySelectorAll('.product-card[data-badge]').forEach(card => {
            const badge = card.dataset.badge;
            const badgeEl = card.querySelector('.product-badge');
            if (badge && !badgeEl) {
                const imageContainer = card.querySelector('.relative.aspect-square, .relative.aspect-video, [class*="aspect-"], .product-image-container');
                if (imageContainer) {
                    imageContainer.insertAdjacentHTML('beforeend', this.render(badge));
                }
            }
        });
    }
}

// ============================================
// REVIEW STARS
// ============================================
class ReviewStars {
    static render(rating, options = {}) {
        const { maxStars = 5, showValue = true, size = 'sm', interactive = false } = options;
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = maxStars - fullStars - (hasHalfStar ? 1 : 0);
        
        const sizeClasses = {
            'sm': 'w-3.5 h-3.5',
            'md': 'w-4 h-4',
            'lg': 'w-5 h-5'
        };
        
        const starSize = sizeClasses[size] || sizeClasses['sm'];
        
        let starsHtml = '';
        
        // Full stars
        for (let i = 0; i < fullStars; i++) {
            starsHtml += `<svg class="${starSize} text-amber-500 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
        }
        
        // Half star
        if (hasHalfStar) {
            starsHtml += `<svg class="${starSize} text-amber-500 fill-current" viewBox="0 0 24 24"><defs><linearGradient id="halfStar" x1="0" y1="0" x2="1" y2="0"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="#cbd5e1"/></linearGradient></defs><path fill="url(#halfStar)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
        }
        
        // Empty stars
        for (let i = 0; i < emptyStars; i++) {
            starsHtml += `<svg class="${starSize} text-slate-300 fill-current" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
        }
        
        const valueHtml = showValue ? `<span class="text-xs font-mono font-semibold text-slate-700 ml-1.5">${rating.toFixed(1)}</span>` : '';
        const interactiveAttr = interactive ? 'role="slider" aria-valuemin="0" aria-valuemax="5" aria-valuenow="' + rating + '" tabindex="0"' : '';
        
        return `<div class="flex items-center gap-0.5 stars" ${interactiveAttr}>${starsHtml}${valueHtml}</div>`;
    }
    
    static applyToProductCards() {
        document.querySelectorAll('.product-card[data-rating]').forEach(card => {
            const rating = parseFloat(card.dataset.rating);
            const starsContainer = card.querySelector('.stars, [class*="star"]');
            if (rating && !isNaN(rating) && starsContainer && !starsContainer.dataset.rendered) {
                starsContainer.innerHTML = this.render(rating, { size: 'sm' });
                starsContainer.dataset.rendered = 'true';
            }
        });
    }
}

// ============================================
// EXPORTS
// ============================================
// Make classes globally available
window.ProductCounter = ProductCounter;
window.QuickProductIndex = QuickProductIndex;
window.RelatedProducts = RelatedProducts;
window.BackToTop = BackToTop;
window.Breadcrumb = Breadcrumb;
window.AvailabilityMessage = AvailabilityMessage;
window.ProductBadge = ProductBadge;
window.ReviewStars = ReviewStars;

// ============================================
// AUTO-INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize ProductBadge for all product cards with data-badge
    ProductBadge.applyToProductCards();
    
    // Initialize ReviewStars for all product cards with data-rating
    ReviewStars.applyToProductCards();
    
    // Initialize AvailabilityMessage for all product cards with data-availability
    AvailabilityMessage.applyToProductCards();
});