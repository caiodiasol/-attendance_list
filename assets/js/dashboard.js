// Array para armazenar os clientes
let clients = [];
let unsubscribeClients = null;

// Elementos do DOM
const clientsList = document.getElementById('clientsList');
const totalClientsElement = document.getElementById('totalClients');
const searchInput = document.getElementById('searchInput');
const messageContainer = document.getElementById('messageContainer');
const firebaseStatus = document.getElementById('firebaseStatus');
const currentKeywordDisplay = document.getElementById('currentKeywordDisplay');
const keywordPreview = document.getElementById('keywordPreview');
const previewButtons = document.getElementById('previewButtons');
const keywordStatus = document.getElementById('keywordStatus');

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeFirebase();
});

// Remover event listeners do formulário que não existe mais

// Função para inicializar Firebase
async function initializeFirebase() {
    try {
        // Aguardar o Firebase estar disponível
        if (typeof window.FirebaseDB === 'undefined') {
            setTimeout(initializeFirebase, 100);
            return;
        }
        
        // Carregar dados iniciais
        await loadClients();
        
        // Configurar listener em tempo real para clientes
        unsubscribeClients = window.FirebaseDB.onClientsChange((clientsData) => {
            clients = clientsData;
            updateClientsList();
            updateStats();
        });
        
        // Carregar status das palavras-chave
        loadKeywordStatus();
        
        // Mostrar status de conexão
        if (window.FirebaseDB.isAvailable()) {
            firebaseStatus.className = 'firebase-status connected';
            firebaseStatus.innerHTML = '<i class="fas fa-cloud"></i> Conectado ao Firebase';
            showMessage('Conectado ao Firebase com sucesso!', 'success');
        } else {
            firebaseStatus.className = 'firebase-status';
            firebaseStatus.innerHTML = '<i class="fas fa-database"></i> Modo localStorage';
            showMessage('Usando armazenamento local', 'info');
        }
        
        console.log('Sistema inicializado com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar sistema:', error);
        firebaseStatus.className = 'firebase-status error';
        firebaseStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Erro no sistema';
        showMessage('Erro ao inicializar sistema. Recarregue a página.', 'error');
    }
}

// Função para carregar clientes do Firestore
async function loadClients() {
    try {
        showLoading(true);
        clients = await window.FirebaseDB.getClients();
        updateClientsList();
        updateStats();
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        showMessage('Erro ao carregar clientes do Firebase', 'error');
        // Fallback para localStorage
        loadClientsFromStorage();
        updateClientsList();
        updateStats();
    } finally {
        showLoading(false);
    }
}

// Funções de formulário removidas - agora estão na página de cadastro

// Função para atualizar a lista de clientes (últimos 10)
function updateClientsList() {
    if (clients.length === 0) {
        clientsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-friends"></i>
                <h3>Nenhum cliente cadastrado</h3>
                <p>Os clientes serão exibidos aqui conforme forem se cadastrando</p>
            </div>
        `;
        return;
    }
    
    // Ordenar por data de cadastro (mais recente primeiro) e pegar apenas os últimos 10
    const sortedClients = [...clients].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt);
        const dateB = new Date(b.createdAt || b.updatedAt);
        return dateB - dateA;
    });
    
    const searchTerm = searchInput.value.toLowerCase();
    let filteredClients = sortedClients.filter(client => 
        client.name.toLowerCase().includes(searchTerm) ||
        client.email.toLowerCase().includes(searchTerm) ||
        (client.whatsapp && client.whatsapp.includes(searchTerm))
    );
    
    // Limitar a 10 últimos após filtro
    filteredClients = filteredClients.slice(0, 10);
    
    if (filteredClients.length === 0) {
        clientsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>Nenhum cliente encontrado</h3>
                <p>Tente ajustar os termos de pesquisa</p>
            </div>
        `;
        return;
    }
    
    clientsList.innerHTML = filteredClients.map(client => `
        <div class="client-item" data-client-id="${client.id}">
            <div class="client-info">
                <div class="client-name">${escapeHtml(client.name)}</div>
                <div class="client-email">${escapeHtml(client.email)}</div>
                ${client.whatsapp ? `<div class="client-whatsapp">
                    <i class="fab fa-whatsapp"></i>
                    ${escapeHtml(client.whatsapp)}
                </div>` : ''}
                <div class="client-date">
                    <i class="fas fa-calendar"></i>
                    Cadastrado em ${formatDate(client.createdAt || client.updatedAt)}
                </div>
            </div>
        </div>
    `).join('');
}

