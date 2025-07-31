// Sistema de participação dos clientes
let clients = [];
let currentClient = null;
let clientActivities = [];
let unsubscribeActivities = null;

// Elementos do DOM
const clientIdentification = document.getElementById('clientIdentification');
const clientPreview = document.getElementById('clientPreview');
const previewText = document.getElementById('previewText');
const identifyBtn = document.getElementById('identifyBtn');
const clientSelectionSection = document.getElementById('clientSelectionSection');
const participationSection = document.getElementById('participationSection');
const currentClientName = document.getElementById('currentClientName');
const currentClientEmail = document.getElementById('currentClientEmail');
const clientPoints = document.getElementById('clientPoints');
const clientPosition = document.getElementById('clientPosition');
const keywordButtons = document.getElementById('keywordButtons');
const keywordStatus = document.getElementById('keywordStatus');
const todayPoints = document.getElementById('todayPoints');
const totalPoints = document.getElementById('totalPoints');
const lastActivity = document.getElementById('lastActivity');
const clientActivity = document.getElementById('clientActivity');
const messageContainer = document.getElementById('messageContainer');

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeFirebase();
    setupEventListeners();
    loadSavedEmail();
});

// Função para inicializar serviços de banco de dados
async function initializeFirebase() {
    try {
        // Aguardar o DatabaseService estar disponível
        if (typeof window.DatabaseService === 'undefined') {
            setTimeout(initializeFirebase, 100);
            return;
        }
        
        // Mostrar indicador de carregamento
        showMessage('Carregando sistema de banco de dados...', 'info');
        
        // Verificar se DatabaseService está disponível
        if (window.DatabaseService.isAvailable()) {
            console.log('DatabaseService disponível na participação');
            showMessage('Conectado ao banco de dados!', 'success');
        } else {
            console.log('DatabaseService não disponível, usando localStorage');
            showMessage('Usando armazenamento local', 'info');
        }
        
        // Carregar clientes
        await loadClients();
        
        console.log('Sistema inicializado na participação');
    } catch (error) {
        console.error('Erro ao inicializar sistema na participação:', error);
        showMessage('Erro ao conectar com banco de dados. Usando dados locais.', 'error');
        
        // Fallback para localStorage
        loadClientsFromStorage();
    }
}

// Função para configurar event listeners
function setupEventListeners() {
    // Input de identificação (apenas email)
    clientIdentification.addEventListener('input', function() {
        const email = this.value.trim();
        const clearEmailBtn = document.getElementById('clearEmailBtn');
        
        // Mostrar/ocultar botão de limpar baseado no conteúdo
        if (clearEmailBtn) {
            clearEmailBtn.style.display = email.length > 0 ? 'block' : 'none';
        }
        
        // Validação básica de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (email.length >= 5 && emailRegex.test(email)) {
            previewClient(email);
            identifyBtn.disabled = false;
        } else {
            hideClientPreview();
            identifyBtn.disabled = true;
        }
    });
    
    // Botão de identificação
    identifyBtn.addEventListener('click', identifyClient);
    
    // Enter na identificação
    clientIdentification.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !identifyBtn.disabled) {
            identifyClient();
        }
    });
    
    // Configurar listener para palavras-chave
    setupKeywordListener();
}

// Função para configurar listener de palavras-chave
function setupKeywordListener() {
    // Carregar palavras-chave inicial
    loadAvailableKeywords();
    
    // Verificar palavras-chave a cada 3 segundos
    setInterval(loadAvailableKeywords, 3000);
}

// Função para carregar clientes do banco de dados
async function loadClients() {
    try {
        // Aguardar um pouco para garantir sincronização
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Tentar carregar do DatabaseService primeiro
        if (window.DatabaseService && window.DatabaseService.isAvailable()) {
            clients = await window.DatabaseService.getClients();
            console.log('Clientes carregados do banco na participação:', clients.length);
        } else {
            // Fallback para localStorage
            console.log('DatabaseService não disponível, carregando do localStorage');
            loadClientsFromStorage();
            return;
        }
        
        // Mostrar clientes no console para debug
        clients.forEach(client => {
            console.log('Cliente:', client.name, client.email);
        });
        
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        // Fallback para localStorage
        loadClientsFromStorage();
    }
}

