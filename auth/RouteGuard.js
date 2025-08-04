/**
 * Middleware de Proteção de Rotas Administrativas
 * Controla acesso às áreas administrativas baseado em autenticação e permissões
 */

class RouteGuard {
    constructor(authService) {
        this.authService = authService;
        this.protectedRoutes = new Map();
        this.publicRoutes = new Set();
        
        // Configurar rotas protegidas por padrão
        this.setupDefaultRoutes();
        
        // Monitorar mudanças de rota
        this.setupRouteMonitoring();
    }
    
    /**
     * Configurar rotas padrão do sistema
     */
    setupDefaultRoutes() {
        // Rotas administrativas protegidas
        this.protectRoute('/admin/', ['all']); // Qualquer área admin
        this.protectRoute('/admin/dashboard.html', ['view_dashboard']);
        this.protectRoute('/admin/users.html', ['manage_users']);
        this.protectRoute('/admin/reports.html', ['view_reports']);
        this.protectRoute('/admin/settings.html', ['manage_settings']);
        this.protectRoute('/index.html', ['view_dashboard']); // Dashboard principal
        
        // Rotas públicas (acessíveis sem autenticação)
        this.allowPublicRoute('/pages/cadastro-clientes.html');
        this.allowPublicRoute('/pages/participar.html');
        this.allowPublicRoute('/pages/ranking.html');
        this.allowPublicRoute('/auth/login.html');
        this.allowPublicRoute('/client/');
    }
    
    /**
     * Proteger uma rota específica
     */
    protectRoute(route, requiredPermissions = []) {
        this.protectedRoutes.set(route, {
            permissions: requiredPermissions,
            roles: [],
            middleware: []
        });
    }
    
    /**
     * Proteger rota com roles específicas
     */
    protectRouteWithRoles(route, requiredRoles = []) {
        const existing = this.protectedRoutes.get(route) || { permissions: [], middleware: [] };
        existing.roles = requiredRoles;
        this.protectedRoutes.set(route, existing);
    }
    
    /**
     * Adicionar middleware customizado a uma rota
     */
    addRouteMiddleware(route, middleware) {
        const existing = this.protectedRoutes.get(route) || { permissions: [], roles: [] };
        existing.middleware = existing.middleware || [];
        existing.middleware.push(middleware);
        this.protectedRoutes.set(route, existing);
    }
    
    /**
     * Permitir acesso público a uma rota
     */
    allowPublicRoute(route) {
        this.publicRoutes.add(route);
    }
    