// Função para atualizar estatísticas
function updateStats() {
    totalClientsElement.textContent = clients.length;
}

// Função para filtrar clientes
function filterClients() {
    updateClientsList();
}

// Funções de edição e exclusão removidas - disponíveis na página de cadastro

// Função para limpar todos os clientes
async function clearAllClients() {
    if (clients.length === 0) {
        showMessage('Não há clientes para remover!', 'error');
        return;
    }
    
    if (!confirm(`Tem certeza que deseja remover todos os ${clients.length} clientes cadastrados?`)) {
        return;
    }
    
    try {
        setButtonLoading('clearAllBtn', true);
        
        // Deletar todos os clientes no Firestore
        const deletePromises = clients.map(client => window.FirebaseDB.deleteClient(client.id));
        await Promise.all(deletePromises);
        
        showMessage('Todos os clientes foram removidos!', 'info');
    } catch (error) {
        console.error('Erro ao limpar clientes:', error);
        showMessage('Erro ao remover clientes. Tente novamente.', 'error');
        
        // Fallback para localStorage
        clients = [];
        saveClientsToStorage();
        updateClientsList();
        updateStats();
        showMessage('Todos os clientes foram removidos localmente!', 'info');
    } finally {
        setButtonLoading('clearAllBtn', false);
    }
}