// Função para buscar cliente por email
async function findClientByEmail(email) {
    try {
        // Primeiro tentar via Firebase
        const client = await window.FirebaseDB.findClientByEmail(email);
        return client;
    } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        
        // Fallback para busca local
        const emailLower = email.toLowerCase().trim();
        
        // Buscar por correspondência exata no email
        const foundClient = clients.find(client => 
            client.email.toLowerCase() === emailLower
        );
        
        return foundClient;
    }
}

// Função para mostrar preview do cliente
async function previewClient(email) {
    const client = await findClientByEmail(email);
    
    if (client) {
        previewText.textContent = `Cliente encontrado: ${client.name}`;
        clientPreview.style.display = 'flex';
        clientPreview.className = 'client-preview success';
    } else {
        previewText.textContent = 'Email não encontrado. Verifique se você está cadastrado.';
        clientPreview.style.display = 'flex';
        clientPreview.className = 'client-preview error';
    }
}

// Função para esconder preview do cliente
function hideClientPreview() {
    clientPreview.style.display = 'none';
}

// Função para identificar cliente
async function identifyClient() {
    const email = clientIdentification.value.trim();
    
    if (email === '') {
        showMessage('Digite seu email para continuar', 'error');
        return;
    }
    
    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('Digite um email válido', 'error');
        return;
    }
    
    try {
        setButtonLoading(identifyBtn, true);
        
        const client = await findClientByEmail(email);
        
        if (!client) {
            showMessage('Email não encontrado. Verifique se você está cadastrado.', 'error');
            return;
        }
        
        // Definir cliente atual
        currentClient = client;
        
        // Salvar no localStorage para persistência
        localStorage.setItem('currentParticipationClient', JSON.stringify(client));
        
        // Salvar email para próximas sessões
        saveEmailToCache(email);
        
        // Mostrar seção de participação
        showParticipationSection();
        
        // Carregar dados do cliente
        await loadClientData();
        
        // Carregar palavras-chave disponíveis
        loadAvailableKeywords();
        
        showMessage(`Bem-vindo, ${client.name}!`, 'success');
        
    } catch (error) {
        console.error('Erro ao identificar cliente:', error);
        showMessage('Erro ao identificar cliente. Tente novamente.', 'error');
    } finally {
        setButtonLoading(identifyBtn, false);
    }
}

// Função para mostrar seção de participação
function showParticipationSection() {
    clientSelectionSection.style.display = 'none';
    participationSection.style.display = 'block';
    
    // Atualizar informações do cliente
    currentClientName.textContent = currentClient.name;
    currentClientEmail.textContent = currentClient.email;
}

// Função para carregar dados do cliente
async function loadClientData() {
    if (!currentClient) return;
    
    try {
        // Carregar atividades do cliente
        clientActivities = await window.FirebaseDB.getClientActivities(currentClient.id);
        
        // Configurar listener em tempo real para atividades
        setupActivityListener();
        
        // Atualizar estatísticas
        updateClientStats();
        
        // Atualizar lista de atividades
        updateActivityList();
        
        // Carregar palavras-chave disponíveis
        loadAvailableKeywords();
        
    } catch (error) {
        console.error('Erro ao carregar dados do cliente:', error);
        
        // Fallback para localStorage
        const savedActivities = localStorage.getItem(`client_activities_${currentClient.id}`);
        if (savedActivities) {
            clientActivities = JSON.parse(savedActivities);
            updateClientStats();
            updateActivityList();
        }
    }
}

// Função para configurar listener de atividades
function setupActivityListener() {
    // Cancelar listener anterior se existir
    if (unsubscribeActivities) {
        unsubscribeActivities();
    }
    
    // Configurar novo listener (para todas as atividades)
    unsubscribeActivities = window.FirebaseDB.onActivitiesChange((activities) => {
        // Filtrar apenas atividades do cliente atual
        clientActivities = activities.filter(activity => 
            activity.clientId === currentClient.id
        );
        
        updateClientStats();
        updateActivityList();
    });
}

