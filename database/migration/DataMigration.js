// Data Migration System
// Sistema para migrar dados do localStorage para banco de dados persistente

class DataMigration {
    constructor(databaseService) {
        this.db = databaseService;
        this.migrationStatus = {
            clients: { migrated: 0, errors: 0, skipped: 0 },
            activities: { migrated: 0, errors: 0, skipped: 0 },
            keywords: { migrated: 0, errors: 0, skipped: 0 },
            attempts: { migrated: 0, errors: 0, skipped: 0 },
            awards: { migrated: 0, errors: 0, skipped: 0 }
        };
        this.totalOperations = 0;
        this.completedOperations = 0;
    }
    
    // Executar migração completa
    async migrate(options = {}) {
        const {
            migrateClients = true,
            migrateActivities = true,
            migrateKeywords = true,
            migrateAttempts = true,
            migrateAwards = true,
            clearLocalStorage = false,
            createBackup = true
        } = options;
        
        console.log('🚀 Iniciando migração de dados...');
        
        try {
            // Verificar se o serviço de banco está disponível
            if (!this.db.isAvailable()) {
                throw new Error('Serviço de banco de dados não está disponível');
            }
            
            // Criar backup antes da migração
            if (createBackup) {
                await this.createBackup();
            }
            
            // Calcular total de operações
            this.calculateTotalOperations(options);
            
            const startTime = Date.now();
            
            // Executar migrações na ordem correta
            if (migrateClients) {
                await this.migrateClients();
            }
            
            if (migrateActivities) {
                await this.migrateActivities();
            }
            
            if (migrateKeywords) {
                await this.migrateKeywords();
            }
            
            if (migrateAttempts) {
                await this.migrateUserAttempts();
            }
            
            if (migrateAwards) {
                await this.migrateAwardStatus();
            }
            
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            
            // Relatório final
            const report = this.generateMigrationReport(duration);
            
            // Limpar localStorage se solicitado
            if (clearLocalStorage && report.success) {
                await this.clearLocalStorageData();
            }
            
            console.log('✅ Migração concluída!');
            console.log('📊 Relatório:', report);
            
            return report;
            
        } catch (error) {
            console.error('❌ Erro durante a migração:', error);
            return {
                success: false,
                error: error.message,
                status: this.migrationStatus,
                duration: 0
            };
        }
    }
    
    // Migrar clientes
    async migrateClients() {
        console.log('👥 Migrando clientes...');
        
        try {
            const clientsData = localStorage.getItem('dashboard-clients');
            if (!clientsData) {
                console.log('Nenhum cliente encontrado no localStorage');
                return;
            }
            
            const clients = JSON.parse(clientsData);
            console.log(`Encontrados ${clients.length} clientes para migrar`);
            
            for (const client of clients) {
                try {
                    // Verificar se cliente já existe no banco
                    const existingClient = await this.db.findClientByEmailOrName(client.email);
                    
                    if (existingClient) {
                        console.log(`Cliente ${client.email} já existe, pulando...`);
                        this.migrationStatus.clients.skipped++;
                    } else {
                        // Migrar cliente
                        const clientData = {
                            name: client.name || 'Nome não informado',
                            email: client.email || `cliente_${client.id}@temp.com`,
                            whatsapp: client.whatsapp || null,
                            status: client.status || 'active'
                        };
                        
                        // Preservar ID original se possível
                        if (client.id) {
                            clientData.id = client.id;
                        }
                        
                        await this.db.addClient(clientData);
                        this.migrationStatus.clients.migrated++;
                        console.log(`✓ Cliente ${client.email} migrado`);
                    }
                    
                    this.completedOperations++;
                    this.logProgress();
                    
                } catch (error) {
                    console.error(`Erro ao migrar cliente ${client.email}:`, error);
                    this.migrationStatus.clients.errors++;
                    this.completedOperations++;
                }
            }
            
        } catch (error) {
            console.error('Erro ao migrar clientes:', error);
            throw error;
        }
    }
    
