// Game State
const state = {
    screen: 'menu', // menu, game, gameover
    level: 1,
    timeElapsed: 0,
    integrity: 100,
    threatLevel: 0,
    score: 0,
    xp: 0,
    threatsStopped: 0,
    systemsCompromised: 0,
    totalThreats: 0,
    responseTimeSum: 0,
    activeThreats: [],
    nodes: [],
    selectedNode: null,
    gameInterval: null,
    eventInterval: null,
    isPlaying: false
};

// Node Definitions (Positions as percentages 0-100)
const NODE_TEMPLATES = [
    { id: 'fw', name: 'Firewall', type: 'SECURITY', x: 50, y: 15, icon: '🛡️' },
    { id: 'web', name: 'Web Server', type: 'SERVER', x: 20, y: 30, icon: '🌐' },
    { id: 'api', name: 'API Server', type: 'SERVER', x: 80, y: 30, icon: '⚙️' },
    { id: 'auth', name: 'Auth Server', type: 'SYSTEM', x: 20, y: 60, icon: '🔑' },
    { id: 'admin', name: 'Admin PC', type: 'ENDPOINT', x: 80, y: 60, icon: '💻' },
    { id: 'db', name: 'Database', type: 'STORAGE', x: 35, y: 85, icon: '🗄️' },
    { id: 'backup', name: 'Backup Server', type: 'STORAGE', x: 65, y: 85, icon: '💾' },
    { id: 'cloud', name: 'Cloud Storage', type: 'EXTERNAL', x: 50, y: 50, icon: '☁️' }
];

// Connection Definitions (Lines between nodes)
const CONNECTIONS = [
    ['fw', 'web'], ['fw', 'api'], ['fw', 'cloud'],
    ['web', 'auth'], ['api', 'auth'], ['api', 'db'],
    ['auth', 'admin'], ['admin', 'backup'], ['db', 'backup'],
    ['cloud', 'web'], ['cloud', 'api'], ['cloud', 'db']
];

// Attack Types and their Counters
const ATTACK_TYPES = {
    'PORT_SCAN': { name: 'Port Scan', duration: 15, damage: 5, counter: 'ENABLE FIREWALL', color: 'yellow' },
    'BRUTE_FORCE': { name: 'Brute Force', duration: 12, damage: 15, counter: 'BLOCK IP', color: 'red' },
    'PHISHING': { name: 'Phishing', duration: 10, damage: 20, counter: 'KILL SESSION', color: 'red' },
    'MALWARE': { name: 'Malware Infection', duration: 18, damage: 25, counter: 'ISOLATE NODE', color: 'red' },
    'CREDENTIAL_THEFT': { name: 'Credential Theft', duration: 14, damage: 30, counter: 'RESET CREDENTIALS', color: 'red' },
    'PRIVILEGE_ESC': { name: 'Privilege Escalation', duration: 20, damage: 40, counter: 'PATCH SERVER', color: 'red' },
    'SQL_INJECTION': { name: 'SQL Injection', duration: 10, damage: 35, counter: 'PATCH SERVER', color: 'red' },
    'DDOS': { name: 'DDoS Attack', duration: 25, damage: 15, counter: 'ENABLE FIREWALL', color: 'yellow' },
    'DATA_EXFIL': { name: 'Data Exfiltration', duration: 15, damage: 50, counter: 'KILL SESSION', color: 'red' },
    'RANSOMWARE': { name: 'Ransomware', duration: 30, damage: 100, counter: 'RESTORE BACKUP', color: 'red' }
};

