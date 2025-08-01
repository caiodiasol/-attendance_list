// Database Configuration with Persistent Storage
// Sistema híbrido que suporta MySQL, Firebase e localStorage

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBxPc0qnTlzJxVk4rP8H3m9L2nE0fG1dCs",
    authDomain: "clientkey-system.firebaseapp.com",
    databaseURL: "https://clientkey-system-default-rtdb.firebaseio.com",
    projectId: "clientkey-system", 
    storageBucket: "clientkey-system.appspot.com",
    messagingSenderId: "654321098",
    appId: "1:654321098:web:a1b2c3d4e5f6g7h8i9j0"
};

// Verificar se Firebase está configurado
const isFirebaseConfigured = firebaseConfig.apiKey !== "your-api-key-here";

// Variáveis globais para compatibilidade
let db = null;
let app = null;
let firebaseInitialized = false;
let databaseServiceInitialized = false;

console.log('Database config status:', isFirebaseConfigured ? 'Firebase configurado' : 'Usando banco persistente + localStorage');

// Storage keys
const STORAGE_KEYS = {
    clients: 'dashboard-clients',
    activities: 'client-activities',
    currentClient: 'currentParticipationClient',
    currentKeywords: 'current-keywords',
    keywordPools: 'keyword-pools',
    userAttempts: 'user-attempts',
    awardStatus: 'award-status'
};

// Utility functions para localStorage
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function createTimestamp() {
    return new Date().toISOString();
}

// Inicializar Firebase
async function initializeFirebase() {
    try {
        console.log('🔥 Tentando inicializar Firebase...');
        console.log('Configuração Firebase válida:', isFirebaseConfigured);
        console.log('Firebase SDK disponível:', typeof firebase !== 'undefined');
        
        if (isFirebaseConfigured && typeof firebase !== 'undefined') {
            console.log('🔥 Inicializando Firebase com config:', firebaseConfig.projectId);
            
            // Inicializar Firebase
            if (!firebase.apps.length) {
                app = firebase.initializeApp(firebaseConfig);
                console.log('Firebase app criado');
            } else {
                app = firebase.app();
                console.log('Firebase app já existe');
            }
            
            // Inicializar Realtime Database
            db = firebase.database();
            firebaseInitialized = true;
            
            console.log('✅ Firebase inicializado com sucesso');
            
            // Testar conexão
            try {
                await db.ref('.info/connected').once('value');
                console.log('✅ Conexão com Firebase testada com sucesso');
            } catch (testError) {
                console.warn('⚠️ Teste de conexão falhou, mas Firebase foi inicializado:', testError.message);
            }
            
            return true;
        } else {
            if (!isFirebaseConfigured) {
                console.log('⚠️ Firebase não configurado corretamente');
            }
            if (typeof firebase === 'undefined') {
                console.log('⚠️ Firebase SDK não carregado');
            }
            return false;
        }
    } catch (error) {
        console.error('❌ Erro ao inicializar Firebase:', error);
        firebaseInitialized = false;
        return false;
    }
}

// Inicializar serviço de banco de dados
async function initializeDatabaseService() {
    try {
        // Tentar inicializar Firebase primeiro
        const firebaseInitialized = await initializeFirebase();
        
        // Carregar scripts necessários se não estiverem carregados
        if (typeof window.databaseService === 'undefined') {
            console.log('Carregando scripts do banco de dados...');
            await loadDatabaseScripts();
        }
        
        // Inicializar serviço
        const initialized = await window.databaseService.initialize();
        if (initialized) {
            databaseServiceInitialized = true;
            console.log('✅ Serviço de banco de dados inicializado');
            
            // Verificar se há dados para migrar
            const dataMigration = new window.DataMigration(window.databaseService);
            const dataCheck = dataMigration.checkDataToMigrate();
            
            if (dataCheck.hasData) {
                console.log('📦 Dados encontrados no localStorage para migração:', dataCheck.details);
                console.log('💡 Use migrateDatabaseData() para migrar os dados');
            }
        }
        
        return initialized;
    } catch (error) {
        console.error('Erro ao inicializar serviço de banco:', error);
        return false;
    }
}