    // Migrar atividades
    async migrateActivities() {
        console.log('📊 Migrando atividades...');
        
        try {
            // Buscar todas as chaves de atividades no localStorage
            const activityKeys = Object.keys(localStorage).filter(key => 
                key.startsWith('client-activities_')
            );
            
            if (activityKeys.length === 0) {
                console.log('Nenhuma atividade encontrada no localStorage');
                return;
            }
            
            console.log(`Encontradas ${activityKeys.length} chaves de atividades`);
            
            for (const key of activityKeys) {
                try {
                    const activitiesData = localStorage.getItem(key);
                    if (!activitiesData) continue;
                    
                    const activities = JSON.parse(activitiesData);
                    const clientId = key.replace('client-activities_', '');
                    
                    console.log(`Migrando ${activities.length} atividades do cliente ${clientId}`);
                    
                    for (const activity of activities) {
                        try {
                            // Preparar dados da atividade
                            const activityData = {
                                client_id: activity.client_id || clientId,
                                client_name: activity.client_name || activity.clientName || 'Nome não informado',
                                client_email: activity.client_email || activity.clientEmail || `cliente_${clientId}@temp.com`,
                                activity_type: activity.activity_type || activity.type || 'participation',
                                points: activity.points || 0,
                                details: activity.details ? (typeof activity.details === 'string' ? activity.details : JSON.stringify(activity.details)) : null
                            };
                            
                            // Preservar timestamp se existir
                            if (activity.timestamp) {
                                activityData.timestamp = activity.timestamp;
                            }
                            
                            await this.db.addActivity(activityData);
                            this.migrationStatus.activities.migrated++;
                            
                        } catch (error) {
                            console.error(`Erro ao migrar atividade:`, error);
                            this.migrationStatus.activities.errors++;
                        }
                    }
                    
                    this.completedOperations++;
                    this.logProgress();
                    
                } catch (error) {
                    console.error(`Erro ao processar chave de atividade ${key}:`, error);
                    this.migrationStatus.activities.errors++;
                    this.completedOperations++;
                }
            }
            
        } catch (error) {
            console.error('Erro ao migrar atividades:', error);
            throw error;
        }
    }
    
    // Migrar palavras-chave
    async migrateKeywords() {
        console.log('🔤 Migrando palavras-chave...');
        
        try {
            const keywordsData = localStorage.getItem('current-keywords');
            if (!keywordsData) {
                console.log('Nenhuma palavra-chave encontrada no localStorage');
                return;
            }
            
            const keywords = JSON.parse(keywordsData);
            console.log('Migrando palavras-chave atual:', keywords.correct);
            
            try {
                // Migrar palavra-chave atual
                const keywordData = {
                    correct_word: keywords.correct,
                    incorrect_words: keywords.incorrect || []
                };
                
                await this.db.setCurrentKeywords(keywordData.correct_word, keywordData.incorrect_words);
                this.migrationStatus.keywords.migrated++;
                console.log('✓ Palavras-chave migradas');
                
            } catch (error) {
                console.error('Erro ao migrar palavra-chave:', error);
                this.migrationStatus.keywords.errors++;
            }
            
            this.completedOperations++;
            this.logProgress();
            
        } catch (error) {
            console.error('Erro ao migrar palavras-chave:', error);
            throw error;
        }
    }
    
    // Migrar tentativas de usuários
    async migrateUserAttempts() {
        console.log('🎯 Migrando tentativas de usuários...');
        
        try {
            const attemptsData = localStorage.getItem('user-attempts');
            if (!attemptsData) {
                console.log('Nenhuma tentativa encontrada no localStorage');
                return;
            }
            
            const attempts = JSON.parse(attemptsData);
            const attemptKeys = Object.keys(attempts);
            
            console.log(`Encontradas ${attemptKeys.length} tentativas para migrar`);
            
            for (const key of attemptKeys) {
                try {
                    const attempt = attempts[key];
                    
                    // As tentativas já estão sendo salvas corretamente no localStorage
                    // pela nova implementação, então apenas contamos como migradas
                    this.migrationStatus.attempts.migrated++;
                    
                } catch (error) {
                    console.error(`Erro ao migrar tentativa ${key}:`, error);
                    this.migrationStatus.attempts.errors++;
                }
            }
            
            this.completedOperations++;
            this.logProgress();
            
        } catch (error) {
            console.error('Erro ao migrar tentativas:', error);
            throw error;
        }
    }
    
