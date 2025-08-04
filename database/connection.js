const env = (typeof process !== 'undefined' && process.env) || window;
// Database Connection Manager
// Suporte para MySQL e Firebase com fallback para localStorage

class DatabaseConnection {
    constructor() {
        this.mysqlConnection = null;
        this.firebaseConnection = null;
        this.currentProvider = 'localStorage'; // 'mysql', 'firebase', 'localStorage'
        this.initialized = false;
        
        // Configurações do MySQL
        this.mysqlConfig = {
            host: env.DB_HOST || 'localhost',
            port: env.DB_PORT || 3306,
            user: env.DB_USER || 'root',
            password: env.DB_PASS || '',
            database: env.DB_NAME || 'clientkey',
            charset: 'utf8mb4',
            timezone: 'local',
            acquireTimeout: 60000,
            timeout: 60000,
            reconnect: true
        };
        
        // Configurações do Firebase
        this.firebaseConfig = {
            apiKey: env.FIREBASE_API_KEY || "AIzaSyAVdVaB69g20FhHS5tdMvLjWzxWZ7cuCU0",
            authDomain: env.FIREBASE_AUTH_DOMAIN || "clientkey-b8ccf.firebaseapp.com",
            projectId: env.FIREBASE_PROJECT_ID || "clientkey-b8ccf",
            storageBucket: env.FIREBASE_STORAGE_BUCKET || "clientkey-b8ccf.firebasestorage.app",
            messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || "835785432053",
            appId: env.FIREBASE_APP_ID || "1:835785432053:web:f5ceccc6cf07e1a6a79ebc",
            measurementId: env.FIREBASE_MEASUREMENT_ID || "G-YVWDNJFG8K"
        };
    }
    
    // Inicializar conexão com banco de dados
    async initialize() {
        console.log('Inicializando conexão com banco de dados...');
        
        // Tentar MySQL primeiro
        if (await this.initializeMySQL()) {
            this.currentProvider = 'mysql';
            console.log('✅ Conectado ao MySQL');
            this.initialized = true;
            return true;
        }
        
        // Fallback para Firebase
        if (await this.initializeFirebase()) {
            this.currentProvider = 'firebase';
            console.log('✅ Conectado ao Firebase');
            this.initialized = true;
            return true;
        }
        
        // Fallback final para localStorage
        console.log('⚠️ Usando localStorage como fallback');
        this.currentProvider = 'localStorage';
        this.initialized = true;
        return true;
    }
    
    // Inicializar MySQL
    async initializeMySQL() {
        try {
            // Verificar se estamos no ambiente Node.js
            if (typeof window !== 'undefined') {
                console.log('MySQL não disponível no browser, tentando Firebase...');
                return false;
            }
            
            const mysql = require('mysql2/promise');
            
            this.mysqlConnection = await mysql.createConnection(this.mysqlConfig);
            
            // Testar conexão
            await this.mysqlConnection.execute('SELECT 1');
            
            // Configurar timezone
            await this.mysqlConnection.execute("SET time_zone = '+00:00'");
            
            return true;
        } catch (error) {
            console.error('Erro ao conectar MySQL:', error.message);
            return false;
        }
    }
    
