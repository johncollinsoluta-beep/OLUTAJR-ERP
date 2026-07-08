
// ==================== DATA STORE ====================
let DB = {
    products: [],
    customers: [],
    sales: [],
    expenses: [],
    stockHistory: [],
    activityLog: [],
    settings: { name:'', phone:'', email:'', pin:'', address:'', currency:'KES', timezone:'Africa/Nairobi', taxRate:16, taxName:'VAT', receiptMsg:'Thank you for your purchase!' },
    users: [],
    nextUserId: 1,
    nextProductId: 1,
    nextCustId: 1,
    nextSaleId: 1,
    nextExpId: 1
};

let currentUser = null;
const ALL_MODULES = [
    {key:'dashboard',label:'Dashboard'},
    {key:'pos',label:'POS'},
    {key:'sales',label:'Sales'},
    {key:'customers',label:'Customers'},
    {key:'products',label:'Products'},
    {key:'stock',label:'Stock'},
    {key:'finance',label:'Finance'},
    {key:'reporting',label:'Reporting'},
    {key:'expenses',label:'Expenses'},
    {key:'users',label:'User Management'},
    {key:'settings',label:'Settings'}
];
const ROLE_MODULE_ACCESS = {
    'Super Admin': ALL_MODULES.map(m=>m.key),
    'Admin': ALL_MODULES.map(m=>m.key),
    'Manager': ['dashboard','pos','sales','customers','products','stock','finance','reporting','expenses'],
    'Cashier': ['dashboard','pos','sales','customers'],
    'Viewer': ['dashboard','reporting','sales']
};
function getDefaultPermissions(role) { return ROLE_MODULE_ACCESS[role] ? [...ROLE_MODULE_ACCESS[role]] : [...ROLE_MODULE_ACCESS['Viewer']]; }
function hasAccess(page) { return currentUser ? (currentUser.permissions||[]).includes(page) : false; }
function renderSidebarNav() {
    document.querySelectorAll('.nav-item').forEach(item=>{
        const page = item.dataset.page;
        if(!page) { item.style.display='flex'; return; }
        item.style.display = hasAccess(page) ? 'flex' : 'none';
    });
}
function updateSidebarUser() {
    const avatar = document.querySelector('.sidebar-user .avatar');
    const info = document.querySelector('.sidebar-user .u-info span');
    const sub = document.querySelector('.sidebar-user .u-info small');
    if(currentUser) {
        avatar.textContent = (currentUser.firstName.charAt(0) || '') + (currentUser.lastName.charAt(0) || '');
        info.innerHTML = `${currentUser.firstName} ${currentUser.lastName}${currentUser.role==='Super Admin'?` <span class="super-badge">SUPER</span>`:''}`;
        sub.textContent = `${currentUser.role}`;
    }
}
function applyRolePreset(role) {
    const defaultPerms = getDefaultPermissions(role);
    document.querySelectorAll('.permission-checkbox input[type="checkbox"]').forEach(cb=>{
        cb.checked = defaultPerms.includes(cb.value);
    });
}
function populateUserPermissionGrid() {
    const container = document.getElementById('userPermissionGrid');
    if(!container) return;
    container.innerHTML = ALL_MODULES.map(m=>`<label class="permission-checkbox"><input type="checkbox" value="${m.key}"> ${m.label}</label>`).join('');
}

// Load from localStorage
function loadDB() {
    const saved = localStorage.getItem('olutajr_erp_db');
    if (saved) { try { DB = JSON.parse(saved); } catch(e) {} }
    DB.users = DB.users || [];
    DB.nextUserId = DB.nextUserId || (DB.users.reduce((max,u)=>Math.max(max,u.id||0),0) + 1);
    DB.users.forEach(u=>{
        if(!u.permissions || !Array.isArray(u.permissions)) u.permissions = getDefaultPermissions(u.role || 'Viewer');
        if(!u.password) u.password = 'admin';
    });

    // Always ensure admin user exists
    let adminUser = DB.users.find(u => u.email && u.email.toLowerCase() === 'admin@olutajr.com');
    if (!adminUser) {
        adminUser = {
            id: DB.nextUserId++,
            firstName: 'Super',
            lastName: 'Admin',
            email: 'admin@olutajr.com',
            password: 'admin',
            role: 'Super Admin',
            permissions: getDefaultPermissions('Super Admin'),
            status: 'Active',
            joined: new Date().toISOString().split('T')[0]
        };
        DB.users.push(adminUser);
    } else {
        // Fix any inactive or missing password
        if (!adminUser.status || adminUser.status !== 'Active') adminUser.status = 'Active';
        if (!adminUser.password) adminUser.password = 'admin';
        adminUser.permissions = getDefaultPermissions('Super Admin');
    }

    // Demo Users - Create if they don't exist
    const demoUsers = [
        { email: 'admin@demo.com', password: 'demo123', firstName: 'Demo', lastName: 'Admin', role: 'Admin' },
        { email: 'manager@demo.com', password: 'manager123', firstName: 'Jane', lastName: 'Manager', role: 'Manager' },
        { email: 'cashier@demo.com', password: 'cashier123', firstName: 'John', lastName: 'Cashier', role: 'Cashier' },
        { email: 'viewer@demo.com', password: 'viewer123', firstName: 'View', lastName: 'Only', role: 'Viewer' }
    ];

    demoUsers.forEach(demoUser => {
        let existingUser = DB.users.find(u => u.email && u.email.toLowerCase() === demoUser.email.toLowerCase());
        if (!existingUser) {
            DB.users.push({
                id: DB.nextUserId++,
                firstName: demoUser.firstName,
                lastName: demoUser.lastName,
                email: demoUser.email,
                password: demoUser.password,
                role: demoUser.role,
                permissions: getDefaultPermissions(demoUser.role),
                status: 'Active',
                joined: new Date().toISOString().split('T')[0]
            });
        }
    });

    saveDB();
}
function saveDB() { localStorage.setItem('olutajr_erp_db', JSON.stringify(DB)); }

// ==================== STATE ====================
let cart = [];
let currentPosCat = 'all';
let selectedPM = 'Cash';
let revenueChartInst = null;
let categoryChartInst = null;
let reportRevChartInst = null;
let reportPayChartInst = null;
let reportsInitDone = false;

// ==================== HELPERS ====================
function fmt(n) { return (DB.settings.currency||'KES') + ' ' + Number(n||0).toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:0}); }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
function fmtTime(d) { return new Date(d).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); }
function genSKU() { return 'SKU-' + String(DB.nextProductId).padStart(4,'0'); }
function genInvoice() { return 'INV-' + String(DB.nextSaleId).padStart(4,'0'); }

function showToast(msg, type='info') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    const icons = {success:'check-circle',danger:'exclamation-circle',warning:'exclamation-triangle',info:'info-circle'};
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fas fa-${icons[type]||'info-circle'}"></i>${msg}`;
    c.appendChild(t);
    setTimeout(()=>t.remove(),3000);
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
document.querySelectorAll('.modal-overlay').forEach(o=>{o.addEventListener('click',function(e){if(e.target===this)this.classList.remove('active');});});

function logActivity(text, icon='info-circle', color='var(--info)') {
    DB.activityLog.unshift({ text, icon, color, time: new Date().toISOString() });
    if (DB.activityLog.length > 50) DB.activityLog.pop();
    saveDB();
}

// ==================== LOGIN ====================
function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const user = DB.users.find(u => u.email.toLowerCase() === email && u.password === password);

    btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px;"></i>Signing in...';
    btn.disabled = true;

    setTimeout(()=>{
        if (!user || user.status !== 'Active') {
            btn.innerHTML='<i class="fas fa-sign-in-alt" style="margin-right:6px;"></i>Sign In';
            btn.disabled=false;
            showToast('Invalid email or password','danger');
            return;
        }

        currentUser = user;
        document.getElementById('loginPage').style.display='none';
        document.getElementById('appLayout').classList.add('active');
        renderSidebarNav();
        updateSidebarUser();
        initApp();
        btn.innerHTML='<i class="fas fa-sign-in-alt" style="margin-right:6px;"></i>Sign In';
        btn.disabled=false;
        showToast(`Welcome back, ${user.firstName}!`,'success');
    },1000);
    return false;
}

