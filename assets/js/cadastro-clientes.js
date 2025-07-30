// Array para armazenar os clientes
let clients = [];
let unsubscribeClients = null;

// Elementos do DOM
const clientForm = document.getElementById('clientForm');
const clientNameInput = document.getElementById('clientName');
const clientWhatsappInput = document.getElementById('clientWhatsapp');
const clientEmailInput = document.getElementById('clientEmail');
const messageContainer = document.getElementById('messageContainer');
const firebaseStatus = document.getElementById('firebaseStatus');

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeFirebase();
    setupPhoneMask();
});

clientForm.addEventListener('submit', function(e) {
    e.preventDefault();
    addClient();
});

// Validação em tempo real
clientNameInput.addEventListener('blur', validateName);
clientWhatsappInput.addEventListener('blur', validateWhatsapp);
clientEmailInput.addEventListener('blur', validateEmail);
clientNameInput.addEventListener('input', clearError);
clientWhatsappInput.addEventListener('input', clearError);
clientEmailInput.addEventListener('input', clearError);

// Função para configurar máscara do telefone
function setupPhoneMask() {
    clientWhatsappInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        let formattedValue = value;

        if (value.length >= 2) {
            formattedValue = `(${value.substring(0, 2)}) `;
            if (value.length >= 7) {
                formattedValue += `${value.substring(2, 7)}-${value.substring(7, 11)}`;
            } else if (value.length > 2) {
                formattedValue += value.substring(2);
            }
        }

        e.target.value = formattedValue;
    });
}

// Função para inicializar Firebase
async function initializeFirebase() {
    try {
        // Aguardar o Firebase estar disponível
        if (typeof window.FirebaseDB === 'undefined') {
            setTimeout(initializeFirebase, 100);
            return;
        }
        
        // Não precisamos carregar dados iniciais nesta página
        
        // Não precisamos de listener em tempo real nesta página
        
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

// Função removida - não necessária nesta página

// Função para adicionar cliente
async function addClient() {
    const name = clientNameInput.value.trim();
    const whatsapp = clientWhatsappInput.value.trim();
    const email = clientEmailInput.value.trim();
    
    // Validações
    if (!validateName() || !validateWhatsapp() || !validateEmail()) {
        showMessage('Por favor, corrija os erros no formulário', 'error');
        return;
    }
    
    // Verificar duplicatas será feito pelo Firebase/backend
    
    try {
        const submitButton = clientForm.querySelector('button[type="submit"]');
        setButtonLoadingByElement(submitButton, true);
        
        // Criar novo cliente
        const newClientData = {
            name: name,
            whatsapp: whatsapp,
            email: email,
            status: 'active'
        };
        
        // Adicionar ao Firestore
        const newClient = await window.FirebaseDB.addClient(newClientData);
        
        // Limpar formulário
        clearForm();
        showMessage(`Cadastro realizado com sucesso, ${name}! Agora você pode participar da live.`, 'success');
        
    } catch (error) {
        console.error('Erro ao adicionar cliente:', error);
        showMessage('Erro ao realizar cadastro. Tente novamente.', 'error');
        
        // Fallback para localStorage
        const newClient = {
            id: generateId(),
            name: name,
            whatsapp: whatsapp,
            email: email,
            createdAt: new Date().toISOString(),
            status: 'active'
        };
        
        clearForm();
        showMessage(`Cadastro realizado localmente, ${name}! Agora você pode participar da live.`, 'info');
    } finally {
        const submitButton = clientForm.querySelector('button[type="submit"]');
        setButtonLoadingByElement(submitButton, false);
    }
}

// Função para validar nome
function validateName() {
    const name = clientNameInput.value.trim();
    
    if (name === '') {
        setFieldError('clientName', 'Nome é obrigatório');
        return false;
    }
    
    if (name.length < 2) {
        setFieldError('clientName', 'Nome deve ter pelo menos 2 caracteres');
        return false;
    }
    
    if (name.length > 100) {
        setFieldError('clientName', 'Nome não pode ter mais de 100 caracteres');
        return false;
    }
    
    if (!/^[A-Za-zÀ-ÿ\s]+$/.test(name)) {
        setFieldError('clientName', 'Nome deve conter apenas letras e espaços');
        return false;
    }
    
    clearFieldError('clientName');
    return true;
}

// Função para validar WhatsApp
function validateWhatsapp() {
    const whatsapp = clientWhatsappInput.value.trim();
    const whatsappNumbers = whatsapp.replace(/\D/g, '');
    
    if (whatsapp === '') {
        setFieldError('clientWhatsapp', 'WhatsApp é obrigatório');
        return false;
    }
    
    if (whatsappNumbers.length !== 11) {
        setFieldError('clientWhatsapp', 'WhatsApp deve ter 11 dígitos no formato (11) 99999-9999');
        return false;
    }
    
    if (!whatsappNumbers.startsWith('11') && !whatsappNumbers.match(/^[1-9][1-9]/)) {
        setFieldError('clientWhatsapp', 'Código de área inválido');
        return false;
    }
    
    if (!whatsappNumbers.substring(2).startsWith('9')) {
        setFieldError('clientWhatsapp', 'Número de celular deve começar com 9');
        return false;
    }
    
    clearFieldError('clientWhatsapp');
    return true;
}

// Função para validar email
function validateEmail() {
    const email = clientEmailInput.value.trim();
    
    if (email === '') {
        setFieldError('clientEmail', 'E-mail é obrigatório');
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        setFieldError('clientEmail', 'E-mail deve ter um formato válido');
        return false;
    }
    
    if (email.length > 254) {
        setFieldError('clientEmail', 'E-mail não pode ter mais de 254 caracteres');
        return false;
    }
    
    clearFieldError('clientEmail');
    return true;
}

// Função para definir erro no campo
function setFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId.replace('client', '').toLowerCase() + 'Error');
    
    field.classList.add('error');
    errorElement.textContent = message;
}

// Função para limpar erro do campo
function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId.replace('client', '').toLowerCase() + 'Error');
    
    field.classList.remove('error');
    errorElement.textContent = '';
}

// Função para limpar erro durante digitação
function clearError(e) {
    const fieldId = e.target.id;
    clearFieldError(fieldId);
}

// Função para limpar formulário
function clearForm() {
    clientForm.reset();
    clearFieldError('clientName');
    clearFieldError('clientWhatsapp');
    clearFieldError('clientEmail');
    clientNameInput.focus();
}

// Funções de listagem e gerenciamento removidas - não necessárias nesta página

// Funções auxiliares removidas - não necessárias nesta página

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

// Cleanup removido - não necessário nesta página

// Atalhos de teclado
document.addEventListener('keydown', function(e) {
    // Ctrl + N para novo cliente
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        clientNameInput.focus();
    }
});

// Adicionar estilos para animação de slideOut
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