// Função para configurar listener de palavras-chave
function setupKeywordListener() {
    // Verificar palavras-chave a cada 2 segundos
    setInterval(loadAvailableKeywords, 2000);
}

// Função para carregar palavras-chave disponíveis
async function loadAvailableKeywords() {
    try {
        let currentKeywords = null;
        
        // Tentar carregar do DatabaseService primeiro
        if (window.DatabaseService && window.DatabaseService.isAvailable()) {
            const result = await window.DatabaseService.getCurrentKeywords();
            
            if (result.success && result.data) {
                currentKeywords = {
                    id: result.data.id,
                    correct: result.data.correct_word,
                    incorrect: JSON.parse(result.data.incorrect_words),
                    timestamp: result.data.created_at
                };
            }
        }
        
        // Fallback para localStorage se não encontrou no banco
        if (!currentKeywords) {
            const saved = localStorage.getItem('currentKeywords');
            if (saved) {
                try {
                    currentKeywords = JSON.parse(saved);
                } catch (error) {
                    console.error('Erro ao carregar palavras do localStorage:', error);
                }
            }
        }
        
        if (currentKeywords && currentKeywords.correct && currentKeywords.incorrect) {
            console.log('Palavras-chave carregadas:', currentKeywords);
            displayKeywordButtons(currentKeywords);
        } else {
            console.log('Nenhuma palavra-chave encontrada');
            showWaitingMessage();
        }
        
    } catch (error) {
        console.error('Erro ao carregar palavras-chave:', error);
        showWaitingMessage();
    }
}

// Função para mostrar mensagem de espera
function showWaitingMessage() {
    keywordButtons.innerHTML = `
        <div class="waiting-message">
            <i class="fas fa-clock"></i>
            <p>Aguardando palavra-chave da live...</p>
        </div>
    `;
}

// Cache para palavras embaralhadas por cliente/palavra-chave
let shuffledWordsCache = {};

// Função para mostrar botões de palavras-chave
function displayKeywordButtons(keywordData) {
    if (!currentClient) {
        showWaitingMessage();
        return;
    }
    
    const { correct, incorrect, timestamp } = keywordData;
    
    // Usar timestamp como ID se não houver ID específico
    const keywordId = keywordData.id || timestamp || Date.now().toString();
    
    const allWords = [correct, ...incorrect];
    
    // Verificar se o usuário já tentou esta palavra-chave
    const hasAttempted = checkUserAttempt(currentClient.email, keywordId);
    
    if (hasAttempted) {
        showPreviousAttemptResult(currentClient.email, keywordId);
        return;
    }
    
    // Criar chave única para o cache baseada no cliente e palavra-chave
    const cacheKey = `${currentClient.email}_${keywordId}`;
    
    // Verificar se já temos palavras embaralhadas no cache para este cliente/palavra-chave
    let shuffledWords;
    if (shuffledWordsCache[cacheKey]) {
        shuffledWords = shuffledWordsCache[cacheKey];
    } else {
        // Embaralhar as palavras apenas uma vez e salvar no cache
        shuffledWords = [...allWords].sort(() => Math.random() - 0.5);
        shuffledWordsCache[cacheKey] = shuffledWords;
    }
    
    keywordButtons.innerHTML = shuffledWords.map(word => `
        <button class="keyword-btn" onclick="selectKeyword('${word}', '${correct}', '${keywordId}')">
            ${word}
        </button>
    `).join('');
}

