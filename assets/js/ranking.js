// Sistema de pontuação e ranking por presença na live
let clients = [];
let activities = [];
let rankingData = [];
let unsubscribeClients = null;
let unsubscribeActivities = null;

// Elementos do DOM
const rankingList = document.getElementById('rankingList');
const recentPointsList = document.getElementById('recentPointsList');
const totalPointsElement = document.getElementById('totalPoints');
const activeParticipantsElement = document.getElementById('activeParticipants');
const podium = document.getElementById('podium');
const messageContainer = document.getElementById('messageContainer');
// Always use all-time period - period filtering removed

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeFirebase();
    setupEventListeners();
});

// Função para inicializar Firebase
async function initializeFirebase() {
    try {
        // Aguardar o Firebase estar disponível
        if (typeof window.FirebaseDB === 'undefined') {
            setTimeout(initializeFirebase, 100);
            return;
        }
        
        // Configurar listeners em tempo real
        setupRealtimeListeners();
        
        // Carregar dados iniciais
        await loadInitialData();
        
        console.log('Firebase inicializado no ranking');
    } catch (error) {
        console.error('Erro ao inicializar Firebase no ranking:', error);
        showMessage('Erro ao conectar com Firebase. Usando dados locais.', 'error');
        
        // Fallback para localStorage
        loadLocalData();
    }
}

// Função para configurar event listeners
function setupEventListeners() {
    // No period switching needed - always show all-time data
}

// Função para configurar listeners em tempo real
function setupRealtimeListeners() {
    // Listener para clientes
    unsubscribeClients = window.FirebaseDB.onClientsChange((clientsData) => {
        clients = clientsData;
        updateRanking();
    });
    
    // Listener para atividades
    unsubscribeActivities = window.FirebaseDB.onActivitiesChange((activitiesData) => {
        activities = activitiesData;
        updateRanking();
        updateRecentActivities();
        updateStats();
    });
}

// Função para carregar dados iniciais
async function loadInitialData() {
    try {
        // Carregar clientes e atividades
        const [clientsData, activitiesData] = await Promise.all([
            window.FirebaseDB.getClients(),
            window.FirebaseDB.getAllActivities(100)
        ]);
        
        clients = clientsData;
        activities = activitiesData;
        
        // Atualizar interface
        updateRanking();
        updateRecentActivities();
        updateStats();
        
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        loadLocalData();
    }
}

// Função para calcular ranking
async function calculateRanking() {
    try {
        // Usar função do Firebase que já calcula o ranking (sempre todo período)
        const ranking = await window.FirebaseDB.getRankingData('all');
        return ranking;
    } catch (error) {
        console.error('Erro ao calcular ranking:', error);
        
        // Fallback para cálculo local
        return calculateLocalRanking();
    }
}

// Função para calcular ranking localmente (fallback)
function calculateLocalRanking() {
    // Always use all activities - no period filtering
    let filteredActivities = activities;
    
    // Agrupar pontos por cliente
    const clientPoints = {};
    filteredActivities.forEach(activity => {
        if (!clientPoints[activity.clientId]) {
            const client = clients.find(c => c.id === activity.clientId);
            if (!client) return;
            
            clientPoints[activity.clientId] = {
                client: client,
                points: 0,
                lastActivity: activity.timestamp,
                position: 0
            };
        }
        
        clientPoints[activity.clientId].points += activity.points || 0;
        
        const currentLastActivity = clientPoints[activity.clientId].lastActivity;
        const activityTime = activity.timestamp?.toDate ? 
            activity.timestamp.toDate() : 
            new Date(activity.timestamp);
        const currentTime = currentLastActivity?.toDate ? 
            currentLastActivity.toDate() : 
            new Date(currentLastActivity);
            
        if (activityTime > currentTime) {
            clientPoints[activity.clientId].lastActivity = activity.timestamp;
        }
    });
    
    // Converter para array e ordenar por pontos
    const ranking = Object.values(clientPoints)
        .sort((a, b) => b.points - a.points);
        
    // Atribuir posições
    ranking.forEach((entry, index) => {
        entry.position = index + 1;
    });
    
    return ranking;
}

// Period switching removed - always show all-time ranking

