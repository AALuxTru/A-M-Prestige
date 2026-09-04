/**
 * Lógica principal del Frontend para A&M Prestige
 */

const app = {
    GAS_URL: "https://script.google.com/macros/s/AKfycbzEOc60qnM5ehbXsQb1UfCmQj_irzNiHF4I-gr7vDYwo5QwHpGQj7bHzNmk5o0mTJrW/exec", 
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

    // --- UTILIDAD PARA FORMATEAR IMÁGENES DE DRIVE ---
    formatImageUrl: function(url) {
        if (!url) return 'assets/placeholder.png'; // Te sugiero tener una imagen por defecto
        
        // IMPORTANTE: Limpiar comillas y espacios para que el Base64 no rompa el atributo src del HTML
        let cleanUrl = String(url).replace(/"/g, '%22').trim();

        if (!cleanUrl.includes('drive.google.com')) return cleanUrl;
        
        // Extrae el ID de la imagen de Google Drive (por si aún quedan URLs antiguas)
        const match = cleanUrl.match(/[-\w]{25,}/);
        if (match && match[0]) {
            return `https://drive.google.com/thumbnail?id=${match[0]}&sz=w800`;
        }
        return cleanUrl;
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

    // --- CARGA DE DATOS ---
    fetchProducts: async function() {
        try {
            // CORREGIDO: Igualado al método de Brilho para evitar conflictos con Apps Script
            const cacheBuster = '?t=' + new Date().getTime();
            let res = await fetch(this.GAS_URL + cacheBuster, { cache: "no-store" });
            let data = await res.json();

            this.state.products = data.map(prod => {
    // Saneamiento de precio heredado de la lógica robusta
    const rawPrice = String(prod.price || prod.Precio || 0);
    const basePrice = parseFloat(rawPrice.replace(/[$\s]/g, '').replace(',', '.')) || 0;

    return {
        id: String(prod.id || prod.ID || ''),
        name: prod.name || prod.Nombre || '',
        ref: prod.ref || prod.Ref || '', // ¡Se añade la extracción del código!
        category: String(prod.cat || prod.category || prod.Categoria || '').toLowerCase().trim(), // Se añade .trim()
        material: prod.material || prod.Material || '',
        price: basePrice,
        img: this.formatImageUrl(prod.img || prod.Imagen || ''),
        stock: parseInt(prod.stock || prod.Stock || 0) || 0,
        featured: prod.isNew === true || String(prod.isNew).toLowerCase() === 'true' || prod.isNew === 1 || prod.featured === true || prod.Destacado === true
    };
});

            this.renderFeatured();
            if(this.state.currentView === 'catalog') this.renderCatalog();

        } catch (error) {
            console.error("Error al obtener los productos desde la base de datos:", error);
        }
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
        const refMatch = p.ref.toLowerCase().includes(searchLower); // Búsqueda por código de referencia
        return nameMatch || refMatch;
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

    // --- RENDERIZADO DE TARJETAS ---
    createProductCard: function(p) {
    const isOutOfStock = p.stock === 0;
    const btnStyle = isOutOfStock ? 'opacity: 0.5; cursor: not-allowed;' : '';
    const btnText = isOutOfStock ? 'Agotado' : 'Añadir al Carrito';
    const badge = p.featured ? `<span style="position:absolute; top:10px; right:10px; background:var(--accent-color, #d4af37); color:#fff; padding:2px 8px; border-radius:12px; font-size:0.8rem;">Destacado</span>` : '';

    // Escapar comillas para evitar que rompan el HTML
    const safeName = String(p.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

    return `
    <div class="product-card" style="position:relative;">
        ${badge}
        <img src="${p.img}" alt="${safeName}" style="${isOutOfStock ? 'opacity:0.5;' : ''}" onerror="this.src='assets/placeholder.png'">
        <div class="product-info">
            <span style="font-size: 0.8rem; color: #888; text-transform: uppercase;">${p.category}</span>
            <h3 class="product-title" style="margin: 5px 0;">${p.name}</h3>
            <p style="font-size: 0.85rem; color: #666; margin-bottom: 5px;">Ref: ${p.ref || 'N/A'}</p>
            <div class="product-price" style="font-weight: bold; margin-bottom: 10px;">$${p.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            <button class="btn btn-primary" style="width:100%; ${btnStyle}" 
                    onclick="app.addToCart('${p.id}')" ${isOutOfStock ? 'disabled' : ''}>
                ${btnText}
            </button>
        </div>
    </div>
    `;
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
