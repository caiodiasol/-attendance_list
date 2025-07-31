/**
 * Sistema de Autenticação para ClientKey
 * Gerencia autenticação de administradores com roles e permissões
 */

class AuthService {
    constructor() {
        this.STORAGE_KEY = 'clientkey_auth_session';
        this.ADMIN_USERS_KEY = 'clientkey_admin_users';
        this.SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 horas
        this.currentUser = null;
        this.sessionTimer = null;
        
        // Inicializar usuários padrão se não existirem
        this.initializeDefaultUsers();
        
        // Carregar sessão existente
        this.loadCurrentSession();
        
        // Configurar auto-logout
        this.setupSessionMonitoring();
    }
    
    /**
     * Inicializar usuários administradores padrão
     */
    initializeDefaultUsers() {
        const existingUsers = localStorage.getItem(this.ADMIN_USERS_KEY);
        if (!existingUsers) {
            const defaultUsers = [
                {
                    id: 'admin_001',
                    username: 'admin',
                    email: 'admin@clientkey.com',
                    password: this.hashPassword('admin123'), // Senha padrão: admin123
                    role: 'super_admin',
                    permissions: ['all'],
                    createdAt: new Date().toISOString(),
                    lastLogin: null,
                    active: true
                },
                {
                    id: 'admin_002',
                    username: 'moderador',
                    email: 'mod@clientkey.com',
                    password: this.hashPassword('mod123'), // Senha padrão: mod123
                    role: 'moderator',
                    permissions: ['view_clients', 'manage_keywords', 'view_reports'],
                    createdAt: new Date().toISOString(),
                    lastLogin: null,
                    active: true
                }
            ];
            
            localStorage.setItem(this.ADMIN_USERS_KEY, JSON.stringify(defaultUsers));
            console.log('✅ Usuários administradores padrão criados');
        }
    }
    
    /**
     * Hash simples para senhas (em produção, use bcrypt ou similar)
     */
    hashPassword(password) {
        // Implementação básica - em produção usar biblioteca robusta
        let hash = 0;
        const salt = 'clientkey_salt_2024';
        const combined = password + salt;
        
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return 'ck_' + Math.abs(hash).toString(36);
    }
    