    /**
     * Verificar se rota é protegida
     */
    isProtectedRoute(path) {
        // Verificar rotas exatas
        if (this.protectedRoutes.has(path)) {
            return true;
        }
        
        // Verificar padrões (ex: /admin/)
        for (const [route] of this.protectedRoutes) {
            if (route.endsWith('/') && path.startsWith(route)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Verificar se rota é pública
     */
    isPublicRoute(path) {
        // Verificar rotas exatas
        if (this.publicRoutes.has(path)) {
            return true;
        }
        
        // Verificar padrões
        for (const route of this.publicRoutes) {
            if (route.endsWith('/') && path.startsWith(route)) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Obter configuração de uma rota protegida
     */
    getRouteConfig(path) {
        // Verificar rota exata
        if (this.protectedRoutes.has(path)) {
            return this.protectedRoutes.get(path);
        }
        
        // Verificar padrões
        for (const [route, config] of this.protectedRoutes) {
            if (route.endsWith('/') && path.startsWith(route)) {
                return config;
            }
        }
        
        return null;
    }
    
    /**
     * Validar acesso a uma rota
     */
    async validateAccess(path, options = {}) {
        try {
            const normalizedPath = this.normalizePath(path);
            
            // Log da tentativa de acesso
            console.log(`🔍 Verificando acesso à rota: ${normalizedPath}`);
            
            // Verificar se é rota pública
            if (this.isPublicRoute(normalizedPath)) {
                console.log('✅ Rota pública, acesso permitido');
                return { allowed: true, reason: 'public_route' };
            }
            
            // Verificar se é rota protegida
            if (!this.isProtectedRoute(normalizedPath)) {
                console.log('✅ Rota não protegida, acesso permitido');
                return { allowed: true, reason: 'unprotected_route' };
            }
            
            // Verificar autenticação
            if (!this.authService.isAuthenticated()) {
                console.log('❌ Usuário não autenticado');
                return { 
                    allowed: false, 
                    reason: 'not_authenticated',
                    redirectTo: `/auth/login.html?return=${encodeURIComponent(path)}`
                };
            }
            
            // Obter configuração da rota
            const routeConfig = this.getRouteConfig(normalizedPath);
            if (!routeConfig) {
                console.log('⚠️ Configuração de rota não encontrada');
                return { allowed: true, reason: 'no_config' };
            }
            
            // Verificar permissões
            if (routeConfig.permissions && routeConfig.permissions.length > 0) {
                const hasPermission = routeConfig.permissions.some(permission => 
                    this.authService.hasPermission(permission)
                );
                
                if (!hasPermission) {
                    console.log(`❌ Usuário sem permissão: ${routeConfig.permissions.join(', ')}`);
                    return { 
                        allowed: false, 
                        reason: 'insufficient_permissions',
                        requiredPermissions: routeConfig.permissions
                    };
                }
            }
            
            // Verificar roles
            if (routeConfig.roles && routeConfig.roles.length > 0) {
                const hasRole = routeConfig.roles.some(role => 
                    this.authService.hasRole(role)
                );
                
                if (!hasRole) {
                    console.log(`❌ Usuário sem role: ${routeConfig.roles.join(', ')}`);
                    return { 
                        allowed: false, 
                        reason: 'insufficient_roles',
                        requiredRoles: routeConfig.roles
                    };
                }
            }
            
            // Executar middlewares customizados
            if (routeConfig.middleware && routeConfig.middleware.length > 0) {
                for (const middleware of routeConfig.middleware) {
                    const result = await middleware(path, this.authService.getCurrentUser());
                    if (!result.allowed) {
                        console.log(`❌ Middleware rejeitou acesso: ${result.reason}`);
                        return result;
                    }
                }
            }
            
            console.log('✅ Acesso autorizado');
            return { allowed: true, reason: 'authorized' };
            
        } catch (error) {
            console.error('❌ Erro ao validar acesso:', error);
            return { 
                allowed: false, 
                reason: 'validation_error',
                error: error.message
            };
        }
    }
    
    /**
     * Normalizar caminho da URL
     */
    normalizePath(path) {
        // Remover query string e hash
        let normalizedPath = path.split('?')[0].split('#')[0];
        
        // Adicionar barra inicial se não existir
        if (!normalizedPath.startsWith('/')) {
            normalizedPath = '/' + normalizedPath;
        }
        
        return normalizedPath;
    }
    
    /**
     * Configurar monitoramento de rotas
     */
    setupRouteMonitoring() {
        // Interceptar navegação
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = (...args) => {
            originalPushState.apply(history, args);
            this.checkCurrentRoute();
        };
        
        history.replaceState = (...args) => {
            originalReplaceState.apply(history, args);
            this.checkCurrentRoute();
        };
        
        // Monitorar mudanças de hash e popstate
        window.addEventListener('popstate', () => {
            this.checkCurrentRoute();
        });
        
        window.addEventListener('hashchange', () => {
            this.checkCurrentRoute();
        });
        
        // Verificar rota inicial
        document.addEventListener('DOMContentLoaded', () => {
            this.checkCurrentRoute();
        });
    }
    
    /**
     * Verificar rota atual
     */
    async checkCurrentRoute() {
        const currentPath = window.location.pathname;
        const result = await this.validateAccess(currentPath);
        
        if (!result.allowed) {
            this.handleUnauthorizedAccess(result);
        }
    }
    
    /**
     * Lidar com acesso não autorizado
     */
    handleUnauthorizedAccess(result) {
        switch (result.reason) {
            case 'not_authenticated':
                console.log('🔒 Redirecionando para login...');
                window.location.href = result.redirectTo;
                break;
                
            case 'insufficient_permissions':
            case 'insufficient_roles':
                console.log('🚫 Mostrando página de acesso negado...');
                this.showAccessDeniedPage(result);
                break;
                
            default:
                console.log('❌ Erro de autorização:', result.reason);
                this.showErrorPage(result);
                break;
        }
    }
    
    /**
     * Mostrar página de acesso negado
     */
    showAccessDeniedPage(result) {
        const user = this.authService.getCurrentUser();
        
        document.body.innerHTML = `
            <div style="
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                font-family: 'Poppins', sans-serif;
            ">
                <div style="
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    padding: 50px;
                    text-align: center;
                    max-width: 500px;
                    margin: 20px;
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
                    
                    <h1 style="color: #2c3e50; margin-bottom: 15px; font-size: 28px;">
                        Acesso Negado
                    </h1>
                    
                    <p style="color: #7f8c8d; margin-bottom: 25px; font-size: 16px; line-height: 1.6;">
                        Você não tem permissão para acessar esta área do sistema.
                    </p>
                    
                    <div style="
                        background: #f8f9fa;
                        border-radius: 10px;
                        padding: 20px;
                        margin-bottom: 30px;
                    ">
                        <h3 style="color: #34495e; margin-bottom: 15px; font-size: 16px;">
                            Detalhes do Acesso
                        </h3>
                        <div style="font-size: 14px; color: #7f8c8d;">
                            <div style="margin-bottom: 8px;">
                                <strong>Usuário:</strong> ${user?.username || 'Desconhecido'}
                            </div>
                            <div style="margin-bottom: 8px;">
                                <strong>Role:</strong> ${user?.role || 'Não definida'}
                            </div>
                            ${result.requiredPermissions ? `
                                <div style="margin-bottom: 8px;">
                                    <strong>Permissões necessárias:</strong> ${result.requiredPermissions.join(', ')}
                                </div>
                            ` : ''}
                            ${result.requiredRoles ? `
                                <div style="margin-bottom: 8px;">
                                    <strong>Roles necessárias:</strong> ${result.requiredRoles.join(', ')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button onclick="window.history.back()" style="
                            background: #3498db;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                        ">
                            <i class="fas fa-arrow-left"></i> Voltar
                        </button>
                        
                        <button onclick="window.location.href='/admin/dashboard.html'" style="
                            background: #2ecc71;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                        ">
                            <i class="fas fa-home"></i> Dashboard
                        </button>
                        
                        <button onclick="authService.logout(); window.location.href='/auth/login.html'" style="
                            background: #e74c3c;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-size: 14px;
                            font-weight: 500;
                        ">
                            <i class="fas fa-sign-out-alt"></i> Sair
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Mostrar página de erro
     */
    showErrorPage(result) {
        document.body.innerHTML = `
            <div style="
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f8f9fa;
                font-family: Arial, sans-serif;
            ">
                <div style="
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    padding: 40px;
                    text-align: center;
                    max-width: 400px;
                ">
                    <i class="fas fa-exclamation-triangle" style="
                        font-size: 48px; 
                        color: #f39c12; 
                        margin-bottom: 20px;
                    "></i>
                    <h2 style="color: #2c3e50; margin-bottom: 10px;">Erro de Acesso</h2>
                    <p style="color: #7f8c8d; margin-bottom: 30px;">
                        Ocorreu um erro ao verificar suas permissões.
                    </p>
                    <p style="color: #95a5a6; font-size: 12px; margin-bottom: 20px;">
                        ${result.error || result.reason}
                    </p>
                    <button onclick="window.location.href='/auth/login.html'" style="
                        background: #3498db;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 5px;
                        cursor: pointer;
                    ">
                        Fazer Login
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Verificar acesso programaticamente
     */
    async canAccess(path, options = {}) {
        const result = await this.validateAccess(path, options);
        return result.allowed;
    }
    
    /**
     * Obter informações de acesso para uma rota
     */
    async getAccessInfo(path) {
        return await this.validateAccess(path);
    }
}

// Instância global do guard de rotas
if (typeof window !== 'undefined' && typeof window.authService !== 'undefined') {
    window.routeGuard = new RouteGuard(window.authService);
}

// Exportar para uso em módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RouteGuard;
}