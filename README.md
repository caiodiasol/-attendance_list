# 🏆 ClientKey - Sistema de Ranking para Lives

Uma aplicação web moderna para gerenciar participantes de lives e criar rankings em tempo real baseado em palavras-chave digitadas durante transmissões ao vivo.

## ✨ Funcionalidades Principais

### 🎯 Sistema Completo de Lives Interativas
- **👤 Cadastro de Clientes**: Registro completo com nome, WhatsApp e email
- **🎮 Participação por Email**: Identificação única por email com cache automático
- **🔤 Sistema de Palavras-Chave**: Geração de 4 opções (1 correta + 3 incorretas)
- **🏆 Ranking em Tempo Real**: Classificação dinâmica com podium e estatísticas
- **👑 Sistema de Premiação**: Histórico de ganhadores com reset automático
- **📊 Dashboard Administrativo**: Painel completo de controle
- **📱 Design Responsivo**: Interface moderna para todos os dispositivos

### 🔐 Recursos Avançados
- **Anti-Duplicação**: Sistema que impede múltiplas tentativas na mesma palavra
- **Cache Inteligente**: Posicionamento estático das palavras para cada usuário
- **Backup Automático**: Firebase + localStorage para máxima confiabilidade
- **Privacidade**: Emails ocultos no ranking público

## 🛠️ Tecnologias Utilizadas

### Frontend Moderno
- **HTML5** - Estrutura semântica das páginas
- **CSS3 Avançado** - Variables, Grid, Flexbox, Animações
- **Vanilla JavaScript** - ES6+, Async/Await, Modular
- **Font Awesome 6** - Ícones atualizados
- **Google Fonts** - Tipografias (Poppins, Inter)

### Integração Backend
- **Firebase Firestore** - Banco de dados em tempo real
- **Firebase Realtime** - Listeners para atualizações instantâneas
- **LocalStorage** - Fallback para funcionamento offline

### Features Técnicas
- **CSS Custom Properties** - Sistema de temas dinâmico
- **Responsive Design** - Mobile-first approach
- **Error Handling** - Tratamento robusto de erros
- **Performance** - Lazy loading e otimizações

## 🚀 Estrutura da Aplicação

```
ClientKey/
├── README.md                    # Documentação
├── firebase-config.js           # Configuração Firebase
├── index.html                   # Dashboard Administrador
├── assets/
│   ├── css/
│   │   ├── dashboard.css        # Estilos do admin
│   │   ├── participar.css       # Estilos da participação
│   │   └── ranking.css          # Estilos do ranking + ganhadores
│   └── js/
│       ├── cadastro-clientes.js # Lógica de cadastro
│       ├── dashboard.js         # Lógica do admin (palavras-chave)
│       ├── participar.js        # Lógica de participação
│       ├── ranking.js           # Lógica do ranking
└── pages/
    ├── cadastro-clientes.html   # Página de cadastro
    ├── participar.html          # Interface de participação
    ├── ranking.html             # Ranking de presença
```

## 🎯 Fluxo de Funcionamento

### 1. 📝 Cadastro (pages/cadastro-clientes.html)
- Formulário completo: Nome, WhatsApp (máscara), Email
- Validação em tempo real dos campos
- Integração com Firebase + fallback localStorage
- Interface simplificada focada apenas no cadastro

### 2. 🎮 Geração de Palavras (index.html - Dashboard Admin)
- Banco com 60+ palavras motivacionais
- Geração automática: 1 correta + 3 incorretas aleatórias
- Sistema de IDs únicos para cada palavra-chave
- Preview de como aparece para os clientes

### 3. 🔴 Participação (pages/participar.html)
- **Identificação**: Apenas por email (dados sensíveis protegidos)
- **Cache de Email**: Auto-preenchimento com botão limpar
- **Sistema de Palavras**: 4 opções em posições fixas por usuário
- **Pontuação Fixa**: Exatamente 1 ponto por acerto
- **Anti-Fraude**: Impossível tentar a mesma palavra duas vezes
- **Feedback Visual**: Animações para acerto/erro

### 4. 🏆 Ranking (pages/ranking.html)
- **Visualização Única**: Todo o período (sem filtros de data)
- **Podium Interativo**: Top 3 com destaque especial
- **Lista Completa**: Todos os participantes ordenados
- **Privacidade**: Emails ocultos, apenas nomes
- **Atividade Recente**: Feed das últimas participações