// Função para selecionar palavra-chave
async function selectKeyword(selectedWord, correctWord, keywordId) {
    if (!currentClient) {
        showMessage('Erro: Cliente não identificado', 'error');
        return;
    }
    
    // Verificar se já tentou (dupla verificação)
    if (checkUserAttempt(currentClient.email, keywordId)) {
        showMessage('Você já tentou esta palavra-chave!', 'error');
        showPreviousAttemptResult(currentClient.email, keywordId);
        return;
    }
    
    const isCorrect = selectedWord === correctWord;
    const buttonClicked = event.target;
    
    // Desabilitar todos os botões
    const allButtons = keywordButtons.querySelectorAll('.keyword-btn');
    allButtons.forEach(btn => btn.disabled = true);
    
    try {
        // Registrar tentativa IMEDIATAMENTE
        recordUserAttempt(currentClient.email, keywordId, isCorrect, selectedWord, correctWord);
        
        if (isCorrect) {
            // Palavra correta - 1 ponto fixo
            const points = 1;
            
            // Marcar botão como correto
            buttonClicked.classList.add('selected');
            
            // Criar atividade
            const activityData = {
                clientId: currentClient.id,
                clientName: currentClient.name,
                keyword: selectedWord,
                points: points,
                isCorrect: true,
                keywordId: keywordId
            };
            
            // Salvar atividade
            await window.FirebaseDB.addActivity(activityData);
            
            showMessage(`🎉 Parabéns! Palavra correta! +${points} ponto!`, 'success');
            
        } else {
            // Palavra incorreta - sem pontos
            buttonClicked.classList.add('error');
            
            // Destacar a palavra correta
            allButtons.forEach(btn => {
                if (btn.textContent.trim() === correctWord) {
                    btn.classList.add('selected');
                }
            });
            
            showMessage(`❌ Palavra incorreta! A palavra correta era "${correctWord}"`, 'error');
        }
        
    } catch (error) {
        console.error('Erro ao processar palavra-chave:', error);
        showMessage('Erro ao processar resposta. Tente novamente.', 'error');
        
        // Remover tentativa em caso de erro crítico
        window.FirebaseDB.clearAttemptsForKeyword(keywordId);
        
        // Reabilitar botões em caso de erro
        allButtons.forEach(btn => btn.disabled = false);
    }
}

// Função para mostrar resultado de tentativa anterior
function showPreviousAttemptResult(clientEmail, keywordId) {
    const attempt = window.FirebaseDB.getUserAttempt(clientEmail, keywordId);
    
    if (!attempt) {
        showWaitingMessage();
        return;
    }
    
    if (attempt.isCorrect) {
        showSuccessState(attempt.selectedWord, null, attempt);
    } else {
        showPreviousErrorState(attempt);
    }
}

