/**
 * Script de Proteção Global para Páginas Administrativas
 * Deve ser incluído antes de qualquer outro script em páginas admin
 */

(function() {
    'use strict';
    
    // Verificar se já foi inicializado
    if (window.adminProtectionLoaded) {
        return;
    }
    window.adminProtectionLoaded = true;
    
    console.log('🛡️ Inicializando proteção administrativa...');
    
    // Aguardar DOM e serviços de autenticação
    document.addEventListener('DOMContentLoaded', function() {
        initializeAdminProtection();
    });
    
    /**
     * Inicializar proteção administrativa
     */
    async function initializeAdminProtection() {
        try {
            // Aguardar carregamento do AuthService
            await waitForAuthService();
            
            // Verificar autenticação
            if (!authService.isAuthenticated()) {
                console.log('❌ Usuário não autenticado, redirecionando...');
                redirectToLogin();
                return;
            }
            
            // Verificar permissões baseado na página atual
            const currentPath = window.location.pathname;
            const requiredPermission = getRequiredPermission(currentPath);
            
            if (requiredPermission && !authService.hasPermission(requiredPermission)) {
                console.log(`❌ Usuário sem permissão: ${requiredPermission}`);
                showAccessDenied();
                return;
            }
            
            // Configurar monitoramento de sessão
            setupSessionMonitoring();
            
            // Configurar navbar administrativa
            setupAdminNavbar();
            
            console.log('✅ Proteção administrativa ativa');
            
        } catch (error) {
            console.error('❌ Erro na proteção administrativa:', error);
            redirectToLogin();
        }
    }
    
    /**
     * Aguardar carregamento do AuthService
     */
    function waitForAuthService() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 segundos
            
            const checkAuthService = () => {
                if (typeof window.authService !== 'undefined') {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('AuthService não carregado'));
                } else {
                    attempts++;
                    setTimeout(checkAuthService, 100);
                }
            };
            
            checkAuthService();
        });
    }
    
    /**
     * Obter permissão necessária baseado na página
     */
    function getRequiredPermission(path) {
        const permissionMap = {
            '/admin/dashboard.html': 'view_dashboard',
            '/admin/users.html': 'manage_users',
            '/admin/reports.html': 'view_reports',
            '/admin/settings.html': 'manage_settings',
            '/admin/audit-logs.html': 'view_logs',
            '/index.html': 'view_dashboard' // Dashboard principal
        };
        
        // Verificar correspondência exata
        for (const [route, permission] of Object.entries(permissionMap)) {
            if (path.endsWith(route)) {
                return permission;
            }
        }
        
        // Se está na pasta admin/, exigir pelo menos view_dashboard
        if (path.includes('/admin/')) {
            return 'view_dashboard';
        }
        
        return null;
    }
    
    /**
     * Redirecionar para login
     */
    function redirectToLogin() {
        const currentUrl = window.location.href;
        const loginUrl = getLoginUrl();
        const returnUrl = encodeURIComponent(currentUrl);
        
        window.location.href = `${loginUrl}?return=${returnUrl}`;
    }
    
    /**
     * Obter URL de login baseado na localização atual
     */
    function getLoginUrl() {
        const currentPath = window.location.pathname;
        
        if (currentPath.includes('/admin/')) {
            return '../auth/login.html';
        } else {
            return 'auth/login.html';
        }
    }
    
    /**
     * Mostrar página de acesso negado
     */
    function showAccessDenied() {
        document.body.innerHTML = `
            <div style="
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                font-family: 'Poppins', sans-serif;
                margin: 0;
                padding: 20px;
            ">
                <div style="
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    padding: 50px;
                    text-align: center;
                    max-width: 500px;
                    width: 100%;
                    animation: slideUp 0.6s ease-out;
                ">
                    <div style="
                        width: 80px;
                        height: 80px;
                        background: linear-gradient(135deg, #e74c3c, #c0392b);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0 auto 25px;
                    ">
                        <i class="fas fa-ban" style="color: white; font-size: 36px;"></i>
                    </div>
                    
                    <h1 style="color: #2c3e50; margin-bottom: 15px; font-size: 28px; font-weight: 700;">
                        Acesso Negado
                    </h1>
                    
                    <p style="color: #7f8c8d; margin-bottom: 25px; font-size: 16px; line-height: 1.6;">
                        Você não tem permissão para acessar esta área administrativa.
                    </p>
                    
                    <div style="
                        background: #f8f9fa;
                        border-radius: 10px;
                        padding: 20px;
                        margin-bottom: 30px;
                        text-align: left;
                    ">
                        <h3 style="color: #34495e; margin-bottom: 15px; font-size: 16px;">
                            <i class="fas fa-info-circle"></i> Informações de Acesso
                        </h3>
                        <div style="font-size: 14px; color: #7f8c8d;">
                            <div style="margin-bottom: 8px;">
                                <strong>Usuário:</strong> ${authService?.getCurrentUser()?.username || 'Desconhecido'}
                            </div>
                            <div style="margin-bottom: 8px;">
                                <strong>Role:</strong> ${authService?.getCurrentUser()?.role || 'Não definida'}
                            </div>
                            <div style="margin-bottom: 8px;">
                                <strong>Página:</strong> ${window.location.pathname}
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                        <button onclick="window.history.back()" style="
                            background: #3498db;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                            transition: background 0.3s ease;
                        " onmouseover="this.style.background='#2980b9'" onmouseout="this.style.background='#3498db'">
                            <i class="fas fa-arrow-left"></i> Voltar
                        </button>
                        
                        <button onclick="window.location.href='${getDashboardUrl()}'" style="
                            background: #2ecc71;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                            transition: background 0.3s ease;
                        " onmouseover="this.style.background='#27ae60'" onmouseout="this.style.background='#2ecc71'">
                            <i class="fas fa-home"></i> Dashboard
                        </button>
                        
                        <button onclick="logout()" style="
                            background: #e74c3c;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 600;
                            transition: background 0.3s ease;
                        " onmouseover="this.style.background='#c0392b'" onmouseout="this.style.background='#e74c3c'">
                            <i class="fas fa-sign-out-alt"></i> Sair
                        </button>
                    </div>
                </div>
            </div>
            
            <style>
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            </style>
            
            <script>
                function logout() {
                    if (typeof authService !== 'undefined') {
                        authService.logout();
                    }
                    window.location.href = '${getLoginUrl()}';
                }
            </script>
        `;
    }
    
    /**
     * Obter URL do dashboard
     */
    function getDashboardUrl() {
        const currentPath = window.location.pathname;
        
        if (currentPath.includes('/admin/')) {
            return 'dashboard.html';
        } else {
            return 'admin/dashboard.html';
        }
    }
    
    /**
     * Configurar monitoramento de sessão
     */
    function setupSessionMonitoring() {
        // Verificar sessão a cada minuto
        setInterval(() => {
            if (typeof authService !== 'undefined' && !authService.isAuthenticated()) {
                console.log('⏰ Sessão expirada durante monitoramento');
                redirectToLogin();
            }
        }, 60000);
        
        // Monitorar atividade para renovar sessão
        let lastActivity = Date.now();
        
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => {
                lastActivity = Date.now();
                if (typeof authService !== 'undefined') {
                    authService.updateLastActivity();
                }
            }, { passive: true });
        });
        
        // Aviso de inatividade
        setInterval(() => {
            const inactiveTime = Date.now() - lastActivity;
            const maxInactiveTime = 30 * 60 * 1000; // 30 minutos
            
            if (inactiveTime > maxInactiveTime) {
                if (confirm('Você está inativo há muito tempo. Deseja continuar na sessão?')) {
                    lastActivity = Date.now();
                } else {
                    if (typeof authService !== 'undefined') {
                        authService.logout();
                    }
                    redirectToLogin();
                }
            }
        }, 5 * 60 * 1000); // Verificar a cada 5 minutos
    }
    
    /**
     * Configurar navbar administrativa
     */
    function setupAdminNavbar() {
        // Aguardar navbar estar disponível
        setTimeout(() => {
            const navbar = document.querySelector('.navbar');
            if (navbar && typeof authService !== 'undefined') {
                const user = authService.getCurrentUser();
                if (user) {
                    // Adicionar indicador de usuário logado se não existir
                    const existingUserInfo = navbar.querySelector('.user-info');
                    if (!existingUserInfo) {
                        addUserInfoToNavbar(navbar, user);
                    }
                }
            }
        }, 1000);
    }
    
    /**
     * Adicionar informações do usuário à navbar
     */
    function addUserInfoToNavbar(navbar, user) {
        const navContainer = navbar.querySelector('.nav-container');
        if (navContainer) {
            const userInfo = document.createElement('div');
            userInfo.className = 'user-info';
            userInfo.innerHTML = `
                <div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <div class="user-name">${user.username}</div>
                    <div class="user-role">${user.role.replace('_', ' ').toUpperCase()}</div>
                </div>
                <button class="logout-btn" onclick="handleAdminLogout()">
                    <i class="fas fa-sign-out-alt"></i> Sair
                </button>
            `;
            
            navContainer.appendChild(userInfo);
            
            // Adicionar estilos se não existirem
            if (!document.getElementById('admin-protection-styles')) {
                const styles = document.createElement('style');
                styles.id = 'admin-protection-styles';
                styles.textContent = `
                    .user-info {
                        display: flex;
                        align-items: center;
                        gap: 15px;
                        padding: 0 20px;
                    }
                    
                    .user-avatar {
                        width: 40px;
                        height: 40px;
                        background: linear-gradient(135deg, #3498db, #2980b9);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: 600;
                        font-size: 16px;
                    }
                    
                    .user-details {
                        color: #ecf0f1;
                    }
                    
                    .user-name {
                        font-weight: 600;
                        font-size: 14px;
                    }
                    
                    .user-role {
                        font-size: 12px;
                        color: #bdc3c7;
                    }
                    
                    .logout-btn {
                        background: #e74c3c;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        transition: background 0.3s ease;
                    }
                    
                    .logout-btn:hover {
                        background: #c0392b;
                    }
                `;
                document.head.appendChild(styles);
            }
        }
    }
    
    /**
     * Função global de logout para navbar
     */
    window.handleAdminLogout = function() {
        if (confirm('Deseja realmente sair do sistema?')) {
            if (typeof authService !== 'undefined') {
                authService.logout();
            }
            redirectToLogin();
        }
    };
    
    // Interceptar tentativas de acessar o console em produção
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        const originalLog = console.log;
        console.log = function(...args) {
            // Permitir apenas logs do sistema de autenticação
            if (args[0] && typeof args[0] === 'string' && 
                (args[0].includes('🛡️') || args[0].includes('✅') || args[0].includes('❌'))) {
                originalLog.apply(console, args);
            }
        };
    }
    
})();