    // Migrar status de premiação
    async migrateAwardStatus() {
        console.log('🏆 Migrando status de premiação...');
        
        try {
            const awardData = localStorage.getItem('award-status');
            if (!awardData) {
                console.log('Nenhum status de premiação encontrado no localStorage');
                return;
            }
            
            const awardStatus = JSON.parse(awardData);
            console.log('Migrando status de premiação:', awardStatus);
            
            try {
                // O status de premiação continua sendo gerenciado pelo localStorage
                // pois é uma funcionalidade simples que não requer banco de dados
                this.migrationStatus.awards.migrated++;
                console.log('✓ Status de premiação mantido no localStorage');
                
            } catch (error) {
                console.error('Erro ao migrar status de premiação:', error);
                this.migrationStatus.awards.errors++;
            }
            
            this.completedOperations++;
            this.logProgress();
            
        } catch (error) {
            console.error('Erro ao migrar status de premiação:', error);
            throw error;
        }
    }
    
    // Criar backup dos dados atuais
    async createBackup() {
        console.log('💾 Criando backup dos dados atuais...');
        
        try {
            const backup = {
                created_at: new Date().toISOString(),
                version: '1.0',
                data: {}
            };
            
            // Backup de clientes
            const clientsData = localStorage.getItem('dashboard-clients');
            if (clientsData) {
                backup.data.clients = JSON.parse(clientsData);
            }
            
            // Backup de atividades
            const activityKeys = Object.keys(localStorage).filter(key => 
                key.startsWith('client-activities_')
            );
            backup.data.activities = {};
            activityKeys.forEach(key => {
                const data = localStorage.getItem(key);
                if (data) {
                    backup.data.activities[key] = JSON.parse(data);
                }
            });
            
            // Backup de palavras-chave
            const keywordsData = localStorage.getItem('current-keywords');
            if (keywordsData) {
                backup.data.keywords = JSON.parse(keywordsData);
            }
            
            // Backup de tentativas
            const attemptsData = localStorage.getItem('user-attempts');
            if (attemptsData) {
                backup.data.attempts = JSON.parse(attemptsData);
            }
            
            // Backup de premiação
            const awardData = localStorage.getItem('award-status');
            if (awardData) {
                backup.data.award = JSON.parse(awardData);
            }
            
            // Salvar backup
            const backupKey = `migration_backup_${Date.now()}`;
            localStorage.setItem(backupKey, JSON.stringify(backup));
            
            console.log(`✓ Backup criado: ${backupKey}`);
            return backupKey;
            
        } catch (error) {
            console.error('Erro ao criar backup:', error);
            throw error;
        }
    }
    
    // Limpar dados do localStorage após migração bem-sucedida
    async clearLocalStorageData() {
        console.log('🧹 Limpando dados do localStorage...');
        
        try {
            // Remover dados de clientes
            localStorage.removeItem('dashboard-clients');
            
            // Remover atividades
            const activityKeys = Object.keys(localStorage).filter(key => 
                key.startsWith('client-activities_')
            );
            activityKeys.forEach(key => localStorage.removeItem(key));
            
            // Manter palavras-chave atuais para funcionamento contínuo
            // localStorage.removeItem('current-keywords');
            
            // Manter tentativas de usuários para funcionamento contínuo
            // localStorage.removeItem('user-attempts');
            
            // Manter status de premiação para funcionamento contínuo
            // localStorage.removeItem('award-status');
            
            console.log('✓ Dados principais removidos do localStorage');
            console.log('ℹ️ Dados operacionais mantidos para funcionamento contínuo');
            
        } catch (error) {
            console.error('Erro ao limpar localStorage:', error);
            throw error;
        }
    }
    