function handleLogout() {
    document.getElementById('appLayout').classList.remove('active');
    document.getElementById('loginPage').style.display='flex';
    showToast('Logged out successfully','info');
}

// ==================== NAVIGATION ====================
function switchPage(page) {
    if(!hasAccess(page)) {
        showToast('Access denied','danger');
        return;
    }
    document.querySelectorAll('.page-section').forEach(s=>s.classList.remove('active'));
    document.getElementById('page-'+page).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
    if(navEl) navEl.classList.add('active');
    const titles = {dashboard:'Dashboard',pos:'Point of Sale',sales:'Sales History',customers:'Customers',products:'Products',stock:'Stock Management',finance:'Finance',reporting:'Reporting',expenses:'Expenses',users:'User Management',settings:'Settings'};
    document.getElementById('pageTitle').textContent = titles[page]||page;
    document.getElementById('breadcrumbCurrent').textContent = titles[page]||page;
    document.getElementById('sidebar').classList.remove('open');
    if(page==='dashboard') renderDashboard();
    if(page==='pos') renderPOS();
    if(page==='sales') renderSalesPage();
    if(page==='customers') renderCustomerPage();
    if(page==='products') renderProductPage();
    if(page==='stock') renderStockPage();
    if(page==='finance') renderFinancePage();
    if(page==='reporting') renderReportingPage();
    if(page==='expenses') renderExpensePage();
    if(page==='users') renderUserPage();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ==================== INIT APP ====================
function initApp() {
    loadDB();
    populateCatSuggestions();
    populateUserPermissionGrid();
    renderDashboard();
    renderPOS();
}

// ==================== DASHBOARD ====================
function renderDashboard() {
    const totalRev = DB.sales.reduce((s,x)=>s+x.total,0);
    const totalSales = DB.sales.length;
    const totalProducts = DB.products.length;
    const totalStock = DB.products.reduce((s,x)=>s+x.stock,0);
    const totalCustomers = DB.customers.length;
    const lowStock = DB.products.filter(p=>p.stock>0&&p.stock<=p.minStock).length;
    const outStock = DB.products.filter(p=>p.stock===0).length;

    document.getElementById('dashStats').innerHTML = `
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(14,116,144,0.1);color:var(--primary)"><i class="fas fa-dollar-sign"></i></div></div><div class="sc-value">${fmt(totalRev)}</div><div class="sc-label">Total Revenue</div></div>
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(5,150,105,0.1);color:var(--success)"><i class="fas fa-shopping-cart"></i></div></div><div class="sc-value">${totalSales}</div><div class="sc-label">Total Sales</div></div>
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(217,119,6,0.1);color:var(--warning)"><i class="fas fa-boxes-stacked"></i></div></div><div class="sc-value">${totalStock}</div><div class="sc-label">Units in Stock</div></div>
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(8,145,178,0.1);color:var(--info)"><i class="fas fa-users"></i></div></div><div class="sc-value">${totalCustomers}</div><div class="sc-label">Customers</div></div>
    `;

    // Recent Sales
    const rs = document.getElementById('dashRecentSales');
    if(DB.sales.length===0) {
        rs.innerHTML='<div class="empty-state" style="padding:30px;"><i class="fas fa-receipt" style="font-size:36px;"></i><h4>No sales yet</h4><p>Start selling from the POS</p><button class="btn btn-primary btn-sm" onclick="switchPage(\'pos\')"><i class="fas fa-cash-register"></i>Go to POS</button></div>';
    } else {
        let html = '<table class="data-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead><tbody>';
        DB.sales.slice(0,5).forEach(s=>{
            const sc = s.status==='Paid'?'badge-success':s.status==='Pending'?'badge-warning':'badge-danger';
            html+=`<tr><td style="font-family:'JetBrains Mono';font-weight:600;">#${s.invoice}</td><td>${s.customer}</td><td style="font-weight:700;">${fmt(s.total)}</td><td><span class="badge ${sc}">${s.status}</span></td></tr>`;
        });
        html+='</tbody></table>';
        rs.innerHTML = html;
    }

    // Activity
    const act = document.getElementById('dashActivity');
    if(DB.activityLog.length===0) {
        act.innerHTML='<div class="empty-state" style="padding:30px;"><i class="fas fa-clock" style="font-size:36px;"></i><h4>No activity yet</h4><p>Actions will appear here</p></div>';
    } else {
        act.innerHTML = DB.activityLog.slice(0,6).map(a=>`<div class="activity-item"><div class="ai-icon" style="background:${a.color}15;color:${a.color}"><i class="fas fa-${a.icon}"></i></div><div><div class="ai-text">${a.text}</div><div class="ai-time">${fmtDate(a.time)} ${fmtTime(a.time)}</div></div></div>`).join('');
    }

    // Charts
    renderDashCharts();
}

function renderDashCharts() {
    // Revenue chart
    const rCtx = document.getElementById('revenueChart').getContext('2d');
    if(revenueChartInst) revenueChartInst.destroy();

    // Group sales by day (last 7 days)
    const days = [];
    for(let i=6;i>=0;i--) {
        const d = new Date(); d.setDate(d.getDate()-i);
        days.push(d.toISOString().split('T')[0]);
    }
    const revByDay = days.map(d => DB.sales.filter(s=>s.date===d).reduce((sum,s)=>sum+s.total,0));
    const expByDay = days.map(d => DB.expenses.filter(e=>e.date===d).reduce((sum,e)=>sum+e.amount,0));

    revenueChartInst = new Chart(rCtx, {
        type:'line',
        data:{
            labels: days.map(d=>fmtDate(d)),
            datasets:[
                {label:'Revenue',data:revByDay,borderColor:'#0e7490',backgroundColor:'rgba(14,116,144,0.08)',fill:true,tension:0.4,borderWidth:2.5,pointBackgroundColor:'#fff',pointBorderColor:'#0e7490',pointBorderWidth:2,pointRadius:4},
                {label:'Expenses',data:expByDay,borderColor:'#f97316',backgroundColor:'rgba(249,115,22,0.05)',fill:true,tension:0.4,borderWidth:2,borderDash:[5,5],pointBackgroundColor:'#fff',pointBorderColor:'#f97316',pointBorderWidth:2,pointRadius:3}
            ]
        },
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{usePointStyle:true,font:{family:'Inter',size:11}}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>fmt(v),font:{family:'Inter',size:10},color:'#94a3b8'},grid:{color:'rgba(0,0,0,0.04)'}},x:{ticks:{font:{family:'Inter',size:10},color:'#94a3b8'},grid:{display:false}}}}
    });

    // Category chart
    const cCtx = document.getElementById('categoryChart').getContext('2d');
    if(categoryChartInst) categoryChartInst.destroy();

    const catData = {};
    DB.sales.forEach(s=>{
        (s.items||[]).forEach(it=>{
            const p = DB.products.find(x=>x.id===it.productId);
            const cat = p ? p.category : 'Other';
            catData[cat] = (catData[cat]||0) + it.qty * it.price;
        });
    });
    const catLabels = Object.keys(catData);
    const catValues = Object.values(catData);
    const catColors = ['#0e7490','#f97316','#059669','#8b5cf6','#d97706','#dc2626','#0891b2','#7c3aed'];

    if(catLabels.length===0) {
        categoryChartInst = new Chart(cCtx,{type:'doughnut',data:{labels:['No Data'],datasets:[{data:[1],backgroundColor:['#e2e8f0'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'bottom',labels:{font:{family:'Inter',size:11}}}}}});
    } else {
        categoryChartInst = new Chart(cCtx,{type:'doughnut',data:{labels:catLabels,datasets:[{data:catValues,backgroundColor:catColors.slice(0,catLabels.length),borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'bottom',labels:{usePointStyle:true,padding:14,font:{family:'Inter',size:11}}}}}});
    }
}

// ==================== POS ====================
function renderPOS() {
    renderPosCats();
    renderPosProducts();
    renderCart();
    updateCheckoutCustomerDD();
    populateStockProductDD();
}

function renderPosCats() {
    const cats = ['all',...new Set(DB.products.map(p=>p.category).filter(Boolean))];
    document.getElementById('posCats').innerHTML = cats.map(c=>`<button class="pos-cat-btn ${c===currentPosCat?'active':''}" onclick="filterPosCat('${c}',this)">${c==='all'?'All':c}</button>`).join('');
}

