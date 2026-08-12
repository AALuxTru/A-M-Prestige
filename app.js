/**
 * Lógica principal del Frontend para A&M Prestige
 * Compatible con Google Apps Script y Paginación Dinámica.
 */

const app = {
    // URL de Google Apps Script
    GAS_URL: "https://script.google.com/macros/s/AKfycbzEOc60qnM5ehbXsQb1UfCmQj_irzNiHF4I-gr7vDYwo5QwHpGQj7bHzNmk5o0mTJrW/exec", 

    state: {
        products: [], // Estado inicia completamente vacío sin mock data
        cart: [],
        currentView: 'home',
        categoryFilter: null,
        // Paginación
        currentPage: 1,
        itemsPerPage: 32
    },

    init: function() {
        this.loadCart();
        this.bindEvents();
        this.fetchProducts();
    },

    bindEvents: function() {
        const menuBtn = document.getElementById('mobile-menu-btn');
        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                document.getElementById('nav-links').classList.toggle('active');
            });
        }
    },

    // --- NAVEGACIÓN SPA ---
    navigate: function(view, category = null) {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        const targetView = document.getElementById(`view-${view}`);
        if (targetView) targetView.classList.add('active');
        
        this.state.currentView = view;
        window.scrollTo(0, 0);

        if (view === 'catalog') {
            this.state.categoryFilter = category;
            this.state.currentPage = 1; // Reiniciar página al cambiar de vista o categoría
            this.renderCatalog();
            
            const subtitle = category 
                ? `Mostrando resultados para: ${category.toUpperCase()}` 
                : 'Explora nuestra colección completa';
            const subElem = document.getElementById('catalog-subtitle');
            if (subElem) subElem.innerText = subtitle;
        }

        const navLinks = document.getElementById('nav-links');
        if (navLinks) navLinks.classList.remove('active');
    },

    // --- CARGA DE DATOS (Manejo de Estado de Carga y Seguridad) ---
    fetchProducts: async function() {
        const catalogContainer = document.getElementById('catalog-products');
        
        // Inyección del estado de carga previo al fetch
        if (catalogContainer) {
            catalogContainer.innerHTML = `<p style="text-align: center; grid-column: 1/-1;">Cargando catálogo de productos...</p>`;
        }

        try {
            const response = await fetch(this.GAS_URL);
            if (!response.ok) {
                throw new Error('Error al conectar con la base de datos');
            }
            
            const data = await response.json();
            this.state.products = Array.isArray(data) ? data : (data.products || []);
            
            this.renderFeatured();
            if (this.state.currentView === 'catalog') {
                this.renderCatalog();
            }
        } catch (error) {
            console.error("Error obteniendo los productos:", error);
            alert("Ocurrió un error al intentar conectar con la base de datos.");
            if (catalogContainer) {
                catalogContainer.innerHTML = `<p style="text-align: center; grid-column: 1/-1;">No se pudieron cargar los productos.</p>`;
            }
        }
    },

    // --- CAMBIO DE PÁGINA ---
    changePage: function(pageNumber) {
        this.state.currentPage = pageNumber;
        
        const catalogContainer = document.getElementById('catalog-products');
        if (catalogContainer) {
            catalogContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        this.renderCatalog();
    },

    // --- RENDERIZADO ---
    createProductCard: function(prod) {
        const priceNum = typeof prod.price === 'number' ? prod.price : parseFloat(prod.price || prod.precio || 0);
        const priceFormatted = isNaN(priceNum) ? '0.00' : priceNum.toFixed(2);
        const imgSrc = prod.img || prod.imagen || 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=400&q=80';
        const prodName = prod.name || prod.nombre || 'Producto';
        const prodMat = prod.material || prod.categoria || prod.category || '';
        const isFeatured = prod.featured || prod.destacado || false;

        return `
            <div class="product-card">
                ${isFeatured ? '<div class="product-badge">Destacado</div>' : ''}
                <i class="fas fa-heart product-fav"></i>
                <img src="${imgSrc}" alt="${prodName}" class="product-img">
                <div class="product-category">${prodMat}</div>
                <h3 class="product-title">${prodName}</h3>
                <div class="product-price">$${priceFormatted}</div>
                <button class="add-to-cart-btn" onclick="app.addToCart('${prod.id}')">Agregar al Carrito</button>
            </div>
        `;
    },

    renderFeatured: function() {
        const container = document.getElementById('featured-products');
        if (!container) return;

        const featured = this.state.products.filter(p => p.featured || p.destacado);
        const itemsToRender = featured.length > 0 ? featured.slice(0, 4) : this.state.products.slice(0, 4);
        container.innerHTML = itemsToRender.map(p => this.createProductCard(p)).join('');
    },

    // MÉTODO REEMPLAZADO CON LA LÓGICA DE FILTRADO CORRECTA
    renderCatalog: function() {
        const container = document.getElementById('catalog-products');
        if (!container) return;

        let filtered = this.state.products;
        
        if (this.state.categoryFilter) {
            const filterValue = this.state.categoryFilter.toUpperCase().trim();
            
            filtered = filtered.filter(p => {
                // Agregamos p.dept y p.cat por si tus columnas en Sheets se llaman así
                const rawCategory = p.category || p.categoria || p.Categoria || p.material || p.dept || p.cat || '';
                const productCategory = String(rawCategory).toUpperCase().trim();
                
                if (filterValue === 'JOYERIA') {
                    return productCategory === 'ACERO' || productCategory === 'GOLDFIELD' || productCategory === 'PLATA';
                }
                
                // CORRECCIÓN: Mapeo de las subclases de la vista home a la categoría principal de la base de datos
                if (filterValue === 'YESS' || filterValue === 'TEMPUS' || filterValue === 'RELOJERIA') {
                    return productCategory.includes('RELOJERIA');
                }
                
                // Búsqueda para PLATA, ACERO, GOLDFIELD y cualquier otra categoría directa
                return productCategory.includes(filterValue);
            });
        }
        
        if (filtered.length === 0) {
            container.innerHTML = `<p style="grid-column: 1/-1; text-align:center;">No se encontraron productos en esta categoría.</p>`;
            this.renderPagination(0);
            return;
        }

        const startIndex = (this.state.currentPage - 1) * this.state.itemsPerPage;
        const endIndex = startIndex + this.state.itemsPerPage;
        const paginatedProducts = filtered.slice(startIndex, endIndex);

        container.innerHTML = paginatedProducts.map(p => this.createProductCard(p)).join('');

        this.renderPagination(filtered.length);
    },

    renderPagination: function(totalFilteredItems) {
        const paginationContainer = document.getElementById('pagination-controls');
        if (!paginationContainer) return;
        
        paginationContainer.innerHTML = '';
        
        const totalPages = Math.ceil(totalFilteredItems / this.state.itemsPerPage);

        if (totalPages <= 1) return;

        // Botón "Anterior"
        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Anterior';
        prevBtn.className = 'btn btn-outline';
        prevBtn.disabled = this.state.currentPage === 1;
        if (this.state.currentPage === 1) prevBtn.style.opacity = '0.5';
        
        prevBtn.addEventListener('click', () => {
            if (this.state.currentPage > 1) this.changePage(this.state.currentPage - 1);
        });
        paginationContainer.appendChild(prevBtn);

        // Botones de Páginas Numéricas
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.className = this.state.currentPage === i ? 'btn btn-primary' : 'btn btn-outline';
            
            pageBtn.addEventListener('click', () => this.changePage(i));
            paginationContainer.appendChild(pageBtn);
        }

        // Botón "Siguiente"
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Siguiente';
        nextBtn.className = 'btn btn-outline';
        nextBtn.disabled = this.state.currentPage === totalPages;
        if (this.state.currentPage === totalPages) nextBtn.style.opacity = '0.5';
        
        nextBtn.addEventListener('click', () => {
            if (this.state.currentPage < totalPages) this.changePage(this.state.currentPage + 1);
        });
        paginationContainer.appendChild(nextBtn);
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
        const prod = this.state.products.find(p => String(p.id) === String(id));
        if (!prod) return;

        const existing = this.state.cart.find(item => String(item.id) === String(id));
        if (existing) {
            existing.qty++;
        } else {
            const priceNum = typeof prod.price === 'number' ? prod.price : parseFloat(prod.price || prod.precio || 0);
            const imgSrc = prod.img || prod.imagen || 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=400&q=80';
            const prodName = prod.name || prod.nombre || 'Producto';
            
            this.state.cart.push({ ...prod, id: prod.id, name: prodName, price: priceNum, img: imgSrc, qty: 1 });
        }
        this.saveCart();
        this.showToast();
    },

    updateQty: function(id, delta) {
        const item = this.state.cart.find(i => String(i.id) === String(id));
        if (!item) return;
        
        item.qty += delta;
        if (item.qty <= 0) {
            this.state.cart = this.state.cart.filter(i => String(i.id) !== String(id));
        }
        this.saveCart();
    },

    toggleCart: function() {
        document.getElementById('cart-sidebar').classList.toggle('open');
        document.getElementById('cart-overlay').classList.toggle('active');
    },

    updateCartUI: function() {
        const count = this.state.cart.reduce((sum, item) => sum + item.qty, 0);
        const countElem = document.getElementById('cart-count');
        if (countElem) countElem.innerText = count;

        const container = document.getElementById('cart-items-container');
        if (!container) return;

        if (this.state.cart.length === 0) {
            container.innerHTML = '<p style="text-align:center; margin-top:20px; color:#888;">Tu carrito está vacío</p>';
            document.getElementById('cart-total-price').innerText = '$0.00';
            return;
        }

        let total = 0;
        container.innerHTML = this.state.cart.map(item => {
            let sub = item.price * item.qty;
            total += sub;
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
        if (toast) {
            toast.style.display = 'block';
            setTimeout(() => toast.style.display = 'none', 2000);
        }
    },

    // --- CHECKOUT (MIGRADO A PETICIÓN POST) ---
    goToCheckout: function() {
        if (this.state.cart.length === 0) {
            alert('Tu carrito está vacío');
            return;
        }
        this.toggleCart();
        this.navigate('checkout');
    },

    processCheckout: async function(e) {
        e.preventDefault();

        if (this.state.cart.length === 0) {
            alert('Tu carrito está vacío');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn ? submitBtn.innerHTML : '';

        // Deshabilitar botón durante el procesamiento
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerText = 'Procesando pedido...';
        }

        const payload = {
            customer: {
                name: document.getElementById('chk-name').value,
                phone: document.getElementById('chk-phone').value,
                city: document.getElementById('chk-city').value,
                payment: document.getElementById('chk-payment').value,
                address: document.getElementById('chk-address').value,
                notes: document.getElementById('chk-notes').value
            },
            cart: this.state.cart,
            total: this.state.cart.reduce((sum, item) => sum + (item.price * item.qty), 0)
        };

        try {
            // CORRECCIÓN: Se agrega mode: 'no-cors' para las peticiones a Google Apps Script
            await fetch(this.GAS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(payload)
            });

            // CORRECCIÓN: Eliminada la validación !response.ok ya que 'no-cors' siempre devuelve status 0.
            // Si llega hasta aquí sin lanzar excepción de red, asumimos éxito.

            // Limpiar carrito y persistir estado
            this.state.cart = [];
            this.saveCart();

            alert('¡Tu pedido ha sido procesado exitosamente!');
            e.target.reset();
            this.navigate('home');

        } catch (error) {
            console.error("Error al procesar el checkout:", error);
            alert('Ocurrió un error al procesar tu pedido. Por favor, verifica tu conexión e intenta nuevamente.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