    // Calcular total de operações para progresso
    calculateTotalOperations(options) {
        this.totalOperations = 0;
        
        if (options.migrateClients) {
            const clientsData = localStorage.getItem('dashboard-clients');
            if (clientsData) {
                this.totalOperations += JSON.parse(clientsData).length;
            }
        }
        
        if (options.migrateActivities) {
            const activityKeys = Object.keys(localStorage).filter(key => 
                key.startsWith('client-activities_')
            );
            this.totalOperations += activityKeys.length;
        }
        
        if (options.migrateKeywords) {
            this.totalOperations += 1;
        }
        
        if (options.migrateAttempts) {
            this.totalOperations += 1;
        }
        
        if (options.migrateAwards) {
            this.totalOperations += 1;
        }
        
        console.log(`Total de operações planejadas: ${this.totalOperations}`);
    }
    
    // Log de progresso
    logProgress() {
        if (this.totalOperations > 0) {
            const percentage = Math.round((this.completedOperations / this.totalOperations) * 100);
            console.log(`📈 Progresso: ${this.completedOperations}/${this.totalOperations} (${percentage}%)`);
        }
    }
    
    // Gerar relatório de migração
    generateMigrationReport(duration) {
        const totalMigrated = Object.values(this.migrationStatus)
            .reduce((sum, status) => sum + status.migrated, 0);
        
        const totalErrors = Object.values(this.migrationStatus)
            .reduce((sum, status) => sum + status.errors, 0);
        
        const totalSkipped = Object.values(this.migrationStatus)
            .reduce((sum, status) => sum + status.skipped, 0);
        
        const success = totalErrors === 0;
        
        return {
            success,
            duration: `${duration}s`,
            summary: {
                migrated: totalMigrated,
                errors: totalErrors,
                skipped: totalSkipped
            },
            details: this.migrationStatus,
            provider: this.db.dbConnection ? this.db.dbConnection.getProvider() : 'localStorage',
            timestamp: new Date().toISOString()
        };
    }
    
    // Verificar se há dados para migrar
    checkDataToMigrate() {
        const dataCheck = {
            clients: !!localStorage.getItem('dashboard-clients'),
            activities: Object.keys(localStorage).some(key => key.startsWith('client-activities_')),
            keywords: !!localStorage.getItem('current-keywords'),
            attempts: !!localStorage.getItem('user-attempts'),
            awards: !!localStorage.getItem('award-status')
        };
        
        const hasData = Object.values(dataCheck).some(Boolean);
        
        return {
            hasData,
            details: dataCheck
        };
    }
    
    // Restaurar backup
    async restoreBackup(backupKey) {
        console.log(`🔄 Restaurando backup: ${backupKey}`);
        
        try {
            const backupData = localStorage.getItem(backupKey);
            if (!backupData) {
                throw new Error('Backup não encontrado');
            }
            
            const backup = JSON.parse(backupData);
            
            // Restaurar clientes
            if (backup.data.clients) {
                localStorage.setItem('dashboard-clients', JSON.stringify(backup.data.clients));
            }
            
            // Restaurar atividades
            if (backup.data.activities) {
                Object.keys(backup.data.activities).forEach(key => {
                    localStorage.setItem(key, JSON.stringify(backup.data.activities[key]));
                });
            }
            
            // Restaurar palavras-chave
            if (backup.data.keywords) {
                localStorage.setItem('current-keywords', JSON.stringify(backup.data.keywords));
            }
            
            // Restaurar tentativas
            if (backup.data.attempts) {
                localStorage.setItem('user-attempts', JSON.stringify(backup.data.attempts));
            }
            
            // Restaurar premiação
            if (backup.data.award) {
                localStorage.setItem('award-status', JSON.stringify(backup.data.award));
            }
            
            console.log('✅ Backup restaurado com sucesso');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao restaurar backup:', error);
            throw error;
        }
    }
}

// Export para uso em Node.js e Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataMigration;
} else {
    window.DataMigration = DataMigration;
}