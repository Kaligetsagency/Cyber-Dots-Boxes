const GRID_SIZE = 5; // 5x5 dots = 4x4 boxes
const P1 = 1, P2 = 2;
let lines = {}; // 'x,y,dir' -> player
let boxes = []; // array of owners
let currentPlayer = P1;
let myPlayer = P1;
let gameMode = '';
let peer = null, conn = null;
let scores = { [P1]: 0, [P2]: 0 };

const UI = {
    menu: document.getElementById('menu-ui'),
    game: document.getElementById('game-ui'),
    result: document.getElementById('result-screen'),
    board: document.getElementById('board'),
    turn: document.getElementById('turn-indicator'),
    score1: document.getElementById('score-1'),
    score2: document.getElementById('score-2'),
    resTitle: document.getElementById('result-title'),
    resDetails: document.getElementById('result-details')
};

function initGame() {
    lines = {};
    boxes = Array((GRID_SIZE-1)*(GRID_SIZE-1)).fill(0);
    scores = { [P1]: 0, [P2]: 0 };
    currentPlayer = P1;
    drawBoard();
    updateUI();
}

function drawBoard() {
    UI.board.innerHTML = '';
    const step = 100 / (GRID_SIZE - 1);

    // Draw Boxes
    for (let r = 0; r < GRID_SIZE - 1; r++) {
        for (let c = 0; c < GRID_SIZE - 1; c++) {
            let box = document.createElement('div');
            box.className = 'box';
            box.style.top = `${r * step}%`;
            box.style.left = `${c * step}%`;
            box.style.width = `${step}%`;
            box.style.height = `${step}%`;
            box.id = `box-${r}-${c}`;
            UI.board.appendChild(box);
        }
    }

    // Draw Horizontal Lines
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE - 1; c++) {
            createLine(c, r, 'h', c * step, r * step, step);
        }
    }

    // Draw Vertical Lines
    for (let r = 0; r < GRID_SIZE - 1; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            createLine(c, r, 'v', c * step, r * step, step);
        }
    }

    // Draw Dots
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            let dot = document.createElement('div');
            dot.className = 'dot';
            dot.style.top = `${r * step}%`;
            dot.style.left = `${c * step}%`;
            UI.board.appendChild(dot);
        }
    }
}

function createLine(x, y, dir, left, top, step) {
    let id = `${x},${y},${dir}`;
    let line = document.createElement('div');
    line.className = `line ${dir}`;
    line.id = `line-${id}`;
    
    if (dir === 'h') {
        line.style.top = `${top}%`; line.style.left = `${left}%`; line.style.width = `${step}%`;
    } else {
        line.style.top = `${top}%`; line.style.left = `${left}%`; line.style.height = `${step}%`;
    }

    line.onclick = () => handleLineClick(id);
    UI.board.appendChild(line);
}

function handleLineClick(id) {
    if (currentPlayer !== myPlayer || lines[id]) return;
    processMove(id);
}

function processMove(id, isP2PData = false) {
    if (lines[id]) return;
    
    lines[id] = currentPlayer;
    document.getElementById(`line-${id}`).classList.add('active', `p${currentPlayer}`);

    if (gameMode === 'p2p' && !isP2PData && currentPlayer === myPlayer) {
        conn.send({ type: 'move', id });
    }

    let boxesCaptured = checkForCompletedBoxes(id);

    if (boxesCaptured > 0) {
        scores[currentPlayer] += boxesCaptured;
        if (checkGameOver()) return;
        // Player gets another turn!
        updateUI();
        triggerAITurn(); 
    } else {
        currentPlayer = currentPlayer === P1 ? P2 : P1;
        updateUI();
        triggerAITurn();
    }
}