// Função para mostrar estado de sucesso
function showSuccessState(selectedWord, points, attempt = null) {
    const pointsText = points ? `+${points} pontos` : 'Pontos já creditados';
    const timestamp = attempt ? new Date(attempt.timestamp).toLocaleString('pt-BR') : 'agora';
    
    keywordButtons.innerHTML = `
        <div class="attempt-result success">
            <div class="result-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            <div class="result-content">
                <h3>🎉 Parabéns!</h3>
                <p>Você acertou a palavra: <strong>"${selectedWord}"</strong></p>
                <p class="points-info">${pointsText}</p>
                <p class="attempt-time">Tentativa realizada em: ${timestamp}</p>
            </div>
        </div>
    `;
    
    keywordStatus.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>Palavra correta! ${pointsText}</span>
    `;
    keywordStatus.style.display = 'flex';
}

// Função para mostrar estado de erro
function showErrorState(selectedWord, correctWord) {
    keywordButtons.innerHTML = `
        <div class="attempt-result error">
            <div class="result-icon">
                <i class="fas fa-times-circle"></i>
            </div>
            <div class="result-content">
                <h3>❌ Palavra Incorreta</h3>
                <p>Você escolheu: <strong>"${selectedWord}"</strong></p>
                <p>A palavra correta era: <strong>"${correctWord}"</strong></p>
                <p class="retry-info">Aguarde a próxima palavra-chave da live!</p>
                <p class="attempt-time">Tentativa realizada agora</p>
            </div>
        </div>
    `;
    
    keywordStatus.innerHTML = `
        <i class="fas fa-times-circle"></i>
        <span>Palavra incorreta! A correta era "${correctWord}"</span>
    `;
    keywordStatus.style.display = 'flex';
}

// Função para mostrar erro de tentativa anterior
function showPreviousErrorState(attempt) {
    const timestamp = new Date(attempt.timestamp).toLocaleString('pt-BR');
    
    keywordButtons.innerHTML = `
        <div class="attempt-result error">
            <div class="result-icon">
                <i class="fas fa-times-circle"></i>
            </div>
            <div class="result-content">
                <h3>❌ Palavra Incorreta</h3>
                <p>Você escolheu: <strong>"${attempt.selectedWord}"</strong></p>
                <p>${attempt.correctWord ? `A palavra correta era: <strong>"${attempt.correctWord}"</strong>` : 'Não foi dessa vez que você conseguiu pontuar'}</p>
                <p class="retry-info">Aguarde a próxima palavra-chave da live!</p>
                <p class="attempt-time">Tentativa realizada em: ${timestamp}</p>
            </div>
        </div>
    `;
    
    keywordStatus.innerHTML = `
        <i class="fas fa-times-circle"></i>
        <span>${attempt.correctWord ? `Palavra incorreta! A correta era "${attempt.correctWord}"` : 'Não foi dessa vez que você conseguiu pontuar'}</span>
    `;
    keywordStatus.style.display = 'flex';
}

// Função para atualizar estatísticas do cliente
function updateClientStats() {
    if (!clientActivities) return;
    
    // Calcular pontos totais
    const totalPts = clientActivities.reduce((sum, activity) => sum + (activity.points || 0), 0);
    
    // Calcular pontos de hoje
    const today = new Date().toDateString();
    const todayActivities = clientActivities.filter(activity => {
        const activityDate = activity.timestamp?.toDate ? 
            activity.timestamp.toDate() : 
            new Date(activity.timestamp);
        return activityDate.toDateString() === today;
    });
    const todayPts = todayActivities.reduce((sum, activity) => sum + (activity.points || 0), 0);
    
    // Atualizar interface
    totalPoints.textContent = totalPts;
    todayPoints.textContent = todayPts;
    clientPoints.textContent = totalPts;
    
    // Última atividade
    if (clientActivities.length > 0) {
        const lastActivityTime = clientActivities[0].timestamp?.toDate ? 
            clientActivities[0].timestamp.toDate() : 
            new Date(clientActivities[0].timestamp);
        lastActivity.textContent = lastActivityTime.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    } else {
        lastActivity.textContent = '-';
    }
}

// Função para atualizar lista de atividades
function updateActivityList() {
    if (!clientActivities || clientActivities.length === 0) {
        clientActivity.innerHTML = `
            <div class="empty-activity">
                <i class="fas fa-keyboard"></i>
                <p>Nenhuma participação ainda hoje</p>
            </div>
        `;
        return;
    }
    
    // Mostrar apenas as últimas 10 atividades
    const recentActivities = clientActivities.slice(0, 10);
    
    clientActivity.innerHTML = recentActivities.map(activity => {
        const activityTime = activity.timestamp?.toDate ? 
            activity.timestamp.toDate() : 
            new Date(activity.timestamp);
            
        return `
            <div class="activity-item">
                <div class="activity-info">
                    <div class="activity-keyword">"${escapeHtml(activity.keyword)}"</div>
                    <div class="activity-time">
                        <i class="fas fa-clock"></i>
                        ${activityTime.toLocaleString('pt-BR')}
                    </div>
                </div>
                <div class="activity-points">+${activity.points} pts</div>
            </div>
        `;
    }).join('');
}

// Função para logout
function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        // Limpar dados
        currentClient = null;
        clientActivities = [];
        
        // Cancelar listeners
        if (unsubscribeActivities) {
            unsubscribeActivities();
        }
        
        // Limpar localStorage
        localStorage.removeItem('currentParticipationClient');
        
        // Mostrar seção de seleção
        participationSection.style.display = 'none';
        clientSelectionSection.style.display = 'block';
        
        // Limpar inputs
        clientIdentification.value = '';
        hideClientPreview();
        showWaitingMessage();
        
        showMessage('Logout realizado com sucesso!', 'info');
    }
}

// Função para carregar clientes do localStorage (fallback)
function loadClientsFromStorage() {
    const saved = localStorage.getItem('dashboard-clients');
    if (saved) {
        clients = JSON.parse(saved);
    }
}

// Função para mostrar loading em botão
function setButtonLoading(button, loading) {
    if (loading) {
        button.classList.add('btn-loading');
        button.disabled = true;
    } else {
        button.classList.remove('btn-loading');
        button.disabled = false;
    }
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

// Função para mostrar mensagens
function showMessage(text, type = 'info') {
    if (typeof window.showMessage === 'function') {
        window.showMessage(text, type);
        return;
    }
    
    // Fallback local
    if (!messageContainer) return;
    
    const message = document.createElement('div');
    message.className = `message ${type}`;
    message.textContent = text;
    
    messageContainer.appendChild(message);
    
    // Remover após 4 segundos
    setTimeout(() => {
        if (message.parentNode) {
            messageContainer.removeChild(message);
        }
    }, 4000);
}

// Verificar se há cliente salvo ao carregar
document.addEventListener('DOMContentLoaded', function() {
    const savedClient = localStorage.getItem('currentParticipationClient');
    if (savedClient) {
        try {
            currentClient = JSON.parse(savedClient);
            showParticipationSection();
            loadClientData();
        } catch (error) {
            console.error('Erro ao carregar cliente salvo:', error);
            localStorage.removeItem('currentParticipationClient');
        }
    }
});

// Funções para controle de tentativas (anti-duplicação)
function checkUserAttempt(email, keywordId) {
    // Verificar no Firebase primeiro
    if (window.FirebaseDB && window.FirebaseDB.hasUserAttempted) {
        try {
            return window.FirebaseDB.hasUserAttempted(email, keywordId);
        } catch (error) {
            console.error('Erro ao verificar tentativa no Firebase:', error);
        }
    }
    
    // Fallback para localStorage
    const attempts = getLocalAttempts();
    const attemptKey = `${email}_${keywordId}`;
    return attempts.hasOwnProperty(attemptKey);
}

function recordUserAttempt(email, keywordId, isCorrect, selectedWord, correctWord) {
    // Registrar no Firebase
    if (window.FirebaseDB && window.FirebaseDB.recordUserAttempt) {
        try {
            window.FirebaseDB.recordUserAttempt(email, keywordId, isCorrect, selectedWord, correctWord);
        } catch (error) {
            console.error('Erro ao registrar tentativa no Firebase:', error);
        }
    }
    
    // Registrar no localStorage (sempre para garantir)
    const attempts = getLocalAttempts();
    const attemptKey = `${email}_${keywordId}`;
    attempts[attemptKey] = {
        email: email,
        keywordId: keywordId,
        isCorrect: isCorrect,
        selectedWord: selectedWord,
        correctWord: correctWord,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('userAttempts', JSON.stringify(attempts));
}

function getLocalAttempts() {
    try {
        const saved = localStorage.getItem('userAttempts');
        return saved ? JSON.parse(saved) : {};
    } catch (error) {
        console.error('Erro ao carregar tentativas do localStorage:', error);
        return {};
    }
}

function showPreviousAttemptResult(email, keywordId) {
    // Tentar buscar resultado do Firebase
    if (window.FirebaseDB && window.FirebaseDB.getUserAttemptResult) {
        try {
            const result = window.FirebaseDB.getUserAttemptResult(email, keywordId);
            if (result) {
                showAttemptResultState(result);
                return;
            }
        } catch (error) {
            console.error('Erro ao buscar resultado do Firebase:', error);
        }
    }
    
    // Fallback para localStorage
    const attempts = getLocalAttempts();
    const attemptKey = `${email}_${keywordId}`;
    const attempt = attempts[attemptKey];
    
    if (attempt) {
        if (attempt.isCorrect) {
            keywordButtons.innerHTML = `
                <div class="attempt-result success">
                    <i class="fas fa-check-circle"></i>
                    <p>Você já acertou esta palavra-chave!</p>
                    <p>Palavra selecionada: <strong>${attempt.selectedWord}</strong></p>
                </div>
            `;
        } else {
            keywordButtons.innerHTML = `
                <div class="attempt-result error">
                    <i class="fas fa-times-circle"></i>
                    <p>❌ Palavra Incorreta</p>
                    <p>Você escolheu: <strong>${attempt.selectedWord}</strong></p>
                    <p>${attempt.correctWord ? `A palavra correta era: <strong>${attempt.correctWord}</strong>` : 'Não foi dessa vez que você conseguiu pontuar'}</p>
                </div>
            `;
        }
    } else {
        keywordButtons.innerHTML = `
            <div class="attempt-result">
                <i class="fas fa-info-circle"></i>
                <p>Você já tentou esta palavra-chave</p>
            </div>
        `;
    }
}

function showAttemptResultState(result) {
    if (result.isCorrect) {
        keywordButtons.innerHTML = `
            <div class="attempt-result success">
                <i class="fas fa-check-circle"></i>
                <p>Você já acertou esta palavra-chave!</p>
                <p>Palavra selecionada: <strong>${result.selectedWord}</strong></p>
            </div>
        `;
    } else {
        keywordButtons.innerHTML = `
            <div class="attempt-result error">
                <i class="fas fa-times-circle"></i>
                <p>❌ Palavra Incorreta</p>
                <p>Você escolheu: <strong>${result.selectedWord}</strong></p>
                <p>${result.correctWord ? `A palavra correta era: <strong>${result.correctWord}</strong>` : 'Não foi dessa vez que você conseguiu pontuar'}</p>
            </div>
        `;
    }
}

// Funções para gerenciar cache do email
function saveEmailToCache(email) {
    try {
        localStorage.setItem('savedUserEmail', email);
    } catch (error) {
        console.error('Erro ao salvar email no cache:', error);
    }
}

function loadSavedEmail() {
    try {
        const savedEmail = localStorage.getItem('savedUserEmail');
        const clearEmailBtn = document.getElementById('clearEmailBtn');
        
        if (savedEmail) {
            clientIdentification.value = savedEmail;
            
            // Mostrar botão de limpar
            if (clearEmailBtn) {
                clearEmailBtn.style.display = 'block';
            }
            
            // Validar automaticamente se é um email válido
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (savedEmail.length >= 5 && emailRegex.test(savedEmail)) {
                previewClient(savedEmail);
                identifyBtn.disabled = false;
            }
        } else {
            // Ocultar botão de limpar se não há email salvo
            if (clearEmailBtn) {
                clearEmailBtn.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Erro ao carregar email do cache:', error);
    }
}

function clearSavedEmail() {
    try {
        localStorage.removeItem('savedUserEmail');
        clientIdentification.value = '';
        hideClientPreview();
        identifyBtn.disabled = true;
        
        // Ocultar botão de limpar
        const clearEmailBtn = document.getElementById('clearEmailBtn');
        if (clearEmailBtn) {
            clearEmailBtn.style.display = 'none';
        }
        
        // Focar no input para nova digitação
        clientIdentification.focus();
        
        showMessage('Email removido do cache', 'info');
    } catch (error) {
        console.error('Erro ao limpar email do cache:', error);
    }
}

// Adicionar estilos CSS para as mensagens de tentativa e botão de limpar email
const attemptStyles = document.createElement('style');
attemptStyles.textContent = `
    .attempt-result {
        text-align: center;
        padding: 30px;
        border-radius: 12px;
        margin: 20px 0;
    }
    
    .attempt-result.success {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
    }
    
    .attempt-result.error {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: white;
    }
    
    .attempt-result i {
        font-size: 2rem;
        margin-bottom: 15px;
        display: block;
    }
    
    .attempt-result p {
        margin: 10px 0;
        font-size: 1.1rem;
    }
    
    .attempt-result strong {
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    /* Estilos para o botão de limpar email */
    .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }
    
    .btn-clear-email {
        position: absolute;
        right: 12px;
        background: none;
        border: none;
        color: var(--text-muted, #64748b);
        cursor: pointer;
        font-size: 1rem;
        padding: 6px;
        border-radius: 6px;
        transition: all 0.2s ease;
        z-index: 10;
    }
    
    .btn-clear-email:hover {
        background: var(--surface-bg, #334155);
        color: var(--text-secondary, #cbd5e1);
        transform: scale(1.05);
    }
    
    .btn-clear-email:active {
        transform: scale(0.95);
    }
    
    /* Ajustar padding do input para não sobrepor o botão */
    .input-wrapper input {
        padding-right: 40px !important;
    }
    
    /* Centralização do menu de email - design original com cores consistentes */
    .client-selection-section {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 100px);
        padding: 20px;
    }
    
    .selection-card {
        width: 100%;
        max-width: 600px;
        background: var(--card-bg, #1e293b);
        border-radius: 16px;
        box-shadow: var(--shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1));
        border: 1px solid var(--border-color, #475569);
        overflow: hidden;
    }
    
    .card-header {
        text-align: center;
        padding: 32px 24px;
        background: var(--card-bg, #1e293b);
        border-bottom: 1px solid var(--border-color, #475569);
    }
    
    .card-header i {
        font-size: 2.5rem;
        color: var(--primary-color, #2563eb);
        margin-bottom: 16px;
    }
    
    .card-header h1 {
        font-size: 1.875rem;
        font-weight: 700;
        color: var(--text-primary, #f8fafc);
        margin-bottom: 8px;
    }
    
    .card-header p {
        color: var(--text-secondary, #cbd5e1);
        font-size: 1rem;
    }
    
    .identification-form {
        padding: 32px 24px;
        background: var(--card-bg, #1e293b);
    }
    
    .input-group {
        margin-bottom: 24px;
    }
    
    .input-wrapper {
        position: relative;
        margin-bottom: 16px;
    }
    
    .input-wrapper i {
        position: absolute;
        left: 16px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--primary-color, #2563eb);
        font-size: 1.1rem;
        z-index: 5;
    }
    
    .input-wrapper input {
        width: 100%;
        padding: 16px 50px 16px 50px;
        background: var(--surface-bg, #334155);
        border: 1px solid var(--border-color, #475569);
        border-radius: 8px;
        color: var(--text-primary, #f8fafc);
        font-size: 1rem;
        transition: all 0.2s ease;
        outline: none;
    }
    
    .input-wrapper input::placeholder {
        color: var(--text-muted, #64748b);
    }
    
    .input-wrapper input:focus {
        border-color: var(--primary-color, #2563eb);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    
    .btn-identify {
        width: 100%;
        padding: 16px;
        background: var(--primary-color, #2563eb);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }
    
    .btn-identify:hover:not(:disabled) {
        background: var(--primary-dark, #1d4ed8);
        transform: translateY(-1px);
    }
    
    .btn-identify:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
        background: var(--text-muted, #64748b);
    }
    
    .client-preview {
        padding: 12px 16px;
        border-radius: 8px;
        margin: 16px 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        font-weight: 500;
        font-size: 0.9rem;
    }
    
    .client-preview.success {
        background: rgba(16, 185, 129, 0.1);
        color: var(--secondary-color, #10b981);
        border: 1px solid rgba(16, 185, 129, 0.2);
    }
    
    .client-preview.error {
        background: rgba(239, 68, 68, 0.1);
        color: var(--danger-color, #ef4444);
        border: 1px solid rgba(239, 68, 68, 0.2);
    }
    
    .help-text {
        text-align: center;
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid var(--border-color, #475569);
    }
    
    .help-text p {
        color: var(--text-secondary, #cbd5e1);
        font-size: 0.9rem;
    }
    
    .help-text a {
        color: var(--primary-color, #2563eb);
        text-decoration: none;
        font-weight: 500;
    }
    
    .help-text a:hover {
        text-decoration: underline;
    }
    
    /* Responsivo para mobile */
    @media (max-width: 768px) {
        .client-selection-section {
            min-height: calc(100vh - 80px);
            padding: 16px;
        }
        
        .selection-card {
            max-width: 100%;
        }
        
        .card-header {
            padding: 24px 20px;
        }
        
        .card-header h1 {
            font-size: 1.5rem;
        }
        
        .card-header i {
            font-size: 2rem;
        }
        
        .identification-form {
            padding: 24px 20px;
        }
    }
`;
document.head.appendChild(attemptStyles);

// Cleanup quando sair da página
window.addEventListener('beforeunload', function() {
    if (unsubscribeActivities) {
        unsubscribeActivities();
    }
});