// Carregar scripts do banco de dados dinamicamente
async function loadDatabaseScripts() {
    const scripts = [
        'database/connection.js',
        'database/models/Client.js',
        'database/models/Activity.js',
        'database/models/Keyword.js',
        'database/services/DatabaseService.js',
        'database/migration/DataMigration.js'
    ];
    
    for (const script of scripts) {
        try {
            await loadScript(script);
        } catch (error) {
            console.warn(`Não foi possível carregar ${script}:`, error);
        }
    }
}

// Função auxiliar para carregar scripts
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Função para migrar dados do localStorage para o banco
async function migrateDatabaseData(options = {}) {
    try {
        if (!databaseServiceInitialized) {
            throw new Error('Serviço de banco não inicializado');
        }
        
        console.log('🚀 Iniciando migração dos dados...');
        
        const dataMigration = new window.DataMigration(window.databaseService);
        const result = await dataMigration.migrate(options);
        
        if (result.success) {
            console.log('✅ Migração concluída com sucesso!');
            console.log('📊 Resumo:', result.summary);
            window.showMessage('Migração de dados concluída com sucesso!', 'success');
        } else {
            console.error('❌ Erro na migração:', result.error);
            window.showMessage('Erro durante a migração: ' + result.error, 'error');
        }
        
        return result;
    } catch (error) {
        console.error('Erro ao migrar dados:', error);
        window.showMessage('Erro ao migrar dados: ' + error.message, 'error');
        return { success: false, error: error.message };
    }
}

