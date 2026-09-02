/**
 * Lógica principal del Frontend para A&M Prestige
 */

const app = {
    GAS_URL: "https://script.google.com/macros/s/TU_SCRIPT_ID/execRIPT", 
    WHATSAPP_NUMBER: "584125918677", 

    state: {
        products: [],
        cart: [],
        currentView: 'home',
        categoryFilter: null,
        searchQuery: '',
        currentPage: 1,      // NUEVO: Control de página actual
        itemsPerPage: 12     // NUEVO: Cantidad de productos por página
    },

    init: function() {
        this.loadCart();
        this.bindEvents();
        this.fetchProducts(); 
    },

    bindEvents: function() {
        document.getElementById('mobile-menu-btn').addEventListener('click', () => {
            document.getElementById('nav-links').classList.toggle('active');
        });
    },

    navigate: function(view, category = null) {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.getElementById(`view-${view}`).classList.add('active');
        this.state.currentView = view;
        this.state.currentPage = 1; // Reseteo a página 1 al cambiar de vista

        // Al navegar, limpiamos la búsqueda para que no se arrastre entre vistas sin intención
        if(!this.state.searchQuery || view !== 'catalog') {
            this.state.searchQuery = '';
            const searchInput = document.getElementById('search-input');
            if(searchInput) searchInput.value = '';
        }

        window.scrollTo(0, 0);

        if (view === 'catalog') {
            this.state.categoryFilter = category;
            this.renderCatalog();
            
            let subtitle = 'Explora nuestra colección completa';
            if (this.state.searchQuery) {
                subtitle = `Resultados de búsqueda para: "${this.state.searchQuery}"`;
            } else if (category) {
                subtitle = `Mostrando resultados para: ${category.toUpperCase()}`;
            }
            document.getElementById('catalog-subtitle').innerText = subtitle;
        }

        document.getElementById('nav-links').classList.remove('active');
    },

    // --- NUEVA LÓGICA DE BÚSQUEDA ---
    toggleSearch: function() {
        const input = document.getElementById('search-input');
        input.classList.toggle('active');
        if (input.classList.contains('active')) {
            input.focus();
        }
    },

    handleSearch: function(e) {
        this.state.searchQuery = e.target.value.toLowerCase().trim();
        this.state.currentPage = 1; // Reseteo a página 1 al realizar una nueva búsqueda
        
        // Si el usuario escribe, redirigimos automáticamente a la vista catálogo para ver los resultados
        if (this.state.currentView !== 'catalog') {
            this.navigate('catalog', this.state.categoryFilter);
        } else {
            this.renderCatalog();
            
            // Actualizar subtítulo en vivo
            const subtitle = this.state.searchQuery 
                ? `Resultados de búsqueda para: "${this.state.searchQuery}"` 
                : (this.state.categoryFilter ? `Mostrando resultados para: ${this.state.categoryFilter.toUpperCase()}` : 'Explora nuestra colección completa');
            document.getElementById('catalog-subtitle').innerText = subtitle;
        }
    },

    // --- UTILIDAD PARA FORMATEAR IMÁGENES DE DRIVE ---
    formatImageUrl: function(url) {
        if (!url) return '';
        if (!url.includes('drive.google.com')) return url;
        
        const match = url.match(/[-\w]{25,}/);
        if (match && match[0]) {
            return `https://drive.google.com/uc?export=view&id=${match[0]}`;
        }
        return url;
    },

    // --- CARGA DE DATOS Y MARKUP DE PRECIOS ---
    fetchProducts: async function() {
        try {
            // Hacemos la petición a Google Apps Script
            let res = await fetch(this.GAS_URL + "?action=getProducts");
            let data = await res.json();

            // Mapeamos los datos reales del backend y aplicamos el markup del 50%
            this.state.products = data.map(prod => {
                const basePrice = parseFloat(prod.price || prod.Precio || 0);

                return {
                    id: String(prod.id || prod.ID || ''),
                    name: prod.name || prod.Nombre || '',
                    category: String(prod.category || prod.Categoria || '').toLowerCase(),
                    material: prod.material || prod.Material || '',
                    price: basePrice * 1.5, // Multiplicador de +50%
                    img: this.formatImageUrl(prod.img || prod.Imagen || ''), // Formateo aplicado
                    stock: parseInt(prod.stock || prod.Stock || 0),
                    featured: prod.featured === true || prod.featured === "TRUE" || prod.Destacado === true
                };
            });

            this.renderFeatured();
            if(this.state.currentView === 'catalog') this.renderCatalog();

        } catch (error) {
            console.error("Error al obtener los productos desde la base de datos:", error);
        }
    },

    // --- RENDERIZADO ---
    createProductCard: function(prod) {
        return `
            <div class="product-card">
                ${prod.featured ? '<div class="product-badge">Destacado</div>' : ''}
                <i class="fas fa-heart product-fav"></i>
                <img src="${prod.img}" alt="${prod.name}" class="product-img">
                <div class="product-category">${prod.material}</div>
                <h3 class="product-title">${prod.name}</h3>
                <div class="product-price">$${prod.price.toFixed(2)}</div>
                <button class="add-to-cart-btn" onclick="app.addToCart('${prod.id}')">Agregar al Carrito</button>
            </div>
        `;
    },

    renderFeatured: function() {
        const container = document.getElementById('featured-products');
        const featured = this.state.products.filter(p => p.featured).slice(0, 4);
        container.innerHTML = featured.map(p => this.createProductCard(p)).join('');
    },

    renderCatalog: function() {
        const container = document.getElementById('catalog-products');
        let filtered = this.state.products;
        
        // 1. Aplicar filtro de búsqueda
        if (this.state.searchQuery) {
            filtered = filtered.filter(p => {
                const searchLower = this.state.searchQuery;
                const nameMatch = p.name.toLowerCase().includes(searchLower);
                const idMatch = p.id.toLowerCase() === searchLower;
                return nameMatch || idMatch;
            });
        } 
        // 2. Aplicar filtro por categoría
        else if (this.state.categoryFilter) {
            if(['plata', 'acero', 'goldfield', 'yess'].includes(this.state.categoryFilter)) {
                filtered = filtered.filter(p => p.category === this.state.categoryFilter);
            } else if (this.state.categoryFilter === 'relojeria') {
                filtered = filtered.filter(p => p.category === 'yess');
            } else if (this.state.categoryFilter === 'joyeria') {
                filtered = filtered.filter(p => ['plata', 'acero', 'goldfield'].includes(p.category));
            }
        }
        
        if(filtered.length === 0) {
            container.innerHTML = `<p style="grid-column: 1/-1; text-align:center;">No se encontraron productos.</p>`;
            document.getElementById('pagination-container').innerHTML = '';
            return;
        }

        // --- LÓGICA DE PAGINACIÓN ---
        const totalPages = Math.ceil(filtered.length / this.state.itemsPerPage);
        
        if (this.state.currentPage > totalPages) {
            this.state.currentPage = 1;
        }

        const startIndex = (this.state.currentPage - 1) * this.state.itemsPerPage;
        const paginatedItems = filtered.slice(startIndex, startIndex + this.state.itemsPerPage);

        container.innerHTML = paginatedItems.map(p => this.createProductCard(p)).join('');
        this.renderPagination(totalPages);
    },

    renderPagination: function(totalPages) {
        const container = document.getElementById('pagination-container');
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        const current = this.state.currentPage;
        const maxVisible = 5; 

        // Botón Anterior
        html += `<button class="btn btn-outline page-btn ${current === 1 ? 'disabled' : ''}" onclick="if(${current} > 1) app.goToPage(${current - 1})">&laquo;</button>`;

        let startPage = Math.max(1, current - 2);
        let endPage = Math.min(totalPages, current + 2);

        if (current <= 3) endPage = Math.min(totalPages, maxVisible);
        if (current >= totalPages - 2) startPage = Math.max(1, totalPages - maxVisible + 1);

        if (startPage > 1) {
            html += `<button class="btn btn-outline page-btn" onclick="app.goToPage(1)">1</button>`;
            if (startPage > 2) html += `<span class="page-dots">...</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === current ? 'btn-accent' : 'btn-outline';
            html += `<button class="btn ${activeClass} page-btn" onclick="app.goToPage(${i})">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span class="page-dots">...</span>`;
            html += `<button class="btn btn-outline page-btn" onclick="app.goToPage(${totalPages})">${totalPages}</button>`;
        }

        // Botón Siguiente
        html += `<button class="btn btn-outline page-btn ${current === totalPages ? 'disabled' : ''}" onclick="if(${current} < ${totalPages}) app.goToPage(${current + 1})">&raquo;</button>`;

        container.innerHTML = html;
    },

    goToPage: function(page) {
        this.state.currentPage = page;
        this.renderCatalog();
        window.scrollTo({ top: document.getElementById('view-catalog').offsetTop - 80, behavior: 'smooth' });
    },

    // --- CARRITO ---
    loadCart: function() {
        const stored = localStorage.getItem('amprestige_cart');
        if (stored) this.state.cart = JSON.parse(stored);
        this.updateCartUI();
    },

    saveCart: function() {
        localStorage.setItem('amprestige_cart', JSON.stringify(this.state.cart));
        this.updateCartUI();
    },

    addToCart: function(id) {
        const prod = this.state.products.find(p => p.id === id);
        if (!prod) return;

        const existing = this.state.cart.find(item => item.id === id);
        if (existing) {
            existing.qty++;
        } else {
            this.state.cart.push({ ...prod, qty: 1 });
        }
        this.saveCart();
        this.showToast();
    },

    updateQty: function(id, delta) {
        const item = this.state.cart.find(i => i.id === id);
        if(!item) return;
        
        item.qty += delta;
        if(item.qty <= 0) {
            this.state.cart = this.state.cart.filter(i => i.id !== id);
        }
        this.saveCart();
    },

    toggleCart: function() {
        document.getElementById('cart-sidebar').classList.toggle('open');
        document.getElementById('cart-overlay').classList.toggle('active');
    },

    updateCartUI: function() {
        const count = this.state.cart.reduce((sum, item) => sum + item.qty, 0);
        document.getElementById('cart-count').innerText = count;

        const container = document.getElementById('cart-items-container');
        if (this.state.cart.length === 0) {
            container.innerHTML = '<p style="text-align:center; margin-top:20px; color:#888;">Tu carrito está vacío</p>';
            document.getElementById('cart-total-price').innerText = '$0.00';
            return;
        }

        let total = 0;
        container.innerHTML = this.state.cart.map(item => {
            total += item.price * item.qty;
            return `
                <div class="cart-item">
                    <img src="${item.img}" alt="${item.name}">
                    <div class="cart-item-details">
                        <div class="cart-item-title">${item.name}</div>
                        <div class="cart-item-price">$${item.price.toFixed(2)}</div>
                        <div class="qty-controls">
                            <button class="qty-btn" onclick="app.updateQty('${item.id}', -1)">-</button>
                            <span>${item.qty}</span>
                            <button class="qty-btn" onclick="app.updateQty('${item.id}', 1)">+</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('cart-total-price').innerText = `$${total.toFixed(2)}`;
    },

    showToast: function() {
        const toast = document.getElementById('toast');
        toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', 2000);
    },

    // --- CHECKOUT ---
    goToCheckout: function() {
        if(this.state.cart.length === 0) {
            alert('Tu carrito está vacío');
            return;
        }
        this.toggleCart();
        this.navigate('checkout');
    },

    processCheckout: function(e) {
        e.preventDefault();
        
        const name = document.getElementById('chk-name').value;
        const phone = document.getElementById('chk-phone').value;
        const city = document.getElementById('chk-city').value;
        const address = document.getElementById('chk-address').value;
        const payment = document.getElementById('chk-payment').value;
        const notes = document.getElementById('chk-notes').value;

        let total = 0;
        let orderText = `*NUEVO PEDIDO - A&M PRESTIGE*%0A%0A`;
        orderText += `*Cliente:* ${name}%0A`;
        orderText += `*Ciudad:* ${city}%0A`;
        orderText += `*Dirección:* ${address}%0A`;
        orderText += `*Pago:* ${payment}%0A`;
        if(notes) orderText += `*Notas:* ${notes}%0A`;
        orderText += `%0A*DETALLE:*%0A`;

        this.state.cart.forEach(item => {
            let sub = item.price * item.qty;
            total += sub;
            orderText += `- ${item.qty}x ${item.name} ($${item.price}) = $${sub.toFixed(2)}%0A`;
        });

        orderText += `%0A*TOTAL: $${total.toFixed(2)}*`;

        const waURL = `https://wa.me/${this.WHATSAPP_NUMBER}?text=${orderText}`;
        window.open(waURL, '_blank');
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
