// Database Service
// Serviço principal que substitui o firebase-config.js com persistência em banco de dados

class DatabaseService {
    constructor() {
        this.dbConnection = null;
        this.clientModel = null;
        this.activityModel = null;
        this.keywordModel = null;
        this.userAttemptsModel = null;
        this.awardModel = null;
        this.initialized = false;
        
        // Cache para melhor performance
        this.cache = {
            clients: null,
            currentKeywords: null,
            cacheTime: 0,
            cacheTTL: 30000 // 30 segundos
        };
    }
    
    // Inicializar serviço
    async initialize() {
        try {
            console.log('Inicializando DatabaseService...');
            
            // Verificar se estamos no browser ou servidor
            const isBrowser = typeof window !== 'undefined';
            
            if (isBrowser) {
                // Browser: usar connection.js global
                if (typeof window.dbConnection === 'undefined') {
                    console.error('dbConnection não encontrado. Certifique-se de incluir database/connection.js');
                    return false;
                }
                
                this.dbConnection = window.dbConnection;
                
                // Importar modelos (assumindo que estão carregados globalmente)
                this.clientModel = new window.Client(this.dbConnection);
                this.activityModel = new window.Activity(this.dbConnection);
                this.keywordModel = new window.Keyword(this.dbConnection);
                this.userAttemptsModel = new window.UserAttempts(this.dbConnection);
                this.awardModel = new window.Award(this.dbConnection);
            } else {
                // Servidor Node.js
                const dbConnection = require('../connection');
                const Client = require('../models/Client');
                const Activity = require('../models/Activity');
                const Keyword = require('../models/Keyword');
                const UserAttempts = require('../models/UserAttempts');
                const Award = require('../models/Award');
                
                this.dbConnection = dbConnection;
                this.clientModel = new Client(this.dbConnection);
                this.activityModel = new Activity(this.dbConnection);
                this.keywordModel = new Keyword(this.dbConnection);
                this.userAttemptsModel = new UserAttempts(this.dbConnection);
                this.awardModel = new Award(this.dbConnection);
            }
            
            // Inicializar conexão com banco
            await this.dbConnection.initialize();
            
            this.initialized = true;
            console.log('✅ DatabaseService inicializado com sucesso');
            console.log(`🔧 Provider: ${this.dbConnection.getProvider()}`);
            
            // Inicializar pool de palavras-chave em background
            setTimeout(() => {
                this.initializeWordPool();
            }, 2000);
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao inicializar DatabaseService:', error);
            return false;
        }
    }
    
    // Verificar se está disponível
    isAvailable() {
        return this.initialized && this.dbConnection && this.dbConnection.isInitialized();
    }
    
    // === MÉTODOS DE CLIENTES ===
    