    // Inicializar Firebase
    async initializeFirebase() {
        try {
            // Verificar se Firebase está configurado
            if (this.firebaseConfig.apiKey === "your-api-key-here") {
                console.log('Firebase não configurado');
                return false;
            }
            
            // Verificar se estamos no browser
            if (typeof window === 'undefined') {
                console.log('Firebase indisponível no servidor');
                return false;
            }
            
            // Importar Firebase (assumindo que já está carregado)
            if (typeof firebase === 'undefined') {
                console.log('Firebase SDK não carregado');
                return false;
            }
            
            // Inicializar Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(this.firebaseConfig);
            }
            
            this.firebaseConnection = firebase.firestore();
            
            // Testar conexão
            await this.firebaseConnection.collection('test').limit(1).get();
            
            return true;
        } catch (error) {
            console.error('Erro ao conectar Firebase:', error.message);
            return false;
        }
    }
    
    // Executar query baseado no provider atual
    async query(sql, params = []) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        switch (this.currentProvider) {
            case 'mysql':
                return await this.queryMySQL(sql, params);
            case 'firebase':
                return await this.queryFirebase(sql, params);
            default:
                return await this.queryLocalStorage(sql, params);
        }
    }
    
    // Query MySQL
    async queryMySQL(sql, params = []) {
        try {
            const [rows] = await this.mysqlConnection.execute(sql, params);
            return {
                success: true,
                data: rows,
                affectedRows: this.mysqlConnection.info?.affectedRows || 0
            };
        } catch (error) {
            console.error('Erro na query MySQL:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }
    
    // Query Firebase (simulada)
    async queryFirebase(operation, collection, data = null) {
        try {
            let result;
            
            switch (operation) {
                case 'SELECT':
                    result = await this.firebaseConnection.collection(collection).get();
                    return {
                        success: true,
                        data: result.docs.map(doc => ({ id: doc.id, ...doc.data() }))
                    };
                    
                case 'INSERT':
                    result = await this.firebaseConnection.collection(collection).add(data);
                    return {
                        success: true,
                        data: { id: result.id, ...data }
                    };
                    
                case 'UPDATE':
                    await this.firebaseConnection.collection(collection).doc(data.id).update(data);
                    return {
                        success: true,
                        data: data
                    };
                    
                case 'DELETE':
                    await this.firebaseConnection.collection(collection).doc(data.id).delete();
                    return {
                        success: true,
                        data: { deleted: true }
                    };
                    
                default:
                    throw new Error('Operação não suportada');
            }
        } catch (error) {
            console.error('Erro na query Firebase:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }
    
    // Query localStorage (fallback)
    async queryLocalStorage(operation, table, data = null) {
        try {
            const storageKey = `db_${table}`;
            let records = JSON.parse(localStorage.getItem(storageKey) || '[]');
            
            switch (operation) {
                case 'SELECT':
                    return {
                        success: true,
                        data: records
                    };
                    
                case 'INSERT':
                    const newRecord = {
                        id: this.generateId(),
                        ...data,
                        created_at: new Date().toISOString()
                    };
                    records.push(newRecord);
                    localStorage.setItem(storageKey, JSON.stringify(records));
                    return {
                        success: true,
                        data: newRecord
                    };
                    
                case 'UPDATE':
                    const updateIndex = records.findIndex(r => r.id === data.id);
                    if (updateIndex !== -1) {
                        records[updateIndex] = { ...records[updateIndex], ...data, updated_at: new Date().toISOString() };
                        localStorage.setItem(storageKey, JSON.stringify(records));
                        return {
                            success: true,
                            data: records[updateIndex]
                        };
                    }
                    throw new Error('Registro não encontrado');
                    
                case 'DELETE':
                    const filteredRecords = records.filter(r => r.id !== data.id);
                    localStorage.setItem(storageKey, JSON.stringify(filteredRecords));
                    return {
                        success: true,
                        data: { deleted: true }
                    };
                    
                default:
                    throw new Error('Operação não suportada');
            }
        } catch (error) {
            console.error('Erro na query localStorage:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }
    
    // Gerar ID único
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    // Verificar saúde da conexão
    async healthCheck() {
        try {
            switch (this.currentProvider) {
                case 'mysql':
                    await this.mysqlConnection.execute('SELECT 1');
                    return { status: 'healthy', provider: 'mysql' };
                    
                case 'firebase':
                    await this.firebaseConnection.collection('health').limit(1).get();
                    return { status: 'healthy', provider: 'firebase' };
                    
                default:
                    return { status: 'healthy', provider: 'localStorage' };
            }
        } catch (error) {
            return { status: 'unhealthy', provider: this.currentProvider, error: error.message };
        }
    }
    
    // Fechar conexão
    async close() {
        try {
            if (this.mysqlConnection) {
                await this.mysqlConnection.end();
                this.mysqlConnection = null;
            }
            
            this.firebaseConnection = null;
            this.initialized = false;
            
            console.log('Conexões fechadas');
        } catch (error) {
            console.error('Erro ao fechar conexões:', error);
        }
    }
    
    // Getter para provider atual
    getProvider() {
        return this.currentProvider;
    }
    
    // Verificar se está inicializado
    isInitialized() {
        return this.initialized;
    }
}

// Singleton instance
const dbConnection = new DatabaseConnection();

// Export para uso em Node.js e Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = dbConnection;
} else {
    window.DatabaseConnection = DatabaseConnection;
    window.dbConnection = dbConnection;
}