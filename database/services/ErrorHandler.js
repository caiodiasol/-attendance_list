// Error Handler Service
// Sistema robusto de tratamento de erros e falhas de conexão

class ErrorHandler {
    constructor(databaseService) {
        this.db = databaseService;
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 segundo
        this.circuitBreakerThreshold = 5; // Falhas consecutivas antes de "abrir" o circuit
        this.circuitBreakerTimeout = 30000; // 30 segundos antes de tentar novamente
        
        // Estado do circuit breaker
        this.circuitState = {
            failures: 0,
            isOpen: false,
            lastFailure: null,
            halfOpenTries: 0
        };
        
        // Fila de operações pendentes
        this.operationQueue = [];
        this.isProcessingQueue = false;
        
        // Estatísticas de erro
        this.errorStats = {
            totalErrors: 0,
            connectionErrors: 0,
            timeoutErrors: 0,
            validationErrors: 0,
            unknownErrors: 0,
            lastError: null,
            errorsByType: {},
            recoverySucess: 0
        };
        
        // Configurações de retry
        this.retryConfig = {
            connectionErrors: { attempts: 5, delay: 2000, backoff: true },
            timeoutErrors: { attempts: 3, delay: 1000, backoff: true },
            validationErrors: { attempts: 1, delay: 0, backoff: false },
            unknownErrors: { attempts: 2, delay: 1500, backoff: true }
        };
    }
    
    // Executar operação com tratamento de erro robusto
    async executeWithErrorHandling(operation, operationName, params = {}) {
        const operationId = this.generateOperationId();
        
        try {
            console.log(`🔄 Executando operação: ${operationName} [${operationId}]`);
            
            // Verificar circuit breaker
            if (this.isCircuitOpen()) {
                throw new DatabaseError('Circuit breaker is open', 'CIRCUIT_OPEN', operationName);
            }
            
            // Executar operação com retry
            const result = await this.executeWithRetry(operation, operationName, params);
            
            // Operação bem-sucedida - reset circuit breaker
            this.resetCircuitBreaker();
            
            console.log(`✅ Operação concluída: ${operationName} [${operationId}]`);
            return result;
            
        } catch (error) {
            // Registrar erro
            this.recordError(error, operationName);
            
            // Verificar se deve abrir circuit breaker
            this.updateCircuitBreaker(error);
            
            // Determinar estratégia de fallback
            const fallbackResult = await this.handleFallback(error, operationName, params);
            
            if (fallbackResult) {
                console.log(`🔄 Fallback executado para: ${operationName} [${operationId}]`);
                this.errorStats.recoverySucess++;
                return fallbackResult;
            } else {
                console.error(`❌ Falha crítica na operação: ${operationName} [${operationId}]`, error);
                throw error;
            }
        }
    }
    