// Função para atualizar ranking
async function updateRanking() {    
    try {
        // Calcular ranking (sempre todo período)
        rankingData = await calculateRanking();
        
        // Atualizar pódium
        updatePodium(rankingData);
        
        // Atualizar lista completa
        updateRankingList(rankingData);
        
    } catch (error) {
        console.error('Erro ao atualizar ranking:', error);
        showMessage('Erro ao atualizar ranking', 'error');
    }
}


// Função para atualizar o pódium
function updatePodium(ranking) {
    if (ranking.length >= 3) {
        podium.style.display = 'flex';
        
        // Atualizar cada posição do pódium
        for (let i = 0; i < 3; i++) {
            const position = i + 1;
            const entry = ranking[i];
            
            const nameElement = document.getElementById(`podium-${position}-name`);
            const pointsElement = document.getElementById(`podium-${position}-points`);
            
            if (nameElement && pointsElement && entry) {
                nameElement.textContent = entry.client.name.split(' ')[0];
                pointsElement.textContent = `${entry.points} pts`;
            }
        }
    } else {
        podium.style.display = 'none';
    }
}

// Função para atualizar lista do ranking
function updateRankingList(ranking) {
    if (ranking.length === 0) {
        rankingList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-trophy"></i>
                <h3>Nenhum ponto adicionado ainda</h3>
                <p>Comece adicionando palavras-chave para ver o ranking!</p>
            </div>
        `;
        return;
    }
    
    rankingList.innerHTML = ranking.map(entry => {
        const lastActivityTime = entry.lastActivity?.toDate ? 
            entry.lastActivity.toDate() : 
            new Date(entry.lastActivity);
            
        return `
            <div class="ranking-item ${entry.position <= 3 ? 'top-three' : ''}">
                <div class="ranking-position">
                    <div class="position-badge" style="color: ${getPositionColor(entry.position)}">
                        ${entry.position}
                    </div>
                </div>
                <div class="client-info">
                    <div class="client-name">${escapeHtml(entry.client.name)}</div>
                    <div class="last-activity">
                        Última atividade: ${lastActivityTime.toLocaleString('pt-BR')}
                    </div>
                </div>
                <div class="points-info">
                    <div class="points-count">${entry.points}</div>
                    <div class="points-label">pontos</div>
                </div>
            </div>
        `;
    }).join('');
}

// Função para obter cor da posição
function getPositionColor(position) {
    switch (position) {
        case 1: return '#ffd700'; // Ouro
        case 2: return '#c0c0c0'; // Prata  
        case 3: return '#cd7f32'; // Bronze
        default: return '#2563eb'; // Azul padrão
    }
}

// Função para atualizar atividades recentes
function updateRecentActivities() {
    if (!activities || activities.length === 0) {
        recentPointsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clock"></i>
                <h3>Nenhuma atividade hoje</h3>
                <p>As ações recentes aparecerão aqui</p>
            </div>
        `;
        return;
    }
    
    // Mostrar apenas as 20 atividades mais recentes
    const recentActivities = activities.slice(0, 20);
    
    recentPointsList.innerHTML = recentActivities.map(activity => {
        const activityTime = activity.timestamp?.toDate ? 
            activity.timestamp.toDate() : 
            new Date(activity.timestamp);
            
        return `
            <div class="recent-point-item">
                <div class="point-info">
                    <div class="client-name">${escapeHtml(activity.clientName)}</div>
                    <div class="keyword-text">"${escapeHtml(activity.keyword)}"</div>
                    <div class="point-time">${activityTime.toLocaleString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}</div>
                </div>
                <div class="points-count" style="color: #10b981; font-weight: bold;">
                    +${activity.points}
                </div>
            </div>
        `;
    }).join('');
}

// Função para atualizar estatísticas
function updateStats() {
    if (!activities) return;
    
    // Total de pontos hoje
    const today = new Date().toDateString();
    const todayActivities = activities.filter(activity => {
        const activityDate = activity.timestamp?.toDate ? 
            activity.timestamp.toDate() : 
            new Date(activity.timestamp);
        return activityDate.toDateString() === today;
    });
    
    const totalTodayPoints = todayActivities.reduce((sum, activity) => sum + (activity.points || 0), 0);
    totalPointsElement.textContent = totalTodayPoints;
    
    // Participantes ativos (clientes com pelo menos 1 atividade)
    const activeClientIds = new Set(activities.map(activity => activity.clientId));
    activeParticipantsElement.textContent = activeClientIds.size;
}