// Database utility functions (compatibilidade com código existente)
window.FirebaseDB = {
    // Verificar se banco está disponível
    isAvailable() {
        return databaseServiceInitialized && window.databaseService && window.databaseService.isAvailable();
    },

    // Clients functions
    async addClient(clientData) {
        console.log('Adicionando cliente:', clientData);
        
        try {
            // Tentar usar o serviço de banco primeiro
            if (this.isAvailable()) {
                const client = await window.databaseService.addClient(clientData);
                console.log('Cliente adicionado via banco de dados:', client.id);
                return client;
            } else {
                // Fallback para localStorage
                console.log('Usando fallback localStorage para adicionar cliente');
                return this.addClientToStorage(clientData);
            }
        } catch (error) {
            console.error('Erro ao adicionar cliente via banco, usando localStorage:', error);
            return this.addClientToStorage(clientData);
        }
    },

    async getClients() {
        console.log('Carregando clientes...');
        
        try {
            // Tentar usar o serviço de banco primeiro
            if (this.isAvailable()) {
                const clients = await window.databaseService.getClients();
                console.log('Clientes carregados via banco de dados:', clients.length);
                return clients;
            } else {
                // Fallback para localStorage
                console.log('Usando fallback localStorage para carregar clientes');
                return this.getClientsFromStorage();
            }
        } catch (error) {
            console.error('Erro ao carregar clientes via banco, usando localStorage:', error);
            return this.getClientsFromStorage();
        }
    },

    // Métodos de fallback para localStorage
    addClientToStorage(clientData) {
        const clientWithId = {
            id: generateId(),
            ...clientData,
            createdAt: createTimestamp(),
            updatedAt: createTimestamp()
        };

        const clients = this.getClientsFromStorage();
        clients.push(clientWithId);
        localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(clients));
        
        console.log('Cliente salvo no localStorage. Total de clientes:', clients.length);
        return clientWithId;
    },

    getClientsFromStorage() {
        const saved = localStorage.getItem(STORAGE_KEYS.clients);
        return saved ? JSON.parse(saved) : [];
    },

    async updateClient(clientId, clientData) {
        console.log('Atualizando cliente:', clientId, clientData);
        
        try {
            // Tentar usar o serviço de banco primeiro
            if (this.isAvailable()) {
                await window.databaseService.updateClient(clientId, clientData);
                console.log('Cliente atualizado via banco de dados');
                return true;
            } else {
                // Fallback para localStorage
                return this.updateClientInStorage(clientId, clientData);
            }
        } catch (error) {
            console.error('Erro ao atualizar cliente via banco, usando localStorage:', error);
            return this.updateClientInStorage(clientId, clientData);
        }
    },

    async deleteClient(clientId) {
        console.log('Deletando cliente:', clientId);
        
        try {
            // Tentar usar o serviço de banco primeiro
            if (this.isAvailable()) {
                await window.databaseService.deleteClient(clientId);
                console.log('Cliente deletado via banco de dados');
                return true;
            } else {
                // Fallback para localStorage
                return this.deleteClientFromStorage(clientId);
            }
        } catch (error) {
            console.error('Erro ao deletar cliente via banco, usando localStorage:', error);
            return this.deleteClientFromStorage(clientId);
        }
    },

    // Métodos de fallback adicionais
    updateClientInStorage(clientId, clientData) {
        const clients = this.getClientsFromStorage();
        const clientIndex = clients.findIndex(c => c.id === clientId);
        if (clientIndex !== -1) {
            clients[clientIndex] = {
                ...clients[clientIndex],
                ...clientData,
                updatedAt: createTimestamp()
            };
            localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(clients));
            console.log('Cliente atualizado no localStorage');
        }
        return true;
    },

    deleteClientFromStorage(clientId) {
        const clients = this.getClientsFromStorage();
        const filteredClients = clients.filter(c => c.id !== clientId);
        localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(filteredClients));
        
        console.log('Cliente deletado. Clientes restantes:', filteredClients.length);
        return true;
    },

    async findClientByEmailOrName(searchTerm) {
        console.log('Buscando cliente por:', searchTerm);
        
        try {
            // Tentar usar o serviço de banco primeiro
            if (this.isAvailable()) {
                const client = await window.databaseService.findClientByEmailOrName(searchTerm);
                console.log('Cliente encontrado via banco de dados:', client ? client.name : 'Nenhum');
                return client;
            } else {
                // Fallback para localStorage
                return this.findClientInStorage(searchTerm);
            }
        } catch (error) {
            console.error('Erro ao buscar cliente via banco, usando localStorage:', error);
            return this.findClientInStorage(searchTerm);
        }
    },

    findClientInStorage(searchTerm) {
        const clients = this.getClientsFromStorage();
        const searchLower = searchTerm.toLowerCase().trim();
        
        console.log('Total de clientes para buscar:', clients.length);
        
        // Buscar por correspondência exata no email
        let foundClient = clients.find(client => 
            client.email.toLowerCase() === searchLower
        );
        
        // Se não encontrou, buscar por correspondência exata no nome
        if (!foundClient) {
            foundClient = clients.find(client => 
                client.name.toLowerCase() === searchLower
            );
        }
        
        // Se não encontrou, buscar por correspondência parcial no email
        if (!foundClient) {
            foundClient = clients.find(client => 
                client.email.toLowerCase().includes(searchLower)
            );
        }
        
        // Se não encontrou, buscar por correspondência parcial no nome
        if (!foundClient) {
            foundClient = clients.find(client => 
                client.name.toLowerCase().includes(searchLower)
            );
        }
        
        console.log('Cliente encontrado:', foundClient ? foundClient.name : 'Nenhum');
        return foundClient;
    },

    // Activities functions
    async addActivity(activityData) {
        console.log('Adicionando atividade:', activityData);
        
        const activity = {
            id: generateId(),
            ...activityData,
            timestamp: createTimestamp()
        };

        console.log('Atividade criada:', activity);

        // Salvar no localStorage
        const storageKey = `${STORAGE_KEYS.activities}_${activityData.clientId}`;
        const activities = JSON.parse(localStorage.getItem(storageKey) || '[]');
        activities.unshift(activity);
        
        // Manter apenas as últimas 50 atividades por cliente
        if (activities.length > 50) {
            activities.splice(50);
        }
        
        localStorage.setItem(storageKey, JSON.stringify(activities));
        
        console.log('Atividade salva. Total de atividades do cliente:', activities.length);

        return activity;
    },

    async getClientActivities(clientId) {
        console.log('Carregando atividades do cliente:', clientId);
        
        // Sempre usar localStorage
        const storageKey = `${STORAGE_KEYS.activities}_${clientId}`;
        const saved = localStorage.getItem(storageKey);
        const activities = saved ? JSON.parse(saved) : [];
        
        console.log('Atividades do cliente carregadas:', activities.length);
        
        return activities;
    },

    async getAllActivities(limitCount = 50) {
        console.log('Carregando todas as atividades...');
        
        const clients = await this.getClients();
        const allActivities = [];

        for (const client of clients) {
            const activities = await this.getClientActivities(client.id);
            allActivities.push(...activities);
        }

        // Ordenar por timestamp decrescente
        allActivities.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA;
        });

        console.log('Total de atividades carregadas:', allActivities.length);
        
        return allActivities.slice(0, limitCount);
    },

    async clearAllActivities() {
        console.log('Limpando todas as atividades...');
        
        const clients = await this.getClients();

        // Limpar localStorage
        clients.forEach(client => {
            const storageKey = `${STORAGE_KEYS.activities}_${client.id}`;
            localStorage.removeItem(storageKey);
        });

        console.log('Todas as atividades foram limpas');
        
        return true;
    },

    // Real-time listeners (simulados para localStorage)
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
        }, 2000);
        
        // Retornar função de cleanup
        return () => {
            console.log('Cancelando listener de clientes...');
            clearInterval(interval);
        };
    },

    onActivitiesChange(callback) {
        console.log('Configurando listener de atividades...');
        
        // Chamar imediatamente
        this.getAllActivities(20).then(activities => {
            callback(activities);
        });
        
        // Verificar mudanças a cada 2 segundos
        const interval = setInterval(() => {
            this.getAllActivities(20).then(activities => {
                callback(activities);
            });
        }, 2000);
        
        // Retornar função de cleanup
        return () => {
            console.log('Cancelando listener de atividades...');
            clearInterval(interval);
        };
    },

    // Utility functions
    async getRankingData(period = 'all') {
        const clients = await this.getClients();
        const rankingData = [];

        for (const client of clients) {
            const activities = await this.getClientActivities(client.id);
            
            let filteredActivities = activities;
            if (period !== 'all') {
                const now = new Date();
                let startDate = null;
                
                if (period === 'day') {
                    // Início do dia atual
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                } else if (period === 'week') {
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
    },

    // Keywords management functions
    generateNewKeywords() {
        console.log('Gerando novas palavras-chave automaticamente...');
        
        // Limpar tentativas da palavra anterior (se houver)
        const previousKeywords = this.getCurrentKeywords();
        if (previousKeywords) {
            this.clearAttemptsForKeyword(previousKeywords.id);
        }
        
        const pool = this.getKeywordPool();
        
        // Selecionar palavra correta aleatoriamente
        const correctIndex = Math.floor(Math.random() * pool.length);
        const correctKeyword = pool[correctIndex];
        
        // Gerar 3 palavras incorretas (para total de 4 palavras)
        const incorrectKeywords = this.generateRandomKeywords(correctKeyword, 3);
        
        const keywordData = {
            correct: correctKeyword,
            incorrect: incorrectKeywords,
            timestamp: createTimestamp(),
            id: generateId()
        };
        
        localStorage.setItem(STORAGE_KEYS.currentKeywords, JSON.stringify(keywordData));
        
        console.log('Palavras-chave geradas:', keywordData);
        return keywordData;
    },

    setCurrentKeywords(correctKeyword, incorrectKeywords) {
        console.log('Definindo palavras-chave:', correctKeyword, incorrectKeywords);
        
        const keywordData = {
            correct: correctKeyword,
            incorrect: incorrectKeywords,
            timestamp: createTimestamp(),
            id: generateId()
        };
        
        localStorage.setItem(STORAGE_KEYS.currentKeywords, JSON.stringify(keywordData));
        
        console.log('Palavras-chave definidas:', keywordData);
        return keywordData;
    },

    getCurrentKeywords() {
        const saved = localStorage.getItem(STORAGE_KEYS.currentKeywords);
        return saved ? JSON.parse(saved) : null;
    },

    clearCurrentKeywords() {
        localStorage.removeItem(STORAGE_KEYS.currentKeywords);
        console.log('Palavras-chave limpas');
    },

    // Pool de palavras para gerar incorretas
    getKeywordPool() {
        const saved = localStorage.getItem(STORAGE_KEYS.keywordPools);
        if (saved) {
            return JSON.parse(saved);
        }
        
        // Pool padrão de palavras
        const defaultPool = [
            'energia', 'vitalidade', 'força', 'poder', 'luz', 'amor', 'paz', 'harmonia',
            'equilíbrio', 'foco', 'determinação', 'coragem', 'sabedoria', 'gratidão',
            'abundância', 'prosperidade', 'sucesso', 'conquista', 'vitória', 'transformação',
            'evolução', 'crescimento', 'expansão', 'liberdade', 'criatividade', 'inspiração',
            'motivação', 'confiança', 'autoestima', 'positividade', 'otimismo', 'esperança',
            'fé', 'propósito', 'missão', 'visão', 'intuição', 'conexão', 'unidade',
            'consciência', 'presença', 'atenção', 'clareza', 'precisão', 'disciplina',
            'persistência', 'resistência', 'flexibilidade', 'adaptação', 'inovação'
        ];
        
        localStorage.setItem(STORAGE_KEYS.keywordPools, JSON.stringify(defaultPool));
        return defaultPool;
    },

    generateRandomKeywords(correctWord, count = 3) {
        const pool = this.getKeywordPool();
        const incorrectWords = [];
        
        // Filtrar a palavra correta do pool
        const availableWords = pool.filter(word => 
            word.toLowerCase() !== correctWord.toLowerCase()
        );
        
        // Selecionar palavras aleatórias
        while (incorrectWords.length < count && availableWords.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableWords.length);
            const word = availableWords.splice(randomIndex, 1)[0];
            incorrectWords.push(word);
        }
        
        return incorrectWords;
    },

    // User attempts control functions
    hasUserAttempted(clientEmail, keywordId) {
        console.log('Verificando tentativa para:', clientEmail, keywordId);
        
        const saved = localStorage.getItem(STORAGE_KEYS.userAttempts);
        const attempts = saved ? JSON.parse(saved) : {};
        
        const attemptKey = `${clientEmail}_${keywordId}`;
        const hasAttempted = !!attempts[attemptKey];
        
        console.log('Usuário já tentou:', hasAttempted);
        return hasAttempted;
    },

    recordUserAttempt(clientEmail, keywordId, isCorrect, selectedWord) {
        console.log('Registrando tentativa:', clientEmail, keywordId, isCorrect, selectedWord);
        
        const saved = localStorage.getItem(STORAGE_KEYS.userAttempts);
        const attempts = saved ? JSON.parse(saved) : {};
        
        const attemptKey = `${clientEmail}_${keywordId}`;
        attempts[attemptKey] = {
            email: clientEmail,
            keywordId: keywordId,
            isCorrect: isCorrect,
            selectedWord: selectedWord,
            timestamp: createTimestamp()
        };
        
        localStorage.setItem(STORAGE_KEYS.userAttempts, JSON.stringify(attempts));
        
        console.log('Tentativa registrada:', attempts[attemptKey]);
        return attempts[attemptKey];
    },

    getUserAttempt(clientEmail, keywordId) {
        const saved = localStorage.getItem(STORAGE_KEYS.userAttempts);
        const attempts = saved ? JSON.parse(saved) : {};
        
        const attemptKey = `${clientEmail}_${keywordId}`;
        return attempts[attemptKey] || null;
    },

    clearUserAttempts() {
        localStorage.removeItem(STORAGE_KEYS.userAttempts);
        console.log('Todas as tentativas foram limpas');
    },

    // Clear attempts for a specific keyword (when new keyword is generated)
    clearAttemptsForKeyword(keywordId) {
        console.log('Limpando tentativas para palavra-chave:', keywordId);
        
        const saved = localStorage.getItem(STORAGE_KEYS.userAttempts);
        const attempts = saved ? JSON.parse(saved) : {};
        
        // Remove attempts for this specific keyword
        Object.keys(attempts).forEach(key => {
            if (key.endsWith(`_${keywordId}`)) {
                delete attempts[key];
            }
        });
        
        localStorage.setItem(STORAGE_KEYS.userAttempts, JSON.stringify(attempts));
        console.log('Tentativas limpas para a palavra-chave');
    },

    // Award control functions
    isAwardExecuted() {
        const saved = localStorage.getItem(STORAGE_KEYS.awardStatus);
        const awardStatus = saved ? JSON.parse(saved) : { executed: false };
        
        console.log('Status da premiação:', awardStatus);
        return awardStatus.executed;
    },

    executeAward(adminNotes = '') {
        console.log('Executando premiação...');
        
        const awardStatus = {
            executed: true,
            executedAt: createTimestamp(),
            adminNotes: adminNotes,
            executedBy: 'admin'
        };
        
        localStorage.setItem(STORAGE_KEYS.awardStatus, JSON.stringify(awardStatus));
        
        console.log('Premiação executada:', awardStatus);
        return awardStatus;
    },

    getAwardStatus() {
        const saved = localStorage.getItem(STORAGE_KEYS.awardStatus);
        return saved ? JSON.parse(saved) : { executed: false };
    },

    resetAwardStatus() {
        console.log('Resetando status de premiação...');
        
        const awardStatus = {
            executed: false,
            resetAt: createTimestamp(),
            resetBy: 'admin'
        };
        
        localStorage.setItem(STORAGE_KEYS.awardStatus, JSON.stringify(awardStatus));
        
        console.log('Status de premiação resetado');
        return awardStatus;
    },

    // Override clearAllActivities to reset award status
    async clearAllActivities() {
        console.log('Limpando todas as atividades...');
        
        const clients = await this.getClients();

        // Limpar localStorage
        clients.forEach(client => {
            const storageKey = `${STORAGE_KEYS.activities}_${client.id}`;
            localStorage.removeItem(storageKey);
        });

        // Reset award status when clearing activities
        this.resetAwardStatus();

        console.log('Todas as atividades foram limpas e status de premiação resetado');
        
        return true;
    }
};

// Show message helper
window.showMessage = function(message, type = 'success') {
    const messageContainer = document.getElementById('messageContainer');
    if (messageContainer) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        messageContainer.appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageContainer.removeChild(messageDiv);
            }
        }, 4000);
    } else {
        if (type === 'error') {
            alert('Erro: ' + message);
        } else {
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }
};

