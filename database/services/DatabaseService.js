class DatabaseService {
    constructor() {
        this.dbConnection = window.dbConnection || null;
        this.initialized = false;
    }

    async initialize() {
        try {
            // Verificar se há conexão disponível
            if (window.dbConnection) {
                this.dbConnection = window.dbConnection;
                this.initialized = true;
                console.log('DatabaseService inicializado com conexão de banco');
                return true;
            } else {
                // Fallback para localStorage
                this.initialized = true;
                console.log('DatabaseService inicializado em modo localStorage');
                return true;
            }
        } catch (error) {
            console.error('Erro ao inicializar DatabaseService:', error);
            this.initialized = true; // Permitir funcionamento com localStorage
            return true;
        }
    }

    isAvailable() {
        return this.initialized;
    }

    async healthCheck() {
        if (!this.initialized) {
            return { status: 'not_initialized', provider: 'none' };
        }

        if (this.dbConnection) {
            try {
                // Testar conexão se possível
                return { status: 'available', provider: 'database' };
            } catch (error) {
                return { status: 'unavailable', provider: 'localStorage' };
            }
        } else {
            return { status: 'unavailable', provider: 'localStorage' };
        }
    }

    async writeData(path, data) {
        if (!this.dbConnection || typeof this.dbConnection.write !== 'function') {
            console.error("Sem conexão de escrita.");
            return;
        }
        await this.dbConnection.write(path, data);
    }

    async readData(path) {
        if (!this.dbConnection || typeof this.dbConnection.read !== 'function') {
            console.error("Sem conexão de leitura.");
            return null;
        }
        return await this.dbConnection.read(path);
    }

    // Métodos adicionais para compatibilidade
    async getClients() {
        // Fallback para FirebaseDB se disponível
        if (window.FirebaseDB && window.FirebaseDB.getClients) {
            return await window.FirebaseDB.getClients();
        }
        return [];
    }

    async addClient(clientData) {
        // Fallback para FirebaseDB se disponível
        if (window.FirebaseDB && window.FirebaseDB.addClient) {
            return await window.FirebaseDB.addClient(clientData);
        }
        return null;
    }

    async findClientByEmailOrName(searchTerm) {
        // Fallback para FirebaseDB se disponível
        if (window.FirebaseDB && window.FirebaseDB.findClientByEmailOrName) {
            return await window.FirebaseDB.findClientByEmailOrName(searchTerm);
        }
        return null;
    }

    async getCurrentKeywords() {
        // Fallback para FirebaseDB se disponível
        if (window.FirebaseDB && window.FirebaseDB.getCurrentKeywords) {
            const keywords = window.FirebaseDB.getCurrentKeywords();
            return keywords ? { success: true, data: keywords } : { success: false };
        }
        return { success: false };
    }
}

// Disponibiliza no escopo global
window.databaseService = new DatabaseService();
