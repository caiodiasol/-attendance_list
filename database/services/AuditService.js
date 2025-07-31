// Audit Service
// Sistema de logs de auditoria para operações de usuários

class AuditService {
    constructor(databaseService) {
        this.db = databaseService;
        this.auditTableName = 'audit_logs';
        this.maxLogsPerTable = 10000; // Máximo de logs por tabela
        this.logRetentionDays = 90; // Reter logs por 90 dias
        
        // Configurações de auditoria
        this.auditConfig = {
            enableClientOperations: true,
            enableActivityOperations: true,
            enableKeywordOperations: true,
            enableLoginOperations: true,
            enableSystemOperations: true,
            logSensitiveData: false, // Não logar dados sensíveis por padrão
            compressOldLogs: true
        };
    }
    
    // Registrar evento de auditoria
    async logEvent(eventData) {
        try {
            // Validar dados do evento
            const validation = this.validateEventData(eventData);
            if (!validation.isValid) {
                console.error('Dados de auditoria inválidos:', validation.errors);
                return false;
            }
            
            // Preparar log de auditoria
            const auditLog = {
                id: this.generateId(),
                table_name: eventData.table_name || 'unknown',
                operation: eventData.operation || 'UNKNOWN',
                record_id: eventData.record_id || null,
                old_values: this.sanitizeData(eventData.old_values),
                new_values: this.sanitizeData(eventData.new_values),
                user_identifier: eventData.user_identifier || this.getCurrentUserIdentifier(),
                ip_address: this.getCurrentUserIP(),
                user_agent: this.getCurrentUserAgent(),
                session_id: this.getCurrentSessionId(),
                timestamp: new Date().toISOString(),
                operation_details: eventData.details || null,
                operation_result: eventData.result || 'SUCCESS'
            };
            
            // Verificar se deve logar esta operação
            if (!this.shouldLogOperation(auditLog)) {
                return true; // Operação ignorada, mas não é erro
            }
            
            // Salvar log
            const success = await this.saveAuditLog(auditLog);
            
            if (success) {
                console.log(`📝 Auditoria registrada: ${auditLog.operation} em ${auditLog.table_name}`);
                
                // Verificar se precisa limpar logs antigos
                await this.cleanOldLogsIfNeeded();
                
                return true;
            } else {
                console.error('Falha ao salvar log de auditoria');
                return false;
            }
            
        } catch (error) {
            console.error('Erro ao registrar auditoria:', error);
            return false;
        }
    }
    
    // Validar dados do evento
    validateEventData(eventData) {
        const errors = [];
        
        if (!eventData.operation) {
            errors.push('Operação é obrigatória');
        }
        
        const validOperations = ['INSERT', 'UPDATE', 'DELETE', 'SELECT', 'LOGIN', 'LOGOUT', 'MIGRATION', 'BACKUP', 'RESTORE'];
        if (eventData.operation && !validOperations.includes(eventData.operation)) {
            errors.push('Operação inválida');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    // Verificar se deve logar a operação
    shouldLogOperation(auditLog) {
        const { table_name, operation } = auditLog;
        
        // Verificar configurações específicas
        if (table_name === 'clients' && !this.auditConfig.enableClientOperations) {
            return false;
        }
        
        if (table_name === 'client_activities' && !this.auditConfig.enableActivityOperations) {
            return false;
        }
        
        if (table_name === 'current_keywords' && !this.auditConfig.enableKeywordOperations) {
            return false;
        }
        
        if (['LOGIN', 'LOGOUT'].includes(operation) && !this.auditConfig.enableLoginOperations) {
            return false;
        }
        
        if (['MIGRATION', 'BACKUP', 'RESTORE'].includes(operation) && !this.auditConfig.enableSystemOperations) {
            return false;
        }
        
        return true;
    }
    
    // Sanitizar dados sensíveis
    sanitizeData(data) {
        if (!data || !this.auditConfig.logSensitiveData) {
            return null;
        }
        
        try {
            const sanitized = JSON.parse(JSON.stringify(data));
            
            // Remover campos sensíveis
            const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'whatsapp'];
            
            const removeSensitiveFields = (obj) => {
                if (typeof obj !== 'object' || obj === null) return obj;
                
                for (const key in obj) {
                    if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
                        obj[key] = '[SENSITIVE_DATA_REMOVED]';
                    } else if (typeof obj[key] === 'object') {
                        removeSensitiveFields(obj[key]);
                    }
                }
                
                return obj;
            };
            
            return JSON.stringify(removeSensitiveFields(sanitized));
            
        } catch (error) {
            console.error('Erro ao sanitizar dados:', error);
            return null;
        }
    }
    