// Inicializar automaticamente quando o script for carregado
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Inicializando sistema de banco de dados...');
    
    try {
        await initializeDatabaseService();
        
        // Verificar status do sistema
        const healthCheck = await window.databaseService?.healthCheck();
        
        if (healthCheck) {
            console.log(`✅ Sistema inicializado: ${healthCheck.provider}`);
            console.log(`📊 Status: ${healthCheck.status}`);
            
            if (healthCheck.status === 'unavailable') {
                console.log('⚠️ Banco de dados não disponível, usando localStorage como fallback');
            }
        }
        
    } catch (error) {
        console.error('❌ Erro ao inicializar sistema:', error);
        console.log('📦 Sistema funcionará apenas com localStorage');
    }
});

// Função global para verificar status do banco
window.checkDatabaseStatus = async function() {
    if (databaseServiceInitialized && window.databaseService) {
        const health = await window.databaseService.healthCheck();
        console.log('🔍 Status do banco de dados:', health);
        return health;
    } else {
        console.log('🔍 Serviço de banco não inicializado');
        return { status: 'not_initialized', provider: 'localStorage' };
    }
};

// Função global para forçar migração
window.migrateDatabaseData = migrateDatabaseData;

console.log('Database config carregado. Modo:', isFirebaseConfigured ? 'Firebase + Banco Persistente + localStorage' : 'Banco Persistente + localStorage');