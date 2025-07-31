// Client Model
// Modelo para gerenciamento de clientes do sistema

class Client {
    constructor(dbConnection) {
        this.db = dbConnection;
        this.tableName = 'clients';
    }
    
    // Validar dados do cliente
    validate(clientData) {
        const errors = [];
        
        // Validar nome
        if (!clientData.name || typeof clientData.name !== 'string') {
            errors.push('Nome é obrigatório');
        } else if (clientData.name.length < 2) {
            errors.push('Nome deve ter pelo menos 2 caracteres');
        } else if (clientData.name.length > 100) {
            errors.push('Nome não pode ter mais de 100 caracteres');
        } else if (!/^[A-Za-zÀ-ÿ\s]+$/.test(clientData.name)) {
            errors.push('Nome deve conter apenas letras e espaços');
        }
        
        // Validar email
        if (!clientData.email || typeof clientData.email !== 'string') {
            errors.push('Email é obrigatório');
        } else if (clientData.email.length > 254) {
            errors.push('Email não pode ter mais de 254 caracteres');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientData.email)) {
            errors.push('Email deve ter um formato válido');
        }
        
        // Validar WhatsApp (opcional)
        if (clientData.whatsapp) {
            const whatsappNumbers = clientData.whatsapp.replace(/\D/g, '');
            if (whatsappNumbers.length !== 11) {
                errors.push('WhatsApp deve ter 11 dígitos');
            } else if (!whatsappNumbers.substring(2).startsWith('9')) {
                errors.push('Número de celular deve começar com 9');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    // Criar novo cliente
    async create(clientData) {
        try {
            // Validar dados
            const validation = this.validate(clientData);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: validation.errors.join(', '),
                    data: null
                };
            }
            
            // Verificar se email já existe
            const existingClient = await this.findByEmail(clientData.email);
            if (existingClient.success && existingClient.data) {
                return {
                    success: false,
                    error: 'Email já cadastrado',
                    data: null
                };
            }
            
            // Preparar dados para inserção
            const client = {
                id: this.generateId(),
                name: clientData.name.trim(),
                email: clientData.email.toLowerCase().trim(),
                whatsapp: clientData.whatsapp ? clientData.whatsapp.trim() : null,
                status: clientData.status || 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            // Inserir no banco
            const result = await this.db.query('INSERT', this.tableName, client);
            
            if (result.success) {
                // Registrar log de auditoria
                await this.logAudit('INSERT', client.id, null, client);
                
                return {
                    success: true,
                    data: client,
                    message: 'Cliente criado com sucesso'
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
            
        } catch (error) {
            console.error('Erro ao criar cliente:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Buscar cliente por ID
    async findById(clientId) {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                const client = result.data.find(c => c.id === clientId);
                return {
                    success: true,
                    data: client || null
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao buscar cliente por ID:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Buscar cliente por email
    async findByEmail(email) {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                const client = result.data.find(c => c.email === email.toLowerCase().trim());
                return {
                    success: true,
                    data: client || null
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao buscar cliente por email:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Buscar cliente por email ou nome
    async findByEmailOrName(searchTerm) {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                const searchLower = searchTerm.toLowerCase().trim();
                
                // Buscar por correspondência exata no email
                let client = result.data.find(c => c.email.toLowerCase() === searchLower);
                
                // Se não encontrou, buscar por correspondência exata no nome
                if (!client) {
                    client = result.data.find(c => c.name.toLowerCase() === searchLower);
                }
                
                // Se não encontrou, buscar por correspondência parcial no email
                if (!client) {
                    client = result.data.find(c => c.email.toLowerCase().includes(searchLower));
                }
                
                // Se não encontrou, buscar por correspondência parcial no nome
                if (!client) {
                    client = result.data.find(c => c.name.toLowerCase().includes(searchLower));
                }
                
                return {
                    success: true,
                    data: client || null
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao buscar cliente:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Listar todos os clientes
    async findAll(limit = null, offset = 0) {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                let clients = result.data.sort((a, b) => {
                    const dateA = new Date(a.created_at);
                    const dateB = new Date(b.created_at);
                    return dateB - dateA; // Mais recente primeiro
                });
                
                if (limit) {
                    clients = clients.slice(offset, offset + limit);
                }
                
                return {
                    success: true,
                    data: clients,
                    total: result.data.length
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao listar clientes:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Atualizar cliente
    async update(clientId, updateData) {
        try {
            // Buscar cliente existente
            const existingResult = await this.findById(clientId);
            if (!existingResult.success || !existingResult.data) {
                return {
                    success: false,
                    error: 'Cliente não encontrado',
                    data: null
                };
            }
            
            const existingClient = existingResult.data;
            
            // Preparar dados de atualização
            const clientData = {
                ...existingClient,
                ...updateData,
                updated_at: new Date().toISOString()
            };
            
            // Validar dados atualizados
            const validation = this.validate(clientData);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: validation.errors.join(', '),
                    data: null
                };
            }
            
            // Verificar se o novo email já existe (se foi alterado)
            if (updateData.email && updateData.email !== existingClient.email) {
                const emailCheck = await this.findByEmail(updateData.email);
                if (emailCheck.success && emailCheck.data) {
                    return {
                        success: false,
                        error: 'Email já cadastrado',
                        data: null
                    };
                }
            }
            
            // Atualizar no banco
            const result = await this.db.query('UPDATE', this.tableName, clientData);
            
            if (result.success) {
                // Registrar log de auditoria
                await this.logAudit('UPDATE', clientId, existingClient, clientData);
                
                return {
                    success: true,
                    data: clientData,
                    message: 'Cliente atualizado com sucesso'
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
            
        } catch (error) {
            console.error('Erro ao atualizar cliente:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Deletar cliente
    async delete(clientId) {
        try {
            // Buscar cliente existente
            const existingResult = await this.findById(clientId);
            if (!existingResult.success || !existingResult.data) {
                return {
                    success: false,
                    error: 'Cliente não encontrado',
                    data: null
                };
            }
            
            const existingClient = existingResult.data;
            
            // Deletar do banco
            const result = await this.db.query('DELETE', this.tableName, { id: clientId });
            
            if (result.success) {
                // Registrar log de auditoria
                await this.logAudit('DELETE', clientId, existingClient, null);
                
                return {
                    success: true,
                    data: { deleted: true },
                    message: 'Cliente deletado com sucesso'
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
            
        } catch (error) {
            console.error('Erro ao deletar cliente:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Obter estatísticas dos clientes
    async getStats() {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                const total = result.data.length;
                const active = result.data.filter(c => c.status === 'active').length;
                const inactive = total - active;
                
                // Clientes por mês
                const monthlyStats = {};
                result.data.forEach(client => {
                    const date = new Date(client.created_at);
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    monthlyStats[monthKey] = (monthlyStats[monthKey] || 0) + 1;
                });
                
                return {
                    success: true,
                    data: {
                        total,
                        active,
                        inactive,
                        monthlyStats
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
            console.error('Erro ao obter estatísticas:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
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
                user_identifier: 'system', // Pode ser alterado para incluir usuário logado
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
    module.exports = Client;
} else {
    window.Client = Client;
}