    // Salvar log de auditoria
    async saveAuditLog(auditLog) {
        try {
            // Tentar salvar no banco de dados
            if (this.db.isAvailable()) {
                const result = await this.db.dbConnection.query('INSERT', this.auditTableName, auditLog);
                return result.success;
            } else {
                // Fallback para localStorage
                return this.saveAuditLogToStorage(auditLog);
            }
        } catch (error) {
            console.error('Erro ao salvar log de auditoria:', error);
            // Fallback para localStorage em caso de erro
            return this.saveAuditLogToStorage(auditLog);
        }
    }
    
    // Salvar log no localStorage (fallback)
    saveAuditLogToStorage(auditLog) {
        try {
            const storageKey = 'audit_logs';
            const existingLogs = JSON.parse(localStorage.getItem(storageKey) || '[]');
            
            existingLogs.unshift(auditLog);
            
            // Limitar número de logs no localStorage
            if (existingLogs.length > 1000) {
                existingLogs.splice(1000);
            }
            
            localStorage.setItem(storageKey, JSON.stringify(existingLogs));
            return true;
            
        } catch (error) {
            console.error('Erro ao salvar log no localStorage:', error);
            return false;
        }
    }
    
    // Buscar logs de auditoria
    async getLogs(filters = {}) {
        try {
            const {
                table_name = null,
                operation = null,
                user_identifier = null,
                start_date = null,
                end_date = null,
                limit = 100,
                offset = 0
            } = filters;
            
            let logs = [];
            
            // Tentar buscar no banco de dados
            if (this.db.isAvailable()) {
                const result = await this.db.dbConnection.query('SELECT', this.auditTableName);
                if (result.success) {
                    logs = result.data;
                }
            } else {
                // Fallback para localStorage
                const storageData = localStorage.getItem('audit_logs');
                logs = storageData ? JSON.parse(storageData) : [];
            }
            
            // Aplicar filtros
            let filteredLogs = logs;
            
            if (table_name) {
                filteredLogs = filteredLogs.filter(log => log.table_name === table_name);
            }
            
            if (operation) {
                filteredLogs = filteredLogs.filter(log => log.operation === operation);
            }
            
            if (user_identifier) {
                filteredLogs = filteredLogs.filter(log => 
                    log.user_identifier && log.user_identifier.includes(user_identifier)
                );
            }
            
            if (start_date) {
                const startDate = new Date(start_date);
                filteredLogs = filteredLogs.filter(log => 
                    new Date(log.timestamp) >= startDate
                );
            }
            
            if (end_date) {
                const endDate = new Date(end_date);
                filteredLogs = filteredLogs.filter(log => 
                    new Date(log.timestamp) <= endDate
                );
            }
            
            // Ordenar por timestamp decrescente
            filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Aplicar paginação
            const paginatedLogs = filteredLogs.slice(offset, offset + limit);
            
            return {
                success: true,
                data: paginatedLogs,
                total: filteredLogs.length,
                filtered: filteredLogs.length,
                offset,
                limit
            };
            
        } catch (error) {
            console.error('Erro ao buscar logs de auditoria:', error);
            return {
                success: false,
                error: error.message,
                data: []
            };
        }
    }
    