// Level configurations
const LEVEL_CONFIG = {
    1: { name: 'Reconnaissance', attacks: ['PORT_SCAN', 'BRUTE_FORCE'], spawnRate: 6000, maxActive: 2 },
    2: { name: 'Credential Attack', attacks: ['PORT_SCAN', 'BRUTE_FORCE', 'PHISHING', 'CREDENTIAL_THEFT'], spawnRate: 5000, maxActive: 3 },
    3: { name: 'Web Attack', attacks: ['BRUTE_FORCE', 'SQL_INJECTION', 'DDOS', 'PRIVILEGE_ESC'], spawnRate: 4000, maxActive: 4 },
    4: { name: 'Multi-stage Attack', attacks: ['PHISHING', 'MALWARE', 'CREDENTIAL_THEFT', 'PRIVILEGE_ESC', 'DDOS'], spawnRate: 3500, maxActive: 5 },
    5: { name: 'Zero-Day Scenario', attacks: Object.keys(ATTACK_TYPES), spawnRate: 2500, maxActive: 7 }
};

// All possible player actions
const ACTIONS = [
    'SCAN', 'BLOCK IP', 'ISOLATE NODE', 'KILL SESSION', 
    'PATCH SERVER', 'RESET CREDENTIALS', 'ENABLE FIREWALL', 'RESTORE BACKUP'
];

// DOM Elements
const screens = {
    menu: document.getElementById('menu-screen'),
    game: document.getElementById('game-screen'),
    gameover: document.getElementById('game-over-screen')
};

const nodesContainer = document.getElementById('nodes-container');
const svgLines = document.getElementById('network-lines');
const logContainer = document.getElementById('log-container');
const nodeInfoPanel = document.getElementById('selected-node-info');
const actionButtonsPanel = document.getElementById('action-buttons');

// UI Update elements
const uiIntegrityFill = document.getElementById('integrity-fill');
const uiIntegrityText = document.getElementById('integrity-text');
const uiThreatFill = document.getElementById('threat-fill');
const uiThreatText = document.getElementById('threat-text');
const uiScore = document.getElementById('score-text');
const uiTime = document.getElementById('time-text');

// Initialize Game
function init() {
    // Menu buttons
    document.querySelectorAll('.level-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const level = parseInt(e.target.dataset.level);
            startGame(level);
        });
    });

    document.getElementById('btn-retry').addEventListener('click', () => startGame(state.level));
    document.getElementById('btn-main-menu').addEventListener('click', showMenu);
}

function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenId].classList.add('active');
    state.screen = screenId;
}

function showMenu() {
    stopGame();
    showScreen('menu');
}

function startGame(level) {
    state.level = level;
    state.timeElapsed = 0;
    state.integrity = 100;
    state.threatLevel = 0;
    state.score = 0;
    state.threatsStopped = 0;
    state.systemsCompromised = 0;
    state.totalThreats = 0;
    state.responseTimeSum = 0;
    state.activeThreats = [];
    state.selectedNode = null;
    state.isPlaying = true;
    
    // Reset nodes
    state.nodes = NODE_TEMPLATES.map(n => ({
        ...n,
        status: 'ONLINE', // ONLINE, COMPROMISED, OFFLINE
        currentAttack: null
    }));

    buildNetworkUI();
    logContainer.innerHTML = '';
    log('system', `>> INITIATING SIMULATION: LEVEL ${level} - ${LEVEL_CONFIG[level].name}`);
    updateHUD();
    updateNodePanel();

    showScreen('game');

    // Game Loops
    state.gameInterval = setInterval(gameTick, 1000);
    state.eventInterval = setInterval(spawnThreat, LEVEL_CONFIG[level].spawnRate);
}

function stopGame() {
    state.isPlaying = false;
    clearInterval(state.gameInterval);
    clearInterval(state.eventInterval);
}