function filterPosCat(cat, btn) {
    currentPosCat = cat;
    document.querySelectorAll('.pos-cat-btn').forEach(b=>b.classList.remove('active'));
    if(btn) btn.classList.add('active');
    renderPosProducts();
}

function filterPosProducts() { renderPosProducts(); }

function renderPosProducts() {
    const q = (document.getElementById('posSearchInput')?.value||'').toLowerCase();
    let prods = DB.products.filter(p=>{
        const matchQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
        const matchCat = currentPosCat==='all' || p.category===currentPosCat;
        return matchQ && matchCat;
    });
    const grid = document.getElementById('posProductGrid');
    if(prods.length===0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-box-open"></i><h4>No products found</h4><p>Add products to start selling</p><button class="btn btn-primary btn-sm" onclick="openModal(\'addProductModal\')"><i class="fas fa-plus"></i>Add Product</button></div>';
        return;
    }
    grid.innerHTML = prods.map(p=>{
        const out = p.stock===0;
        const low = p.stock>0&&p.stock<=p.minStock;
        return `<div class="pos-product-card ${out?'out-of-stock':''}" onclick="addToCart(${p.id})">
            <div class="pp-img"><img src="https://picsum.photos/seed/p${p.id}/140/72.jpg" alt="${p.name}" loading="lazy"></div>
            <div class="pp-name">${p.name}</div>
            <div class="pp-price">${fmt(p.price)}</div>
            <div class="pp-stock" style="${out?'color:var(--danger)':low?'color:var(--warning)':''}">${out?'Out of stock':p.stock+' in stock'}</div>
        </div>`;
    }).join('');
}

function addToCart(pid) {
    const p = DB.products.find(x=>x.id===pid);
    if(!p||p.stock===0) return;
    const ex = cart.find(c=>c.id===pid);
    if(ex) {
        if(ex.qty<p.stock) { ex.qty++; } else { showToast('Maximum stock reached','warning'); return; }
    } else {
        cart.push({id:p.id, name:p.name, price:p.price, qty:1});
    }
    renderCart();
    showToast(`${p.name} added`,'success');
}

function updateCartQty(pid, delta) {
    const item = cart.find(c=>c.id===pid);
    const p = DB.products.find(x=>x.id===pid);
    if(!item) return;
    item.qty += delta;
    if(item.qty<=0) cart=cart.filter(c=>c.id!==pid);
    else if(item.qty>p.stock) { item.qty=p.stock; showToast('Maximum stock reached','warning'); }
    renderCart();
}

function removeFromCart(pid) { cart=cart.filter(c=>c.id!==pid); renderCart(); }
function clearCart() { cart=[]; renderCart(); }

function renderCart() {
    const container = document.getElementById('cartItems');
    const summary = document.getElementById('cartSummary');
    const actions = document.getElementById('cartActions');

    if(cart.length===0) {
        container.innerHTML = '<div class="cart-empty"><i class="fas fa-shopping-basket"></i><p>No items in cart</p><p style="font-size:10px;margin-top:3px;">Click products to add</p></div>';
        summary.style.display='none';
        actions.style.display='none';
        return;
    }

    container.innerHTML = cart.map(i=>`<div class="cart-item">
        <div class="ci-info"><div class="ci-name">${i.name}</div><div class="ci-price">${fmt(i.price)} each</div></div>
        <div class="ci-qty"><button onclick="updateCartQty(${i.id},-1)"><i class="fas fa-minus"></i></button><span>${i.qty}</span><button onclick="updateCartQty(${i.id},1)"><i class="fas fa-plus"></i></button></div>
        <div class="ci-total">${fmt(i.price*i.qty)}</div>
        <div class="ci-remove" onclick="removeFromCart(${i.id})"><i class="fas fa-times"></i></div>
    </div>`).join('');

    updateCartTotals();
    summary.style.display='block';
    actions.style.display='flex';
}

function updateCartTotals() {
    const summary = document.getElementById('cartSummary');
    const subtotal = cart.reduce((s,i)=>s+i.price*i.qty,0);
    const tax = Math.round(subtotal * (DB.settings.taxRate||16) / 100);
    const discount = parseFloat(document.getElementById('checkoutDiscount')?.value||0);
    const total = subtotal + tax - discount;
    summary.innerHTML = `
        <div class="cs-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
        <div class="cs-row"><span>${DB.settings.taxName||'VAT'} (${DB.settings.taxRate||16}%)</span><span>${fmt(tax)}</span></div>
        <div class="cs-row"><span>Discount</span><span style="color:var(--danger);">-${fmt(discount)}</span></div>
        <div class="cs-total"><span>Total</span><span>${fmt(total)}</span></div>
    `;
}

function getCartTotal() {
    const subtotal = cart.reduce((s,i)=>s+i.price*i.qty,0);
    const tax = Math.round(subtotal * (DB.settings.taxRate||16) / 100);
    const discount = parseFloat(document.getElementById('checkoutDiscount')?.value||0);
    return { subtotal, tax, discount, total: subtotal + tax - discount };
}

function holdOrder() { showToast('Order placed on hold','info'); }

function completeSale() {
    if(cart.length===0) return;
    const {total} = getCartTotal();
    document.getElementById('checkoutTotal').textContent = fmt(total);
    document.getElementById('amountTendered').value='';
    document.getElementById('checkoutDiscount').value='0';
    document.getElementById('changeDisplay').style.display='none';
    updateCheckoutCustomerDD();
    openModal('checkoutModal');
}

function selectPM(btn, method) {
    selectedPM = method;
    document.querySelectorAll('.pm-btn').forEach(b=>{b.classList.remove('active');b.style.background='';b.style.color='';b.style.borderColor='';});
    btn.classList.add('active');
    btn.style.background='var(--primary)';btn.style.color='#fff';btn.style.borderColor='var(--primary)';
    document.getElementById('mpesaField').style.display = method==='M-Pesa'?'block':'none';
}

function calcChange() {
    const {total} = getCartTotal();
    const tendered = parseFloat(document.getElementById('amountTendered').value)||0;
    const change = tendered - total;
    const cd = document.getElementById('changeDisplay');
    const ca = document.getElementById('changeAmount');
    if(tendered>0) {
        cd.style.display='block';
        if(change>=0) { ca.textContent=fmt(change);ca.style.color='var(--success)';cd.style.background='rgba(5,150,105,0.1)'; }
        else { ca.textContent=fmt(Math.abs(change))+' short';ca.style.color='var(--danger)';cd.style.background='rgba(220,38,38,0.1)'; }
    } else { cd.style.display='none'; }
}

function updateCheckoutCustomerDD() {
    const sel = document.getElementById('checkoutCustomer');
    sel.innerHTML = '<option value="">Walk-in Customer</option>' + DB.customers.map(c=>`<option value="${c.id}">${c.firstName} ${c.lastName}</option>`).join('');
}

function finalizeSale() {
    const {subtotal, tax, discount, total} = getCartTotal();
    const tendered = parseFloat(document.getElementById('amountTendered').value)||0;

    if(selectedPM==='Cash' && tendered<total) { showToast('Amount tendered is insufficient','danger'); return; }

    const custId = document.getElementById('checkoutCustomer').value;
    const custName = custId ? (DB.customers.find(c=>c.id==custId)?.firstName||'') + ' ' + (DB.customers.find(c=>c.id==custId)?.lastName||'') : 'Walk-in Customer';
    const invoice = genInvoice();
    const change = selectedPM==='Cash'? Math.max(0,tendered-total) : 0;

    // Build sale items
    const saleItems = cart.map(i=>{
        const p = DB.products.find(x=>x.id===i.id);
        return { productId:i.id, name:i.name, price:i.price, qty:i.qty, total:i.price*i.qty };
    });

    // Deduct stock
    cart.forEach(i=>{
        const p = DB.products.find(x=>x.id===i.id);
        if(p) { p.stock = Math.max(0, p.stock - i.qty); }
    });

    // Record sale
    DB.sales.unshift({
        id: DB.nextSaleId++,
        invoice,
        customer: custName,
        customerId: custId || null,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toISOString(),
        items: saleItems,
        subtotal, tax, discount, total,
        payment: selectedPM,
        tendered: selectedPM==='Cash'?tendered:total,
        change,
        status: 'Paid'
    });

    // Update customer purchase total
    if(custId) {
        const cust = DB.customers.find(c=>c.id==custId);
        if(cust) { cust.totalPurchases = (cust.totalPurchases||0) + total; cust.points = Math.floor((cust.totalPurchases||0)/100); }
    }

    logActivity(`Sale <strong>#${invoice}</strong> completed â€” ${fmt(total)} via ${selectedPM}`, 'receipt', 'var(--success)');

    // Generate receipt
    const receiptHTML = `
        <div class="r-center">
            <h4>${DB.settings.name||'OLUTAJR ERP'}</h4>
            <div>${DB.settings.address||'Business Address'}</div>
            <div>${DB.settings.phone||'Phone'}</div>
            ${DB.settings.pin?`<div>PIN: ${DB.settings.pin}</div>`:''}
            <div class="r-line"></div>
            <div style="font-weight:700;">RECEIPT</div>
            <div>#${invoice}</div>
            <div>${fmtDate(new Date())} ${fmtTime(new Date())}</div>
        </div>
        <div class="r-line"></div>
        ${saleItems.map(i=>`<div class="r-row"><span>${i.name} x${i.qty}</span><span>${fmt(i.total)}</span></div>`).join('')}
        <div class="r-line"></div>
        <div class="r-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
        <div class="r-row"><span>${DB.settings.taxName||'VAT'} ${DB.settings.taxRate||16}%</span><span>${fmt(tax)}</span></div>
        ${discount>0?`<div class="r-row"><span>Discount</span><span>-${fmt(discount)}</span></div>`:''}
        <div class="r-row" style="font-weight:700;font-size:13px;"><span>TOTAL</span><span>${fmt(total)}</span></div>
        <div class="r-line"></div>
        <div class="r-row"><span>Payment</span><span>${selectedPM}</span></div>
        ${selectedPM==='Cash'?`<div class="r-row"><span>Tendered</span><span>${fmt(tendered)}</span></div><div class="r-row"><span>Change</span><span>${fmt(change)}</span></div>`:''}
        <div class="r-line"></div>
        <div class="r-center" style="font-size:10px;">
            <div>${DB.settings.receiptMsg||'Thank you for your purchase!'}</div>
        </div>
    `;
    document.getElementById('receiptContent').innerHTML = receiptHTML;

    saveDB();
    closeModal('checkoutModal');
    openModal('receiptModal');

    cart = [];
    renderCart();
    renderPosProducts();
    showToast('Sale completed successfully!','success');
}

function printReceipt() {
    const content = document.getElementById('receiptContent').innerHTML;
    const w = window.open('','','width=350,height=600');
    w.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;font-size:11px;padding:10px;}.r-center{text-align:center;}.r-line{border-top:1px dashed #000;margin:6px 0;}.r-row{display:flex;justify-content:space-between;padding:2px 0;}h4{font-size:15px;margin:0;}</style></head><body>${content}</body></html>`);
    w.document.close();
    w.print();
}

// ==================== PRODUCTS ====================
function renderProductPage() {
    const q = (document.getElementById('prodSearchInput')?.value||'').toLowerCase();
    const catF = document.getElementById('prodCatFilter')?.value||'';
    let prods = DB.products.filter(p=>{
        const matchQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
        const matchCat = !catF || p.category===catF;
        return matchQ && matchCat;
    });
    document.getElementById('prodCount').textContent = prods.length + ' product' + (prods.length!==1?'s':'');

    // Update category filter options
    const cats = [...new Set(DB.products.map(p=>p.category).filter(Boolean))];
    const catSel = document.getElementById('prodCatFilter');
    const curVal = catSel.value;
    catSel.innerHTML = '<option value="">All Categories</option>' + cats.map(c=>`<option value="${c}" ${c===curVal?'selected':''}>${c}</option>`).join('');

    const tbody = document.getElementById('productTableBody');
    if(prods.length===0) {
        tbody.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><h4>No products yet</h4><p>Add your first product to get started</p><button class="btn btn-primary btn-sm" onclick="openModal(\'addProductModal\')"><i class="fas fa-plus"></i>Add Product</button></div>';
        return;
    }
    tbody.innerHTML = `<table class="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Cost</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>${
        prods.map(p=>{
            const sc = p.stock===0?'badge-danger':p.stock<=p.minStock?'badge-warning':'badge-success';
            const st = p.stock===0?'Out of Stock':p.stock<=p.minStock?'Low Stock':'In Stock';
            return `<tr>
                <td><div style="display:flex;align-items:center;gap:9px;"><img src="https://picsum.photos/seed/p${p.id}/36/36.jpg" style="width:36px;height:36px;border-radius:8px;object-fit:cover;"><strong>${p.name}</strong></div></td>
                <td style="font-family:'JetBrains Mono';font-size:12px;">${p.sku}</td>
                <td><span class="badge badge-primary">${p.category}</span></td>
                <td style="font-weight:700;">${fmt(p.price)}</td>
                <td style="color:var(--text-secondary);">${p.cost?fmt(p.cost):'-'}</td>
                <td>${p.stock}</td>
                <td><span class="badge ${sc}">${st}</span></td>
                <td><button class="btn-icon" title="Edit" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button> <button class="btn-icon danger" title="Delete" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        }).join('')
    }</tbody></table>`;
}

function populateCatSuggestions() {
    const cats = [...new Set(DB.products.map(p=>p.category).filter(Boolean))];
    document.getElementById('catSuggestions').innerHTML = cats.map(c=>`<option value="${c}">`).join('');
}

function openAddProductModal() {
    document.getElementById('productModalTitle').textContent='Add New Product';
    document.getElementById('editProductId').value='';
    document.getElementById('pName').value='';
    document.getElementById('pSku').value=genSKU();
    document.getElementById('pCategory').value='';
    document.getElementById('pPrice').value='';
    document.getElementById('pCost').value='';
    document.getElementById('pStock').value='';
    document.getElementById('pMinStock').value='10';
    document.getElementById('pDesc').value='';
}

function editProduct(id) {
    const p = DB.products.find(x=>x.id===id);
    if(!p) return;
    document.getElementById('productModalTitle').textContent='Edit Product';
    document.getElementById('editProductId').value=id;
    document.getElementById('pName').value=p.name;
    document.getElementById('pSku').value=p.sku;
    document.getElementById('pCategory').value=p.category;
    document.getElementById('pPrice').value=p.price;
    document.getElementById('pCost').value=p.cost||'';
    document.getElementById('pStock').value=p.stock;
    document.getElementById('pMinStock').value=p.minStock;
    document.getElementById('pDesc').value=p.description||'';
    openModal('addProductModal');
}

function saveProduct() {
    const name = document.getElementById('pName').value.trim();
    const sku = document.getElementById('pSku').value.trim();
    const category = document.getElementById('pCategory').value.trim();
    const price = parseFloat(document.getElementById('pPrice').value);
    const cost = parseFloat(document.getElementById('pCost').value)||0;
    const stock = parseInt(document.getElementById('pStock').value)||0;
    const minStock = parseInt(document.getElementById('pMinStock').value)||10;
    const desc = document.getElementById('pDesc').value.trim();
    const editId = document.getElementById('editProductId').value;

    if(!name||!sku||!category||isNaN(price)) { showToast('Please fill in all required fields','danger'); return; }

    if(editId) {
        const p = DB.products.find(x=>x.id==editId);
        if(p) {
            const oldStock = p.stock;
            Object.assign(p, {name,sku,category,price,cost,stock,minStock,description:desc});
            if(stock!==oldStock) logActivity(`Stock updated for <strong>${name}</strong>: ${oldStock} â†’ ${stock}`, 'boxes-stacked', 'var(--warning)');
            else logActivity(`Product <strong>${name}</strong> updated`, 'edit', 'var(--info)');
        }
    } else {
        DB.products.push({id:DB.nextProductId++,name,sku,category,price,cost,stock,minStock,description:desc});
        logActivity(`Product <strong>${name}</strong> added with ${stock} units`, 'box', 'var(--success)');
    }

    saveDB();
    closeModal('addProductModal');
    populateCatSuggestions();
    renderProductPage();
    renderPosProducts();
    renderPosCats();
    renderStockPage();
    showToast(editId?'Product updated':'Product added successfully','success');
}

function deleteProduct(id) {
    const p = DB.products.find(x=>x.id===id);
    if(!p) return;
    DB.products = DB.products.filter(x=>x.id!==id);
    logActivity(`Product <strong>${p.name}</strong> deleted`, 'trash', 'var(--danger)');
    saveDB();
    renderProductPage();
    renderPosProducts();
    renderPosCats();
    renderStockPage();
    showToast('Product deleted','danger');
}

// ==================== CUSTOMERS ====================
function renderCustomerPage() {
    const q = (document.getElementById('custSearchInput')?.value||'').toLowerCase();
    let custs = DB.customers.filter(c=>{
        const full = (c.firstName+' '+c.lastName).toLowerCase();
        return !q || full.includes(q) || (c.email||'').toLowerCase().includes(q) || (c.phone||'').includes(q);
    });
    document.getElementById('custCount').textContent = custs.length + ' customer' + (custs.length!==1?'s':'');

    const tbody = document.getElementById('customerTableBody');
    if(custs.length===0) {
        tbody.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i><h4>No customers yet</h4><p>Add your first customer</p><button class="btn btn-primary btn-sm" onclick="openModal(\'addCustomerModal\')"><i class="fas fa-user-plus"></i>Add Customer</button></div>';
        return;
    }
    tbody.innerHTML = `<table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Purchases</th><th>Points</th><th>Joined</th><th>Actions</th></tr></thead><tbody>${
        custs.map(c=>`<tr>
            <td><strong>${c.firstName} ${c.lastName}</strong></td>
            <td>${c.email||'-'}</td>
            <td>${c.phone||'-'}</td>
            <td style="font-weight:700;">${fmt(c.totalPurchases||0)}</td>
            <td><span class="badge badge-warning">${(c.points||0).toLocaleString()} pts</span></td>
            <td>${fmtDate(c.joined)}</td>
            <td><button class="btn-icon" title="Edit" onclick="editCustomer(${c.id})"><i class="fas fa-edit"></i></button> <button class="btn-icon danger" title="Delete" onclick="deleteCustomer(${c.id})"><i class="fas fa-trash"></i></button></td>
        </tr>`).join('')
    }</tbody></table>`;
}

function editCustomer(id) {
    const c = DB.customers.find(x=>x.id===id);
    if(!c) return;
    document.getElementById('customerModalTitle').textContent='Edit Customer';
    document.getElementById('editCustId').value=id;
    document.getElementById('cFirst').value=c.firstName;
    document.getElementById('cLast').value=c.lastName;
    document.getElementById('cEmail').value=c.email||'';
    document.getElementById('cPhone').value=c.phone||'';
    document.getElementById('cAddress').value=c.address||'';
    openModal('addCustomerModal');
}

function saveCustomer() {
    const first = document.getElementById('cFirst').value.trim();
    const last = document.getElementById('cLast').value.trim();
    const email = document.getElementById('cEmail').value.trim();
    const phone = document.getElementById('cPhone').value.trim();
    const address = document.getElementById('cAddress').value.trim();
    const editId = document.getElementById('editCustId').value;

    if(!first||!last) { showToast('Please fill in customer name','danger'); return; }

    if(editId) {
        const c = DB.customers.find(x=>x.id==editId);
        if(c) Object.assign(c, {firstName:first,lastName:last,email,phone,address});
        logActivity(`Customer <strong>${first} ${last}</strong> updated`, 'user-edit', 'var(--info)');
    } else {
        DB.customers.push({id:DB.nextCustId++,firstName:first,lastName:last,email,phone,address,joined:new Date().toISOString().split('T')[0],totalPurchases:0,points:0});
        logActivity(`New customer <strong>${first} ${last}</strong> registered`, 'user-plus', 'var(--success)');
    }

    saveDB();
    closeModal('addCustomerModal');
    renderCustomerPage();
    updateCheckoutCustomerDD();
    showToast(editId?'Customer updated':'Customer added successfully','success');
    // Reset
    ['editCustId','cFirst','cLast','cEmail','cPhone','cAddress'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('customerModalTitle').textContent='Add Customer';
}

function deleteCustomer(id) {
    const c = DB.customers.find(x=>x.id===id);
    if(!c) return;
    DB.customers = DB.customers.filter(x=>x.id!==id);
    logActivity(`Customer <strong>${c.firstName} ${c.lastName}</strong> removed`, 'user-minus', 'var(--danger)');
    saveDB();
    renderCustomerPage();
    updateCheckoutCustomerDD();
    showToast('Customer removed','danger');
}

// ==================== USERS MANAGEMENT ====================
function renderUserPage() {
    const q = (document.getElementById('userSearchInput')?.value||'').toLowerCase();
    const users = DB.users.filter(u => {
        const name = `${u.firstName} ${u.lastName}`.toLowerCase();
        return !q || name.includes(q) || (u.email||'').toLowerCase().includes(q) || (u.role||'').toLowerCase().includes(q);
    });
    document.getElementById('userCount').textContent = users.length + ' user' + (users.length!==1?'s':'');
    const tbody = document.getElementById('userTableBody');
    if(users.length===0) {
        tbody.innerHTML = '<div class="empty-state"><i class="fas fa-user-shield"></i><h4>No users found</h4><p>Add system users and assign roles for access control</p><button class="btn btn-primary btn-sm" onclick="openModal(\'addUserModal\')"><i class="fas fa-user-plus"></i>Add User</button></div>';
        return;
    }
    tbody.innerHTML = `<table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead><tbody>${users.map(u=>`<tr>
            <td><strong>${u.firstName} ${u.lastName}</strong></td>
            <td>${u.email}</td>
            <td><span class="badge badge-primary">${u.role}</span></td>
            <td><span class="badge ${u.status==='Active'?'badge-success':'badge-danger'}">${u.status}</span></td>
            <td>${fmtDate(u.joined)}</td>
            <td><button class="btn-icon" title="Edit" onclick="editUser(${u.id})"><i class="fas fa-edit"></i></button> <button class="btn-icon danger" title="Delete" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i></button></td>
        </tr>`).join('')}</tbody></table>`;
}

function openAddUserModal() {
    document.getElementById('userModalTitle').textContent='Add User';
    document.getElementById('editUserId').value='';
    document.getElementById('uFirst').value='';
    document.getElementById('uLast').value='';
    document.getElementById('uEmail').value='';
    document.getElementById('uPassword').value='';
    document.getElementById('uRole').value='Cashier';
    document.getElementById('uStatus').value='Active';
    document.getElementById('uNotes').value='';
    populateUserPermissionGrid();
    applyRolePreset('Cashier');
}

function editUser(id) {
    const u = DB.users.find(x=>x.id===id);
    if(!u) return;
    document.getElementById('userModalTitle').textContent='Edit User';
    document.getElementById('editUserId').value=id;
    document.getElementById('uFirst').value=u.firstName;
    document.getElementById('uLast').value=u.lastName;
    document.getElementById('uEmail').value=u.email;
    document.getElementById('uPassword').value='';
    document.getElementById('uRole').value=u.role||'Cashier';
    document.getElementById('uStatus').value=u.status||'Active';
    document.getElementById('uNotes').value=u.notes||'';
    populateUserPermissionGrid();
    if(Array.isArray(u.permissions)) {
        document.querySelectorAll('.permission-checkbox input[type="checkbox"]').forEach(cb=>{
            cb.checked = u.permissions.includes(cb.value);
        });
    } else {
        applyRolePreset(u.role||'Cashier');
    }
    openModal('addUserModal');
}

function saveUser() {
    const first = document.getElementById('uFirst').value.trim();
    const last = document.getElementById('uLast').value.trim();
    const email = document.getElementById('uEmail').value.trim();
    const password = document.getElementById('uPassword').value;
    const role = document.getElementById('uRole').value;
    const status = document.getElementById('uStatus').value;
    const notes = document.getElementById('uNotes').value.trim();
    const editId = document.getElementById('editUserId').value;
    const permissions = Array.from(document.querySelectorAll('.permission-checkbox input[type="checkbox"]'))
        .filter(cb=>cb.checked)
        .map(cb=>cb.value);

    if(!first||!last||!email||!role) { showToast('Please fill in required user fields','danger'); return; }
    if(!editId && !password) { showToast('Please set a password for the new user','danger'); return; }

    if(editId) {
        const u = DB.users.find(x=>x.id==editId);
        if(u) {
            u.firstName = first;
            u.lastName = last;
            u.email = email;
            if(password) u.password = password;
            u.role = role;
            u.status = status;
            u.notes = notes;
            u.permissions = permissions.length ? permissions : getDefaultPermissions(role);
            logActivity(`User <strong>${first} ${last}</strong> updated with role ${role}`,'user-edit','var(--info)');
        }
    } else {
        DB.users.push({
            id:DB.nextUserId++,
            firstName:first,
            lastName:last,
            email,
            password,
            role,
            status,
            notes,
            permissions: permissions.length ? permissions : getDefaultPermissions(role),
            joined:new Date().toISOString().split('T')[0]
        });
        logActivity(`New user <strong>${first} ${last}</strong> added as ${role}`,'user-plus','var(--success)');
    }

    saveDB();
    closeModal('addUserModal');
    renderUserPage();
    showToast(editId?'User updated successfully':'User added successfully','success');
}

function deleteUser(id) {
    const u = DB.users.find(x=>x.id===id);
    if(!u) return;
    DB.users = DB.users.filter(x=>x.id!==id);
    logActivity(`User <strong>${u.firstName} ${u.lastName}</strong> removed`, 'user-minus', 'var(--danger)');
    saveDB();
    renderUserPage();
    showToast('User removed','danger');
}

// ==================== STOCK MANAGEMENT ====================
function populateStockProductDD() {
    const sel = document.getElementById('stockProduct');
    if(!sel) return;
    sel.innerHTML = DB.products.length===0
        ? '<option value="">No products â€” add products first</option>'
        : DB.products.map(p=>`<option value="${p.id}">${p.name} (Current: ${p.stock})</option>`).join('');
}

function renderStockPage() {
    const inStock = DB.products.filter(p=>p.stock>0&&p.stock>p.minStock).length;
    const lowStock = DB.products.filter(p=>p.stock>0&&p.stock<=p.minStock).length;
    const outStock = DB.products.filter(p=>p.stock===0).length;

    document.getElementById('stockStats').innerHTML = `
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(5,150,105,0.1);color:var(--success)"><i class="fas fa-check-circle"></i></div></div><div class="sc-value">${inStock}</div><div class="sc-label">In Stock</div></div>
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(217,119,6,0.1);color:var(--warning)"><i class="fas fa-exclamation-circle"></i></div></div><div class="sc-value">${lowStock}</div><div class="sc-label">Low Stock</div></div>
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(220,38,38,0.1);color:var(--danger)"><i class="fas fa-times-circle"></i></div></div><div class="sc-value">${outStock}</div><div class="sc-label">Out of Stock</div></div>
    `;

    const tbody = document.getElementById('stockTableBody');
    if(DB.products.length===0) {
        tbody.innerHTML = '<div class="empty-state"><i class="fas fa-warehouse"></i><h4>No products in inventory</h4><p>Add products first</p><button class="btn btn-primary btn-sm" onclick="openModal(\'addProductModal\')"><i class="fas fa-plus"></i>Add Product</button></div>';
        return;
    }

    tbody.innerHTML = `<table class="data-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Current Stock</th><th>Min Level</th><th>Cost Price</th><th>Selling Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>${
        DB.products.map(p=>{
            const sc = p.stock===0?'badge-danger':p.stock<=p.minStock?'badge-warning':'badge-success';
            const st = p.stock===0?'Out of Stock':p.stock<=p.minStock?'Low Stock':'In Stock';
            return `<tr>
                <td><strong>${p.name}</strong></td>
                <td style="font-family:'JetBrains Mono';font-size:12px;">${p.sku}</td>
                <td>${p.category}</td>
                <td style="font-weight:700;${p.stock===0?'color:var(--danger)':p.stock<=p.minStock?'color:var(--warning)':''}">${p.stock}</td>
                <td>${p.minStock}</td>
                <td>${p.cost?fmt(p.cost):'-'}</td>
                <td>${fmt(p.price)}</td>
                <td><span class="badge ${sc}">${st}</span></td>
                <td><button class="btn btn-sm btn-primary" onclick="quickRestock(${p.id})"><i class="fas fa-plus"></i>Restock</button></td>
            </tr>`;
        }).join('')
    }</tbody></table>`;
}

function addStock() {
    const pid = parseInt(document.getElementById('stockProduct').value);
    const qty = parseInt(document.getElementById('stockQty').value);
    const cost = parseFloat(document.getElementById('stockCost').value)||0;
    const supplier = document.getElementById('stockSupplier').value.trim();
    const notes = document.getElementById('stockNotes').value.trim();

    if(!pid||!qty||qty<=0) { showToast('Please select a product and enter quantity','danger'); return; }

    const p = DB.products.find(x=>x.id===pid);
    if(!p) { showToast('Product not found','danger'); return; }

    const oldStock = p.stock;
    p.stock += qty;
    if(cost) p.cost = cost;

    DB.stockHistory.push({productId:pid,productName:p.name,type:'in',qty,oldStock,newStock:p.stock,cost,supplier,notes,date:new Date().toISOString()});

    logActivity(`Stock added: <strong>${p.name}</strong> +${qty} units (${oldStock} â†’ ${p.stock})`, 'truck', 'var(--success)');

    saveDB();
    closeModal('addStockModal');
    renderStockPage();
    renderPosProducts();
    renderProductPage();
    showToast(`${qty} units added to ${p.name}`,'success');

    // Reset form
    ['stockQty','stockCost','stockSupplier','stockNotes'].forEach(id=>document.getElementById(id).value='');
}

function quickRestock(pid) {
    populateStockProductDD();
    document.getElementById('stockProduct').value = pid;
    document.getElementById('stockQty').value = '';
    document.getElementById('stockCost').value = '';
    document.getElementById('stockSupplier').value = '';
    document.getElementById('stockNotes').value = '';
    openModal('addStockModal');
}

// ==================== SALES PAGE ====================
function renderSalesPage() {
    const q = (document.getElementById('salesSearchInput')?.value||'').toLowerCase();
    let sales = DB.sales.filter(s=> !q || s.invoice.toLowerCase().includes(q) || s.customer.toLowerCase().includes(q));
    document.getElementById('salesCount').textContent = sales.length + ' sale' + (sales.length!==1?'s':'');

    const tbody = document.getElementById('salesTableBody');
    if(sales.length===0) {
        tbody.innerHTML = '<div class="empty-state"><i class="fas fa-receipt"></i><h4>No sales recorded</h4><p>Complete a sale from the POS to see it here</p><button class="btn btn-primary btn-sm" onclick="switchPage(\'pos\')"><i class="fas fa-cash-register"></i>Go to POS</button></div>';
        return;
    }
    tbody.innerHTML = `<table class="data-table"><thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead><tbody>${
        sales.map(s=>{
            const sc = s.status==='Paid'?'badge-success':s.status==='Pending'?'badge-warning':'badge-danger';
            return `<tr>
                <td style="font-family:'JetBrains Mono';font-weight:600;">#${s.invoice}</td>
                <td>${fmtDate(s.date)}</td>
                <td>${s.customer}</td>
                <td>${s.items.length}</td>
                <td style="font-weight:700;">${fmt(s.total)}</td>
                <td><span class="badge badge-primary">${s.payment}</span></td>
                <td><span class="badge ${sc}">${s.status}</span></td>
                <td><button class="btn-icon" title="View" onclick="viewSaleDetail(${s.id})"><i class="fas fa-eye"></i></button> <button class="btn-icon" title="Print" onclick="printSaleInvoice(${s.id})"><i class="fas fa-print"></i></button></td>
            </tr>`;
        }).join('')
    }</tbody></table>`;
}

function viewSaleDetail(id) {
    const s = DB.sales.find(x=>x.id===id);
    if(!s) return;
    showToast(`Viewing sale #${s.invoice} â€” ${fmt(s.total)}`,'info');
}