    // Obter estatísticas de auditoria
    async getAuditStats(period = 'week') {
        try {
            const now = new Date();
            let startDate = null;
            
            switch (period) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            }
            
            const logsResult = await this.getLogs({
                start_date: startDate.toISOString(),
                limit: 10000
            });
            
            if (!logsResult.success) {
                throw new Error(logsResult.error);
            }
            
            const logs = logsResult.data;
            
            // Calcular estatísticas
            const stats = {
                totalOperations: logs.length,
                operationsByType: {},
                operationsByTable: {},
                operationsByUser: {},
                operationsByDay: {},
                errorRate: 0,
                mostActiveUser: null,
                mostModifiedTable: null
            };
            
            // Contar por tipo de operação
            logs.forEach(log => {
                // Por tipo
                stats.operationsByType[log.operation] = (stats.operationsByType[log.operation] || 0) + 1;
                
                // Por tabela
                stats.operationsByTable[log.table_name] = (stats.operationsByTable[log.table_name] || 0) + 1;
                
                // Por usuário
                if (log.user_identifier) {
                    stats.operationsByUser[log.user_identifier] = (stats.operationsByUser[log.user_identifier] || 0) + 1;
                }
                
                // Por dia
                const day = log.timestamp.split('T')[0];
                stats.operationsByDay[day] = (stats.operationsByDay[day] || 0) + 1;
                
                // Taxa de erro
                if (log.operation_result === 'ERROR') {
                    stats.errorRate++;
                }
            });
            
            // Calcular taxa de erro percentual
            stats.errorRate = logs.length > 0 ? (stats.errorRate / logs.length) * 100 : 0;
            
            // Usuário mais ativo
            if (Object.keys(stats.operationsByUser).length > 0) {
                stats.mostActiveUser = Object.keys(stats.operationsByUser).reduce((a, b) => 
                    stats.operationsByUser[a] > stats.operationsByUser[b] ? a : b
                );
            }
            
            // Tabela mais modificada
            if (Object.keys(stats.operationsByTable).length > 0) {
                stats.mostModifiedTable = Object.keys(stats.operationsByTable).reduce((a, b) => 
                    stats.operationsByTable[a] > stats.operationsByTable[b] ? a : b
                );
            }
            
            return {
                success: true,
                period,
                stats
            };
            
        } catch (error) {
            console.error('Erro ao obter estatísticas de auditoria:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Limpar logs antigos
    async cleanOldLogs(daysToKeep = null) {
        try {
            const retentionDays = daysToKeep || this.logRetentionDays;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            
            console.log(`🧹 Limpando logs de auditoria anteriores a ${cutoffDate.toISOString()}`);
            
            // Limpar do banco de dados
            if (this.db.isAvailable()) {
                // Implementar limpeza no banco
                // Por enquanto mantém todos os logs
            }
            
            // Limpar do localStorage
            const storageData = localStorage.getItem('audit_logs');
            if (storageData) {
                const logs = JSON.parse(storageData);
                const filteredLogs = logs.filter(log => 
                    new Date(log.timestamp) >= cutoffDate
                );
                
                const removedCount = logs.length - filteredLogs.length;
                
                if (removedCount > 0) {
                    localStorage.setItem('audit_logs', JSON.stringify(filteredLogs));
                    console.log(`✅ ${removedCount} logs antigos removidos`);
                }
            }
            
            return true;
            
        } catch (error) {
            console.error('Erro ao limpar logs antigos:', error);
            return false;
        }
    }
    
    // Verificar se precisa limpar logs antigos
    async cleanOldLogsIfNeeded() {
        try {
            // Verificar apenas uma vez por hora
            const lastCleanup = localStorage.getItem('last_audit_cleanup');
            const now = Date.now();
            
            if (lastCleanup && (now - parseInt(lastCleanup)) < 60 * 60 * 1000) {
                return; // Já limpou recentemente
            }
            
            // Verificar se há muitos logs
            const logsResult = await this.getLogs({ limit: 1 });
            if (logsResult.total > this.maxLogsPerTable) {
                await this.cleanOldLogs();
            }
            
            localStorage.setItem('last_audit_cleanup', now.toString());
            
        } catch (error) {
            console.error('Erro ao verificar limpeza de logs:', error);
        }
    }
    
    // Exportar logs para análise
    async exportLogs(filters = {}) {
        try {
            const logsResult = await this.getLogs({ ...filters, limit: 10000 });
            
            if (!logsResult.success) {
                throw new Error(logsResult.error);
            }
            
            const logs = logsResult.data;
            
            // Preparar dados para exportação
            const exportData = {
                exported_at: new Date().toISOString(),
                total_logs: logs.length,
                filters_applied: filters,
                logs: logs.map(log => ({
                    timestamp: log.timestamp,
                    operation: log.operation,
                    table: log.table_name,
                    record_id: log.record_id,
                    user: log.user_identifier,
                    ip: log.ip_address,
                    result: log.operation_result,
                    details: log.operation_details
                }))
            };
            
            // Criar arquivo para download
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileName = `audit_logs_${new Date().toISOString().split('T')[0]}.json`;
            
            return {
                success: true,
                data: exportData,
                downloadUri: dataUri,
                fileName: exportFileName
            };
            
        } catch (error) {
            console.error('Erro ao exportar logs:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Métodos auxiliares para obter informações do usuário
    getCurrentUserIdentifier() {
        // Tentar obter identificador do usuário atual
        // Pode ser email, IP, session ID, etc.
        return localStorage.getItem('currentParticipationClient') || 
               this.getCurrentUserIP() || 
               'anonymous';
    }
    
    getCurrentUserIP() {
        // Em ambiente browser, não é possível obter IP diretamente
        // Retornar placeholder
        return 'browser_client';
    }
    
    getCurrentUserAgent() {
        return typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    }
    
    getCurrentSessionId() {
        let sessionId = sessionStorage.getItem('audit_session_id');
        if (!sessionId) {
            sessionId = this.generateId();
            sessionStorage.setItem('audit_session_id', sessionId);
        }
        return sessionId;
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Export para uso em Node.js e Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuditService;
} else {
    window.AuditService = AuditService;
}