function gameOver(success) {
    stopGame();
    
    document.getElementById('end-title').innerText = success ? 'NETWORK SECURED' : 'MISSION FAILED';
    document.getElementById('end-title').setAttribute('data-text', success ? 'NETWORK SECURED' : 'MISSION FAILED');
    document.getElementById('end-title').style.color = success ? 'var(--neon-green)' : 'var(--neon-red)';
    document.getElementById('end-subtitle').innerText = success ? 'ALL THREATS NEUTRALIZED' : 'CRITICAL SYSTEMS COMPROMISED';
    
    document.getElementById('end-threats').innerText = state.threatsStopped;
    document.getElementById('end-systems').innerText = state.nodes.filter(n => n.status === 'ONLINE').length;
    
    let avgTime = state.threatsStopped > 0 ? (state.responseTimeSum / state.threatsStopped).toFixed(1) : 0;
    document.getElementById('end-response').innerText = `${avgTime}s`;
    
    let finalScore = state.score + (state.integrity * 100);
    document.getElementById('end-score').innerText = pad(finalScore, 6);
    
    let xpGained = state.threatsStopped * 50;
    document.getElementById('end-xp').innerText = `+${xpGained}`;
    
    let rating = 'F';
    if (state.integrity > 90) rating = 'S';
    else if (state.integrity > 75) rating = 'A';
    else if (state.integrity > 50) rating = 'B';
    else if (state.integrity > 25) rating = 'C';
    else if (state.integrity > 0) rating = 'D';
    
    document.getElementById('end-rating').innerText = rating;
    document.getElementById('end-rating').className = rating === 'F' ? 'text-red' : 'text-green';

    setTimeout(() => {
        showScreen('gameover');
    }, 1500);
}

// Game Logic
function gameTick() {
    if (!state.isPlaying) return;
    
    state.timeElapsed++;
    
    // Process active threats
    let currentDamage = 0;
    const now = Date.now();
    
    for (let i = state.activeThreats.length - 1; i >= 0; i--) {
        let threat = state.activeThreats[i];
        let elapsed = (now - threat.startTime) / 1000;
        
        let node = state.nodes.find(n => n.id === threat.target);
        
        if (elapsed >= threat.duration) {
            // Threat succeeded
            log('alert', `!! ${node.name} COMPROMISED BY ${ATTACK_TYPES[threat.type].name} !!`);
            state.integrity -= threat.damage;
            state.systemsCompromised++;
            
            node.status = 'COMPROMISED';
            node.currentAttack = null;
            updateNodeElement(node);
            
            state.activeThreats.splice(i, 1);
        } else {
            // Apply constant pressure/threat level calculation
            currentDamage += threat.damage;
        }
    }

    // Threat Level calculation
    let maxDamage = LEVEL_CONFIG[state.level].maxActive * 50;
    state.threatLevel = Math.min(100, Math.floor((currentDamage / maxDamage) * 100));
    
    updateHUD();

    // Win/Loss conditions
    if (state.integrity <= 0) {
        state.integrity = 0;
        updateHUD();
        gameOver(false);
    } else if (state.timeElapsed >= 120 && state.activeThreats.length === 0) {
        // Survive for 2 minutes to win
        gameOver(true);
    }
}

function spawnThreat() {
    if (!state.isPlaying) return;
    
    const config = LEVEL_CONFIG[state.level];
    if (state.activeThreats.length >= config.maxActive) return;
    
    // Win condition time limit (stop spawning after 120s)
    if (state.timeElapsed >= 120) return;

    // Pick random target that is ONLINE
    const validTargets = state.nodes.filter(n => n.status === 'ONLINE' && !n.currentAttack);
    if (validTargets.length === 0) return;
    
    const target = validTargets[Math.floor(Math.random() * validTargets.length)];
    
    // Pick random attack
    const attackType = config.attacks[Math.floor(Math.random() * config.attacks.length)];
    const attackDef = ATTACK_TYPES[attackType];

    const threat = {
        id: 'THT-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
        type: attackType,
        target: target.id,
        startTime: Date.now(),
        duration: attackDef.duration,
        damage: attackDef.damage
    };

    state.activeThreats.push(threat);
    state.totalThreats++;
    target.currentAttack = threat;

    log('warning', `!! WARNING: ${attackDef.name} detected targeting ${target.name}`);
    updateNodeElement(target);
    if (state.selectedNode && state.selectedNode.id === target.id) {
        updateNodePanel();
    }
}

