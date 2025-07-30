// Firebase Configuration
// Substitua pelos seus dados do Firebase Console
const firebaseConfig = {
    apiKey: "your-api-key-here",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// Verificar se Firebase está configurado
const isFirebaseConfigured = firebaseConfig.apiKey !== "your-api-key-here";

let db = null;
let app = null;
let firebaseInitialized = false;

console.log('Firebase config status:', isFirebaseConfigured ? 'Configurado' : 'Usando localStorage apenas');

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

// Firebase utility functions
window.FirebaseDB = {
    // Verificar se Firebase está disponível
    isAvailable() {
        return false; // Sempre usar localStorage para garantir funcionamento
    },

    // Clients functions
    async addClient(clientData) {
        console.log('Adicionando cliente:', clientData);
        
        const clientWithId = {
            id: generateId(),
            ...clientData,
            createdAt: createTimestamp(),
            updatedAt: createTimestamp()
        };

        console.log('Cliente criado com ID:', clientWithId.id);

        // Sempre salvar no localStorage (removido Firebase para garantir funcionamento)
        const clients = this.getClientsFromStorage();
        clients.push(clientWithId);
        localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(clients));
        
        console.log('Cliente salvo no localStorage. Total de clientes:', clients.length);

        return clientWithId;
    },

    async getClients() {
        console.log('Carregando clientes do localStorage...');
        
        // Sempre usar localStorage para garantir funcionamento
        const clients = this.getClientsFromStorage();
        console.log('Clientes carregados:', clients.length);
        
        return clients;
    },

    getClientsFromStorage() {
        const saved = localStorage.getItem(STORAGE_KEYS.clients);
        return saved ? JSON.parse(saved) : [];
    },

    async updateClient(clientId, clientData) {
        console.log('Atualizando cliente:', clientId, clientData);
        
        // Atualizar localStorage
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

    async deleteClient(clientId) {
        console.log('Deletando cliente:', clientId);
        
        // Deletar do localStorage
        const clients = this.getClientsFromStorage();
        const filteredClients = clients.filter(c => c.id !== clientId);
        localStorage.setItem(STORAGE_KEYS.clients, JSON.stringify(filteredClients));
        
        console.log('Cliente deletado. Clientes restantes:', filteredClients.length);

        return true;
    },

    async findClientByEmailOrName(searchTerm) {
        console.log('Buscando cliente por:', searchTerm);
        
        const clients = await this.getClients();
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
        
        // Gerar palavras incorretas
        const incorrectKeywords = this.generateRandomKeywords(correctKeyword, 2);
        
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

    generateRandomKeywords(correctWord, count = 2) {
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

console.log('Firebase config carregado. Modo:', isFirebaseConfigured ? 'Firebase + localStorage' : 'Apenas localStorage');