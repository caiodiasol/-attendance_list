// Award Model
// Modelo para gerenciamento de premiações do sistema

class Award {
    constructor(dbConnection) {
        this.db = dbConnection;
        this.tableName = 'awards';
        this.historyTableName = 'award_history';
    }
    
    // Validar dados da premiação
    validate(awardData) {
        const errors = [];
        
        // Validar email do ganhador
        if (!awardData.winner_email || typeof awardData.winner_email !== 'string') {
            errors.push('Email do ganhador é obrigatório');
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(awardData.winner_email)) {
                errors.push('Email do ganhador inválido');
            }
        }
        
        // Validar posição
        if (!awardData.position || typeof awardData.position !== 'number' || awardData.position < 1) {
            errors.push('Posição deve ser um número maior que 0');
        }
        
        // Validar pontos
        if (typeof awardData.points !== 'number' || awardData.points < 0) {
            errors.push('Pontos devem ser um número não negativo');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    // Registrar premiação
    async recordAward(awardData) {
        try {
            // Validar dados
            const validation = this.validate(awardData);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: validation.errors.join(', '),
                    data: null
                };
            }
            
            // Preparar dados para inserção
            const award = {
                id: this.generateId(),
                winner_email: awardData.winner_email.toLowerCase().trim(),
                winner_name: awardData.winner_name || 'Não informado',
                position: awardData.position,
                points: awardData.points,
                prize_description: awardData.prize_description || `${awardData.position}º lugar`,
                awarded_at: new Date().toISOString(),
                period: awardData.period || 'live_session',
                status: 'awarded'
            };
            
            // Inserir no banco
            const result = await this.db.query('INSERT', this.tableName, award);
            
            if (result.success) {
                // Registrar no histórico
                await this.addToHistory(award);
                
                // Registrar log de auditoria
                await this.logAudit('INSERT', award.id, null, award);
                
                return {
                    success: true,
                    data: award,
                    message: 'Premiação registrada com sucesso'
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
            
        } catch (error) {
            console.error('Erro ao registrar premiação:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Executar premiação baseada no ranking
    async executeAwardCeremony(rankingData, prizeConfig = null) {
        try {
            if (!Array.isArray(rankingData) || rankingData.length === 0) {
                return {
                    success: false,
                    error: 'Ranking vazio ou inválido',
                    data: null
                };
            }
            
            // Configuração padrão de prêmios
            const defaultPrizes = {
                1: 'Prêmio Principal - 1º Lugar',
                2: 'Prêmio Secundário - 2º Lugar', 
                3: 'Prêmio Terceiro - 3º Lugar'
            };
            
            const prizes = prizeConfig || defaultPrizes;
            const awards = [];
            
            // Processar apenas os 3 primeiros colocados ou quantos estiverem configurados
            const winnersCount = Math.min(rankingData.length, Object.keys(prizes).length);
            
            for (let i = 0; i < winnersCount; i++) {
                const winner = rankingData[i];
                const position = i + 1;
                
                if (prizes[position]) {
                    const awardResult = await this.recordAward({
                        winner_email: winner.email,
                        winner_name: winner.name || 'Participante',
                        position: position,
                        points: winner.totalPoints || winner.points || 0,
                        prize_description: prizes[position],
                        period: `live_${new Date().toISOString().split('T')[0]}`
                    });
                    
                    if (awardResult.success) {
                        awards.push(awardResult.data);
                    }
                }
            }
            
            if (awards.length > 0) {
                return {
                    success: true,
                    data: {
                        awards,
                        totalWinners: awards.length,
                        ceremonyDate: new Date().toISOString()
                    },
                    message: `Cerimônia executada com ${awards.length} premiados`
                };
            } else {
                return {
                    success: false,
                    error: 'Nenhuma premiação foi registrada',
                    data: null
                };
            }
            
        } catch (error) {
            console.error('Erro na cerimônia de premiação:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Buscar premiações atuais
    async getCurrentAwards() {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                // Ordenar por posição
                const awards = result.data.sort((a, b) => a.position - b.position);
                
                return {
                    success: true,
                    data: awards
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: []
                };
            }
        } catch (error) {
            console.error('Erro ao buscar premiações:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: []
            };
        }
    }
    
    // Buscar histórico de premiações
    async getAwardHistory(limit = 50) {
        try {
            const result = await this.db.query('SELECT', this.historyTableName);
            
            if (result.success) {
                // Ordenar por data (mais recente primeiro)
                const history = result.data
                    .sort((a, b) => new Date(b.awarded_at) - new Date(a.awarded_at))
                    .slice(0, limit);
                
                return {
                    success: true,
                    data: history
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: []
                };
            }
        } catch (error) {
            console.error('Erro ao buscar histórico:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: []
            };
        }
    }
    
    // Limpar premiações atuais (resetar para nova rodada)
    async clearCurrentAwards() {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                const deletePromises = result.data.map(award => 
                    this.db.query('DELETE', this.tableName, { id: award.id })
                );
                
                await Promise.all(deletePromises);
                
                // Registrar log de auditoria
                await this.logAudit('DELETE_ALL', 'multiple', null, { 
                    deletedCount: result.data.length,
                    resetAt: new Date().toISOString()
                });
                
                return {
                    success: true,
                    data: { deletedCount: result.data.length },
                    message: `${result.data.length} premiações foram removidas`
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao limpar premiações:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Adicionar ao histórico
    async addToHistory(awardData) {
        try {
            const historyEntry = {
                ...awardData,
                id: this.generateId(), // Novo ID para o histórico
                original_award_id: awardData.id
            };
            
            await this.db.query('INSERT', this.historyTableName, historyEntry);
            
        } catch (error) {
            console.error('Erro ao adicionar ao histórico:', error);
        }
    }
    
    // Verificar se cliente já foi premiado no período
    async hasUserWonInPeriod(clientEmail, period = null) {
        try {
            const currentPeriod = period || `live_${new Date().toISOString().split('T')[0]}`;
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                const userAward = result.data.find(award => 
                    award.winner_email === clientEmail.toLowerCase().trim() &&
                    award.period === currentPeriod
                );
                
                return {
                    success: true,
                    data: !!userAward,
                    award: userAward || null
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: false
                };
            }
        } catch (error) {
            console.error('Erro ao verificar premiação do usuário:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: false
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
    module.exports = Award;
} else {
    window.Award = Award;
}