function printSaleInvoice(id) {
    const s = DB.sales.find(x=>x.id===id);
    if(!s) return;
    showToast(`Printing invoice #${s.invoice}`,'info');
}

// ==================== EXPENSES ====================
function renderExpensePage() {
    const totalExp = DB.expenses.reduce((s,x)=>s+x.amount,0);
    const paidExp = DB.expenses.filter(e=>e.status==='Paid').reduce((s,x)=>s+x.amount,0);
    const pendingExp = totalExp - paidExp;

    document.getElementById('expenseStats').innerHTML = `
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(220,38,38,0.1);color:var(--danger)"><i class="fas fa-money-bill-wave"></i></div></div><div class="sc-value">${fmt(totalExp)}</div><div class="sc-label">Total Expenses</div></div>
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(217,119,6,0.1);color:var(--warning)"><i class="fas fa-clock"></i></div></div><div class="sc-value">${fmt(pendingExp)}</div><div class="sc-label">Pending</div></div>
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(5,150,105,0.1);color:var(--success)"><i class="fas fa-check-double"></i></div></div><div class="sc-value">${fmt(paidExp)}</div><div class="sc-label">Paid</div></div>
    `;

    const tbody = document.getElementById('expenseTableBody');
    if(DB.expenses.length===0) {
        tbody.innerHTML = '<div class="empty-state"><i class="fas fa-money-bill-trend-up"></i><h4>No expenses recorded</h4><p>Track your business expenses here</p><button class="btn btn-primary btn-sm" onclick="openModal(\'addExpenseModal\')"><i class="fas fa-plus"></i>Add Expense</button></div>';
        return;
    }
    tbody.innerHTML = `<table class="data-table"><thead><tr><th>Description</th><th>Category</th><th>Amount</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>${
        DB.expenses.map(e=>{
            const sc = e.status==='Paid'?'badge-success':'badge-warning';
            return `<tr>
                <td><strong>${e.description}</strong></td>
                <td><span class="badge badge-primary">${e.category}</span></td>
                <td style="font-weight:700;">${fmt(e.amount)}</td>
                <td>${fmtDate(e.date)}</td>
                <td><span class="badge ${sc}">${e.status}</span></td>
                <td><button class="btn-icon danger" title="Delete" onclick="deleteExpense(${e.id})"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        }).join('')
    }</tbody></table>`;
}

function saveExpense() {
    const desc = document.getElementById('expDesc').value.trim();
    const amount = parseFloat(document.getElementById('expAmount').value);
    const category = document.getElementById('expCategory').value;
    const date = document.getElementById('expDate').value || new Date().toISOString().split('T')[0];
    const status = document.getElementById('expStatus').value;

    if(!desc||!amount) { showToast('Please fill in required fields','danger'); return; }

    DB.expenses.unshift({id:DB.nextExpId++,description:desc,amount,category,date,status});
    logActivity(`Expense added: <strong>${desc}</strong> â€” ${fmt(amount)}`, 'money-bill', 'var(--warning)');
    saveDB();
    closeModal('addExpenseModal');
    renderExpensePage();
    showToast('Expense added','success');
    ['expDesc','expAmount'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
}

function deleteExpense(id) {
    DB.expenses = DB.expenses.filter(x=>x.id!==id);
    saveDB();
    renderExpensePage();
    showToast('Expense deleted','danger');
}

// ==================== FINANCE ====================
function renderFinancePage() {
    const totalRev = DB.sales.reduce((s,x)=>s+x.total,0);
    const totalExp = DB.expenses.reduce((s,x)=>s+x.amount,0);
    const profit = totalRev - totalExp;
    const pendingExp = DB.expenses.filter(e=>e.status==='Pending').reduce((s,x)=>s+x.amount,0);
    const paidExp = totalExp - pendingExp;

    document.getElementById('financeStats').innerHTML = `
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(14,116,144,0.1);color:var(--primary)"><i class="fas fa-dollar-sign"></i></div></div><div class="sc-value">${fmt(totalRev)}</div><div class="sc-label">Total Revenue</div></div>
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(220,38,38,0.1);color:var(--danger)"><i class="fas fa-money-bill-wave"></i></div></div><div class="sc-value">${fmt(totalExp)}</div><div class="sc-label">Total Expenses</div></div>
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(5,150,105,0.1);color:var(--success)"><i class="fas fa-chart-line"></i></div></div><div class="sc-value">${fmt(profit)}</div><div class="sc-label">Net Profit</div></div>
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(217,119,6,0.1);color:var(--warning)"><i class="fas fa-wallet"></i></div></div><div class="sc-value">${fmt(paidExp)}</div><div class="sc-label">Paid Expenses</div></div>
    `;

    const breakdown = DB.expenses.reduce((acc,e)=>{ acc[e.category] = (acc[e.category]||0) + e.amount; return acc; }, {});
    const breakdownEntries = Object.entries(breakdown).sort((a,b)=>b[1]-a[1]);
    document.getElementById('financeExpenseBreakdown').innerHTML = breakdownEntries.length===0 ? '<p style="color:var(--text-muted);font-size:13px;">No expense data yet</p>' : breakdownEntries.map(([cat,amt])=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);"><span>${cat}</span><strong>${fmt(amt)}</strong></div>`).join('');

    document.getElementById('financeCashFlow').innerHTML = `
        <div style="display:grid;gap:12px;">
            <div style="padding:14px;background:rgba(14,116,144,0.08);border-radius:12px;"><div style="font-size:12px;color:var(--text-secondary);">Gross Revenue</div><div style="font-size:18px;font-weight:700;">${fmt(totalRev)}</div></div>
            <div style="padding:14px;background:rgba(220,38,38,0.08);border-radius:12px;"><div style="font-size:12px;color:var(--text-secondary);">Total Expenses</div><div style="font-size:18px;font-weight:700;">${fmt(totalExp)}</div></div>
            <div style="padding:14px;background:rgba(5,150,105,0.08);border-radius:12px;"><div style="font-size:12px;color:var(--text-secondary);">Net Cash Flow</div><div style="font-size:18px;font-weight:700;">${fmt(profit)}</div></div>
            <div style="padding:14px;background:rgba(217,119,6,0.08);border-radius:12px;"><div style="font-size:12px;color:var(--text-secondary);">Pending Expenses</div><div style="font-size:18px;font-weight:700;">${fmt(pendingExp)}</div></div>
        </div>
    `;

    const tableBody = document.getElementById('financeExpenseTable');
    if(DB.expenses.length===0) {
        tableBody.innerHTML = '<div class="empty-state"><i class="fas fa-money-bill-trend-up"></i><h4>No expenses recorded</h4><p>Track your finance expenses here</p><button class="btn btn-primary btn-sm" onclick="openModal(\'addExpenseModal\')"><i class="fas fa-plus"></i>Add Expense</button></div>';
    } else {
        tableBody.innerHTML = `<table class="data-table"><thead><tr><th>Description</th><th>Category</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>${DB.expenses.map(e=>`<tr><td><strong>${e.description}</strong></td><td>${e.category}</td><td style="font-weight:700;">${fmt(e.amount)}</td><td>${fmtDate(e.date)}</td><td><span class="badge ${e.status==='Paid'?'badge-success':'badge-warning'}">${e.status}</span></td></tr>`).join('')}</tbody></table>`;
    }
}

