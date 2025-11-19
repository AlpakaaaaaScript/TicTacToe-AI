import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- BACKGROUND ANIMATION (Smart Snake) ---
class BackgroundSnake {
    constructor() {
        this.canvas = document.getElementById('bg-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 30;
        this.cols = 0;
        this.rows = 0;
        
        this.snake = [];
        this.path = [];
        this.apple = null;
        this.target = null; // Can be apple or wander point
        
        this.tickSpeed = 60;
        this.lastTick = 0;
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        window.addEventListener('mousedown', (e) => {
            if(e.target.id === 'bg-canvas') {
                const gridX = Math.round(e.clientX / this.gridSize);
                const gridY = Math.round(e.clientY / this.gridSize);
                this.spawnApple(gridX, gridY);
            }
        });

        // Initial Snake
        this.initSnake();
        requestAnimationFrame((t) => this.loop(t));
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.cols = Math.floor(this.canvas.width / this.gridSize);
        this.rows = Math.floor(this.canvas.height / this.gridSize);
    }

    initSnake() {
        // Safe spawn
        const safeCols = Math.max(5, this.cols);
        const safeRows = Math.max(5, this.rows);
        const startX = Math.floor(safeCols / 2);
        const startY = Math.floor(safeRows / 2);
        this.snake = [{x: startX, y: startY}, {x: startX-1, y: startY}, {x: startX-2, y: startY}];
    }

    spawnApple(x, y) {
        // Ensure apple is within bounds
        x = Math.max(0, Math.min(x, this.cols - 1));
        y = Math.max(0, Math.min(y, this.rows - 1));
        
        this.apple = {x, y};
        // Apple overrides wandering
        this.calculatePath(this.apple);
    }

    pickWanderTarget() {
        const tx = Math.floor(Math.random() * (this.cols - 1));
        const ty = Math.floor(Math.random() * (this.rows - 1));
        return {x: tx, y: ty};
    }

    calculatePath(target) {
        if (!target || this.snake.length === 0) return;
        
        const head = this.snake[0];
        
        // BFS for Shortest Path
        let queue = [{x: head.x, y: head.y, parent: null}];
        let visited = new Set();
        visited.add(`${head.x},${head.y}`);
        
        let endNode = null;
        let headPtr = 0; // Queue pointer optimization
        
        // Limit BFS depth for performance if grid is huge
        const maxSteps = 2000; 
        let steps = 0;

        while(headPtr < queue.length && steps < maxSteps) {
            let current = queue[headPtr++];
            steps++;
            
            if (current.x === target.x && current.y === target.y) {
                endNode = current;
                break;
            }

            // Neighbors (Up, Down, Left, Right)
            const neighbors = [
                {x: current.x+1, y: current.y},
                {x: current.x-1, y: current.y},
                {x: current.x, y: current.y+1},
                {x: current.x, y: current.y-1}
            ];

            for (let n of neighbors) {
                if (n.x >= 0 && n.x < this.cols && n.y >= 0 && n.y < this.rows) {
                    const key = `${n.x},${n.y}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        queue.push({x: n.x, y: n.y, parent: current});
                    }
                }
            }
        }

        // Reconstruct Path
        this.path = [];
        while(endNode && endNode.parent) {
            this.path.unshift({x: endNode.x, y: endNode.y});
            endNode = endNode.parent;
        }
    }

    move() {
        // If path empty, logic based on state
        if (this.path.length === 0) {
            if (this.apple) {
                // Should have a path to apple, if stuck, recalc
                this.calculatePath(this.apple);
            } else {
                // WANDER: Pick new random target
                const wanderPt = this.pickWanderTarget();
                this.calculatePath(wanderPt);
            }
        }

        if (this.path.length > 0) {
            const next = this.path.shift();
            this.snake.unshift(next);
            
            // Check collisions
            if (this.apple && next.x === this.apple.x && next.y === this.apple.y) {
                this.apple = null; // Eat
                // Grow (don't pop)
            } else {
                this.snake.pop(); // Move
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Grid Dots
        this.ctx.fillStyle = '#cbd5e1';
        for(let x = 0; x < this.cols; x++) {
            for(let y = 0; y < this.rows; y++) {
                this.ctx.beginPath();
                this.ctx.arc(x * this.gridSize, y * this.gridSize, 2, 0, Math.PI*2);
                this.ctx.fill();
            }
        }

        // Snake Path Preview (Subtle)
        if(this.path.length > 0) {
            this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.1)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(this.snake[0].x * this.gridSize, this.snake[0].y * this.gridSize);
            for(let p of this.path) this.ctx.lineTo(p.x * this.gridSize, p.y * this.gridSize);
            this.ctx.stroke();
        }

        // Snake Body
        if (this.snake.length > 0) {
            this.ctx.beginPath();
            this.ctx.lineWidth = 6;
            this.ctx.strokeStyle = '#4f46e5'; // Bright Indigo
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = '#818cf8';
            
            this.ctx.moveTo(this.snake[0].x * this.gridSize, this.snake[0].y * this.gridSize);
            for (let i = 1; i < this.snake.length; i++) {
                this.ctx.lineTo(this.snake[i].x * this.gridSize, this.snake[i].y * this.gridSize);
            }
            this.ctx.stroke();

            // Head
            this.ctx.beginPath();
            this.ctx.fillStyle = '#312e81'; // Darker Head
            this.ctx.arc(this.snake[0].x * this.gridSize, this.snake[0].y * this.gridSize, 6, 0, Math.PI*2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }

        // Apple
        if (this.apple) {
            this.ctx.fillStyle = '#ef4444';
            this.ctx.beginPath();
            this.ctx.arc(this.apple.x * this.gridSize, this.apple.y * this.gridSize, 7, 0, Math.PI*2);
            this.ctx.fill();
            
            // Pulse
            this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(this.apple.x * this.gridSize, this.apple.y * this.gridSize, 12 + Math.sin(Date.now()/150)*3, 0, Math.PI*2);
            this.ctx.stroke();
        }
    }

    loop(timestamp) {
        if (timestamp - this.lastTick > this.tickSpeed) {
            this.move();
            this.lastTick = timestamp;
        }
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}


// --- APP LOGIC ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let db, auth, userId;
let gameState = { board: Array(9).fill(null), currentPlayer: 'X', isActive: false, mode: 'standard', playerMark: 'X', mpId: null };
let mpUnsubscribe = null;

async function initApp() {
    // Init Snake
    new BackgroundSnake();
    
    if (firebaseConfig) {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        onAuthStateChanged(auth, (user) => {
            if (user) userId = user.uid;
            else if (initialAuthToken) signInWithCustomToken(auth, initialAuthToken);
            else signInAnonymously(auth);
        });
    }
    window.nav('menu');
}

window.nav = (screen) => {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${screen}`).classList.add('active');
};

window.copyCode = () => {
    const codeText = document.getElementById('lobby-code').innerText.replace(/\s/g, '');
    if (!navigator.clipboard) { fallbackCopy(codeText); return; }
    navigator.clipboard.writeText(codeText)
        .then(() => alert("Code Copied: " + codeText))
        .catch(err => { console.warn(err); fallbackCopy(codeText); });
};

function fallbackCopy(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus(); textArea.select();
    try { document.execCommand('copy'); alert("Code Copied: " + text); } 
    catch (err) { alert("Manual copy required: " + text); }
    document.body.removeChild(textArea);
}

// --- AI Logic ---
const WIN_PATTERNS = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]];
function checkWin(board) {
    for (let [a,b,c] of WIN_PATTERNS) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return board.includes(null) ? null : 'Draw';
}
function minimax(board, depth, isMax, aiMark) {
    const result = checkWin(board);
    const opponent = aiMark === 'X' ? 'O' : 'X';
    if (result === aiMark) return 10 - depth;
    if (result === opponent) return depth - 10;
    if (result === 'Draw') return 0;
    if (isMax) {
        let best = -Infinity;
        for (let i=0; i<9; i++) {
            if (board[i] === null) {
                board[i] = aiMark; best = Math.max(best, minimax(board, depth+1, false, aiMark)); board[i] = null;
            }
        }
        return best;
    } else {
        let best = Infinity;
        for (let i=0; i<9; i++) {
            if (board[i] === null) {
                board[i] = opponent; best = Math.min(best, minimax(board, depth+1, true, aiMark)); board[i] = null;
            }
        }
        return best;
    }
}
function getBestMoves(board, player) {
    let available = []; for(let i=0; i<9; i++) if(board[i] === null) available.push(i);
    let bestScore = -Infinity; let moves = [];
    available.forEach(i => {
        board[i] = player; let score = minimax(board, 0, false, player); board[i] = null;
        if (score > bestScore) { bestScore = score; moves = [i]; }
        else if (score === bestScore) { moves.push(i); }
    });
    return { moves, score: bestScore };
}

// --- Game Controller ---
window.startLocalGame = (mode) => {
    gameState.mode = mode; gameState.isActive = true; gameState.board = Array(9).fill(null); gameState.winner = null;
    if (mode === 'standard') {
        gameState.playerMark = 'X'; const starter = Math.random() < 0.5 ? 'X' : 'O'; gameState.currentPlayer = starter;
        renderBoard(); updateStatus(starter === 'X' ? "Your Turn (X)" : "AI's Turn (O)"); window.nav('game');
        if (starter === 'O') setTimeout(aiMove, 800);
    } else if (mode === 'learning') {
        const pMark = document.getElementById('learn-player').value; const starter = document.getElementById('learn-starter').value;
        gameState.playerMark = pMark; gameState.currentPlayer = starter;
        renderBoard(); updateStatus(starter === pMark ? "Make your move" : "Coach is watching..."); window.nav('game');
        if (starter !== pMark) setTimeout(aiMove, 800);
    }
};

window.handleCellClick = (index) => {
    if (!gameState.isActive || gameState.board[index] !== null) return;
    // Fix: AI turn guard for standard mode
    if (gameState.mode === 'standard' && gameState.currentPlayer !== gameState.playerMark) return;

    if (gameState.mode === 'multiplayer') { if (gameState.currentPlayer !== gameState.playerMark) return; mpSendMove(index); return; }
    
    if (gameState.mode === 'learning') {
        const { moves } = getBestMoves([...gameState.board], gameState.playerMark);
        if (!moves.includes(index)) { highlightMistake(index, moves[0]); return; }
        updateStatus("Good move!", "success");
    }
    commitMove(index, gameState.playerMark);
};

function commitMove(index, player) {
    if (gameState.board[index] !== null) return;
    gameState.board[index] = player;
    const res = checkWin(gameState.board); if (res) { endGame(res); return; }
    gameState.currentPlayer = player === 'X' ? 'O' : 'X'; renderBoard();
    if (gameState.mode !== 'multiplayer' && gameState.currentPlayer !== gameState.playerMark) {
        updateStatus("AI is thinking..."); setTimeout(aiMove, 800);
    } else if (gameState.mode !== 'multiplayer') { updateStatus("Your Turn"); }
}

function aiMove() {
    if (!gameState.isActive) return;
    if(gameState.currentPlayer === gameState.playerMark) return;
    const aiMark = gameState.currentPlayer;
    const { moves } = getBestMoves([...gameState.board], aiMark);
    if (moves.length > 0) { const pick = moves[Math.floor(Math.random() * moves.length)]; commitMove(pick, aiMark); }
}

function highlightMistake(wrongIdx, correctIdx) {
    gameState.isActive = false; const cells = document.querySelectorAll('.cell');
    cells[wrongIdx].classList.add('highlight-mistake'); cells[wrongIdx].innerHTML = getIconHtml(gameState.playerMark);
    cells[correctIdx].classList.add('highlight-best');
    updateStatus("Suboptimal! Coach Correcting...", "error");
    setTimeout(() => { gameState.isActive = true; commitMove(correctIdx, gameState.playerMark); }, 1500);
}

function endGame(result) {
    gameState.isActive = false; gameState.winner = result; renderBoard();
    let msg = result === 'Draw' ? "It's a Draw!" : `${result} Wins!`;
    updateStatus(msg, result === gameState.playerMark ? 'success' : 'neutral');
}

// --- Multiplayer ---
const generateGameId = () => Math.floor(100000 + Math.random() * 900000).toString();
window.createMpGame = async () => {
    if (!db) return alert("Database not ready");
    const btn = document.getElementById('btn-create'); btn.innerHTML = '<div class="loader"></div>';
    const code = generateGameId();
    try {
        await setDoc(doc(db, `artifacts/${appId}/public/data/games`, code), {
            board: JSON.stringify(Array(9).fill(null)),
            playerX: userId, playerO: null, currentPlayer: 'X', winner: null, createdAt: new Date().toISOString()
        });
        gameState.mpId = code; gameState.playerMark = 'X'; enterLobby(code);
    } catch(e) { console.error(e); alert("Error creating game."); }
    btn.innerHTML = 'Create New Game';
};

window.joinMpGame = async () => {
    const code = document.getElementById('join-code').value.trim();
    if (code.length !== 6) return alert("Enter 6 digit code");
    const ref = doc(db, `artifacts/${appId}/public/data/games`, code);
    const snap = await getDoc(ref);
    if (snap.exists()) {
        await setDoc(ref, { playerO: userId }, { merge: true });
        gameState.mpId = code; gameState.playerMark = 'O'; startMpListener(code);
    } else alert("Game not found");
};

function enterLobby(code) {
    window.nav('lobby'); document.getElementById('lobby-code').innerText = `${code.slice(0,3)} ${code.slice(3)}`;
    document.getElementById('qr-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${code}`;
    onSnapshot(doc(db, `artifacts/${appId}/public/data/games`, code), (snap) => { if (snap.data().playerO) startMpListener(code); });
}

function startMpListener(code) {
    gameState.mode = 'multiplayer'; gameState.isActive = true; window.nav('game');
    if (mpUnsubscribe) mpUnsubscribe();
    mpUnsubscribe = onSnapshot(doc(db, `artifacts/${appId}/public/data/games`, code), (snap) => {
        const data = snap.data(); gameState.board = JSON.parse(data.board); gameState.currentPlayer = data.currentPlayer;
        if (data.winner) endGame(data.winner);
        else {
            const isMyTurn = gameState.currentPlayer === gameState.playerMark;
            updateStatus(isMyTurn ? "Your Turn" : "Opponent's Turn", isMyTurn ? 'success' : 'neutral');
        }
        renderBoard();
    });
}

async function mpSendMove(index) {
    const newBoard = [...gameState.board]; newBoard[index] = gameState.playerMark;
    const next = gameState.playerMark === 'X' ? 'O' : 'X'; const win = checkWin(newBoard);
    await setDoc(doc(db, `artifacts/${appId}/public/data/games`, gameState.mpId), {
        board: JSON.stringify(newBoard), currentPlayer: win ? null : next, winner: win || null
    }, { merge: true });
}

function updateStatus(msg, type='neutral') {
    const el = document.getElementById('status-text'); el.innerText = msg;
    el.className = "text-xl font-bold transition-colors duration-300 " + (type === 'success' ? "text-green-600" : type === 'error' ? "text-red-500" : "text-gray-800");
}
function getIconHtml(mark) {
    const iconClass = mark === 'X' ? 'ph-x' : 'ph-circle'; 
    return `<i class="ph-bold ${iconClass} mark-${mark.toLowerCase()}" style="animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"></i>`;
}
function renderBoard() {
    const grid = document.getElementById('grid'); grid.innerHTML = '';
    gameState.board.forEach((mark, i) => {
        const cell = document.createElement('div'); cell.className = 'cell';
        if(gameState.mode !== 'multiplayer' && gameState.currentPlayer !== gameState.playerMark && !gameState.winner) cell.classList.add('locked');
        if (mark) cell.innerHTML = getIconHtml(mark);
        cell.onclick = () => window.handleCellClick(i);
        grid.appendChild(cell);
    });
}
window.quit = () => { if (mpUnsubscribe) mpUnsubscribe(); gameState.isActive = false; window.nav('menu'); };
window.restart = () => { if (gameState.mode === 'multiplayer') return; window.startLocalGame(gameState.mode); };
window.onload = initApp;
