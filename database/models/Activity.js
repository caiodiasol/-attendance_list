// Activity Model
// Modelo para gerenciamento de atividades dos clientes

class Activity {
    constructor(dbConnection) {
        this.db = dbConnection;
        this.tableName = 'client_activities';
        this.maxActivitiesPerClient = 50; // Limitar histórico
    }
    
    // Validar dados da atividade
    validate(activityData) {
        const errors = [];
        
        // Validar client_id
        if (!activityData.client_id) {
            errors.push('ID do cliente é obrigatório');
        }
        
        // Validar client_name
        if (!activityData.client_name || typeof activityData.client_name !== 'string') {
            errors.push('Nome do cliente é obrigatório');
        }
        
        // Validar client_email
        if (!activityData.client_email || typeof activityData.client_email !== 'string') {
            errors.push('Email do cliente é obrigatório');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(activityData.client_email)) {
            errors.push('Email deve ter um formato válido');
        }
        
        // Validar activity_type
        const validTypes = ['participation', 'correct_answer', 'incorrect_answer', 'login', 'logout'];
        if (!activityData.activity_type || !validTypes.includes(activityData.activity_type)) {
            errors.push('Tipo de atividade inválido');
        }
        
        // Validar points (opcional)
        if (activityData.points !== undefined && (typeof activityData.points !== 'number' || activityData.points < 0)) {
            errors.push('Pontos devem ser um número não negativo');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    // Criar nova atividade
    async create(activityData) {
        try {
            // Validar dados
            const validation = this.validate(activityData);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: validation.errors.join(', '),
                    data: null
                };
            }
            
            // Preparar dados para inserção
            const activity = {
                id: this.generateId(),
                client_id: activityData.client_id,
                client_name: activityData.client_name,
                client_email: activityData.client_email.toLowerCase().trim(),
                activity_type: activityData.activity_type,
                points: activityData.points || 0,
                details: activityData.details ? JSON.stringify(activityData.details) : null,
                timestamp: new Date().toISOString()
            };
            
            // Inserir no banco
            const result = await this.db.query('INSERT', this.tableName, activity);
            
            if (result.success) {
                // Limitar número de atividades por cliente
                await this.limitActivitiesPerClient(activityData.client_id);
                
                // Registrar log de auditoria
                await this.logAudit('INSERT', activity.id, null, activity);
                
                return {
                    success: true,
                    data: activity,
                    message: 'Atividade registrada com sucesso'
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
            
        } catch (error) {
            console.error('Erro ao criar atividade:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Buscar atividades de um cliente
    async findByClientId(clientId, limit = 50) {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                let activities = result.data.filter(a => a.client_id === clientId);
                
                // Ordenar por timestamp decrescente
                activities.sort((a, b) => {
                    const timeA = new Date(a.timestamp).getTime();
                    const timeB = new Date(b.timestamp).getTime();
                    return timeB - timeA;
                });
                
                // Limitar resultado
                if (limit) {
                    activities = activities.slice(0, limit);
                }
                
                return {
                    success: true,
                    data: activities
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao buscar atividades do cliente:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Buscar todas as atividades (feed geral)
    async findAll(limit = 50) {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                let activities = result.data;
                
                // Ordenar por timestamp decrescente
                activities.sort((a, b) => {
                    const timeA = new Date(a.timestamp).getTime();
                    const timeB = new Date(b.timestamp).getTime();
                    return timeB - timeA;
                });
                
                // Limitar resultado
                if (limit) {
                    activities = activities.slice(0, limit);
                }
                
                return {
                    success: true,
                    data: activities
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao buscar atividades:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Buscar atividades por período
    async findByDateRange(startDate, endDate, limit = 100) {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                
                let activities = result.data.filter(activity => {
                    const activityDate = new Date(activity.timestamp);
                    return activityDate >= start && activityDate <= end;
                });
                
                // Ordenar por timestamp decrescente
                activities.sort((a, b) => {
                    const timeA = new Date(a.timestamp).getTime();
                    const timeB = new Date(b.timestamp).getTime();
                    return timeB - timeA;
                });
                
                // Limitar resultado
                if (limit) {
                    activities = activities.slice(0, limit);
                }
                
                return {
                    success: true,
                    data: activities
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao buscar atividades por período:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Obter estatísticas de atividades
    async getStats(period = 'all') {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                let activities = result.data;
                
                // Filtrar por período se especificado
                if (period !== 'all') {
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
                    }
                    
                    if (startDate) {
                        activities = activities.filter(activity => {
                            const activityDate = new Date(activity.timestamp);
                            return activityDate >= startDate;
                        });
                    }
                }
                
                // Calcular estatísticas
                const totalActivities = activities.length;
                const totalPoints = activities.reduce((sum, activity) => sum + (activity.points || 0), 0);
                const uniqueClients = new Set(activities.map(a => a.client_id)).size;
                
                // Atividades por tipo
                const byType = {};
                activities.forEach(activity => {
                    byType[activity.activity_type] = (byType[activity.activity_type] || 0) + 1;
                });
                
                // Atividades por dia (últimos 7 dias)
                const dailyStats = {};
                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const dateKey = date.toISOString().split('T')[0];
                    dailyStats[dateKey] = 0;
                }
                
                activities.forEach(activity => {
                    const activityDate = new Date(activity.timestamp);
                    const dateKey = activityDate.toISOString().split('T')[0];
                    if (dailyStats.hasOwnProperty(dateKey)) {
                        dailyStats[dateKey]++;
                    }
                });
                
                return {
                    success: true,
                    data: {
                        totalActivities,
                        totalPoints,
                        uniqueClients,
                        byType,
                        dailyStats
                    }
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao obter estatísticas de atividades:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Limpar todas as atividades
    async clearAll() {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                // Deletar todas as atividades
                const deletePromises = result.data.map(activity => 
                    this.db.query('DELETE', this.tableName, { id: activity.id })
                );
                
                await Promise.all(deletePromises);
                
                // Registrar log de auditoria
                await this.logAudit('DELETE_ALL', 'all', null, null);
                
                return {
                    success: true,
                    data: { deletedCount: result.data.length },
                    message: 'Todas as atividades foram removidas'
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao limpar atividades:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Limitar número de atividades por cliente
    async limitActivitiesPerClient(clientId) {
        try {
            const clientActivities = await this.findByClientId(clientId, null);
            
            if (clientActivities.success && clientActivities.data.length > this.maxActivitiesPerClient) {
                const activitiesToRemove = clientActivities.data.slice(this.maxActivitiesPerClient);
                
                const deletePromises = activitiesToRemove.map(activity => 
                    this.db.query('DELETE', this.tableName, { id: activity.id })
                );
                
                await Promise.all(deletePromises);
                
                console.log(`Removidas ${activitiesToRemove.length} atividades antigas do cliente ${clientId}`);
            }
        } catch (error) {
            console.error('Erro ao limitar atividades do cliente:', error);
        }
    }
    
    // Registrar log de auditoria
    async logAudit(operation, recordId, oldValues, newValues) {
        try {
            const auditLog = {
                id: this.generateId(),
                table_name: this.tableName,
                operation,
                record_id: recordId,
                old_values: oldValues ? JSON.stringify(oldValues) : null,
                new_values: newValues ? JSON.stringify(newValues) : null,
                user_identifier: 'system',
                timestamp: new Date().toISOString()
            };
            
            await this.db.query('INSERT', 'audit_logs', auditLog);
        } catch (error) {
            console.error('Erro ao registrar auditoria:', error);
        }
    }
    
    // Gerar ID único
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// Export para uso em Node.js e Browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Activity;
} else {
    window.Activity = Activity;
}