    /**
     * Autenticar usuário
     */
    async login(credentials) {
        try {
            const { username, password } = credentials;
            
            if (!username || !password) {
                throw new Error('Usuário e senha são obrigatórios');
            }
            
            const users = this.getAdminUsers();
            const hashedPassword = this.hashPassword(password);
            
            const user = users.find(u => 
                (u.username === username || u.email === username) && 
                u.password === hashedPassword &&
                u.active
            );
            
            if (!user) {
                // Log da tentativa de login inválida
                this.logActivity('login_failed', { username, ip: this.getClientIP() });
                throw new Error('Credenciais inválidas');
            }
            
            // Atualizar último login
            user.lastLogin = new Date().toISOString();
            this.updateAdminUser(user);
            
            // Criar sessão
            const session = {
                userId: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                permissions: user.permissions,
                loginTime: new Date().toISOString(),
                expiresAt: new Date(Date.now() + this.SESSION_TIMEOUT).toISOString(),
                sessionToken: this.generateSessionToken()
            };
            
            // Salvar sessão
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
            this.currentUser = session;
            
            // Log da atividade
            this.logActivity('login_success', { 
                userId: user.id, 
                username: user.username,
                role: user.role,
                ip: this.getClientIP()
            });
            
            // Configurar timer de expiração
            this.setupSessionTimer();
            
            console.log('✅ Login realizado com sucesso:', user.username);
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    permissions: user.permissions
                },
                sessionToken: session.sessionToken
            };
            
        } catch (error) {
            console.error('❌ Erro no login:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Logout do usuário
     */
    logout() {
        try {
            if (this.currentUser) {
                // Log da atividade
                this.logActivity('logout', { 
                    userId: this.currentUser.userId,
                    username: this.currentUser.username,
                    sessionDuration: Date.now() - new Date(this.currentUser.loginTime).getTime()
                });
            }
            
            // Limpar sessão
            localStorage.removeItem(this.STORAGE_KEY);
            this.currentUser = null;
            
            // Limpar timer
            if (this.sessionTimer) {
                clearTimeout(this.sessionTimer);
                this.sessionTimer = null;
            }
            
            console.log('✅ Logout realizado com sucesso');
            return true;
            
        } catch (error) {
            console.error('❌ Erro no logout:', error);
            return false;
        }
    }
    
    /**
     * Verificar se usuário está autenticado
     */
    isAuthenticated() {
        if (!this.currentUser) {
            return false;
        }
        
        const now = new Date();
        const expiresAt = new Date(this.currentUser.expiresAt);
        
        if (now >= expiresAt) {
            console.log('⏰ Sessão expirada');
            this.logout();
            return false;
        }
        
        return true;
    }
    
    /**
     * Obter usuário atual
     */
    getCurrentUser() {
        return this.isAuthenticated() ? this.currentUser : null;
    }
    
    /**
     * Verificar permissão específica
     */
    hasPermission(permission) {
        if (!this.isAuthenticated()) {
            return false;
        }
        
        const user = this.getCurrentUser();
        
        // Super admin tem todas as permissões
        if (user.role === 'super_admin' || user.permissions.includes('all')) {
            return true;
        }
        
        return user.permissions.includes(permission);
    }
    
    /**
     * Verificar role específica
     */
    hasRole(role) {
        if (!this.isAuthenticated()) {
            return false;
        }
        
        return this.getCurrentUser().role === role;
    }
    
    /**
     * Carregar sessão existente
     */
    loadCurrentSession() {
        try {
            const savedSession = localStorage.getItem(this.STORAGE_KEY);
            if (savedSession) {
                const session = JSON.parse(savedSession);
                
                // Verificar se sessão ainda é válida
                const now = new Date();
                const expiresAt = new Date(session.expiresAt);
                
                if (now < expiresAt) {
                    this.currentUser = session;
                    this.setupSessionTimer();
                    console.log('✅ Sessão carregada:', session.username);
                } else {
                    console.log('⏰ Sessão expirada, removendo...');
                    localStorage.removeItem(this.STORAGE_KEY);
                }
            }
        } catch (error) {
            console.error('❌ Erro ao carregar sessão:', error);
            localStorage.removeItem(this.STORAGE_KEY);
        }
    }
    
    /**
     * Configurar monitoramento de sessão
     */
    setupSessionMonitoring() {
        // Verificar sessão a cada minuto
        setInterval(() => {
            if (this.currentUser && !this.isAuthenticated()) {
                this.redirectToLogin();
            }
        }, 60000);
        
        // Monitorar atividade do usuário
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, () => {
                this.updateLastActivity();
            }, { passive: true });
        });
    }
    
    /**
     * Configurar timer de expiração da sessão
     */
    setupSessionTimer() {
        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer);
        }
        
        if (this.currentUser) {
            const expiresAt = new Date(this.currentUser.expiresAt);
            const timeUntilExpiry = expiresAt.getTime() - Date.now();
            
            if (timeUntilExpiry > 0) {
                this.sessionTimer = setTimeout(() => {
                    console.log('⏰ Sessão expirou automaticamente');
                    this.logout();
                    this.redirectToLogin();
                }, timeUntilExpiry);
            }
        }
    }
    
    /**
     * Atualizar última atividade
     */
    updateLastActivity() {
        if (this.currentUser) {
            this.currentUser.lastActivity = new Date().toISOString();
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.currentUser));
        }
    }
    
    /**
     * Redirecionar para login
     */
    redirectToLogin() {
        const currentPath = window.location.pathname;
        
        // Não redirecionar se já estiver na página de login
        if (!currentPath.includes('login.html')) {
            const loginUrl = '/auth/login.html';
            const returnUrl = encodeURIComponent(window.location.href);
            window.location.href = `${loginUrl}?return=${returnUrl}`;
        }
    }
    
    /**
     * Gerar token de sessão
     */
    generateSessionToken() {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substr(2, 9);
        return `ck_${timestamp}_${random}`;
    }
    
    /**
     * Obter IP do cliente (simulado)
     */
    getClientIP() {
        return '127.0.0.1'; // Em produção, obter IP real
    }
    
    /**
     * Obter usuários administradores
     */
    getAdminUsers() {
        const users = localStorage.getItem(this.ADMIN_USERS_KEY);
        return users ? JSON.parse(users) : [];
    }
    
    /**
     * Atualizar usuário administrador
     */
    updateAdminUser(updatedUser) {
        const users = this.getAdminUsers();
        const index = users.findIndex(u => u.id === updatedUser.id);
        
        if (index !== -1) {
            users[index] = { ...users[index], ...updatedUser };
            localStorage.setItem(this.ADMIN_USERS_KEY, JSON.stringify(users));
        }
    }
    
    /**
     * Log de atividades administrativas
     */
    logActivity(action, details = {}) {
        try {
            const ACTIVITY_LOG_KEY = 'clientkey_admin_activity_log';
            const logs = JSON.parse(localStorage.getItem(ACTIVITY_LOG_KEY) || '[]');
            
            const logEntry = {
                id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                action,
                details,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            };
            
            logs.unshift(logEntry);
            
            // Manter apenas os últimos 1000 logs
            if (logs.length > 1000) {
                logs.splice(1000);
            }
            
            localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(logs));
            
        } catch (error) {
            console.error('❌ Erro ao logar atividade:', error);
        }
    }
    
    /**
     * Obter logs de atividade
     */
    getActivityLogs(options = {}) {
        try {
            const ACTIVITY_LOG_KEY = 'clientkey_admin_activity_log';
            let logs = JSON.parse(localStorage.getItem(ACTIVITY_LOG_KEY) || '[]');
            
            // Filtros
            if (options.userId) {
                logs = logs.filter(log => log.details.userId === options.userId);
            }
            
            if (options.action) {
                logs = logs.filter(log => log.action === options.action);
            }
            
            if (options.fromDate) {
                const fromDate = new Date(options.fromDate);
                logs = logs.filter(log => new Date(log.timestamp) >= fromDate);
            }
            
            if (options.toDate) {
                const toDate = new Date(options.toDate);
                logs = logs.filter(log => new Date(log.timestamp) <= toDate);
            }
            
            // Limitar resultados
            if (options.limit) {
                logs = logs.slice(0, options.limit);
            }
            
            return logs;
            
        } catch (error) {
            console.error('❌ Erro ao obter logs:', error);
            return [];
        }
    }
    
    /**
     * Validar acesso a rota administrativa
     */
    validateAdminRoute(requiredPermission = null) {
        if (!this.isAuthenticated()) {
            console.log('❌ Usuário não autenticado, redirecionando...');
            this.redirectToLogin();
            return false;
        }
        
        if (requiredPermission && !this.hasPermission(requiredPermission)) {
            console.log(`❌ Usuário sem permissão: ${requiredPermission}`);
            this.showAccessDenied();
            return false;
        }
        
        return true;
    }
    
    /**
     * Mostrar página de acesso negado
     */
    showAccessDenied() {
        document.body.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 100vh;
                font-family: Arial, sans-serif;
                background: #f5f5f5;
            ">
                <div style="
                    background: white;
                    padding: 40px;
                    border-radius: 10px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    text-align: center;
                    max-width: 400px;
                ">
                    <i class="fas fa-ban" style="font-size: 48px; color: #e74c3c; margin-bottom: 20px;"></i>
                    <h2 style="color: #2c3e50; margin-bottom: 10px;">Acesso Negado</h2>
                    <p style="color: #7f8c8d; margin-bottom: 30px;">
                        Você não tem permissão para acessar esta área.
                    </p>
                    <button onclick="window.history.back()" style="
                        background: #3498db;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 5px;
                        cursor: pointer;
                        margin-right: 10px;
                    ">
                        Voltar
                    </button>
                    <button onclick="authService.logout(); window.location.href='/auth/login.html'" style="
                        background: #e74c3c;
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
}

// Instância global do serviço de autenticação
window.authService = new AuthService();

// Exportar para uso em módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthService;
}