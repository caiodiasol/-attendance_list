class DatabaseService {
    constructor() {
        this.dbConnection = window.dbConnection || null;
    }

    isAvailable() {
        return !!this.dbConnection;
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
}

// Disponibiliza no escopo global
window.DatabaseService = new DatabaseService();