// Função para exportar clientes
function exportClients() {
    if (clients.length === 0) {
        showMessage('Não há clientes para exportar!', 'error');
        return;
    }
    
    const csvContent = "data:text/csv;charset=utf-8," + 
        "Nome,Email,Data de Cadastro\n" +
        clients.map(client => 
            `"${client.name}","${client.email}","${formatDate(client.createdAt || client.updatedAt)}"`
        ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `clientes_${formatDateForFile(new Date())}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showMessage('Arquivo CSV exportado com sucesso!', 'success');
}

// Função para ir para o ranking
function goToRanking() {
    window.location.href = 'pages/ranking.html';
}

function goToParticipation() {
    window.location.href = 'pages/participar.html';
}

// Função para gerar relatório
function generateReport() {
    if (clients.length === 0) {
        showMessage('Não há dados para gerar relatório!', 'error');
        return;
    }
    
    const report = {
        totalClients: clients.length,
        oldestClient: clients.reduce((oldest, client) => {
            const oldestDate = oldest.createdAt || oldest.updatedAt;
            const clientDate = client.createdAt || client.updatedAt;
            return new Date(clientDate) < new Date(oldestDate) ? client : oldest;
        }),
        newestClient: clients.reduce((newest, client) => {
            const newestDate = newest.createdAt || newest.updatedAt;
            const clientDate = client.createdAt || client.updatedAt;
            return new Date(clientDate) > new Date(newestDate) ? client : newest;
        }),
        generatedAt: new Date().toISOString()
    };
    
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`
        <html>
            <head>
                <title>Relatório de Clientes</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    .header { border-bottom: 2px solid #2196F3; padding-bottom: 20px; margin-bottom: 30px; }
                    .stat { margin: 10px 0; }
                    .stat strong { color: #2196F3; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Relatório de Clientes</h1>
                    <p>Gerado em: ${formatDate(report.generatedAt)}</p>
                </div>
                <div class="stat"><strong>Total de Clientes:</strong> ${report.totalClients}</div>
                <div class="stat"><strong>Primeiro Cliente:</strong> ${report.oldestClient.name} (${formatDate(report.oldestClient.createdAt || report.oldestClient.updatedAt)})</div>
                <div class="stat"><strong>Último Cliente:</strong> ${report.newestClient.name} (${formatDate(report.newestClient.createdAt || report.newestClient.updatedAt)})</div>
            </body>
        </html>
    `);
    
    showMessage('Relatório gerado em nova aba!', 'success');
}

// Funções de importação removidas - não necessárias no dashboard do administrador

// Função para backup dos dados
function backupData() {
    if (clients.length === 0) {
        showMessage('Não há dados para backup!', 'error');
        return;
    }
    
    const backup = {
        clients: clients,
        exportedAt: new Date().toISOString(),
        version: '1.0'
    };
    
    const dataStr = JSON.stringify(backup, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `backup_clientes_${formatDateForFile(new Date())}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showMessage('Backup dos dados criado com sucesso!', 'success');
}

// Funções auxiliares para localStorage (fallback)
function saveClientsToStorage() {
    localStorage.setItem('dashboard-clients', JSON.stringify(clients));
}

function loadClientsFromStorage() {
    const saved = localStorage.getItem('dashboard-clients');
    if (saved) {
        clients = JSON.parse(saved);
    }
}

// Função para gerar ID único
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Função para escapar HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Função para formatar data
function formatDate(dateString) {
    if (!dateString) return 'Data não disponível';
    
    try {
        // Handle Firestore timestamp
        if (dateString && typeof dateString.toDate === 'function') {
            return dateString.toDate().toLocaleString('pt-BR');
        }
        
        // Handle JavaScript Date object
        if (dateString instanceof Date) {
            return dateString.toLocaleString('pt-BR');
        }
        
        // Handle string dates
        if (typeof dateString === 'string') {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                return date.toLocaleString('pt-BR');
            }
        }
        
        return 'Data não disponível';
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return 'Data não disponível';
    }
}

// Função para formatar data para nome de arquivo
function formatDateForFile(date) {
    return date.toISOString().split('T')[0].replace(/-/g, '');
}

// Função para mostrar loading
function showLoading(show) {
    const container = document.querySelector('.container');
    if (show) {
        container.classList.add('loading');
    } else {
        container.classList.remove('loading');
    }
}

// Função para mostrar loading em botão
function setButtonLoading(formId, loading) {
    const form = document.getElementById(formId);
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    
    if (submitBtn) {
        setButtonLoadingByElement(submitBtn, loading);
    }
}

// Função para mostrar loading em botão por elemento
function setButtonLoadingByElement(button, loading) {
    if (!button) return;
    
    if (loading) {
        button.classList.add('btn-loading');
        button.disabled = true;
    } else {
        button.classList.remove('btn-loading');
        button.disabled = false;
    }
}

// Função para mostrar mensagens
function showMessage(text, type = 'info') {
    if (typeof window.showMessage === 'function') {
        window.showMessage(text, type);
        return;
    }
    
    // Fallback local
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    
    messageContainer.appendChild(message);
    
    // Remover após 4 segundos
    setTimeout(() => {
        message.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => {
            if (message.parentNode) {
                messageContainer.removeChild(message);
            }
        }, 300);
    }, 4000);
}

// Cleanup quando sair da página
window.addEventListener('beforeunload', function() {
    if (unsubscribeClients) {
        unsubscribeClients();
    }
});

// Modal removido - não mais necessário

// Atalhos de teclado simplificados para o dashboard
document.addEventListener('keydown', function(e) {
    // F5 para atualizar dados
    if (e.key === 'F5') {
        e.preventDefault();
        loadClients();
    }
});

// Adicionar estilos para animação de slideOut e WhatsApp
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .client-whatsapp {
        color: #25D366;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 5px;
    }
    
    .client-whatsapp i {
        font-size: 1rem;
    }
`;
document.head.appendChild(style);

// Banco de palavras para geração randômica
const WORD_BANK = [
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

// Keywords Management Functions
async function generateNewKeywords() {
    try {
        // Mostrar loading no botão se existir
        const generateBtn = document.getElementById('generateKeywordsBtn');
        if (generateBtn) {
            setButtonLoadingByElement(generateBtn, true);
        }
        
        // Verificar se o DatabaseService está disponível
        if (window.DatabaseService && window.DatabaseService.isAvailable()) {
            console.log('Gerando palavras-chave via DatabaseService...');
            
            // Usar o método generateKeywords do modelo Keyword
            const result = await window.DatabaseService.generateKeywords();
            
            if (result.success) {
                const keywordData = {
                    id: result.data.id,
                    correct: result.data.correct_word,
                    incorrect: JSON.parse(result.data.incorrect_words),
                    timestamp: result.data.created_at
                };
                
                // Mostrar palavra atual
                showCurrentKeyword(keywordData);
                
                // Mostrar preview para clientes
                showKeywordPreview(keywordData.correct, keywordData.incorrect);
                
                // Atualizar status
                updateKeywordStatus(true);
                
                showMessage(`Nova palavra-chave salva no banco: "${keywordData.correct}"`, 'success');
                console.log('Palavra-chave gerada e salva no banco:', keywordData);
                
                return;
            } else {
                console.warn('Falha ao gerar via DatabaseService, usando método local:', result.error);
            }
        }
        
        // Fallback: Geração local (método anterior)
        console.log('Gerando palavras-chave localmente...');
        
        // Gerar palavra correta aleatória
        const correctWord = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
        
        // Gerar 3 palavras incorretas diferentes da correta
        const incorrectWords = [];
        while (incorrectWords.length < 3) {
            const randomWord = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
            if (randomWord !== correctWord && !incorrectWords.includes(randomWord)) {
                incorrectWords.push(randomWord);
            }
        }
        
        const keywordData = {
            id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
            correct: correctWord,
            incorrect: incorrectWords,
            timestamp: new Date().toISOString()
        };
        
        // Tentar salvar no DatabaseService primeiro
        if (window.DatabaseService && window.DatabaseService.isAvailable()) {
            try {
                const saveResult = await window.DatabaseService.createKeywords({
                    correct_word: correctWord,
                    incorrect_words: incorrectWords
                });
                
                if (saveResult.success) {
                    console.log('Palavra-chave salva no banco via método alternativo');
                    keywordData.id = saveResult.data.id;
                    keywordData.timestamp = saveResult.data.created_at;
                }
            } catch (error) {
                console.warn('Erro ao salvar no banco, usando localStorage:', error);
            }
        }
        
        // Fallback para localStorage
        localStorage.setItem('currentKeywords', JSON.stringify(keywordData));
        
        // Mostrar palavra atual
        showCurrentKeyword(keywordData);
        
        // Mostrar preview para clientes
        showKeywordPreview(keywordData.correct, keywordData.incorrect);
        
        // Atualizar status
        updateKeywordStatus(true);
        
        showMessage(`Nova palavra gerada: "${keywordData.correct}"`, 'success');
        console.log('Palavra-chave gerada:', keywordData);
        
    } catch (error) {
        console.error('Erro ao gerar palavras-chave:', error);
        showMessage('Erro ao gerar palavras-chave. Tente novamente.', 'error');
    } finally {
        // Remover loading do botão
        const generateBtn = document.getElementById('generateKeywordsBtn');
        if (generateBtn) {
            setButtonLoadingByElement(generateBtn, false);
        }
    }
}

function showCurrentKeyword(keywordData) {
    const { correct, timestamp } = keywordData;
    const formattedTime = new Date(timestamp).toLocaleString('pt-BR');
    
    currentKeywordDisplay.innerHTML = `
        <div class="active-keyword">
            <div class="keyword-main">
                <i class="fas fa-bullseye"></i>
                <span class="keyword-text">${correct}</span>
            </div>
            <div class="keyword-info">
                <small>Palavra correta atual • Gerada em ${formattedTime}</small>
            </div>
        </div>
    `;
}

function showKeywordPreview(correctWord, incorrectWords) {
    // Criar array com todas as palavras
    const allWords = [correctWord, ...incorrectWords];
    
    // Embaralhar as palavras para mostrar em ordem aleatória
    const shuffledWords = [...allWords].sort(() => Math.random() - 0.5);
    
    // Mostrar preview das 4 palavras embaralhadas
    previewButtons.innerHTML = shuffledWords.map((word) => {
        const isCorrect = word === correctWord;
        return `<button class="preview-btn ${isCorrect ? 'correct' : 'incorrect'}" disabled>
            ${word} ${isCorrect ? '(correta)' : ''}
        </button>`;
    }).join('');
    
    keywordPreview.style.display = 'block';
}

async function clearKeywords() {
    if (confirm('Tem certeza que deseja limpar as palavras-chave atuais?')) {
        try {
            // Mostrar loading
            const clearBtn = document.getElementById('clearKeywordsBtn');
            if (clearBtn) {
                setButtonLoadingByElement(clearBtn, true);
            }
            
            // Limpar do DatabaseService primeiro
            if (window.DatabaseService && window.DatabaseService.isAvailable()) {
                console.log('Limpando palavras-chave do banco...');
                const result = await window.DatabaseService.clearCurrentKeywords();
                
                if (result.success) {
                    console.log('Palavras-chave limpas do banco com sucesso');
                } else {
                    console.warn('Erro ao limpar do banco:', result.error);
                }
            }
            
            // Limpar do localStorage
            localStorage.removeItem('currentKeywords');
            
            // Mostrar estado vazio
            currentKeywordDisplay.innerHTML = `
                <div class="no-keyword">
                    <i class="fas fa-clock"></i>
                    <p>Nenhuma palavra ativa no momento</p>
                    <small>Use o botão "Gerar Palavras" para criar novas palavras-chave</small>
                </div>
            `;
            
            keywordPreview.style.display = 'none';
            updateKeywordStatus(false);
            showMessage('Palavras-chave limpas com sucesso!', 'info');
            
        } catch (error) {
            console.error('Erro ao limpar palavras-chave:', error);
            showMessage('Erro ao limpar palavras-chave. Tente novamente.', 'error');
        } finally {
            // Remover loading
            const clearBtn = document.getElementById('clearKeywordsBtn');
            if (clearBtn) {
                setButtonLoadingByElement(clearBtn, false);
            }
        }
    }
}

async function loadKeywordStatus() {
    try {
        let currentKeywords = null;
        
        // Tentar carregar do DatabaseService primeiro
        if (window.DatabaseService && window.DatabaseService.isAvailable()) {
            console.log('Carregando palavras-chave do banco...');
            const result = await window.DatabaseService.getCurrentKeywords();
            
            if (result.success && result.data) {
                currentKeywords = {
                    id: result.data.id,
                    correct: result.data.correct_word,
                    incorrect: JSON.parse(result.data.incorrect_words),
                    timestamp: result.data.created_at
                };
                console.log('Palavras-chave carregadas do banco:', currentKeywords);
            }
        }
        
        // Fallback para localStorage se não encontrou no banco
        if (!currentKeywords) {
            console.log('Carregando palavras-chave do localStorage...');
            const saved = localStorage.getItem('currentKeywords');
            if (saved) {
                try {
                    currentKeywords = JSON.parse(saved);
                } catch (error) {
                    console.error('Erro ao carregar palavras do localStorage:', error);
                }
            }
        }
        
        // Exibir palavras-chave se encontradas
        if (currentKeywords && currentKeywords.correct && currentKeywords.incorrect) {
            showCurrentKeyword(currentKeywords);
            showKeywordPreview(currentKeywords.correct, currentKeywords.incorrect);
            updateKeywordStatus(true);
            console.log('Palavras-chave ativas:', currentKeywords.correct);
        } else {
            console.log('Nenhuma palavra-chave ativa encontrada');
            currentKeywordDisplay.innerHTML = `
                <div class="no-keyword">
                    <i class="fas fa-clock"></i>
                    <p>Nenhuma palavra ativa no momento</p>
                    <small>Use o botão "Gerar Palavras" para criar novas palavras-chave</small>
                </div>
            `;
            updateKeywordStatus(false);
        }
        
    } catch (error) {
        console.error('Erro ao carregar status das palavras-chave:', error);
        currentKeywordDisplay.innerHTML = `
            <div class="no-keyword">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erro ao carregar palavras-chave</p>
                <small>Tente recarregar a página</small>
            </div>
        `;
        updateKeywordStatus(false);
    }
}

function updateKeywordStatus(active) {
    if (active) {
        keywordStatus.className = 'keyword-status active';
        keywordStatus.textContent = '✓ Palavras-chave ativas na live';
    } else {
        keywordStatus.className = 'keyword-status inactive';
        keywordStatus.textContent = '⚠ Nenhuma palavra-chave configurada';
    }
}

function clearAllAttempts() {
    if (confirm('Tem certeza que deseja limpar todas as tentativas dos usuários? Eles poderão tentar novamente as palavras-chave atuais.')) {
        window.FirebaseDB.clearUserAttempts();
        showMessage('Todas as tentativas dos usuários foram limpas!', 'success');
    }
}