// ==================== REPORTING ====================
function renderReportingPage() {
    const totalRev = DB.sales.reduce((s,x)=>s+x.total,0);
    const totalExp = DB.expenses.reduce((s,x)=>s+x.amount,0);
    const profit = totalRev - totalExp;
    const margin = totalRev>0 ? ((profit/totalRev)*100).toFixed(1) : 0;
    const totalCustomers = DB.customers.length;
    const totalProducts = DB.products.length;
    const totalStock = DB.products.reduce((s,x)=>s+x.stock,0);

    document.getElementById('reportStats').innerHTML = `
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(14,116,144,0.1);color:var(--primary)"><i class="fas fa-chart-line"></i></div></div><div class="sc-value">${fmt(totalRev)}</div><div class="sc-label">Total Revenue</div></div>
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(5,150,105,0.1);color:var(--success)"><i class="fas fa-coins"></i></div></div><div class="sc-value">${fmt(profit)}</div><div class="sc-label">Net Profit</div></div>
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(217,119,6,0.1);color:var(--warning)"><i class="fas fa-percentage"></i></div></div><div class="sc-value">${margin}%</div><div class="sc-label">Profit Margin</div></div>
        <div class="stat-card"><div class="sc-header"><div class="sc-icon" style="background:rgba(220,38,38,0.1);color:var(--danger)"><i class="fas fa-money-bill-wave"></i></div></div><div class="sc-value">${fmt(totalExp)}</div><div class="sc-label">Total Expenses</div></div>
    `;

    const rCtx = document.getElementById('reportRevenueChart').getContext('2d');
    if(reportRevChartInst) reportRevChartInst.destroy();
    const months = [];
    for(let i=5;i>=0;i--) { const d=new Date(); d.setMonth(d.getMonth()-i); months.push(d.toISOString().slice(0,7)); }
    const revByMonth = months.map(m=>DB.sales.filter(s=>s.date.startsWith(m)).reduce((sum,s)=>sum+s.total,0));
    const expByMonth = months.map(m=>DB.expenses.filter(e=>e.date.startsWith(m)).reduce((sum,e)=>sum+e.amount,0));
    reportRevChartInst = new Chart(rCtx, {
        type:'bar',
        data:{labels:months.map(m=>{const d=new Date(m+'-01');return d.toLocaleDateString('en',{month:'short',year:'2-digit'});}),datasets:[{label:'Revenue',data:revByMonth,backgroundColor:'rgba(14,116,144,0.8)',borderRadius:5,borderSkipped:false},{label:'Expenses',data:expByMonth,backgroundColor:'rgba(249,115,22,0.7)',borderRadius:5,borderSkipped:false}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{usePointStyle:true,font:{family:'Inter',size:11}}}},scales:{y:{beginAtZero:true,ticks:{callback:v=>fmt(v),font:{family:'Inter',size:10},color:'#94a3b8'},grid:{color:'rgba(0,0,0,0.04)'}},x:{ticks:{font:{family:'Inter',size:10},color:'#94a3b8'},grid:{display:false}}}}
    });

    const pCtx = document.getElementById('reportPaymentChart').getContext('2d');
    if(reportPayChartInst) reportPayChartInst.destroy();
    const pmData = {};
    DB.sales.forEach(s=>{ pmData[s.payment] = (pmData[s.payment]||0) + s.total; });
    const pmLabels = Object.keys(pmData);
    const pmValues = Object.values(pmData);
    const pmColors = ['#0e7490','#f97316','#059669','#8b5cf6'];
    if(pmLabels.length===0) {
        reportPayChartInst = new Chart(pCtx,{type:'pie',data:{labels:['No Data'],datasets:[{data:[1],backgroundColor:['#e2e8f0'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{family:'Inter',size:11}}}}}});
    } else {
        reportPayChartInst = new Chart(pCtx,{type:'pie',data:{labels:pmLabels,datasets:[{data:pmValues,backgroundColor:pmColors.slice(0,pmLabels.length),borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,padding:14,font:{family:'Inter',size:11}}}}}});
    }

    const topProducts = {};
    DB.sales.forEach(s=>s.items.forEach(item=>{ topProducts[item.name] = (topProducts[item.name]||0) + item.qty; }));
    const topProductRows = Object.entries(topProducts).sort((a,b)=>b[1]-a[1]).slice(0,5);
    document.getElementById('reportTopProducts').innerHTML = topProductRows.length===0 ? '<p style="color:var(--text-muted);font-size:13px;">No sales data yet</p>' : `<ol style="padding-left:18px;">${topProductRows.map(([name,qty])=>`<li style="margin-bottom:8px;"><strong>${name}</strong> â€” ${qty} sold</li>`).join('')}</ol>`;

    document.getElementById('reportKeyMetrics').innerHTML = `
        <div style="display:grid;gap:10px;">
            <div style="padding:14px;background:rgba(14,116,144,0.08);border-radius:12px;"><div style="font-size:12px;color:var(--text-secondary);">Customers</div><div style="font-size:18px;font-weight:700;">${totalCustomers}</div></div>
            <div style="padding:14px;background:rgba(5,150,105,0.08);border-radius:12px;"><div style="font-size:12px;color:var(--text-secondary);">Products</div><div style="font-size:18px;font-weight:700;">${totalProducts}</div></div>
            <div style="padding:14px;background:rgba(217,119,6,0.08);border-radius:12px;"><div style="font-size:12px;color:var(--text-secondary);">Stock Units</div><div style="font-size:18px;font-weight:700;">${totalStock}</div></div>
            <div style="padding:14px;background:rgba(220,38,38,0.08);border-radius:12px;"><div style="font-size:12px;color:var(--text-secondary);">Expense Ratio</div><div style="font-size:18px;font-weight:700;">${totalRev?((totalExp/totalRev)*100).toFixed(1):0}%</div></div>
        </div>
    `;
}