function performAction(actionStr) {
    if (!state.selectedNode) return;
    const node = state.selectedNode;

    if (actionStr === 'SCAN') {
        log('system', `>> Scanning ${node.name}...`);
        if (node.currentAttack) {
            log('warning', `>> Threat identified: ${ATTACK_TYPES[node.currentAttack.type].name}`);
        } else {
            log('success', `>> ${node.name} is secure.`);
        }
        return;
    }

    if (node.status === 'COMPROMISED' && actionStr === 'RESTORE BACKUP') {
        log('success', `>> ${node.name} restored from backup. Operations normal.`);
        node.status = 'ONLINE';
        state.integrity = Math.min(100, state.integrity + 5); // Recover a bit
        updateNodeElement(node);
        updateNodePanel();
        updateHUD();
        return;
    }

    if (node.currentAttack) {
        const attackDef = ATTACK_TYPES[node.currentAttack.type];
        if (actionStr === attackDef.counter) {
            // Correct counter
            let responseTime = (Date.now() - node.currentAttack.startTime) / 1000;
            state.responseTimeSum += responseTime;
            state.threatsStopped++;
            state.score += 500 + Math.floor((attackDef.duration - responseTime) * 10);
            
            log('success', `>> SUCCESS: ${actionStr} executed. ${attackDef.name} stopped on ${node.name}.`);
            
            // Remove threat
            state.activeThreats = state.activeThreats.filter(t => t.id !== node.currentAttack.id);
            node.currentAttack = null;
            
            updateNodeElement(node);
            updateNodePanel();
            updateHUD();
        } else {
            // Wrong action
            log('alert', `>> FAILED: ${actionStr} ineffective against current threat on ${node.name}.`);
            state.score = Math.max(0, state.score - 100);
            updateHUD();
        }
    } else {
        log('system', `>> Action ${actionStr} performed on ${node.name}. No immediate effect.`);
    }
}

// UI Rendering
function buildNetworkUI() {
    nodesContainer.innerHTML = '';
    svgLines.innerHTML = '';

    // Draw Lines
    CONNECTIONS.forEach(conn => {
        let n1 = state.nodes.find(n => n.id === conn[0]);
        let n2 = state.nodes.find(n => n.id === conn[1]);
        if(n1 && n2) {
            let line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', `${n1.x}%`);
            line.setAttribute('y1', `${n1.y}%`);
            line.setAttribute('x2', `${n2.x}%`);
            line.setAttribute('y2', `${n2.y}%`);
            line.setAttribute('class', 'conn-line');
            line.id = `conn-${n1.id}-${n2.id}`;
            svgLines.appendChild(line);
        }
    });

    // Draw Nodes
    state.nodes.forEach(node => {
        let el = document.createElement('div');
        el.className = 'node';
        el.id = `node-${node.id}`;
        el.style.left = `${node.x}%`;
        el.style.top = `${node.y}%`;
        
        el.innerHTML = `
            <div class="node-icon">${node.icon}</div>
            <div class="node-label">${node.name}</div>
        `;

        el.addEventListener('click', () => selectNode(node.id));
        nodesContainer.appendChild(el);
    });
}

function updateNodeElement(node) {
    const el = document.getElementById(`node-${node.id}`);
    if (!el) return;

    el.className = 'node';
    if (state.selectedNode && state.selectedNode.id === node.id) el.classList.add('selected');
    
    // Remove old indicator
    const oldInd = el.querySelector('.attack-indicator');
    if (oldInd) oldInd.remove();

    if (node.status === 'COMPROMISED') {
        el.classList.add('compromised');
    } else if (node.status === 'OFFLINE') {
        el.classList.add('offline');
    } else if (node.currentAttack) {
        el.classList.add('warning');
        // Add indicator
        let ind = document.createElement('div');
        ind.className = 'attack-indicator';
        ind.innerText = '!';
        el.appendChild(ind);
    }
}

