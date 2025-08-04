// Backup Service
// Sistema de backup automático para dados de usuários

class BackupService {
    constructor(databaseService) {
        this.db = databaseService;
        this.backupInterval = null;
        this.backupFrequency = 30 * 60 * 1000; // 30 minutos por padrão
        this.maxBackups = 10; // Máximo de backups a manter
        this.isRunning = false;
        
        // Configurações de backup
        this.backupConfig = {
            includeClients: true,
            includeActivities: true,
            includeKeywords: true,
            includeAttempts: true,
            includeAwards: true,
            compressData: true,
            encryptData: false // Pode ser implementado no futuro
        };
    }
    
    // Iniciar backup automático
    startAutomaticBackup(frequency = null) {
        try {
            if (this.isRunning) {
                console.log('⚠️ Backup automático já está rodando');
                return false;
            }
            
            if (frequency) {
                this.backupFrequency = frequency;
            }
            
            console.log(`🔄 Iniciando backup automático (frequência: ${this.backupFrequency / 1000 / 60} minutos)`);
            
            // Fazer backup inicial
            this.createBackup();
            
            // Configurar intervalo
            this.backupInterval = setInterval(() => {
                this.createBackup();
            }, this.backupFrequency);
            
            this.isRunning = true;
            console.log('✅ Backup automático iniciado');
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao iniciar backup automático:', error);
            return false;
        }
    }
    
    // Parar backup automático
    stopAutomaticBackup() {
        try {
            if (!this.isRunning) {
                console.log('⚠️ Backup automático não está rodando');
                return false;
            }
            
            if (this.backupInterval) {
                clearInterval(this.backupInterval);
                this.backupInterval = null;
            }
            
            this.isRunning = false;
            console.log('🛑 Backup automático parado');
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao parar backup automático:', error);
            return false;
        }
    }
    
