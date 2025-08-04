// Keyword Model
// Modelo para gerenciamento de palavras-chave do sistema

class Keyword {
    constructor(dbConnection) {
        this.db = dbConnection;
        this.tableName = 'current_keywords';
        this.poolTableName = 'keyword_pool';
    }
    
    // Validar dados da palavra-chave
    validate(keywordData) {
        const errors = [];
        
        // Validar palavra correta
        if (!keywordData.correct_word || typeof keywordData.correct_word !== 'string') {
            errors.push('Palavra correta é obrigatória');
        } else if (keywordData.correct_word.length < 2) {
            errors.push('Palavra correta deve ter pelo menos 2 caracteres');
        } else if (keywordData.correct_word.length > 100) {
            errors.push('Palavra correta não pode ter mais de 100 caracteres');
        }
        
        // Validar palavras incorretas
        if (!keywordData.incorrect_words || !Array.isArray(keywordData.incorrect_words)) {
            errors.push('Palavras incorretas devem ser um array');
        } else if (keywordData.incorrect_words.length < 1) {
            errors.push('Deve haver pelo menos 1 palavra incorreta');
        } else if (keywordData.incorrect_words.length > 10) {
            errors.push('Máximo de 10 palavras incorretas');
        } else {
            // Validar cada palavra incorreta
            keywordData.incorrect_words.forEach((word, index) => {
                if (!word || typeof word !== 'string') {
                    errors.push(`Palavra incorreta ${index + 1} é inválida`);
                } else if (word.length < 2 || word.length > 100) {
                    errors.push(`Palavra incorreta ${index + 1} deve ter entre 2 e 100 caracteres`);
                }
            });
            
            // Verificar se não há duplicatas
            const uniqueWords = new Set(keywordData.incorrect_words.map(w => w.toUpperCase()));
            if (uniqueWords.size !== keywordData.incorrect_words.length) {
                errors.push('Não deve haver palavras incorretas duplicadas');
            }
            
            // Verificar se a palavra correta não está nas incorretas
            const correctUpper = keywordData.correct_word.toUpperCase();
            if (keywordData.incorrect_words.some(w => w.toUpperCase() === correctUpper)) {
                errors.push('A palavra correta não pode estar na lista de incorretas');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    
    // Criar nova palavra-chave
    async create(keywordData) {
        try {
            // Validar dados
            const validation = this.validate(keywordData);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: validation.errors.join(', '),
                    data: null
                };
            }
            
            // Desativar palavra-chave anterior
            await this.deactivateAll();
            
            // Preparar dados para inserção
            const keyword = {
                id: this.generateId(),
                correct_word: keywordData.correct_word.toUpperCase().trim(),
                incorrect_words: JSON.stringify(keywordData.incorrect_words.map(w => w.toUpperCase().trim())),
                created_at: new Date().toISOString(),
                is_active: true
            };
            
            // Inserir no banco
            const result = await this.db.query('INSERT', this.tableName, keyword);
            
            if (result.success) {
                // Registrar log de auditoria
                await this.logAudit('INSERT', keyword.id, null, keyword);
                
                return {
                    success: true,
                    data: {
                        ...keyword,
                        incorrect_words: JSON.parse(keyword.incorrect_words)
                    },
                    message: 'Palavra-chave criada com sucesso'
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
            
        } catch (error) {
            console.error('Erro ao criar palavra-chave:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Gerar palavras-chave automaticamente
    async generateKeywords() {
        try {
            // Buscar palavras do pool
            const poolWords = await this.getWordPool();
            if (!poolWords.success || poolWords.data.length < 4) {
                return {
                    success: false,
                    error: 'Pool de palavras insuficiente (mínimo 4 palavras)',
                    data: null
                };
            }
            
            const words = poolWords.data.filter(w => w.is_active);
            if (words.length < 4) {
                return {
                    success: false,
                    error: 'Palavras ativas insuficientes no pool (mínimo 4 palavras)',
                    data: null
                };
            }
            
            // Selecionar palavra correta aleatoriamente
            const correctIndex = Math.floor(Math.random() * words.length);
            const correctWord = words[correctIndex].word;
            
            // Selecionar 3 palavras incorretas (para total de 4 palavras)
            const incorrectWords = [];
            const availableWords = words.filter(w => w.word !== correctWord);
            
            while (incorrectWords.length < 3 && availableWords.length > 0) {
                const randomIndex = Math.floor(Math.random() * availableWords.length);
                const word = availableWords.splice(randomIndex, 1)[0];
                incorrectWords.push(word.word);
            }
            
            if (incorrectWords.length < 3) {
                return {
                    success: false,
                    error: 'Não foi possível gerar 3 palavras incorretas únicas',
                    data: null
                };
            }
            
            // Criar palavra-chave
            return await this.create({
                correct_word: correctWord,
                incorrect_words: incorrectWords
            });
            
        } catch (error) {
            console.error('Erro ao gerar palavras-chave:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Buscar palavra-chave ativa
    async getCurrent() {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                const activeKeyword = result.data.find(k => k.is_active);
                
                if (activeKeyword) {
                    return {
                        success: true,
                        data: {
                            ...activeKeyword,
                            incorrect_words: JSON.parse(activeKeyword.incorrect_words)
                        }
                    };
                } else {
                    return {
                        success: true,
                        data: null
                    };
                }
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao buscar palavra-chave atual:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Buscar palavra-chave por ID
    async findById(keywordId) {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                const keyword = result.data.find(k => k.id === keywordId);
                
                if (keyword) {
                    return {
                        success: true,
                        data: {
                            ...keyword,
                            incorrect_words: JSON.parse(keyword.incorrect_words)
                        }
                    };
                } else {
                    return {
                        success: true,
                        data: null
                    };
                }
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao buscar palavra-chave por ID:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Desativar todas as palavras-chave
    async deactivateAll() {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                const updatePromises = result.data
                    .filter(k => k.is_active)
                    .map(keyword => {
                        const updatedKeyword = { ...keyword, is_active: false };
                        return this.db.query('UPDATE', this.tableName, updatedKeyword);
                    });
                
                await Promise.all(updatePromises);
                
                return {
                    success: true,
                    message: 'Todas as palavras-chave foram desativadas'
                };
            } else {
                return {
                    success: false,
                    error: result.error
                };
            }
        } catch (error) {
            console.error('Erro ao desativar palavras-chave:', error);
            return {
                success: false,
                error: 'Erro interno do servidor'
            };
        }
    }
    
    // Limpar palavras-chave antigas
    async clearOld(keepLast = 10) {
        try {
            const result = await this.db.query('SELECT', this.tableName);
            
            if (result.success) {
                // Ordenar por data de criação (mais recente primeiro)
                const sortedKeywords = result.data.sort((a, b) => {
                    const dateA = new Date(a.created_at);
                    const dateB = new Date(b.created_at);
                    return dateB - dateA;
                });
                
                // Manter apenas as mais recentes
                const keywordsToDelete = sortedKeywords.slice(keepLast);
                
                if (keywordsToDelete.length > 0) {
                    const deletePromises = keywordsToDelete.map(keyword => 
                        this.db.query('DELETE', this.tableName, { id: keyword.id })
                    );
                    
                    await Promise.all(deletePromises);
                    
                    // Registrar log de auditoria
                    await this.logAudit('DELETE_OLD', 'multiple', null, { deletedCount: keywordsToDelete.length });
                    
                    return {
                        success: true,
                        data: { deletedCount: keywordsToDelete.length },
                        message: `${keywordsToDelete.length} palavras-chave antigas foram removidas`
                    };
                } else {
                    return {
                        success: true,
                        data: { deletedCount: 0 },
                        message: 'Nenhuma palavra-chave antiga para remover'
                    };
                }
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao limpar palavras-chave antigas:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Gerenciar pool de palavras
    async getWordPool() {
        try {
            const result = await this.db.query('SELECT', this.poolTableName);
            return result;
        } catch (error) {
            console.error('Erro ao buscar pool de palavras:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    async addWordToPool(word, category = 'motivational') {
        try {
            const poolWord = {
                id: this.generateId(),
                word: word.toUpperCase().trim(),
                category: category,
                is_active: true,
                created_at: new Date().toISOString()
            };
            
            const result = await this.db.query('INSERT', this.poolTableName, poolWord);
            
            if (result.success) {
                return {
                    success: true,
                    data: poolWord,
                    message: 'Palavra adicionada ao pool'
                };
            } else {
                return {
                    success: false,
                    error: result.error,
                    data: null
                };
            }
        } catch (error) {
            console.error('Erro ao adicionar palavra ao pool:', error);
            return {
                success: false,
                error: 'Erro interno do servidor',
                data: null
            };
        }
    }
    
    // Inicializar pool de palavras com conjunto padrão
    async initializeWordPool() {
        try {
            // Verificar se já existe pool
            const existingPool = await this.getWordPool();
            if (existingPool.success && existingPool.data.length >= 20) {
                console.log('Pool de palavras já inicializado com', existingPool.data.length, 'palavras');
                return {
                    success: true,
                    message: 'Pool já inicializado',
                    data: { wordCount: existingPool.data.length }
                };
            }
            
            // Palavras motivacionais padrão
            const defaultWords = [
                'SUCESSO', 'VITÓRIA', 'ENERGIA', 'FOCO', 'PODER', 'FORÇA', 'ALEGRIA', 'PAZ',
                'AMOR', 'SAÚDE', 'RIQUEZA', 'ABUNDÂNCIA', 'PROSPERIDADE', 'FELICIDADE', 'GRATIDÃO',
                'CORAGEM', 'ESPERANÇA', 'FÉ', 'DETERMINAÇÃO', 'PERSISTÊNCIA', 'CONQUISTA', 'REALIZAÇÃO',
                'TRANSFORMAÇÃO', 'CRESCIMENTO', 'EVOLUÇÃO', 'PROGRESSO', 'INOVAÇÃO', 'CRIATIVIDADE',
                'INSPIRAÇÃO', 'MOTIVAÇÃO', 'SUPERAÇÃO', 'RESILIÊNCIA', 'OTIMISMO', 'CONFIANÇA',
                'LIDERANÇA', 'EXCELÊNCIA', 'QUALIDADE', 'RESULTADO', 'META', 'OBJETIVO', 'SONHO',
                'PROPÓSITO', 'MISSÃO', 'VISÃO', 'ESTRATÉGIA', 'PLANEJAMENTO', 'ORGANIZAÇÃO', 'DISCIPLINA',
                'COMPROMISSO', 'DEDICAÇÃO', 'ESFORÇO', 'TRABALHO', 'EQUIPE', 'UNIÃO', 'PARCERIA',
                'COLABORAÇÃO', 'COMUNICAÇÃO', 'RELACIONAMENTO', 'NETWORKING', 'CONEXÃO', 'OPORTUNIDADE'
            ];
            
            // Adicionar palavras que ainda não existem
            let addedCount = 0;
            const existingWords = existingPool.success ? existingPool.data.map(w => w.word.toUpperCase()) : [];
            
            for (const word of defaultWords) {
                if (!existingWords.includes(word.toUpperCase())) {
                    const result = await this.addWordToPool(word, 'motivational');
                    if (result.success) {
                        addedCount++;
                    }
                }
            }
            
            console.log(`Pool inicializado com ${addedCount} novas palavras`);
            
            return {
                success: true,
                message: `Pool inicializado com ${addedCount} novas palavras`,
                data: { addedCount, totalWords: existingWords.length + addedCount }
            };
            
        } catch (error) {
            console.error('Erro ao inicializar pool de palavras:', error);
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
    module.exports = Keyword;
} else {
    window.Keyword = Keyword;
}