// ==================== SETTINGS ====================
function saveSettings() {
    DB.settings.name = document.getElementById('setBizName').value;
    DB.settings.phone = document.getElementById('setBizPhone').value;
    DB.settings.email = document.getElementById('setBizEmail').value;
    DB.settings.pin = document.getElementById('setBizPIN').value;
    DB.settings.address = document.getElementById('setBizAddr').value;
    DB.settings.currency = document.getElementById('setBizCurrency').value.split(' - ')[0];
    DB.settings.timezone = document.getElementById('setBizTZ').value;
    DB.settings.taxRate = parseFloat(document.getElementById('setTaxRate').value)||16;
    DB.settings.taxName = document.getElementById('setTaxName').value||'VAT';
    DB.settings.receiptMsg = document.getElementById('setReceiptMsg').value;
    saveDB();
    showToast('Settings saved successfully','success');
}

function loadSettingsToForm() {
    document.getElementById('setBizName').value = DB.settings.name||'';
    document.getElementById('setBizPhone').value = DB.settings.phone||'';
    document.getElementById('setBizEmail').value = DB.settings.email||'';
    document.getElementById('setBizPIN').value = DB.settings.pin||'';
    document.getElementById('setBizAddr').value = DB.settings.address||'';
    document.getElementById('setTaxRate').value = DB.settings.taxRate||16;
    document.getElementById('setTaxName').value = DB.settings.taxName||'VAT';
    document.getElementById('setReceiptMsg').value = DB.settings.receiptMsg||'';
}