function checkForCompletedBoxes(lineId) {
    let [x, y, dir] = lineId.split(',');
    x = parseInt(x); y = parseInt(y);
    let captured = 0;

    const checkAndFill = (bx, by) => {
        if (bx < 0 || bx >= GRID_SIZE - 1 || by < 0 || by >= GRID_SIZE - 1) return 0;
        let boxIdx = by * (GRID_SIZE - 1) + bx;
        if (boxes[boxIdx] !== 0) return 0;

        let top = lines[`${bx},${by},h`];
        let bottom = lines[`${bx},${by+1},h`];
        let left = lines[`${bx},${by},v`];
        let right = lines[`${bx+1},${by},v`];

        if (top && bottom && left && right) {
            boxes[boxIdx] = currentPlayer;
            document.getElementById(`box-${by}-${bx}`).classList.add(`p${currentPlayer}`);
            return 1;
        }
        return 0;
    };

    if (dir === 'h') {
        captured += checkAndFill(x, y - 1); // Box above
        captured += checkAndFill(x, y);     // Box below
    } else {
        captured += checkAndFill(x - 1, y); // Box left
        captured += checkAndFill(x, y);     // Box right
    }

    return captured;
}

function updateUI() {
    UI.score1.innerText = scores[P1];
    UI.score2.innerText = scores[P2];
    
    if (currentPlayer === myPlayer) {
        UI.turn.innerText = "> YOUR TURN <";
        UI.turn.style.color = myPlayer === P1 ? "var(--p1-color)" : "var(--p2-color)";
    } else {
        UI.turn.innerText = gameMode === 'ai' ? "SYSTEM COMPUTING..." : "OPPONENT'S TURN";
        UI.turn.style.color = "#888";
    }
}

function checkGameOver() {
    let totalBoxes = (GRID_SIZE - 1) * (GRID_SIZE - 1);
    if (scores[P1] + scores[P2] === totalBoxes) {
        setTimeout(() => {
            UI.game.classList.add('hidden');
            UI.result.classList.remove('hidden');
            UI.resDetails.innerText = `Cyan: ${scores[P1]} | Gold: ${scores[P2]}`;
            
            if (scores[P1] > scores[P2]) {
                UI.resTitle.innerText = myPlayer === P1 || gameMode === 'ai' ? "YOU WIN!" : "YOU LOSE!";
                UI.resTitle.style.color = "var(--p1-color)";
            } else if (scores[P2] > scores[P1]) {
                UI.resTitle.innerText = myPlayer === P2 ? "YOU WIN!" : "SYSTEM WINS!";
                UI.resTitle.style.color = "var(--p2-color)";
            } else {
                UI.resTitle.innerText = "DRAW!";
                UI.resTitle.style.color = "white";
            }
        }, 800);
        return true;
    }
    return false;
}

// --- RUTHLESS AI LOGIC ---
function triggerAITurn() {
    if (gameMode === 'ai' && currentPlayer !== myPlayer && !checkGameOver()) {
        setTimeout(playAITurn, 600); // Artificial delay for realism
    }
}

function playAITurn() {
    let allValidLines = [];
    // Gather all possible moves
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE - 1; c++) {
            let h = `${c},${r},h`; if (!lines[h]) allValidLines.push(h);
        }
    }
    for (let r = 0; r < GRID_SIZE - 1; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            let v = `${c},${r},v`; if (!lines[v]) allValidLines.push(v);
        }
    }

    if (allValidLines.length === 0) return;

    // 1. Can we close a box? Do it immediately.
    let capturingMove = getCapturingMove(allValidLines);
    if (capturingMove) {
        processMove(capturingMove);
        return;
    }

    // 2. Find safe moves (moves that don't leave a box with 3 lines)
    let safeMoves = [];
    for (let move of allValidLines) {
        if (isSafeMove(move)) safeMoves.push(move);
    }

    if (safeMoves.length > 0) {
        // Pick a random safe move
        let choice = safeMoves[Math.floor(Math.random() * safeMoves.length)];
        processMove(choice);
        return;
    }

    // 3. Forced to give away a box. (Greedy fallback: pick random, advanced: give smallest chain)
    // To keep performance high on mobile, we'll pick the move that creates the fewest immediate 3-sided boxes
    let bestForcedMove = allValidLines[0];
    let minDanger = 999;

    for (let move of allValidLines) {
        let danger = calculateDanger(move);
        if (danger < minDanger) {
            minDanger = danger;
            bestForcedMove = move;
        }
    }
    
    processMove(bestForcedMove);
}

function getCapturingMove(available) {
    for (let move of available) {
        if (wouldCaptureBox(move)) return move;
    }
    return null;
}