    // Executar operação com retry automático
    async executeWithRetry(operation, operationName, params) {
        const errorType = this.getErrorType(null); // Tipo padrão
        const config = this.retryConfig[errorType] || this.retryConfig.unknownErrors;
        
        let lastError = null;
        
        for (let attempt = 1; attempt <= config.attempts; attempt++) {
            try {
                console.log(`🔁 Tentativa ${attempt}/${config.attempts} para ${operationName}`);
                
                const result = await operation();
                
                if (attempt > 1) {
                    console.log(`✅ Operação recuperada na tentativa ${attempt}`);
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                const errorType = this.getErrorType(error);
                const errorConfig = this.retryConfig[errorType];
                
                console.warn(`⚠️ Tentativa ${attempt} falhou para ${operationName}:`, error.message);
                
                // Se não deve fazer retry para este tipo de erro, falhar imediatamente
                if (!errorConfig || errorConfig.attempts <= 1) {
                    throw error;
                }
                
                // Se não é a última tentativa, aguardar antes de tentar novamente
                if (attempt < config.attempts) {
                    const delay = this.calculateRetryDelay(attempt, errorConfig);
                    console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
                    await this.sleep(delay);
                }
            }
        }
        
        // Se chegou aqui, todas as tentativas falharam
        throw lastError;
    }
    
    // Determinar tipo de erro
    getErrorType(error) {
        if (!error) return 'unknownErrors';
        
        const message = error.message?.toLowerCase() || '';
        const code = error.code?.toLowerCase() || '';
        
        // Erros de conexão
        if (message.includes('connection') || 
            message.includes('network') || 
            message.includes('connect') ||
            code.includes('connect') ||
            code === 'enotfound' ||
            code === 'econnrefused') {
            return 'connectionErrors';
        }
        
        // Erros de timeout
        if (message.includes('timeout') || 
            message.includes('timed out') ||
            code.includes('timeout')) {
            return 'timeoutErrors';
        }
        
        // Erros de validação
        if (message.includes('validation') || 
            message.includes('invalid') ||
            message.includes('required') ||
            error.name === 'ValidationError') {
            return 'validationErrors';
        }
        
        return 'unknownErrors';
    }
    
    // Calcular delay para retry com backoff exponencial
    calculateRetryDelay(attempt, config) {
        let delay = config.delay;
        
        if (config.backoff) {
            // Backoff exponencial com jitter
            delay = config.delay * Math.pow(2, attempt - 1);
            delay += Math.random() * 1000; // Adicionar jitter para evitar thundering herd
        }
        
        return Math.min(delay, 30000); // Máximo de 30 segundos
    }
    
    // Verificar se circuit breaker está aberto
    isCircuitOpen() {
        if (!this.circuitState.isOpen) {
            return false;
        }
        
        const now = Date.now();
        const timeSinceLastFailure = now - this.circuitState.lastFailure;
        
        // Se passou tempo suficiente, tentar half-open
        if (timeSinceLastFailure > this.circuitBreakerTimeout) {
            this.circuitState.isOpen = false;
            this.circuitState.halfOpenTries = 0;
            console.log('🔧 Circuit breaker mudando para half-open');
            return false;
        }
        
        return true;
    }
    
    // Atualizar estado do circuit breaker
    updateCircuitBreaker(error) {
        this.circuitState.failures++;
        this.circuitState.lastFailure = Date.now();
        
        // Se atingiu o threshold, abrir circuit
        if (this.circuitState.failures >= this.circuitBreakerThreshold) {
            this.circuitState.isOpen = true;
            console.warn(`⚠️ Circuit breaker ABERTO após ${this.circuitState.failures} falhas consecutivas`);
        }
    }
    
    // Reset circuit breaker após sucesso
    resetCircuitBreaker() {
        const wasOpen = this.circuitState.isOpen;
        
        this.circuitState.failures = 0;
        this.circuitState.isOpen = false;
        this.circuitState.halfOpenTries = 0;
        
        if (wasOpen) {
            console.log('✅ Circuit breaker FECHADO - conexão recuperada');
        }
    }
    
    // Registrar erro para estatísticas
    recordError(error, operationName) {
        this.errorStats.totalErrors++;
        this.errorStats.lastError = {
            message: error.message,
            type: this.getErrorType(error),
            operation: operationName,
            timestamp: new Date().toISOString()
        };
        
        const errorType = this.getErrorType(error);
        this.errorStats[errorType]++;
        
        // Registrar por tipo específico
        if (!this.errorStats.errorsByType[errorType]) {
            this.errorStats.errorsByType[errorType] = 0;
        }
        this.errorStats.errorsByType[errorType]++;
        
        console.error(`📊 Erro registrado: ${errorType} - Total: ${this.errorStats.totalErrors}`);
    }
    
    // Estratégias de fallback
    async handleFallback(error, operationName, params) {
        try {
            console.log(`🔄 Executando fallback para: ${operationName}`);
            
            const errorType = this.getErrorType(error);
            
            switch (operationName) {
                case 'getClients':
                    return this.fallbackGetClients();
                    
                case 'addClient':
                    return this.fallbackAddClient(params);
                    
                case 'updateClient':
                    return this.fallbackUpdateClient(params);
                    
                case 'deleteClient':
                    return this.fallbackDeleteClient(params);
                    
                case 'addActivity':
                    return this.fallbackAddActivity(params);
                    
                case 'getActivities':
                    return this.fallbackGetActivities(params);
                    
                case 'findClientByEmailOrName':
                    return this.fallbackFindClient(params);
                    
                default:
                    console.warn(`⚠️ Nenhum fallback disponível para: ${operationName}`);
                    return null;
            }
            
        } catch (fallbackError) {
            console.error('❌ Fallback também falhou:', fallbackError);
            return null;
        }
    }
    
    // Fallbacks específicos para operações
    fallbackGetClients() {
        console.log('📦 Fallback: carregando clientes do localStorage');
        const saved = localStorage.getItem('dashboard-clients');
        return saved ? JSON.parse(saved) : [];
    }
    
    fallbackAddClient(params) {
        console.log('📦 Fallback: adicionando cliente ao localStorage');
        const { clientData } = params;
        
        const clientWithId = {
            id: this.generateId(),
            ...clientData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const clients = this.fallbackGetClients();
        clients.push(clientWithId);
        localStorage.setItem('dashboard-clients', JSON.stringify(clients));
        
        // Adicionar à fila para sincronização posterior
        this.queueOperation('addClient', { clientData: clientWithId });
        
        return clientWithId;
    }
    
    fallbackUpdateClient(params) {
        console.log('📦 Fallback: atualizando cliente no localStorage');
        const { clientId, clientData } = params;
        
        const clients = this.fallbackGetClients();
        const clientIndex = clients.findIndex(c => c.id === clientId);
        
        if (clientIndex !== -1) {
            clients[clientIndex] = {
                ...clients[clientIndex],
                ...clientData,
                updatedAt: new Date().toISOString()
            };
            localStorage.setItem('dashboard-clients', JSON.stringify(clients));
            
            // Adicionar à fila para sincronização posterior
            this.queueOperation('updateClient', { clientId, clientData });
            
            return true;
        }
        
        return false;
    }
    
    fallbackDeleteClient(params) {
        console.log('📦 Fallback: deletando cliente do localStorage');
        const { clientId } = params;
        
        const clients = this.fallbackGetClients();
        const filteredClients = clients.filter(c => c.id !== clientId);
        localStorage.setItem('dashboard-clients', JSON.stringify(filteredClients));
        
        // Adicionar à fila para sincronização posterior
        this.queueOperation('deleteClient', { clientId });
        
        return true;
    }
    
    fallbackAddActivity(params) {
        console.log('📦 Fallback: adicionando atividade ao localStorage');
        const { activityData } = params;
        
        const activity = {
            id: this.generateId(),
            ...activityData,
            timestamp: new Date().toISOString()
        };
        
        const storageKey = `client-activities_${activityData.client_id}`;
        const activities = JSON.parse(localStorage.getItem(storageKey) || '[]');
        activities.unshift(activity);
        
        // Limitar a 50 atividades
        if (activities.length > 50) {
            activities.splice(50);
        }
        
        localStorage.setItem(storageKey, JSON.stringify(activities));
        
        // Adicionar à fila para sincronização posterior
        this.queueOperation('addActivity', { activityData: activity });
        
        return activity;
    }
    
    fallbackGetActivities(params) {
        console.log('📦 Fallback: carregando atividades do localStorage');
        const { clientId, limit = 50 } = params;
        
        if (clientId) {
            const storageKey = `client-activities_${clientId}`;
            const activities = JSON.parse(localStorage.getItem(storageKey) || '[]');
            return activities.slice(0, limit);
        } else {
            // Carregar todas as atividades
            const clients = this.fallbackGetClients();
            const allActivities = [];
            
            clients.forEach(client => {
                const storageKey = `client-activities_${client.id}`;
                const activities = JSON.parse(localStorage.getItem(storageKey) || '[]');
                allActivities.push(...activities);
            });
            
            // Ordenar por timestamp
            allActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            return allActivities.slice(0, limit);
        }
    }
    
    fallbackFindClient(params) {
        console.log('📦 Fallback: buscando cliente no localStorage');
        const { searchTerm } = params;
        
        const clients = this.fallbackGetClients();
        const searchLower = searchTerm.toLowerCase().trim();
        
        return clients.find(client => 
            client.email.toLowerCase().includes(searchLower) ||
            client.name.toLowerCase().includes(searchLower)
        ) || null;
    }
    
    // Sistema de fila para sincronização posterior
    queueOperation(operationType, params) {
        const operation = {
            id: this.generateOperationId(),
            type: operationType,
            params,
            timestamp: new Date().toISOString(),
            attempts: 0
        };
        
        this.operationQueue.push(operation);
        console.log(`📋 Operação adicionada à fila: ${operationType} [${operation.id}]`);
        
        // Tentar processar fila se não estiver processando
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }
    
    // Processar fila de operações pendentes
    async processQueue() {
        if (this.isProcessingQueue || this.operationQueue.length === 0) {
            return;
        }
        
        this.isProcessingQueue = true;
        console.log(`🔄 Processando fila de operações: ${this.operationQueue.length} pendentes`);
        
        while (this.operationQueue.length > 0) {
            // Verificar se banco está disponível
            if (!this.db.isAvailable() || this.isCircuitOpen()) {
                console.log('⏳ Banco indisponível, pausando processamento da fila');
                break;
            }
            
            const operation = this.operationQueue.shift();
            
            try {
                console.log(`🔄 Sincronizando operação: ${operation.type} [${operation.id}]`);
                
                await this.syncOperation(operation);
                console.log(`✅ Operação sincronizada: ${operation.type} [${operation.id}]`);
                
            } catch (error) {
                console.error(`❌ Erro ao sincronizar operação ${operation.type}:`, error);
                
                operation.attempts++;
                
                // Se ainda tem tentativas, colocar de volta na fila
                if (operation.attempts < 3) {
                    this.operationQueue.push(operation);
                } else {
                    console.error(`❌ Operação ${operation.type} [${operation.id}] descartada após 3 tentativas`);
                }
                
                // Parar processamento se houve erro crítico
                break;
            }
            
            // Pequena pausa entre operações
            await this.sleep(100);
        }
        
        this.isProcessingQueue = false;
        
        if (this.operationQueue.length > 0) {
            console.log(`⏳ ${this.operationQueue.length} operações ainda pendentes na fila`);
        } else {
            console.log('✅ Fila de operações processada completamente');
        }
    }
    
    // Sincronizar operação específica com o banco
    async syncOperation(operation) {
        const { type, params } = operation;
        
        switch (type) {
            case 'addClient':
                await this.db.addClient(params.clientData);
                break;
                
            case 'updateClient':
                await this.db.updateClient(params.clientId, params.clientData);
                break;
                
            case 'deleteClient':
                await this.db.deleteClient(params.clientId);
                break;
                
            case 'addActivity':
                await this.db.addActivity(params.activityData);
                break;
                
            default:
                throw new Error(`Tipo de operação não suportado: ${type}`);
        }
    }
    
    // Obter estatísticas de erro
    getErrorStats() {
        return {
            ...this.errorStats,
            circuitBreakerState: {
                isOpen: this.circuitState.isOpen,
                failures: this.circuitState.failures,
                lastFailure: this.circuitState.lastFailure
            },
            queuedOperations: this.operationQueue.length,
            isProcessingQueue: this.isProcessingQueue
        };
    }
    
    // Reset estatísticas
    resetStats() {
        this.errorStats = {
            totalErrors: 0,
            connectionErrors: 0,
            timeoutErrors: 0,
            validationErrors: 0,
            unknownErrors: 0,
            lastError: null,
            errorsByType: {},
            recoverySucess: 0
        };
        
        console.log('🔄 Estatísticas de erro resetadas');
    }
    
    // Métodos auxiliares
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    generateOperationId() {
        return 'op_' + this.generateId();
    }
}

// Classe de erro customizada
class DatabaseError extends Error {
    constructor(message, code = 'UNKNOWN', operation = null) {
        super(message);
        this.name = 'DatabaseError';
        this.code = code;
        this.operation = operation;
        this.timestamp = new Date().toISOString();
    }
}

// Export para uso em Node.js e Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ErrorHandler, DatabaseError };
} else {
    window.ErrorHandler = ErrorHandler;
    window.DatabaseError = DatabaseError;
}