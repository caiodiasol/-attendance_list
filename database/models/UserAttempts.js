// UserAttempts Model
// Modelo para gerenciamento de tentativas dos usuários nas palavras-chave

class UserAttempts {
    constructor(dbConnection) {
        this.db = dbConnection;
        this.tableName = 'user_attempts';
    }
    
    // Validar dados da tentativa
    validate(attemptData) {
        const errors = [];
        
        // Validar email do cliente
        if (!attemptData.client_email || typeof attemptData.client_email !== 'string') {
            errors.push('Email do cliente é obrigatório');
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(attemptData.client_email)) {
                errors.push('Email do cliente inválido');
            }
        }
        
        // Validar ID da palavra-chave
        if (!attemptData.keyword_id || typeof attemptData.keyword_id !== 'string') {
            errors.push('ID da palavra-chave é obrigatório');
        }
        
        // Validar palavra selecionada
        if (!attemptData.selected_word || typeof attemptData.selected_word !== 'string') {
            errors.push('Palavra selecionada é obrigatória');
        }
        
        // Validar se é correta
        if (typeof attemptData.is_correct !== 'boolean') {
            errors.push('Campo is_correct deve ser boolean');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    // Registrar tentativa do usuário
    async recordAttempt(attemptData) {
        try {
            // Validar dados
            const validation = this.validate(attemptData);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: validation.errors.join(', '),
                    data: null
                };
            }
            
            // Preparar dados para inserção
            const attempt = {
                id: this.generateId(),
                client_email: attemptData.client_email.toLowerCase().trim(),
                keyword_id: attemptData.keyword_id,
                selected_word: attemptData.selected_word.toUpperCase().trim(),
                is_correct: attemptData.is_correct,
                points_earned: attemptData.is_correct ? 1 : 0,
                attempted_at: new Date().toISOString()
            };
            
            // Inserir no banco
            const result = await this.db.query('INSERT', this.tableName, attempt);
            
            if (result.success) {
                // Registrar log de auditoria
                await this.logAudit('INSERT', attempt.id, null, attempt);
                
                return {
                    success: true,
                    data: attempt,
                    message: 'Tentativa registrada com sucesso'
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
            
        } catch (error) {
            console.error('Erro ao registrar tentativa:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Verificar se usuário já tentou uma palavra-chave específica
    async hasUserAttempted(clientEmail, keywordId) {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                const attempt = result.data.find(a => 
                    a.client_email === clientEmail.toLowerCase().trim() && 
                    a.keyword_id === keywordId
                );
                
                return {
                    success: true,
                    data: !!attempt,
                    attempt: attempt || null
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: false
                };
            }
        } catch (error) {
            console.error('Erro ao verificar tentativa:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: false
            };
        }
    }
    
    // Buscar tentativas de um cliente
    async getUserAttempts(clientEmail) {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                const userAttempts = result.data.filter(a => 
                    a.client_email === clientEmail.toLowerCase().trim()
                );
                
                // Ordenar por data (mais recente primeiro)
                userAttempts.sort((a, b) => new Date(b.attempted_at) - new Date(a.attempted_at));
                
                return {
                    success: true,
                    data: userAttempts
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: []
                };
            }
        } catch (error) {
            console.error('Erro ao buscar tentativas do usuário:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: []
            };
        }
    }
    
    // Calcular pontos totais de um cliente
    async getUserPoints(clientEmail) {
        try {
            const attemptsResult = await this.getUserAttempts(clientEmail);
            
            if (attemptsResult.success) {
                const totalPoints = attemptsResult.data.reduce((sum, attempt) => {
                    return sum + (attempt.points_earned || 0);
                }, 0);
                
                return {
                    success: true,
                    data: {
                        totalPoints,
                        correctAttempts: attemptsResult.data.filter(a => a.is_correct).length,
                        totalAttempts: attemptsResult.data.length
                    }
                };
            } else {
                return attemptsResult;
            }
        } catch (error) {
            console.error('Erro ao calcular pontos:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Limpar todas as tentativas
    async clearAllAttempts() {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                const deletePromises = result.data.map(attempt => 
                    this.db.query('DELETE', this.tableName, { id: attempt.id })
                );
                
                await Promise.all(deletePromises);
                
                // Registrar log de auditoria
                await this.logAudit('DELETE_ALL', 'multiple', null, { deletedCount: result.data.length });
                
                return {
                    success: true,
                    data: { deletedCount: result.data.length },
                    message: `${result.data.length} tentativas foram removidas`
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao limpar tentativas:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Gerar ranking baseado nas tentativas
    async generateRanking(limit = 50) {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                // Agrupar por cliente e calcular pontos
                const clientPoints = {};
                
                result.data.forEach(attempt => {
                    if (!clientPoints[attempt.client_email]) {
                        clientPoints[attempt.client_email] = {
                            email: attempt.client_email,
                            totalPoints: 0,
                            correctAttempts: 0,
                            totalAttempts: 0,
                            lastAttempt: attempt.attempted_at
                        };
                    }
                    
                    const client = clientPoints[attempt.client_email];
                    client.totalPoints += attempt.points_earned || 0;
                    client.totalAttempts++;
                    
                    if (attempt.is_correct) {
                        client.correctAttempts++;
                    }
                    
                    // Atualizar última tentativa se mais recente
                    if (new Date(attempt.attempted_at) > new Date(client.lastAttempt)) {
                        client.lastAttempt = attempt.attempted_at;
                    }
                });
                
                // Converter para array e ordenar por pontos
                const ranking = Object.values(clientPoints)
                    .sort((a, b) => {
                        // Primeiro por pontos (decrescente)
                        if (b.totalPoints !== a.totalPoints) {
                            return b.totalPoints - a.totalPoints;
                        }
                        // Em caso de empate, por data da última tentativa (mais recente primeiro)
                        return new Date(b.lastAttempt) - new Date(a.lastAttempt);
                    })
                    .slice(0, limit)
                    .map((client, index) => ({
                        position: index + 1,
                        ...client,
                        accuracy: client.totalAttempts > 0 ? 
                            Math.round((client.correctAttempts / client.totalAttempts) * 100) : 0
                    }));
                
                return {
                    success: true,
                    data: ranking
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: []
                };
            }
        } catch (error) {
            console.error('Erro ao gerar ranking:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: []
            };
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
    module.exports = UserAttempts;
} else {
    window.UserAttempts = UserAttempts;
}