function wouldCaptureBox(move) {
    let [x, y, dir] = move.split(',');
    x = parseInt(x); y = parseInt(y);
    
    const countSides = (bx, by) => {
        if (bx < 0 || bx >= GRID_SIZE - 1 || by < 0 || by >= GRID_SIZE - 1) return -1;
        let c = 0;
        if (lines[`${bx},${by},h`]) c++;
        if (lines[`${bx},${by+1},h`]) c++;
        if (lines[`${bx},${by},v`]) c++;
        if (lines[`${bx+1},${by},v`]) c++;
        return c;
    };

    if (dir === 'h') {
        if (countSides(x, y - 1) === 3) return true;
        if (countSides(x, y) === 3) return true;
    } else {
        if (countSides(x - 1, y) === 3) return true;
        if (countSides(x, y) === 3) return true;
    }
    return false;
}

function isSafeMove(move) {
    let [x, y, dir] = move.split(',');
    x = parseInt(x); y = parseInt(y);
    
    const countSides = (bx, by) => {
        if (bx < 0 || bx >= GRID_SIZE - 1 || by < 0 || by >= GRID_SIZE - 1) return -1;
        let c = 0;
        if (lines[`${bx},${by},h`]) c++;
        if (lines[`${bx},${by+1},h`]) c++;
        if (lines[`${bx},${by},v`]) c++;
        if (lines[`${bx+1},${by},v`]) c++;
        return c;
    };

    if (dir === 'h') {
        if (countSides(x, y - 1) === 2 || countSides(x, y) === 2) return false;
    } else {
        if (countSides(x - 1, y) === 2 || countSides(x, y) === 2) return false;
    }
    return true;
}

function calculateDanger(move) {
    let [x, y, dir] = move.split(',');
    x = parseInt(x); y = parseInt(y);
    let dangerScore = 0;
    
    const countSides = (bx, by) => {
        if (bx < 0 || bx >= GRID_SIZE - 1 || by < 0 || by >= GRID_SIZE - 1) return -1;
        let c = 0;
        if (lines[`${bx},${by},h`]) c++;
        if (lines[`${bx},${by+1},h`]) c++;
        if (lines[`${bx},${by},v`]) c++;
        if (lines[`${bx+1},${by},v`]) c++;
        return c;
    };

    if (dir === 'h') {
        if (countSides(x, y - 1) === 2) dangerScore++;
        if (countSides(x, y) === 2) dangerScore++;
    } else {
        if (countSides(x - 1, y) === 2) dangerScore++;
        if (countSides(x, y) === 2) dangerScore++;
    }
    return dangerScore;
}


// --- P2P & FLOW ---
function startAIGame() {
    gameMode = 'ai'; myPlayer = P1;
    UI.menu.classList.add('hidden');
    UI.game.classList.remove('hidden');
    initGame();
}

function resetToMenu() {
    UI.result.classList.add('hidden');
    UI.menu.classList.remove('hidden');
    if (conn) { conn.close(); conn = null; }
    if (peer) { peer.destroy(); peer = null; }
}

function initPeer(isHost) {
    peer = new Peer();
    peer.on('open', id => { 
        if(isHost) document.getElementById('peer-id-display').innerText = id; 
    });
    peer.on('connection', connection => {
        conn = connection; setupConn();
        myPlayer = P1; startGameP2P();
    });
}

function hostGame() {
    document.getElementById('host-info').classList.remove('hidden');
    initPeer(true);
}

function joinGame() {
    const hostId = document.getElementById('join-id').value;
    if (!hostId) return alert('Enter Uplink Code');
    peer = new Peer();
    peer.on('open', () => {
        conn = peer.connect(hostId);
        conn.on('open', () => {
            myPlayer = P2; setupConn(); startGameP2P();
        });
    });
}

function setupConn() {
    conn.on('data', data => {
        if (data.type === 'move') {
            processMove(data.id, true);
        }
    });
    conn.on('close', () => { alert("Connection lost."); resetToMenu(); });
}

function startGameP2P() {
    gameMode = 'p2p';
    UI.menu.classList.add('hidden');
    UI.game.classList.remove('hidden');
    initGame();
}