// Função para limpar dados do ranking
async function clearRankingData() {
    try {
        // Limpar todas as atividades no Firestore
        if (window.FirebaseDB && typeof window.FirebaseDB.clearAllActivities === 'function') {
            await window.FirebaseDB.clearAllActivities();
        }
        
        // Limpar dados locais
        clients.forEach(client => {
            localStorage.removeItem(`client_activities_${client.id}`);
        });
        
        // Resetar variáveis
        activities = [];
        rankingData = [];
        
        // Atualizar interface
        updateRanking();
        updateRecentActivities();
        updateStats();
        
    } catch (error) {
        console.error('Erro ao limpar dados do ranking:', error);
        throw error;
    }
}

// Função para executar premiação
async function executeAward() {
    if (!rankingData || rankingData.length === 0) {
        showMessage('Não há participantes para premiar!', 'warning');
        return;
    }
    
    if (!confirm('Tem certeza que deseja confirmar a premiação? Isso salvará os ganhadores e habilitará o reset do ranking.')) {
        return;
    }
    
    try {
        // Salvar ranking atual como ganhadores
        const winners = {
            id: Date.now().toString(),
            timestamp: new Date(),
            ranking: rankingData.slice(0, 10), // Top 10
            totalParticipants: rankingData.length
        };
        
        // Salvar no localStorage e Firebase (se disponível)
        let savedWinners = JSON.parse(localStorage.getItem('winners_history') || '[]');
        savedWinners.unshift(winners);
        localStorage.setItem('winners_history', JSON.stringify(savedWinners));
        
        if (window.FirebaseDB && typeof window.FirebaseDB.saveWinners === 'function') {
            await window.FirebaseDB.saveWinners(winners);
        }
        
        // Zerar o ranking automaticamente após salvar os ganhadores
        await clearRankingData();
        
        showMessage('Premiação confirmada! Ganhadores salvos e ranking zerado.', 'success');
        
    } catch (error) {
        console.error('Erro ao executar premiação:', error);
        showMessage('Erro ao confirmar premiação. Tente novamente.', 'error');
    }
}

// Função para resetar ranking (manual)
async function resetRanking() {
    if (!confirm('Tem certeza que deseja zerar todo o ranking? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        await clearRankingData();
        showMessage('Ranking zerado com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao resetar ranking:', error);
        showMessage('Erro ao zerar ranking. Tente novamente.', 'error');
    }
}

// Função para limpar atividades recentes
function clearRecentPoints() {
    if (!confirm('Tem certeza que deseja limpar as atividades recentes?')) {
        return;
    }
    
    // Limpar apenas visualmente (não afeta os dados)
    recentPointsList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-clock"></i>
            <h3>Atividades limpas</h3>
            <p>As atividades continuam sendo salvas no banco de dados</p>
        </div>
    `;
    
    showMessage('Feed de atividades limpo!', 'info');
    
    // Recarregar após 3 segundos
    setTimeout(() => {
        updateRecentActivities();
    }, 3000);
}

// Função para carregar dados locais (fallback)
function loadLocalData() {
    // Carregar clientes
    const savedClients = localStorage.getItem('dashboard-clients');
    if (savedClients) {
        clients = JSON.parse(savedClients);
    }
    
    // Carregar atividades de todos os clientes
    activities = [];
    clients.forEach(client => {
        const clientActivities = localStorage.getItem(`client_activities_${client.id}`);
        if (clientActivities) {
            const parsedActivities = JSON.parse(clientActivities);
            activities.push(...parsedActivities);
        }
    });
    
    // Ordenar por timestamp
    activities.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
    });
    
    // Atualizar interface
    updateRanking();
    updateRecentActivities();
    updateStats();
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
    
    setTimeout(() => {
        if (message.parentNode) {
            messageContainer.removeChild(message);
        }
    }, 4000);
}

// Auto-refresh a cada 30 segundos (apenas se não estiver usando Firebase real-time)
setInterval(() => {
    if (typeof window.FirebaseDB === 'undefined') {
        loadLocalData();
    }
}, 30000);

// Cleanup quando sair da página
window.addEventListener('beforeunload', function() {
    if (unsubscribeClients) {
        unsubscribeClients();
    }
    if (unsubscribeActivities) {
        unsubscribeActivities();
    }
});