function selectNode(id) {
    if (state.selectedNode) {
        const prev = state.selectedNode;
        state.selectedNode = null;
        updateNodeElement(prev);
    }
    state.selectedNode = state.nodes.find(n => n.id === id);
    updateNodeElement(state.selectedNode);
    updateNodePanel();
}

function updateNodePanel() {
    if (!state.selectedNode) {
        nodeInfoPanel.innerHTML = '<p class="placeholder-text">Select a node on the network map to view details and available countermeasures.</p>';
        actionButtonsPanel.classList.add('hidden');
        actionButtonsPanel.innerHTML = '';
        return;
    }

    const node = state.selectedNode;
    
    // Update Info
    let statusColor = node.status === 'ONLINE' ? 'var(--neon-green)' : (node.status === 'COMPROMISED' ? 'var(--neon-red)' : '#555');
    
    let html = `
        <div class="node-meta">
            <span class="label">ID:</span> ${node.id.toUpperCase()}<br>
            <span class="label">NAME:</span> ${node.name}<br>
            <span class="label">TYPE:</span> ${node.type}<br>
            <span class="label">STATUS:</span> <span style="color:${statusColor}">${node.status}</span><br>
        </div>
    `;

    if (node.currentAttack) {
        let att = ATTACK_TYPES[node.currentAttack.type];
        html += `
            <div style="border:1px solid var(--neon-red); padding:10px; margin-bottom:15px; background:rgba(255,0,0,0.1);">
                <strong style="color:var(--neon-red)">CRITICAL ALERT</strong><br>
                Type: ${att.name}<br>
                Severity: HIGH
            </div>
        `;
    }

    nodeInfoPanel.innerHTML = html;

    // Update Actions
    actionButtonsPanel.classList.remove('hidden');
    actionButtonsPanel.innerHTML = '';

    ACTIONS.forEach(action => {
        let btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.innerText = `> ${action}`;
        
        // Logic for disabled buttons
        if (node.status === 'COMPROMISED' && action !== 'RESTORE BACKUP') {
            btn.classList.add('disabled');
        } else if (node.status !== 'COMPROMISED' && action === 'RESTORE BACKUP') {
            btn.classList.add('disabled');
        } else {
            btn.addEventListener('click', () => performAction(action));
        }
        
        actionButtonsPanel.appendChild(btn);
    });
}

function updateHUD() {
    // Time formatting
    let m = Math.floor(state.timeElapsed / 60).toString().padStart(2, '0');
    let s = (state.timeElapsed % 60).toString().padStart(2, '0');
    uiTime.innerText = `${m}:${s}`;
    if(state.timeElapsed > 120) uiTime.innerText = '02:00'; // Cap display

    // Score
    uiScore.innerText = pad(state.score, 6);

    // Integrity
    uiIntegrityFill.style.width = `${state.integrity}%`;
    uiIntegrityText.innerText = `${Math.floor(state.integrity)}%`;
    uiIntegrityFill.className = 'fill';
    if (state.integrity > 66) uiIntegrityFill.classList.add('integrity-high');
    else if (state.integrity > 33) uiIntegrityFill.classList.add('integrity-med');
    else uiIntegrityFill.classList.add('integrity-low');

    // Threat
    uiThreatFill.style.width = `${state.threatLevel}%`;
    uiThreatFill.className = 'fill';
    if (state.threatLevel < 33) {
        uiThreatFill.classList.add('threat-low');
        uiThreatText.innerText = 'LOW';
    } else if (state.threatLevel < 66) {
        uiThreatFill.classList.add('threat-med');
        uiThreatText.innerText = 'MED';
    } else {
        uiThreatFill.classList.add('threat-high');
        uiThreatText.innerText = 'HIGH';
    }
}

function log(type, message) {
    let entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    let time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
    entry.innerText = `[${time}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function pad(num, size) {
    let s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}

// Start
window.onload = init;