// ==================== EXPORT ====================
function exportData(type) {
    let data, filename;
    if(type==='sales') { data=DB.sales; filename='olutajr_sales.json'; }
    else if(type==='products') { data=DB.products; filename='olutajr_products.json'; }
    else if(type==='finance') { data={sales:DB.sales,expenses:DB.expenses,customers:DB.customers,products:DB.products}; filename='olutajr_finance.json'; }
    else { data={sales:DB.sales,products:DB.products,customers:DB.customers,expenses:DB.expenses}; filename='olutajr_report.json'; }
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');a.href=url;a.download=filename;a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully','success');
}

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown',function(e){
    if(e.ctrlKey&&e.key==='k'){e.preventDefault();const s=document.querySelector('.topbar-search input');if(s)s.focus();}
    if(e.key==='Escape') document.querySelectorAll('.modal-overlay.active').forEach(m=>m.classList.remove('active'));
});

// ==================== INIT MODAL FORM RESETS ====================
// Reset add product modal when opening
const origOpenModal = openModal;
openModal = function(id) {
    if(id==='addProductModal' && !document.getElementById('editProductId').value) {
        openAddProductModal();
    }
    if(id==='addCustomerModal' && !document.getElementById('editCustId').value) {
        document.getElementById('customerModalTitle').textContent='Add Customer';
        ['cFirst','cLast','cEmail','cPhone','cAddress'].forEach(x=>document.getElementById(x).value='');
    }
    if(id==='addUserModal' && !document.getElementById('editUserId').value) {
        openAddUserModal();
    }
    if(id==='addExpenseModal') {
        document.getElementById('expDate').value = new Date().toISOString().split('T')[0];
    }
    if(id==='addStockModal') {
        populateStockProductDD();
    }
    origOpenModal(id);
};

// ==================== ON LOAD ====================
loadDB();
// Set initial PM button style
document.addEventListener('DOMContentLoaded',function(){
    const fb = document.querySelector('.pm-btn.active');
    if(fb){fb.style.background='var(--primary)';fb.style.color='#fff';fb.style.borderColor='var(--primary)';}
    loadSettingsToForm();
});