    // Criar backup manual
    async createBackup(options = {}) {
        try {
            const config = { ...this.backupConfig, ...options };
            console.log('💾 Criando backup dos dados...');
            
            const backup = {
                id: this.generateBackupId(),
                created_at: new Date().toISOString(),
                version: '1.0',
                provider: this.db.isAvailable() ? this.db.dbConnection.getProvider() : 'localStorage',
                config: config,
                data: {},
                metadata: {
                    totalRecords: 0,
                    dataSize: 0,
                    compressed: config.compressData
                }
            };
            
            // Backup de clientes
            if (config.includeClients) {
                try {
                    const clients = await this.db.getClients();
                    backup.data.clients = clients;
                    backup.metadata.totalRecords += clients.length;
                    console.log(`📊 Clientes incluídos no backup: ${clients.length}`);
                } catch (error) {
                    console.error('Erro ao fazer backup de clientes:', error);
                    backup.data.clients = [];
                }
            }
            
            // Backup de atividades
            if (config.includeActivities) {
                try {
                    const activities = await this.db.getAllActivities(1000); // Limitar a 1000 atividades mais recentes
                    backup.data.activities = activities;
                    backup.metadata.totalRecords += activities.length;
                    console.log(`📊 Atividades incluídas no backup: ${activities.length}`);
                } catch (error) {
                    console.error('Erro ao fazer backup de atividades:', error);
                    backup.data.activities = [];
                }
            }
            
            // Backup de palavras-chave
            if (config.includeKeywords) {
                try {
                    const keywords = this.db.getCurrentKeywords();
                    backup.data.keywords = keywords;
                    if (keywords) {
                        backup.metadata.totalRecords += 1;
                    }
                    console.log(`📊 Palavras-chave incluídas no backup: ${keywords ? 'Sim' : 'Não'}`);
                } catch (error) {
                    console.error('Erro ao fazer backup de palavras-chave:', error);
                    backup.data.keywords = null;
                }
            }
            
            // Backup de tentativas
            if (config.includeAttempts) {
                try {
                    const attemptsData = localStorage.getItem('user-attempts');
                    const attempts = attemptsData ? JSON.parse(attemptsData) : {};
                    backup.data.attempts = attempts;
                    backup.metadata.totalRecords += Object.keys(attempts).length;
                    console.log(`📊 Tentativas incluídas no backup: ${Object.keys(attempts).length}`);
                } catch (error) {
                    console.error('Erro ao fazer backup de tentativas:', error);
                    backup.data.attempts = {};
                }
            }
            
            // Backup de premiação
            if (config.includeAwards) {
                try {
                    const awardData = localStorage.getItem('award-status');
                    const awardStatus = awardData ? JSON.parse(awardData) : null;
                    backup.data.award = awardStatus;
                    if (awardStatus) {
                        backup.metadata.totalRecords += 1;
                    }
                    console.log(`📊 Status de premiação incluído no backup: ${awardStatus ? 'Sim' : 'Não'}`);
                } catch (error) {
                    console.error('Erro ao fazer backup de premiação:', error);
                    backup.data.award = null;
                }
            }
            
            // Calcular tamanho dos dados
            const dataString = JSON.stringify(backup.data);
            backup.metadata.dataSize = new Blob([dataString]).size;
            
            // Comprimir dados se solicitado
            if (config.compressData) {
                try {
                    backup.data = this.compressData(backup.data);
                    console.log('🗜️ Dados comprimidos');
                } catch (error) {
                    console.warn('⚠️ Não foi possível comprimir os dados:', error);
                }
            }
            
            // Salvar backup
            const backupKey = `backup_${backup.id}`;
            const success = await this.saveBackup(backupKey, backup);
            
            if (success) {
                // Limpar backups antigos
                await this.cleanOldBackups();
                
                console.log(`✅ Backup criado com sucesso: ${backupKey}`);
                console.log(`📊 Total de registros: ${backup.metadata.totalRecords}`);
                console.log(`📏 Tamanho dos dados: ${this.formatBytes(backup.metadata.dataSize)}`);
                
                return {
                    success: true,
                    backupId: backup.id,
                    backupKey,
                    metadata: backup.metadata
                };
            } else {
                throw new Error('Falha ao salvar backup');
            }
            
        } catch (error) {
            console.error('❌ Erro ao criar backup:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Salvar backup (localStorage por enquanto, pode ser expandido para outros locais)
    async saveBackup(backupKey, backup) {
        try {
            const backupString = JSON.stringify(backup);
            
            // Verificar se há espaço suficiente no localStorage
            const availableSpace = this.getAvailableLocalStorageSpace();
            const requiredSpace = new Blob([backupString]).size;
            
            if (requiredSpace > availableSpace) {
                console.warn('⚠️ Espaço insuficiente no localStorage, tentando limpar backups antigos...');
                await this.cleanOldBackups(this.maxBackups - 2);
            }
            
            localStorage.setItem(backupKey, backupString);
            
            // Salvar referência do backup
            const backupsList = this.getBackupsList();
            backupsList.push({
                key: backupKey,
                id: backup.id,
                created_at: backup.created_at,
                provider: backup.provider,
                totalRecords: backup.metadata.totalRecords,
                dataSize: backup.metadata.dataSize
            });
            
            // Manter apenas os últimos backups
            if (backupsList.length > this.maxBackups) {
                backupsList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                const backupsToKeep = backupsList.slice(0, this.maxBackups);
                localStorage.setItem('backup_list', JSON.stringify(backupsToKeep));
            } else {
                localStorage.setItem('backup_list', JSON.stringify(backupsList));
            }
            
            return true;
        } catch (error) {
            console.error('Erro ao salvar backup:', error);
            return false;
        }
    }
    
    // Listar backups disponíveis
    getBackupsList() {
        try {
            const backupsData = localStorage.getItem('backup_list');
            return backupsData ? JSON.parse(backupsData) : [];
        } catch (error) {
            console.error('Erro ao listar backups:', error);
            return [];
        }
    }
    
    // Restaurar backup
    async restoreBackup(backupId) {
        try {
            console.log(`🔄 Restaurando backup: ${backupId}`);
            
            const backupKey = `backup_${backupId}`;
            const backupData = localStorage.getItem(backupKey);
            
            if (!backupData) {
                throw new Error('Backup não encontrado');
            }
            
            const backup = JSON.parse(backupData);
            
            // Descomprimir dados se necessário
            let data = backup.data;
            if (backup.metadata.compressed) {
                try {
                    data = this.decompressData(data);
                    console.log('🗜️ Dados descomprimidos');
                } catch (error) {
                    console.warn('⚠️ Não foi possível descomprimir os dados:', error);
                }
            }
            
            let restoredCount = 0;
            
            // Restaurar clientes
            if (data.clients && Array.isArray(data.clients)) {
                localStorage.setItem('dashboard-clients', JSON.stringify(data.clients));
                restoredCount += data.clients.length;
                console.log(`✓ ${data.clients.length} clientes restaurados`);
            }
            
            // Restaurar atividades (mais complexo pois são armazenadas por cliente)
            if (data.activities && Array.isArray(data.activities)) {
                const activitiesByClient = {};
                
                data.activities.forEach(activity => {
                    const clientId = activity.client_id;
                    if (!activitiesByClient[clientId]) {
                        activitiesByClient[clientId] = [];
                    }
                    activitiesByClient[clientId].push(activity);
                });
                
                Object.keys(activitiesByClient).forEach(clientId => {
                    const storageKey = `client-activities_${clientId}`;
                    localStorage.setItem(storageKey, JSON.stringify(activitiesByClient[clientId]));
                });
                
                restoredCount += data.activities.length;
                console.log(`✓ ${data.activities.length} atividades restauradas`);
            }
            
            // Restaurar palavras-chave
            if (data.keywords) {
                localStorage.setItem('current-keywords', JSON.stringify(data.keywords));
                restoredCount += 1;
                console.log('✓ Palavras-chave restauradas');
            }
            
            // Restaurar tentativas
            if (data.attempts) {
                localStorage.setItem('user-attempts', JSON.stringify(data.attempts));
                restoredCount += Object.keys(data.attempts).length;
                console.log(`✓ ${Object.keys(data.attempts).length} tentativas restauradas`);
            }
            
            // Restaurar premiação
            if (data.award) {
                localStorage.setItem('award-status', JSON.stringify(data.award));
                restoredCount += 1;
                console.log('✓ Status de premiação restaurado');
            }
            
            console.log(`✅ Backup restaurado com sucesso: ${restoredCount} registros`);
            
            return {
                success: true,
                restoredCount,
                backupInfo: {
                    id: backup.id,
                    created_at: backup.created_at,
                    provider: backup.provider
                }
            };
            
        } catch (error) {
            console.error('❌ Erro ao restaurar backup:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Limpar backups antigos
    async cleanOldBackups(maxToKeep = null) {
        try {
            const keepCount = maxToKeep || this.maxBackups;
            const backupsList = this.getBackupsList();
            
            if (backupsList.length <= keepCount) {
                return;
            }
            
            // Ordenar por data (mais recente primeiro)
            backupsList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            
            // Backups para remover
            const backupsToRemove = backupsList.slice(keepCount);
            
            console.log(`🧹 Removendo ${backupsToRemove.length} backups antigos...`);
            
            for (const backup of backupsToRemove) {
                try {
                    localStorage.removeItem(backup.key);
                } catch (error) {
                    console.warn(`Erro ao remover backup ${backup.key}:`, error);
                }
            }
            
            // Atualizar lista
            const updatedList = backupsList.slice(0, keepCount);
            localStorage.setItem('backup_list', JSON.stringify(updatedList));
            
            console.log(`✅ ${backupsToRemove.length} backups antigos removidos`);
            
        } catch (error) {
            console.error('Erro ao limpar backups antigos:', error);
        }
    }
    
    // Deletar backup específico
    async deleteBackup(backupId) {
        try {
            const backupKey = `backup_${backupId}`;
            
            // Remover do localStorage
            localStorage.removeItem(backupKey);
            
            // Remover da lista
            const backupsList = this.getBackupsList();
            const updatedList = backupsList.filter(backup => backup.id !== backupId);
            localStorage.setItem('backup_list', JSON.stringify(updatedList));
            
            console.log(`🗑️ Backup ${backupId} removido`);
            
            return true;
        } catch (error) {
            console.error('Erro ao deletar backup:', error);
            return false;
        }
    }
    
    // Configurar frequência de backup
    setBackupFrequency(minutes) {
        this.backupFrequency = minutes * 60 * 1000;
        
        if (this.isRunning) {
            // Reiniciar com nova frequência
            this.stopAutomaticBackup();
            this.startAutomaticBackup();
        }
        
        console.log(`⚙️ Frequência de backup alterada para ${minutes} minutos`);
    }
    
    // Obter estatísticas de backup
    getBackupStats() {
        const backupsList = this.getBackupsList();
        
        if (backupsList.length === 0) {
            return {
                totalBackups: 0,
                lastBackup: null,
                totalSize: 0,
                averageSize: 0
            };
        }
        
        const totalSize = backupsList.reduce((sum, backup) => sum + (backup.dataSize || 0), 0);
        const lastBackup = backupsList.reduce((latest, backup) => 
            new Date(backup.created_at) > new Date(latest.created_at) ? backup : latest
        );
        
        return {
            totalBackups: backupsList.length,
            lastBackup: lastBackup,
            totalSize: totalSize,
            averageSize: Math.round(totalSize / backupsList.length),
            isRunning: this.isRunning,
            frequency: this.backupFrequency / 1000 / 60 // em minutos
        };
    }
    
    // Métodos auxiliares
    generateBackupId() {
        return Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    compressData(data) {
        // Implementação simples de compressão (pode ser melhorada)
        const jsonString = JSON.stringify(data);
        try {
            // Usar compressão nativa do browser se disponível
            if (typeof CompressionStream !== 'undefined') {
                // Implementar compressão real no futuro
                return jsonString;
            } else {
                // Fallback: apenas retornar os dados originais
                return jsonString;
            }
        } catch (error) {
            return jsonString;
        }
    }
    
    decompressData(compressedData) {
        // Implementação simples de descompressão
        try {
            if (typeof compressedData === 'string') {
                return JSON.parse(compressedData);
            }
            return compressedData;
        } catch (error) {
            return compressedData;
        }
    }
    
    getAvailableLocalStorageSpace() {
        try {
            const testKey = 'test_storage_space';
            let size = 0;
            
            // Tentar escrever dados até atingir o limite
            try {
                for (let i = 0; i < 10000; i++) {
                    const testData = 'x'.repeat(1024); // 1KB
                    localStorage.setItem(testKey + i, testData);
                    size += 1024;
                }
            } catch (e) {
                // Limpar dados de teste
                for (let i = 0; i < 10000; i++) {
                    localStorage.removeItem(testKey + i);
                }
            }
            
            return size;
        } catch (error) {
            return 5 * 1024 * 1024; // Assumir 5MB por padrão
        }
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// Export para uso em Node.js e Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackupService;
} else {
    window.BackupService = BackupService;
}