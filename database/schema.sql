-- ClientKey Database Schema
-- Sistema de migração do localStorage para banco de dados persistente

-- Tabela de clientes
CREATE TABLE clients (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    whatsapp VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Tabela de atividades dos clientes
CREATE TABLE client_activities (
    id VARCHAR(50) PRIMARY KEY,
    client_id VARCHAR(50) NOT NULL,
    client_name VARCHAR(100) NOT NULL,
    client_email VARCHAR(254) NOT NULL,
    activity_type VARCHAR(50) NOT NULL, -- 'participation', 'correct_answer', 'incorrect_answer'
    points INT DEFAULT 0,
    details TEXT, -- JSON com detalhes específicos da atividade
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    INDEX idx_client_id (client_id),
    INDEX idx_timestamp (timestamp),
    INDEX idx_activity_type (activity_type)
);

-- Tabela de palavras-chave atuais
CREATE TABLE current_keywords (
    id VARCHAR(50) PRIMARY KEY,
    correct_word VARCHAR(100) NOT NULL,
    incorrect_words JSON NOT NULL, -- Array das palavras incorretas
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    
    INDEX idx_active (is_active),
    INDEX idx_created_at (created_at)
);

-- Tabela de tentativas dos usuários
CREATE TABLE user_attempts (
    id VARCHAR(50) PRIMARY KEY,
    client_email VARCHAR(254) NOT NULL,
    keyword_id VARCHAR(50) NOT NULL,
    selected_word VARCHAR(100) NOT NULL,
    is_correct BOOLEAN NOT NULL,
    points_earned INT DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_user_keyword (client_email, keyword_id),
    FOREIGN KEY (keyword_id) REFERENCES current_keywords(id) ON DELETE CASCADE,
    INDEX idx_client_email (client_email),
    INDEX idx_keyword_id (keyword_id),
    INDEX idx_timestamp (timestamp)
);

-- Tabela de status de premiação
CREATE TABLE award_status (
    id INT PRIMARY KEY AUTO_INCREMENT,
    executed BOOLEAN DEFAULT FALSE,
    executed_at TIMESTAMP NULL,
    executed_by VARCHAR(100),
    admin_notes TEXT,
    reset_at TIMESTAMP NULL,
    reset_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_executed (executed),
    INDEX idx_executed_at (executed_at)
);

-- Tabela de histórico de ganhadores
CREATE TABLE winners_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    award_execution_id INT,
    client_id VARCHAR(50) NOT NULL,
    client_name VARCHAR(100) NOT NULL,
    client_email VARCHAR(254) NOT NULL,
    position INT NOT NULL,
    total_points INT NOT NULL,
    last_activity TIMESTAMP,
    awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (client_id) REFERENCES clients(id),
    INDEX idx_position (position),
    INDEX idx_awarded_at (awarded_at),
    INDEX idx_client_id (client_id)
);

-- Tabela de pool de palavras-chave
CREATE TABLE keyword_pool (
    id INT PRIMARY KEY AUTO_INCREMENT,
    word VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) DEFAULT 'motivational',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_category (category),
    INDEX idx_active (is_active)
);

-- Tabela de logs de auditoria
CREATE TABLE audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    table_name VARCHAR(50) NOT NULL,
    operation VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    record_id VARCHAR(50) NOT NULL,
    old_values JSON,
    new_values JSON,
    user_identifier VARCHAR(254), -- email ou IP
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_table_operation (table_name, operation),
    INDEX idx_timestamp (timestamp),
    INDEX idx_record_id (record_id)
);

-- Inserir palavras padrão no pool
INSERT INTO keyword_pool (word, category) VALUES
('SUCESSO', 'motivational'),
('VITÓRIA', 'motivational'),
('ENERGIA', 'motivational'),
('FOCO', 'motivational'),
('PODER', 'motivational'),
('FORÇA', 'motivational'),
('ALEGRIA', 'motivational'),
('PAZ', 'motivational'),
('AMOR', 'motivational'),
('SAÚDE', 'motivational'),
('RIQUEZA', 'motivational'),
('ABUNDÂNCIA', 'motivational'),
('PROSPERIDADE', 'motivational'),
('FELICIDADE', 'motivational'),
('GRATIDÃO', 'motivational'),
('CORAGEM', 'motivational'),
('ESPERANÇA', 'motivational'),
('FÉ', 'motivational'),
('DETERMINAÇÃO', 'motivational'),
('PERSISTÊNCIA', 'motivational'),
('CONQUISTA', 'motivational'),
('REALIZAÇÃO', 'motivational'),
('TRANSFORMAÇÃO', 'motivational'),
('CRESCIMENTO', 'motivational'),
('EVOLUÇÃO', 'motivational'),
('PROGRESSO', 'motivational'),
('INOVAÇÃO', 'motivational'),
('CRIATIVIDADE', 'motivational'),
('INSPIRAÇÃO', 'motivational'),
('MOTIVAÇÃO', 'motivational'),
('SUPERAÇÃO', 'motivational'),
('RESILIÊNCIA', 'motivational'),
('OTIMISMO', 'motivational'),
('CONFIANÇA', 'motivational'),
('LIDERANÇA', 'motivational'),
('EXCELÊNCIA', 'motivational'),
('QUALIDADE', 'motivational'),
('RESULTADO', 'motivational'),
('META', 'motivational'),
('OBJETIVO', 'motivational'),
('SONHO', 'motivational'),
('PROPÓSITO', 'motivational'),
('MISSÃO', 'motivational'),
('VISÃO', 'motivational'),
('ESTRATÉGIA', 'motivational'),
('PLANEJAMENTO', 'motivational'),
('ORGANIZAÇÃO', 'motivational'),
('DISCIPLINA', 'motivational'),
('COMPROMISSO', 'motivational'),
('DEDICAÇÃO', 'motivational'),
('ESFORÇO', 'motivational'),
('TRABALHO', 'motivational'),
('EQUIPE', 'motivational'),
('UNIÃO', 'motivational'),
('PARCERIA', 'motivational'),
('COLABORAÇÃO', 'motivational'),
('COMUNICAÇÃO', 'motivational'),
('RELACIONAMENTO', 'motivational'),
('NETWORKING', 'motivational'),
('CONEXÃO', 'motivational'),
('OPORTUNIDADE', 'motivational');

-- Inserir status inicial de premiação
INSERT INTO award_status (executed, executed_by) VALUES (FALSE, 'system');