    async addClient(clientData) {
        try {
            console.log('Adicionando cliente:', clientData);
            
            if (!this.isAvailable()) {
                throw new Error('Serviço de banco de dados não disponível');
            }
            
            const result = await this.clientModel.create(clientData);
            
            if (result.success) {
                // Invalidar cache
                this.invalidateCache();
                
                // Registrar atividade
                await this.addActivity({
                    client_id: result.data.id,
                    client_name: result.data.name,
                    client_email: result.data.email,
                    activity_type: 'registration',
                    points: 0,
                    details: { source: 'web_form' }
                });
                
                console.log('Cliente adicionado com sucesso:', result.data.id);
                return result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro ao adicionar cliente:', error);
            throw error;
        }
    }
    
    async getClients() {
        try {
            console.log('Carregando clientes...');
            
            if (!this.isAvailable()) {
                console.log('Banco não disponível, usando cache/localStorage');
                return this.getClientsFromStorage();
            }
            
            // Verificar cache
            if (this.isCacheValid() && this.cache.clients) {
                console.log('Retornando clientes do cache');
                return this.cache.clients;
            }
            
            const result = await this.clientModel.findAll();
            
            if (result.success) {
                // Atualizar cache
                this.cache.clients = result.data;
                this.cache.cacheTime = Date.now();
                
                console.log(`Clientes carregados: ${result.data.length}`);
                return result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            // Fallback para localStorage
            console.log('Fallback: usando localStorage');
            return this.getClientsFromStorage();
        }
    }
    
    async updateClient(clientId, clientData) {
        try {
            console.log('Atualizando cliente:', clientId);
            
            if (!this.isAvailable()) {
                throw new Error('Serviço de banco de dados não disponível');
            }
            
            const result = await this.clientModel.update(clientId, clientData);
            
            if (result.success) {
                // Invalidar cache
                this.invalidateCache();
                
                console.log('Cliente atualizado com sucesso');
                return true;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro ao atualizar cliente:', error);
            throw error;
        }
    }
    
    async deleteClient(clientId) {
        try {
            console.log('Deletando cliente:', clientId);
            
            if (!this.isAvailable()) {
                throw new Error('Serviço de banco de dados não disponível');
            }
            
            const result = await this.clientModel.delete(clientId);
            
            if (result.success) {
                // Invalidar cache
                this.invalidateCache();
                
                console.log('Cliente deletado com sucesso');
                return true;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro ao deletar cliente:', error);
            throw error;
        }
    }
    
    async findClientByEmailOrName(searchTerm) {
        try {
            console.log('Buscando cliente por:', searchTerm);
            
            if (!this.isAvailable()) {
                console.log('Banco não disponível, buscando no localStorage');
                const clients = this.getClientsFromStorage();
                return this.searchClientInArray(clients, searchTerm);
            }
            
            const result = await this.clientModel.findByEmailOrName(searchTerm);
            
            if (result.success) {
                console.log('Cliente encontrado:', result.data ? result.data.name : 'Nenhum');
                return result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro ao buscar cliente:', error);
            // Fallback para localStorage
            const clients = this.getClientsFromStorage();
            return this.searchClientInArray(clients, searchTerm);
        }
    }
    
    // === MÉTODOS DE ATIVIDADES ===
    
    async addActivity(activityData) {
        try {
            console.log('Adicionando atividade:', activityData);
            
            if (!this.isAvailable()) {
                console.log('Banco não disponível, usando localStorage para atividade');
                return this.addActivityToStorage(activityData);
            }
            
            const result = await this.activityModel.create(activityData);
            
            if (result.success) {
                console.log('Atividade adicionada com sucesso');
                return result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro ao adicionar atividade:', error);
            // Fallback para localStorage
            return this.addActivityToStorage(activityData);
        }
    }
    
    async getClientActivities(clientId) {
        try {
            console.log('Carregando atividades do cliente:', clientId);
            
            if (!this.isAvailable()) {
                return this.getClientActivitiesFromStorage(clientId);
            }
            
            const result = await this.activityModel.findByClientId(clientId);
            
            if (result.success) {
                console.log(`Atividades do cliente carregadas: ${result.data.length}`);
                return result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro ao carregar atividades do cliente:', error);
            return this.getClientActivitiesFromStorage(clientId);
        }
    }
    
    async getAllActivities(limitCount = 50) {
        try {
            console.log('Carregando todas as atividades...');
            
            if (!this.isAvailable()) {
                return this.getAllActivitiesFromStorage(limitCount);
            }
            
            const result = await this.activityModel.findAll(limitCount);
            
            if (result.success) {
                console.log(`Total de atividades carregadas: ${result.data.length}`);
                return result.data;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro ao carregar atividades:', error);
            return this.getAllActivitiesFromStorage(limitCount);
        }
    }
    
    async clearAllActivities() {
        try {
            console.log('Limpando todas as atividades...');
            
            if (!this.isAvailable()) {
                return this.clearAllActivitiesFromStorage();
            }
            
            const result = await this.activityModel.clearAll();
            
            if (result.success) {
                // Também resetar status de premiação
                await this.resetAwardStatus();
                
                console.log('Todas as atividades foram limpas');
                return true;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro ao limpar atividades:', error);
            return this.clearAllActivitiesFromStorage();
        }
    }
    
    // === MÉTODOS DE PALAVRAS-CHAVE ===
    
    generateNewKeywords() {
        try {
            console.log('Gerando novas palavras-chave automaticamente...');
            
            if (this.isAvailable() && this.keywordModel) {
                // Usar banco de dados
                return this.keywordModel.generateKeywords();
            } else {
                // Fallback para método original
                return this.generateKeywordsFromPool();
            }
        } catch (error) {
            console.error('Erro ao gerar palavras-chave:', error);
            return this.generateKeywordsFromPool();
        }
    }
    
    setCurrentKeywords(correctKeyword, incorrectKeywords) {
        try {
            console.log('Definindo palavras-chave:', correctKeyword, incorrectKeywords);
            
            if (this.isAvailable() && this.keywordModel) {
                // Usar banco de dados
                return this.keywordModel.create({
                    correct_word: correctKeyword,
                    incorrect_words: incorrectKeywords
                });
            } else {
                // Fallback para localStorage
                return this.setCurrentKeywordsInStorage(correctKeyword, incorrectKeywords);
            }
        } catch (error) {
            console.error('Erro ao definir palavras-chave:', error);
            return this.setCurrentKeywordsInStorage(correctKeyword, incorrectKeywords);
        }
    }
    
    getCurrentKeywords() {
        try {
            if (this.isAvailable() && this.keywordModel) {
                // Usar banco de dados
                return this.keywordModel.getCurrent();
            } else {
                // Fallback para localStorage
                return this.getCurrentKeywordsFromStorage();
            }
        } catch (error) {
            console.error('Erro ao obter palavras-chave atuais:', error);
            return this.getCurrentKeywordsFromStorage();
        }
    }
    
    clearCurrentKeywords() {
        try {
            if (this.isAvailable() && this.keywordModel) {
                // Usar banco de dados
                return this.keywordModel.deactivateAll();
            } else {
                // Fallback para localStorage
                localStorage.removeItem('current-keywords');
                console.log('Palavras-chave limpas do localStorage');
            }
        } catch (error) {
            console.error('Erro ao limpar palavras-chave:', error);
            localStorage.removeItem('current-keywords');
        }
    }
    
    // === MÉTODOS DE TENTATIVAS DE USUÁRIOS ===
    
    hasUserAttempted(clientEmail, keywordId) {
        // Implementar lógica de verificação de tentativas
        const saved = localStorage.getItem('user-attempts');
        const attempts = saved ? JSON.parse(saved) : {};
        const attemptKey = `${clientEmail}_${keywordId}`;
        return !!attempts[attemptKey];
    }
    
    recordUserAttempt(clientEmail, keywordId, isCorrect, selectedWord) {
        // Implementar lógica de registro de tentativas
        const saved = localStorage.getItem('user-attempts');
        const attempts = saved ? JSON.parse(saved) : {};
        
        const attemptKey = `${clientEmail}_${keywordId}`;
        attempts[attemptKey] = {
            email: clientEmail,
            keywordId: keywordId,
            isCorrect: isCorrect,
            selectedWord: selectedWord,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('user-attempts', JSON.stringify(attempts));
        return attempts[attemptKey];
    }
    
    clearUserAttempts() {
        localStorage.removeItem('user-attempts');
        console.log('Todas as tentativas foram limpas');
    }
    
    // === MÉTODOS DE PREMIAÇÃO ===
    
    isAwardExecuted() {
        const saved = localStorage.getItem('award-status');
        const awardStatus = saved ? JSON.parse(saved) : { executed: false };
        return awardStatus.executed;
    }
    
    executeAward(adminNotes = '') {
        const awardStatus = {
            executed: true,
            executedAt: new Date().toISOString(),
            adminNotes: adminNotes,
            executedBy: 'admin'
        };
        
        localStorage.setItem('award-status', JSON.stringify(awardStatus));
        return awardStatus;
    }
    
    resetAwardStatus() {
        const awardStatus = {
            executed: false,
            resetAt: new Date().toISOString(),
            resetBy: 'admin'
        };
        
        localStorage.setItem('award-status', JSON.stringify(awardStatus));
        return awardStatus;
    }
    
    // === MÉTODOS DE POOL DE PALAVRAS-CHAVE ===
    
    async initializeWordPool() {
        try {
            if (this.isAvailable() && this.keywordModel) {
                console.log('🔄 Inicializando pool de palavras-chave...');
                const result = await this.keywordModel.initializeWordPool();
                
                if (result.success) {
                    console.log('✅ Pool de palavras-chave inicializado:', result.message);
                } else {
                    console.warn('⚠️ Problema ao inicializar pool:', result.error);
                }
                
                return result;
            } else {
                console.log('⚠️ DatabaseService não disponível para inicializar pool');
                return {
                    success: false,
                    error: 'DatabaseService não disponível'
                };
            }
        } catch (error) {
            console.error('❌ Erro ao inicializar pool de palavras:', error);
            return {
                success: false,
                error: 'Erro interno do servidor'
            };
        }
    }
    
    async addWordToPool(word, category = 'motivational') {
        try {
            if (this.isAvailable() && this.keywordModel) {
                return await this.keywordModel.addWordToPool(word, category);
            } else {
                return {
                    success: false,
                    error: 'DatabaseService não disponível'
                };
            }
        } catch (error) {
            console.error('Erro ao adicionar palavra ao pool:', error);
            return {
                success: false,
                error: 'Erro interno do servidor'
            };
        }
    }
    
    async getWordPool() {
        try {
            if (this.isAvailable() && this.keywordModel) {
                return await this.keywordModel.getWordPool();
            } else {
                return {
                    success: false,
                    error: 'DatabaseService não disponível'
                };
            }
        } catch (error) {
            console.error('Erro ao buscar pool de palavras:', error);
            return {
                success: false,
                error: 'Erro interno do servidor'
            };
        }
    }
    
    // === MÉTODOS DE RANKING ===
    
    async getRankingData(period = 'all') {
        try {
            const clients = await this.getClients();
            const rankingData = [];

            for (const client of clients) {
                const activities = await this.getClientActivities(client.id);
                
                let filteredActivities = activities;
                if (period !== 'all') {
                    const now = new Date();
                    let startDate = null;
                    
                    if (period === 'week') {
                        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    } else if (period === 'month') {
                        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    }
                    
                    if (startDate) {
                        filteredActivities = activities.filter(activity => {
                            const activityDate = new Date(activity.timestamp);
                            return activityDate >= startDate;
                        });
                    }
                }

                if (filteredActivities.length > 0) {
                    const points = filteredActivities.reduce((sum, activity) => sum + (activity.points || 0), 0);
                    const lastActivity = filteredActivities[0].timestamp;
                    
                    rankingData.push({
                        client,
                        points,
                        lastActivity,
                        position: 0
                    });
                }
            }

            // Ordenar por pontos e atribuir posições
            rankingData.sort((a, b) => b.points - a.points);
            rankingData.forEach((entry, index) => {
                entry.position = index + 1;
            });

            return rankingData;
        } catch (error) {
            console.error('Erro ao gerar ranking:', error);
            return [];
        }
    }
    
    // === MÉTODOS DE LISTENERS (SIMULADOS) ===
    
    onClientsChange(callback) {
        console.log('Configurando listener de clientes...');
        
        // Chamar imediatamente
        this.getClients().then(clients => {
            callback(clients);
        });
        
        // Verificar mudanças a cada 2 segundos
        const interval = setInterval(() => {
            this.getClients().then(clients => {
                callback(clients);
            });
        }, 5000); // Aumentado para 5 segundos para reduzir carga
        
        // Retornar função de cleanup
        return () => {
            console.log('Cancelando listener de clientes...');
            clearInterval(interval);
        };
    }
    
    onActivitiesChange(callback) {
        console.log('Configurando listener de atividades...');
        
        // Chamar imediatamente
        this.getAllActivities(20).then(activities => {
            callback(activities);
        });
        
        // Verificar mudanças a cada 3 segundos
        const interval = setInterval(() => {
            this.getAllActivities(20).then(activities => {
                callback(activities);
            });
        }, 3000);
        
        // Retornar função de cleanup
        return () => {
            console.log('Cancelando listener de atividades...');
            clearInterval(interval);
        };
    }
    
    // === MÉTODOS DE FALLBACK (LOCALSTORAGE) ===
    
    getClientsFromStorage() {
        const saved = localStorage.getItem('dashboard-clients');
        return saved ? JSON.parse(saved) : [];
    }
    
    searchClientInArray(clients, searchTerm) {
        const searchLower = searchTerm.toLowerCase().trim();
        
        // Buscar por correspondência exata no email
        let client = clients.find(c => c.email.toLowerCase() === searchLower);
        
        // Se não encontrou, buscar por correspondência exata no nome
        if (!client) {
            client = clients.find(c => c.name.toLowerCase() === searchLower);
        }
        
        // Se não encontrou, buscar por correspondência parcial
        if (!client) {
            client = clients.find(c => 
                c.email.toLowerCase().includes(searchLower) ||
                c.name.toLowerCase().includes(searchLower)
            );
        }
        
        return client || null;
    }
    
    addActivityToStorage(activityData) {
        const activity = {
            id: this.generateId(),
            ...activityData,
            timestamp: new Date().toISOString()
        };

        const storageKey = `client-activities_${activityData.client_id}`;
        const activities = JSON.parse(localStorage.getItem(storageKey) || '[]');
        activities.unshift(activity);
        
        // Manter apenas as últimas 50 atividades por cliente
        if (activities.length > 50) {
            activities.splice(50);
        }
        
        localStorage.setItem(storageKey, JSON.stringify(activities));
        return activity;
    }
    
    getClientActivitiesFromStorage(clientId) {
        const storageKey = `client-activities_${clientId}`;
        const saved = localStorage.getItem(storageKey);
        return saved ? JSON.parse(saved) : [];
    }
    
    getAllActivitiesFromStorage(limitCount = 50) {
        const clients = this.getClientsFromStorage();
        const allActivities = [];

        for (const client of clients) {
            const activities = this.getClientActivitiesFromStorage(client.id);
            allActivities.push(...activities);
        }

        // Ordenar por timestamp decrescente
        allActivities.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA;
        });

        return allActivities.slice(0, limitCount);
    }
    
    clearAllActivitiesFromStorage() {
        const clients = this.getClientsFromStorage();
        
        clients.forEach(client => {
            const storageKey = `client-activities_${client.id}`;
            localStorage.removeItem(storageKey);
        });
        
        this.resetAwardStatus();
        return true;
    }
    
    generateKeywordsFromPool() {
        // Pool padrão de palavras (mesmo do firebase-config.js original)
        const pool = [
            'energia', 'vitalidade', 'força', 'poder', 'luz', 'amor', 'paz', 'harmonia',
            'equilíbrio', 'foco', 'determinação', 'coragem', 'sabedoria', 'gratidão',
            'abundância', 'prosperidade', 'sucesso', 'conquista', 'vitória', 'transformação',
            'evolução', 'crescimento', 'expansão', 'liberdade', 'criatividade', 'inspiração',
            'motivação', 'confiança', 'autoestima', 'positividade', 'otimismo', 'esperança',
            'fé', 'propósito', 'missão', 'visão', 'intuição', 'conexão', 'unidade',
            'consciência', 'presença', 'atenção', 'clareza', 'precisão', 'disciplina',
            'persistência', 'resistência', 'flexibilidade', 'adaptação', 'inovação'
        ];
        
        // Selecionar palavra correta aleatoriamente
        const correctIndex = Math.floor(Math.random() * pool.length);
        const correctKeyword = pool[correctIndex];
        
        // Gerar 3 palavras incorretas (para total de 4 palavras)
        const incorrectKeywords = [];
        const availableWords = pool.filter(word => word !== correctKeyword);
        
        while (incorrectKeywords.length < 3 && availableWords.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableWords.length);
            const word = availableWords.splice(randomIndex, 1)[0];
            incorrectKeywords.push(word);
        }
        
        const keywordData = {
            correct: correctKeyword,
            incorrect: incorrectKeywords,
            timestamp: new Date().toISOString(),
            id: this.generateId()
        };
        
        localStorage.setItem('current-keywords', JSON.stringify(keywordData));
        return keywordData;
    }
    
    setCurrentKeywordsInStorage(correctKeyword, incorrectKeywords) {
        const keywordData = {
            correct: correctKeyword,
            incorrect: incorrectKeywords,
            timestamp: new Date().toISOString(),
            id: this.generateId()
        };
        
        localStorage.setItem('current-keywords', JSON.stringify(keywordData));
        return keywordData;
    }
    
    getCurrentKeywordsFromStorage() {
        const saved = localStorage.getItem('current-keywords');
        return saved ? JSON.parse(saved) : null;
    }
    
    // === MÉTODOS AUXILIARES ===
    
    invalidateCache() {
        this.cache.clients = null;
        this.cache.currentKeywords = null;
        this.cache.cacheTime = 0;
    }
    
    isCacheValid() {
        return (Date.now() - this.cache.cacheTime) < this.cache.cacheTTL;
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    // Health check
    async healthCheck() {
        if (!this.isAvailable()) {
            return {
                status: 'unavailable',
                provider: 'localStorage',
                message: 'Banco de dados não disponível, usando localStorage'
            };
        }
        
        try {
            const dbHealth = await this.dbConnection.healthCheck();
            return {
                status: 'healthy',
                provider: dbHealth.provider,
                message: 'Serviço funcionando normalmente'
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                provider: this.dbConnection.getProvider(),
                error: error.message
            };
        }
    }
}

// Singleton instance
const databaseService = new DatabaseService();

// Export para uso em Node.js e Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = databaseService;
} else {
    window.DatabaseService = DatabaseService;
    window.databaseService = databaseService;
}