### 5. 👑 Sistema de Premiação
- **Confirmar Premiação**: Salva Top 10 como ganhadores
- **Reset Automático**: Ranking zerado após confirmação
- **Histórico Completo**: Página dedicada aos ganhadores
- **Redirecionamento**: Fluxo automatizado

## 🎮 Sistema de Pontuação Atual

### Pontuação Simplificada
- **1 ponto fixo** por palavra-chave correta
- **0 pontos** para palavras incorretas
- **Sem limite** de participações (diferentes palavras-chave)
- **Uma tentativa** por palavra-chave gerada

### Recursos do Ranking
- **Tempo Real**: Atualizações instantâneas via Firebase
- **Posições Dinâmicas**: 1º, 2º, 3º com cores especiais
- **Últimas Atividades**: Feed cronológico
- **Estatísticas**: Participantes ativos e pontos do dia

## 🎨 Design System

### Tema Administrativo (Dashboard)
- **Paleta**: Gradientes azul/roxo, cards claros
- **Estilo**: Clean, profissional, dashboards modernos
- **Interações**: Hover effects, animações sutis

### Tema dos Usuários (Participação/Ranking)
- **Paleta**: Dark mode, slate/blue, acentos dourados
- **Estilo**: Gaming-inspired, foco na experiência
- **Elementos**: Glass morphism, neon effects, podium 3D

### Componentes Reutilizáveis
- **Botões**: Estados hover, loading, disabled
- **Cards**: Sombras, bordas, backgrounds dinâmicos  
- **Mensagens**: Success, error, warning, info
- **Formulários**: Validação visual, máscaras de input

## 📱 Responsividade Completa

- **Desktop (1200px+)**: Layout completo, grids expansivos
- **Tablet (768px-1199px)**: Adaptação de colunas, spacing ajustado
- **Mobile (320px-767px)**: Stacking vertical, touch-optimized

## 🔧 Configurações Personalizáveis

### Cores e Temas
```css
:root {
    --primary-color: #2563eb;
    --secondary-color: #10b981;
    --warning-color: #f59e0b;
    --danger-color: #ef4444;
    --dark-bg: #0f172a;
    --card-bg: #1e293b;
    --surface-bg: #334155;
}
```

### Banco de Palavras
Edite em `dashboard.js`:
```javascript
const WORD_BANK = [
    'SUCESSO', 'VITÓRIA', 'ENERGIA', 'FOCO',
    'PODER', 'FORÇA', 'ALEGRIA', 'PAZ'
    // Adicione suas palavras aqui
];
```

### Sistema de Pontos
Modifique em `participar.js`:
```javascript
const points = 1; // Altere para o valor desejado
```

## 🚀 Como Usar

### Configuração Inicial
1. **Configure o Firebase** no arquivo `firebase-config.js`
2. **Abra `index.html`** no navegador ou servidor web
3. **Cadastre clientes** na página de cadastro
4. **Gere palavras-chave** no dashboard admin
5. **Compartilhe a URL** da página de participação

### Fluxo da Live
1. **Admin**: Gera palavra-chave no dashboard
2. **Streamer**: Menciona a palavra na live
3. **Viewers**: Clicam na palavra correta
4. **Sistema**: Atualiza ranking em tempo real
5. **Admin**: Confirma premiação quando quiser

### Gestão de Ganhadores
1. **Botão "Confirmar Premiação"**: Salva Top 10
2. **Ranking Zerado**: Automaticamente limpo
3. **Página de Ganhadores**: Histórico completo
4. **Novo Ciclo**: Pronto para próxima live

## 📊 Recursos de Analytics

- **Participantes Ativos**: Contador em tempo real
- **Pontos do Dia**: Estatística diária
- **Últimas Atividades**: Feed cronológico
- **Histórico de Premiações**: Dados históricos completos

## 📄 Licença & Créditos

**ClientKey** - Sistema desenvolvido para maximizar o engajamento em lives e streams.

- ✅ Uso comercial permitido
- ✅ Modificações permitidas  
- ✅ Distribuição permitida
- ✅ Código aberto

---

**🚀 Transforme suas lives em experiências interativas inesquecíveis!**

*Desenvolvido com foco em performance, UX e engajamento máximo.*