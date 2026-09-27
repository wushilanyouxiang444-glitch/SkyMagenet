/* =========================================================
   SkyMagnet
   Main Game Script
========================================================= */


/* =========================================================
   SCREEN
========================================================= */

const screens = {
    home: document.getElementById("homeScreen"),
    menu: document.getElementById("menuScreen"),
    settings: document.getElementById("settingsScreen"),
    game: document.getElementById("gameScreen"),
    clear: document.getElementById("clearScreen"),
    gameOver: document.getElementById("gameOverScreen")
};

function showScreen(name) {

    Object.values(screens).forEach(screen => {
        screen.classList.remove("active");
    });

    screens[name].classList.add("active");
}


/* =========================================================
   GAME STATE
========================================================= */

let currentStage = 1;

let soundEnabled = true;
let effectEnabled = false;

let gameRunning = false;
let stageCleared = false;

let gameLoopRequest = null;

const PROGRESS_KEY = "skymagnet-progress-v1";

const MAX_STAGES = 20;

function readProgress() {

    try {

        const saved = JSON.parse(
            localStorage.getItem(PROGRESS_KEY) || "null"
        );

        if (!saved || typeof saved !== "object") {
            return {
                unlockedStage: 1,
                clearedStages: {},
                bestTimes: {}
            };
        }

        return {
            unlockedStage: Math.min(
                MAX_STAGES,
                Math.max(1, Number(saved.unlockedStage) || 1)
            ),
            clearedStages: saved.clearedStages || {},
            bestTimes: saved.bestTimes || {}
        };

    } catch {

        return {
            unlockedStage: 1,
            clearedStages: {},
            bestTimes: {}
        };

    }

}

let progress = readProgress();

let gameStats = {
    startedAt: 0,
    deaths: 0,
    jumps: 0,
    elapsed: 0
};

let lastStatsUpdate = 0;

let audioContext = null;

let particles = [];

let lastMagnetEffectAt = 0;


function playSound(type) {

    if (!soundEnabled) {
        return;
    }

    const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

    if (!AudioContextClass) {
        return;
    }


    try {

        audioContext ??= new AudioContextClass();

        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        const patterns = {
            jump: [520, 760],
            land: [220],
            magnet: [390],
            clear: [523, 659, 784],
            death: [260, 180]
        };

        const notes = patterns[type] || [440];

        notes.forEach((frequency, index) => {

            const startTime =
                audioContext.currentTime + index * 0.075;

            const oscillator =
                audioContext.createOscillator();

            const gain =
                audioContext.createGain();

            oscillator.type = type === "death"
                ? "sawtooth"
                : "triangle";

            oscillator.frequency.setValueAtTime(
                frequency,
                startTime
            );

            gain.gain.setValueAtTime(0.0001, startTime);

            gain.gain.exponentialRampToValueAtTime(
                0.08,
                startTime + 0.015
            );

            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                startTime + 0.16
            );

            oscillator.connect(gain);

            gain.connect(audioContext.destination);

            oscillator.start(startTime);

            oscillator.stop(startTime + 0.17);

        });

    } catch {
        // Audio is optional when the browser blocks audio initialization.
    }

}


function spawnParticles(x, y, color, count = 12) {

    if (!effectEnabled) {
        return;
    }

    for (let index = 0; index < count; index++) {

        const angle =
            Math.random() * Math.PI * 2;

        const speed =
            1 + Math.random() * 3.5;

        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 2 + Math.random() * 3,
            color,
            life: 1
        });

    }

}


function updateParticles() {

    particles = particles.filter(particle => {

        particle.x += particle.vx;

        particle.y += particle.vy;

        particle.vy += 0.04;

        particle.vx *= 0.98;

        particle.life -= 0.025;

        return particle.life > 0;

    });

}


/* =========================================================
   CANVAS
========================================================= */

const canvas =
    document.getElementById("gameCanvas");

const ctx =
    canvas.getContext("2d");


/* =========================================================
   PLAYER
========================================================= */

const player = {

    x: 80,
    y: 545,

    width: 90,
    height: 55,

    vx: 0,
    vy: 0,

    speed: 0.75,
    maxSpeed: 7.5,
    friction: 0.82,

    gravity: 0.65,

    polarity: -1,

    onGround: false

};


/* =========================================================
   WORLD
========================================================= */

const WORLD = {

    groundY: 600

};


/* =========================================================
   JUMP
========================================================= */

const jump = {

    minPower: 8,

    maxPower: 18,

    maxChargeTime: 1000,

    minAirHeight: 120

};

let jumpCharging = false;

let jumpChargeStart = 0;

let jumpChargeRatio = 0;

let airJumpUsed = false;


/* =========================================================
   JUMP UI
========================================================= */

const jumpChargeUI =
    document.getElementById(
        "jumpChargeUI"
    );

const jumpChargeFill =
    document.getElementById(
        "jumpChargeFill"
    );

const jumpChargePercent =
    document.getElementById(
        "jumpChargePercent"
    );


function updateJumpChargeUI() {

    const percent =
        Math.round(
            jumpChargeRatio * 100
        );

    jumpChargeFill.style.width =
        `${percent}%`;

    jumpChargePercent.textContent =
        `${percent}%`;

    jumpChargeUI.classList.toggle(
        "charging",
        jumpCharging
    );
}


/* =========================================================
   MAGNETIC OBJECTS
========================================================= */

let magnets = [];

let magneticObjects = [];

let pits = [];


/* =========================================================
   GOAL
========================================================= */

let goal = {

    x: 1120,
    y: 450,

    width: 20,
    height: 150

};


/* =========================================================
   STAGE DATA
========================================================= */

const stageData = {

    1: {
        goal: { x: 1120, y: 450, width: 20, height: 150 },
        pits: [
            { x: 760, width: 120 }
        ],
        obstacles: [
            { x: 430, y: 470, width: 70, height: 130 }
        ],
        magnets: [
            { x: 465, y: 445, radius: 260, strength: 0.9, polarity: 1 }
        ],
        magneticObjects: [
            { x: 650, y: 300, radius: 15, mass: 1, polarity: -1, color: "#f5b942" }
        ]
    },

    2: {
        goal: { x: 1120, y: 400, width: 20, height: 200 },
        pits: [{ x: 510, width: 90 }],
        obstacles: [
            { x: 350, y: 420, width: 70, height: 180 },
            { x: 700, y: 350, width: 70, height: 250 }
        ],
        magnets: [
            { x: 520, y: 330, radius: 360, strength: 0.75, polarity: 1 },
            { x: 900, y: 300, radius: 360, strength: 0.75, polarity: -1 }
        ],
        magneticObjects: [
            { x: 570, y: 190, radius: 15, mass: 1, polarity: -1, color: "#ff7c66" },
            { x: 970, y: 200, radius: 15, mass: 1, polarity: 1, color: "#9b8cff" }
        ]
    },

    3: {
        goal: { x: 1080, y: 350, width: 20, height: 250 },
        pits: [{ x: 670, width: 110 }],
        obstacles: [
            { x: 300, y: 460, width: 70, height: 140 },
            { x: 550, y: 350, width: 70, height: 250 },
            { x: 820, y: 430, width: 70, height: 170 }
        ],
        magnets: [
            { x: 460, y: 390, radius: 360, strength: 0.8, polarity: 1 },
            { x: 930, y: 370, radius: 360, strength: 0.8, polarity: -1 }
        ],
        magneticObjects: [
            { x: 400, y: 260, radius: 15, mass: 1, polarity: -1, color: "#f5b942" },
            { x: 1000, y: 240, radius: 15, mass: 1, polarity: 1, color: "#ff7c66" }
        ]
    },

    4: {
        goal: { x: 1120, y: 420, width: 20, height: 180 },
        pits: [{ x: 620, width: 110 }],
        obstacles: [
            { x: 280, y: 400, width: 70, height: 200 },
            { x: 500, y: 470, width: 70, height: 130 },
            { x: 700, y: 350, width: 70, height: 250 },
            { x: 920, y: 450, width: 70, height: 150 }
        ],
        magnets: [
            { x: 430, y: 330, radius: 350, strength: 0.75, polarity: 1 },
            { x: 820, y: 300, radius: 370, strength: 0.85, polarity: -1 }
        ],
        magneticObjects: [
            { x: 430, y: 230, radius: 15, mass: 1, polarity: 1, color: "#9b8cff" },
            { x: 850, y: 190, radius: 15, mass: 1, polarity: -1, color: "#f5b942" }
        ]
    },

    5: {
        goal: { x: 1080, y: 380, width: 20, height: 220 },
        pits: [{ x: 600, width: 120 }],
        obstacles: [
            { x: 280, y: 350, width: 70, height: 250 },
            { x: 500, y: 450, width: 70, height: 150 },
            { x: 720, y: 350, width: 70, height: 250 },
            { x: 940, y: 430, width: 70, height: 170 }
        ],
        magnets: [
            { x: 420, y: 300, radius: 370, strength: 0.85, polarity: 1 },
            { x: 850, y: 280, radius: 390, strength: 1.2, polarity: -1 }
        ],
        magneticObjects: [
            { x: 420, y: 200, radius: 15, mass: 1, polarity: -1, color: "#ff7c66" },
            { x: 920, y: 180, radius: 15, mass: 1, polarity: 1, color: "#9b8cff" }
        ]
    },

    6: {
        goal: { x: 1140, y: 420, width: 20, height: 180 },
        pits: [{ x: 610, width: 110 }],
        obstacles: [
            { x: 330, y: 440, width: 80, height: 160 },
            { x: 790, y: 390, width: 90, height: 210 }
        ],
        magnets: [
            { x: 500, y: 360, radius: 300, strength: 0.78, polarity: 1 },
            { x: 940, y: 330, radius: 250, strength: 0.72, polarity: -1 }
        ],
        magneticObjects: [
            { x: 660, y: 250, radius: 16, mass: 1, polarity: -1, color: "#f5b942" }
        ]
    },

    7: {
        goal: { x: 1100, y: 390, width: 24, height: 210 },
        pits: [{ x: 440, width: 90 }, { x: 850, width: 100 }],
        obstacles: [
            { x: 300, y: 400, width: 70, height: 200 },
            { x: 620, y: 460, width: 80, height: 140 }
        ],
        magnets: [
            { x: 420, y: 330, radius: 250, strength: 0.72, polarity: -1 },
            { x: 760, y: 350, radius: 290, strength: 0.8, polarity: 1 }
        ],
        magneticObjects: [
            { x: 560, y: 220, radius: 15, mass: 1.1, polarity: 1, color: "#ff7c66" },
            { x: 940, y: 230, radius: 15, mass: 0.9, polarity: -1, color: "#9b8cff" }
        ]
    },

    8: {
        goal: { x: 1160, y: 440, width: 20, height: 160 },
        pits: [{ x: 700, width: 145 }],
        obstacles: [
            { x: 390, y: 450, width: 90, height: 150 },
            { x: 900, y: 390, width: 80, height: 210 }
        ],
        magnets: [
            { x: 570, y: 300, radius: 320, strength: 0.82, polarity: 1 },
            { x: 850, y: 270, radius: 260, strength: 0.7, polarity: 1 }
        ],
        magneticObjects: [
            { x: 680, y: 180, radius: 17, mass: 1, polarity: -1, color: "#f5b942" }
        ]
    },

    9: {
        goal: { x: 1120, y: 350, width: 22, height: 250 },
        pits: [{ x: 520, width: 115 }],
        obstacles: [
            { x: 360, y: 380, width: 70, height: 220 },
            { x: 710, y: 430, width: 85, height: 170 },
            { x: 930, y: 360, width: 70, height: 240 }
        ],
        magnets: [
            { x: 490, y: 320, radius: 260, strength: 0.72, polarity: 1 },
            { x: 830, y: 290, radius: 300, strength: 0.8, polarity: -1 }
        ],
        magneticObjects: [
            { x: 620, y: 220, radius: 15, mass: 1, polarity: -1, color: "#9b8cff" },
            { x: 1020, y: 190, radius: 15, mass: 1.2, polarity: 1, color: "#ff7c66" }
        ]
    },

    10: {
        goal: { x: 1160, y: 410, width: 20, height: 190 },
        pits: [{ x: 390, width: 85 }, { x: 770, width: 125 }],
        obstacles: [
            { x: 520, y: 440, width: 75, height: 160 },
            { x: 970, y: 400, width: 80, height: 200 }
        ],
        magnets: [
            { x: 470, y: 330, radius: 260, strength: 0.75, polarity: -1 },
            { x: 700, y: 300, radius: 310, strength: 0.82, polarity: 1 },
            { x: 1030, y: 300, radius: 260, strength: 0.72, polarity: -1 }
        ],
        magneticObjects: [
            { x: 620, y: 200, radius: 15, mass: 1, polarity: -1, color: "#f5b942" }
        ]
    },

    11: {
        goal: { x: 1120, y: 380, width: 22, height: 220 },
        pits: [{ x: 580, width: 125 }],
        obstacles: [
            { x: 300, y: 430, width: 85, height: 170 },
            { x: 760, y: 370, width: 80, height: 230 },
            { x: 960, y: 470, width: 70, height: 130 }
        ],
        magnets: [
            { x: 450, y: 330, radius: 280, strength: 0.78, polarity: 1 },
            { x: 880, y: 300, radius: 340, strength: 0.84, polarity: -1 }
        ],
        magneticObjects: [
            { x: 600, y: 200, radius: 15, mass: 0.85, polarity: -1, color: "#ff7c66" },
            { x: 1060, y: 250, radius: 16, mass: 1.15, polarity: 1, color: "#9b8cff" }
        ]
    },

    12: {
        goal: { x: 1160, y: 430, width: 20, height: 170 },
        pits: [{ x: 420, width: 100 }, { x: 870, width: 110 }],
        obstacles: [
            { x: 570, y: 400, width: 90, height: 200 },
            { x: 740, y: 460, width: 75, height: 140 }
        ],
        magnets: [
            { x: 480, y: 300, radius: 300, strength: 0.8, polarity: 1 },
            { x: 800, y: 330, radius: 300, strength: 0.8, polarity: -1 },
            { x: 1060, y: 290, radius: 240, strength: 0.68, polarity: 1 }
        ],
        magneticObjects: [
            { x: 680, y: 190, radius: 16, mass: 1, polarity: 1, color: "#f5b942" }
        ]
    },

    13: {
        goal: { x: 1100, y: 360, width: 24, height: 240 },
        pits: [{ x: 640, width: 145 }],
        obstacles: [
            { x: 330, y: 390, width: 75, height: 210 },
            { x: 520, y: 470, width: 80, height: 130 },
            { x: 870, y: 410, width: 85, height: 190 }
        ],
        magnets: [
            { x: 450, y: 320, radius: 260, strength: 0.76, polarity: -1 },
            { x: 750, y: 280, radius: 330, strength: 0.84, polarity: 1 },
            { x: 1010, y: 310, radius: 270, strength: 0.72, polarity: -1 }
        ],
        magneticObjects: [
            { x: 620, y: 190, radius: 15, mass: 1.25, polarity: 1, color: "#9b8cff" },
            { x: 950, y: 210, radius: 15, mass: 0.8, polarity: -1, color: "#ff7c66" }
        ]
    },

    14: {
        goal: { x: 1150, y: 400, width: 20, height: 200 },
        pits: [{ x: 480, width: 120 }, { x: 790, width: 100 }],
        obstacles: [
            { x: 350, y: 450, width: 75, height: 150 },
            { x: 650, y: 380, width: 90, height: 220 },
            { x: 950, y: 440, width: 80, height: 160 }
        ],
        magnets: [
            { x: 530, y: 300, radius: 300, strength: 0.82, polarity: 1 },
            { x: 850, y: 280, radius: 310, strength: 0.82, polarity: -1 }
        ],
        magneticObjects: [
            { x: 700, y: 190, radius: 16, mass: 1, polarity: -1, color: "#f5b942" }
        ]
    },

    15: {
        goal: { x: 1120, y: 350, width: 24, height: 250 },
        pits: [{ x: 350, width: 90 }, { x: 690, width: 120 }, { x: 960, width: 80 }],
        obstacles: [
            { x: 500, y: 420, width: 75, height: 180 },
            { x: 850, y: 390, width: 80, height: 210 }
        ],
        magnets: [
            { x: 420, y: 300, radius: 250, strength: 0.76, polarity: -1 },
            { x: 650, y: 300, radius: 300, strength: 0.84, polarity: 1 },
            { x: 920, y: 280, radius: 300, strength: 0.82, polarity: -1 }
        ],
        magneticObjects: [
            { x: 590, y: 190, radius: 15, mass: 0.9, polarity: 1, color: "#ff7c66" },
            { x: 1020, y: 200, radius: 16, mass: 1.2, polarity: 1, color: "#9b8cff" }
        ]
    },

    16: {
        goal: { x: 1160, y: 420, width: 20, height: 180 },
        pits: [{ x: 550, width: 135 }, { x: 900, width: 120 }],
        obstacles: [
            { x: 330, y: 400, width: 80, height: 200 },
            { x: 720, y: 430, width: 85, height: 170 },
            { x: 1020, y: 380, width: 70, height: 220 }
        ],
        magnets: [
            { x: 470, y: 280, radius: 290, strength: 0.8, polarity: 1 },
            { x: 790, y: 300, radius: 330, strength: 0.84, polarity: -1 },
            { x: 1090, y: 270, radius: 240, strength: 0.7, polarity: 1 }
        ],
        magneticObjects: [
            { x: 630, y: 180, radius: 15, mass: 1, polarity: -1, color: "#f5b942" }
        ]
    },

    17: {
        goal: { x: 1100, y: 390, width: 24, height: 210 },
        pits: [{ x: 430, width: 105 }, { x: 760, width: 140 }],
        obstacles: [
            { x: 310, y: 460, width: 70, height: 140 },
            { x: 590, y: 370, width: 80, height: 230 },
            { x: 930, y: 420, width: 90, height: 180 }
        ],
        magnets: [
            { x: 480, y: 310, radius: 280, strength: 0.78, polarity: -1 },
            { x: 710, y: 270, radius: 320, strength: 0.86, polarity: 1 },
            { x: 1010, y: 320, radius: 290, strength: 0.8, polarity: -1 }
        ],
        magneticObjects: [
            { x: 690, y: 170, radius: 16, mass: 1.15, polarity: -1, color: "#ff7c66" },
            { x: 1050, y: 200, radius: 15, mass: 0.85, polarity: 1, color: "#9b8cff" }
        ]
    },

    18: {
        goal: { x: 1160, y: 360, width: 20, height: 240 },
        pits: [{ x: 500, width: 100 }, { x: 830, width: 115 }],
        obstacles: [
            { x: 370, y: 410, width: 90, height: 190 },
            { x: 650, y: 450, width: 80, height: 150 },
            { x: 960, y: 380, width: 80, height: 220 }
        ],
        magnets: [
            { x: 540, y: 290, radius: 300, strength: 0.82, polarity: 1 },
            { x: 790, y: 300, radius: 320, strength: 0.84, polarity: -1 },
            { x: 1080, y: 280, radius: 250, strength: 0.72, polarity: 1 }
        ],
        magneticObjects: [
            { x: 620, y: 190, radius: 16, mass: 1, polarity: -1, color: "#f5b942" }
        ]
    },

    19: {
        goal: { x: 1120, y: 400, width: 24, height: 200 },
        pits: [{ x: 380, width: 90 }, { x: 620, width: 110 }, { x: 890, width: 120 }],
        obstacles: [
            { x: 500, y: 400, width: 75, height: 200 },
            { x: 790, y: 360, width: 85, height: 240 },
            { x: 1030, y: 450, width: 60, height: 150 }
        ],
        magnets: [
            { x: 430, y: 300, radius: 260, strength: 0.78, polarity: -1 },
            { x: 700, y: 280, radius: 310, strength: 0.84, polarity: 1 },
            { x: 970, y: 300, radius: 300, strength: 0.84, polarity: -1 }
        ],
        magneticObjects: [
            { x: 590, y: 180, radius: 15, mass: 0.9, polarity: 1, color: "#9b8cff" },
            { x: 900, y: 180, radius: 16, mass: 1.1, polarity: 1, color: "#ff7c66" }
        ]
    },

    20: {
        goal: { x: 1160, y: 340, width: 24, height: 260 },
        pits: [{ x: 340, width: 100 }, { x: 570, width: 120 }, { x: 820, width: 130 }, { x: 1030, width: 70 }],
        obstacles: [
            { x: 460, y: 430, width: 75, height: 170 },
            { x: 720, y: 380, width: 85, height: 220 },
            { x: 970, y: 400, width: 55, height: 200 }
        ],
        magnets: [
            { x: 400, y: 290, radius: 270, strength: 0.8, polarity: 1 },
            { x: 650, y: 250, radius: 330, strength: 0.88, polarity: -1 },
            { x: 900, y: 280, radius: 320, strength: 0.86, polarity: 1 },
            { x: 1100, y: 250, radius: 230, strength: 0.72, polarity: -1 }
        ],
        magneticObjects: [
            { x: 600, y: 170, radius: 16, mass: 1, polarity: 1, color: "#f5b942" },
            { x: 890, y: 170, radius: 16, mass: 0.8, polarity: 1, color: "#ff7c66" }
        ]
    }

};


let obstacles = [];



/* =========================================================
   STAGE SELECT
========================================================= */

const stageGrid =
    document.getElementById(
        "stageGrid"
    );


for (
    let i = 1;
    i <= MAX_STAGES;
    i++
) {

    const button =
        document.createElement(
            "button"
        );

    button.className =
        "stage-button";

    button.type = "button";

    button.textContent =
        i;

    button.dataset.stage = i;

    button.addEventListener(
        "click",
        () => {
            if (i <= progress.unlockedStage) {
                loadStage(i);
            }
        }
    );

    stageGrid.appendChild(
        button
    );

}


function saveProgress() {

    try {

        localStorage.setItem(
            PROGRESS_KEY,
            JSON.stringify(progress)
        );

    } catch {
        // Progress remains available for the current session.
    }

}


function updateStageSelect() {

    for (const button of stageGrid.children) {

        const stageNumber =
            Number(button.dataset.stage);

        const isUnlocked =
            stageNumber <= progress.unlockedStage;

        button.disabled = !isUnlocked;

        button.classList.toggle(
            "cleared",
            Boolean(progress.clearedStages[stageNumber])
        );

        button.textContent = isUnlocked
            ? `${stageNumber}${progress.clearedStages[stageNumber] ? " ✓" : ""}`
            : "🔒";

        button.setAttribute(
            "aria-label",
            isUnlocked
                ? `ステージ ${stageNumber}${progress.clearedStages[stageNumber] ? " クリア済み" : ""}`
                : `ステージ ${stageNumber} ロック中`
        );

    }

    document.getElementById("stageProgressText").textContent =
        `UNLOCKED ${progress.unlockedStage} / ${MAX_STAGES}`;

}


function formatTime(milliseconds) {

    const totalSeconds =
        Math.max(0, milliseconds) / 1000;

    const minutes =
        Math.floor(totalSeconds / 60);

    const seconds =
        (totalSeconds % 60).toFixed(2).padStart(5, "0");

    return `${minutes}:${seconds}`;

}


function updateRunStats(force = false) {

    const now = performance.now();

    if (!force && now - lastStatsUpdate < 200) {
        return;
    }

    lastStatsUpdate = now;

    const elapsed =
        gameStats.elapsed +
        (gameStats.startedAt
            ? now - gameStats.startedAt
            : 0);

    document.getElementById("runTime").textContent =
        formatTime(elapsed);

    document.getElementById("runDeaths").textContent =
        gameStats.deaths;

    document.getElementById("runJumps").textContent =
        gameStats.jumps;

}


/* =========================================================
   LOAD STAGE
========================================================= */

function loadStage(stageNumber, preserveRun = false) {

    if (
        stageNumber < 1 ||
        stageNumber > MAX_STAGES ||
        stageNumber > progress.unlockedStage
    ) {

        return;

    }

    if (gameLoopRequest !== null) {

        cancelAnimationFrame(
            gameLoopRequest
        );

        gameLoopRequest = null;
    }


    currentStage =
        stageNumber;


    document.getElementById(
        "stageTitle"
    ).textContent =
        `STAGE ${currentStage}`;


    const stage =
        stageData[stageNumber];


    obstacles =
        stage.obstacles.map(
            obstacle => ({ ...obstacle })
        );

    magnets =
        stage.magnets.map(
            magnet => ({
                ...magnet,
                polarity: magnet.polarity || 1
            })
        );

    magneticObjects =
        stage.magneticObjects.map(
            object => ({
                ...object,
                vx: 0,
                vy: 0,
                polarity: object.polarity || -1,
                spawnX: object.x,
                spawnY: object.y
            })
        );

    pits =
        (stage.pits || []).map(
            pit => ({ ...pit })
        );

    goal = { ...stage.goal };


    resetPlayer();

    airJumpUsed = false;

    if (!preserveRun) {

        gameStats = {
            startedAt: performance.now(),
            deaths: 0,
            jumps: 0,
            elapsed: 0
        };

    } else {

        gameStats.startedAt = performance.now();

    }

    stageCleared = false;

    gameRunning = true;

    jumpCharging = false;

    jumpChargeRatio = 0;

    updateJumpChargeUI();

    updateRunStats(true);

    showScreen("game");


    gameLoopRequest =
        requestAnimationFrame(
            gameLoop
        );

}


/* =========================================================
   RESET PLAYER
========================================================= */

function resetPlayer() {

    player.x = 80;

    player.y =
        WORLD.groundY -
        player.height;

    player.vx = 0;
    player.vy = 0;

    player.onGround = true;

    airJumpUsed = false;

    jumpCharging = false;

    jumpChargeStart = 0;

    jumpChargeRatio = 0;

    updateJumpChargeUI();

}


function stopGameLoop() {

    if (gameLoopRequest !== null) {
        cancelAnimationFrame(gameLoopRequest);
        gameLoopRequest = null;
    }

    gameRunning = false;

}


/* =========================================================
   HOME
========================================================= */

function backToHome() {

    stopGameLoop();

    jumpCharging = false;

    jumpChargeRatio = 0;

    updateJumpChargeUI();

    showScreen("home");

}


/* =========================================================
   START
========================================================= */

function startGame() {

    loadStage(
        currentStage
    );

}


/* =========================================================
   MENU
========================================================= */

function openMenu() {

    stopGameLoop();

    jumpCharging = false;

    jumpChargeRatio = 0;

    updateJumpChargeUI();

    showScreen("menu");

}


/* =========================================================
   SETTINGS
========================================================= */

function openSettings() {

    stopGameLoop();

    jumpCharging = false;

    jumpChargeRatio = 0;

    updateJumpChargeUI();

    showScreen("settings");

}


/* =========================================================
   RESTART
========================================================= */

function restartStage() {

    loadStage(
        currentStage,
        true
    );

}


/* =========================================================
   NEXT STAGE
========================================================= */

function nextStage() {

    if (currentStage < 20) {

        currentStage++;

        progress.unlockedStage = Math.max(
            progress.unlockedStage,
            currentStage
        );

        saveProgress();

        updateStageSelect();

        loadStage(
            currentStage
        );

    } else {

        openMenu();

    }

}


/* =========================================================
   SOUND
========================================================= */

function toggleSound() {

    soundEnabled =
        !soundEnabled;


    const button =
        document.getElementById(
            "soundToggle"
        );

    const text =
        document.getElementById(
            "soundText"
        );


    button.classList.toggle(
        "on",
        soundEnabled
    );

    button.classList.toggle(
        "off",
        !soundEnabled
    );


    text.textContent =
        soundEnabled
            ? "ON"
            : "OFF";

    button.setAttribute(
        "aria-pressed",
        soundEnabled
    );

}


/* =========================================================
   EFFECT
========================================================= */

function toggleEffect() {

    effectEnabled =
        !effectEnabled;


    const button =
        document.getElementById(
            "effectToggle"
        );

    const text =
        document.getElementById(
            "effectText"
        );


    button.classList.toggle(
        "on",
        effectEnabled
    );

    button.classList.toggle(
        "off",
        !effectEnabled
    );


    text.textContent =
        effectEnabled
            ? "ON"
            : "OFF";

    button.setAttribute(
        "aria-pressed",
        effectEnabled
    );

}


/* =========================================================
   KEYBOARD
========================================================= */

const keys = {};


function resetInputState() {

    Object.keys(keys)
        .forEach(key => {
            keys[key] = false;
        });


    jumpCharging = false;

    jumpChargeStart = 0;

    jumpChargeRatio = 0;

    updateJumpChargeUI();

}


window.addEventListener(
    "blur",
    resetInputState
);


/* =========================================================
   KEY DOWN
========================================================= */

window.addEventListener(
    "keydown",
    event => {

        const key =
            event.key.toLowerCase();


        keys[key] = true;


        /*
            地上ジャンプ後、空中チャージは
            着地まで1回だけ許可
        */

        if (
            event.code === "Space" &&
            !event.repeat &&
            gameRunning &&
            (
                player.onGround ||
                (
                    !airJumpUsed &&
                    WORLD.groundY -
                    (player.y + player.height) >=
                    jump.minAirHeight
                )
            ) &&
            !jumpCharging
        ) {

            event.preventDefault();


            jumpCharging = true;

            jumpChargeStart =
                performance.now();

            jumpChargeRatio = 0;

            if (!player.onGround) {

                airJumpUsed = true;

            }

            updateJumpChargeUI();

        }


        /*
            ブラウザのSpaceスクロール防止
        */

        if (
            event.code === "Space"
        ) {

            event.preventDefault();

        }

    }
);


/* =========================================================
   KEY UP
========================================================= */

window.addEventListener(
    "keyup",
    event => {

        const key =
            event.key.toLowerCase();

        keys[key] = false;


        if (
            event.code !== "Space"
        ) {
            return;
        }


        event.preventDefault();


        /*
            チャージ中なら
            離した瞬間にジャンプ
        */

        if (jumpCharging) {

            const chargeTime =
                performance.now() -
                jumpChargeStart;


            jumpChargeRatio =
                Math.min(
                    chargeTime /
                    jump.maxChargeTime,
                    1
                );


            const jumpPower =
                jump.minPower +
                (
                    jump.maxPower -
                    jump.minPower
                ) *
                jumpChargeRatio;


            player.vy -=
                jumpPower;

            gameStats.jumps++;

            updateRunStats(true);

            playSound("jump");

            spawnParticles(
                player.x + player.width / 2,
                player.y + player.height,
                "#63dbe4",
                14
            );


            player.onGround = false;

        }


        jumpCharging = false;

        jumpChargeStart = 0;

        jumpChargeRatio = 0;

        updateJumpChargeUI();

    }
);


/* =========================================================
   UPDATE JUMP CHARGE
========================================================= */

function updateJumpCharging() {

    if (!jumpCharging) {
        return;
    }


    const elapsed =
        performance.now() -
        jumpChargeStart;


    jumpChargeRatio =
        Math.min(
            elapsed /
            jump.maxChargeTime,
            1
        );


    updateJumpChargeUI();

}


/* =========================================================
   UPDATE
========================================================= */

function update() {

    updateJumpCharging();

    updateHorizontalMovement();

    updatePlayerPhysics();

    if (!gameRunning) {
        return;
    }

    updateMagneticObjects();

    updateParticles();

    checkGoal();

    updateRunStats();

}


function applyMagneticForce(target, targetX, targetY) {

    let affected = false;

    for (const magnet of magnets) {

        const dx = magnet.x - targetX;

        const dy = magnet.y - targetY;

        const distance = Math.hypot(dx, dy);

        if (
            distance >= magnet.radius ||
            distance <= 0
        ) {

            continue;

        }

        const polarityProduct =
            (target.polarity || -1) *
            (magnet.polarity || 1);

        const force =
            magnet.strength *
            (1 - distance / magnet.radius) *
            -polarityProduct /
            (target.mass || 1);

        target.vx +=
            dx / distance * force;

        target.vy +=
            dy / distance * force;

        affected = true;

    }

    return affected;

}


function updateMagneticObjects() {

    for (const object of magneticObjects) {

        applyMagneticForce(
            object,
            object.x,
            object.y
        );

        object.vy += 0.08;

        object.vx *= 0.985;

        object.vy *= 0.985;

        object.vx = Math.max(-8, Math.min(8, object.vx));

        object.vy = Math.max(-8, Math.min(8, object.vy));


        const previousX = object.x;

        const previousY = object.y;

        object.x += object.vx;


        for (const obstacle of obstacles) {

            const overlapsX =
                object.x + object.radius > obstacle.x &&
                object.x - object.radius < obstacle.x + obstacle.width;

            const overlapsY =
                object.y + object.radius > obstacle.y &&
                object.y - object.radius < obstacle.y + obstacle.height;


            if (overlapsX && overlapsY) {

                object.x = previousX;

                object.vx *= -0.35;

                break;

            }

        }


        object.y += object.vy;


        for (const obstacle of obstacles) {

            const overlapsX =
                object.x + object.radius > obstacle.x &&
                object.x - object.radius < obstacle.x + obstacle.width;

            const overlapsY =
                object.y + object.radius > obstacle.y &&
                object.y - object.radius < obstacle.y + obstacle.height;


            if (overlapsX && overlapsY) {

                object.y = previousY;

                object.vy *= -0.35;

                break;

            }

        }


        if (
            object.x - object.radius < 0 ||
            object.x + object.radius > canvas.width
        ) {

            object.x = Math.max(
                object.radius,
                Math.min(canvas.width - object.radius, object.x)
            );

            object.vx *= -0.45;

        }


        const overPit =
            pits.some(pit =>
                object.x >= pit.x &&
                object.x <= pit.x + pit.width
            );


        if (
            !overPit &&
            object.y + object.radius >= WORLD.groundY
        ) {

            object.y = WORLD.groundY - object.radius;

            object.vy *= -0.25;

        }


        if (object.y > canvas.height + 80) {

            object.x = object.spawnX;

            object.y = object.spawnY;

            object.vx = 0;

            object.vy = 0;

        }

    }

}


/* =========================================================
   HORIZONTAL MOVEMENT
========================================================= */

function updateHorizontalMovement() {

    const previousX = player.x;

    const left =
        keys["arrowleft"] ||
        keys["a"];

    const right =
        keys["arrowright"] ||
        keys["d"];


    if (left) {

        player.vx -=
            player.speed;

    }


    if (right) {

        player.vx +=
            player.speed;

    }


    if (!left && !right) {

        player.vx *=
            player.friction;

    }


    player.vx =
        Math.max(
            -player.maxSpeed,
            Math.min(
                player.maxSpeed,
                player.vx
            )
        );


    const magneticallyAffected =
        applyMagneticForce(
        player,
        player.x + player.width / 2,
        player.y + player.height / 2
    );


    if (
        magneticallyAffected &&
        performance.now() - lastMagnetEffectAt > 180
    ) {

        lastMagnetEffectAt = performance.now();

        playSound("magnet");

        spawnParticles(
            player.x + player.width / 2,
            player.y + player.height / 2,
            "#75e5ef",
            2
        );

    }


    player.vx =
        Math.max(
            -player.maxSpeed,
            Math.min(
                player.maxSpeed,
                player.vx
            )
        );


    player.x +=
        player.vx;


    /*
        壁
    */

    if (player.x < 0) {

        player.x = 0;

        player.vx = 0;

    }


    if (
        player.x +
        player.width >
        canvas.width
    ) {

        player.x =
            canvas.width -
            player.width;

        player.vx = 0;

    }


    /*
        横方向の障害物衝突
    */

    for (
        const obstacle of obstacles
    ) {

        resolveHorizontalCollision(
            player,
            obstacle,
            previousX
        );

    }

}


/* =========================================================
   PLAYER PHYSICS
========================================================= */

function updatePlayerPhysics() {

    const wasOnGround =
        player.onGround;

    const previousY =
        player.y;


    /*
        重力
    */

    if (!player.onGround) {

        player.vy +=
            player.gravity;

    }


    /*
        縦移動
    */

    player.y +=
        player.vy;


    /*
        毎フレーム一度リセット
        ↓
        このフレームに着地したらtrueにする
    */

    player.onGround = false;


    /*
        地面
    */

    const groundTop =
        WORLD.groundY;

    const playerCenterX =
        player.x + player.width / 2;

    const overPit =
        pits.some(pit =>
            playerCenterX >= pit.x &&
            playerCenterX <= pit.x + pit.width
        );


    if (
        !overPit &&
        player.y +
        player.height >=
        groundTop &&
        player.vy >= 0
    ) {

        player.y =
            groundTop -
            player.height;

        player.vy = 0;

        player.onGround = true;

    }


    /*
        障害物の上面への着地
        --------------------------------
        previousBottom <= obstacleTop
        かつ
        currentBottom >= obstacleTop
        なら確実に着地
    */

    for (
        const obstacle of obstacles
    ) {

        const previousBottom =
            previousY +
            player.height;

        const currentBottom =
            player.y +
            player.height;


        const horizontalOverlap =
            player.x <
            obstacle.x +
            obstacle.width &&
            player.x +
            player.width >
            obstacle.x;


        const landing =
            horizontalOverlap &&
            player.vy >= 0 &&
            previousBottom <=
                obstacle.y + 2 &&
            currentBottom >=
                obstacle.y;


        if (landing) {

            player.y =
                obstacle.y -
                player.height;

            player.vy = 0;

            player.onGround = true;

        }

    }


    if (player.onGround) {

        airJumpUsed = false;

    }


    /*
        障害物の下面・側面への
        縦方向めり込み防止
    */

    if (!player.onGround) {

        for (
            const obstacle of obstacles
        ) {

            if (
                isColliding(
                    player,
                    obstacle
                )
            ) {

                /*
                    上からではない場合だけ
                    下方向への侵入を防ぐ
                */

                if (
                    player.vy < 0 &&
                    player.y <
                        obstacle.y +
                        obstacle.height
                ) {

                    player.y =
                        obstacle.y +
                        obstacle.height;

                    player.vy = 0;

                }

            }

        }

    }


    if (player.y > canvas.height + 100) {

        playerDied();

        return;

    }


    if (!wasOnGround && player.onGround) {

        playSound("land");

        spawnParticles(
            player.x + player.width / 2,
            player.y + player.height,
            "#ffffff",
            10
        );

    }

}


/* =========================================================
   HORIZONTAL COLLISION
========================================================= */

function resolveHorizontalCollision(
    object,
    obstacle,
    previousX
) {

    if (!isColliding(object, obstacle)) {
        return;
    }

    const previousRight =
        previousX + object.width;

    const movingRight =
        object.x > previousX;

    const movingLeft =
        object.x < previousX;

    /*
        上面に着地している場合は
        横衝突として扱わない。
    */

    if (
        object.y + object.height <=
        obstacle.y + 8
    ) {
        return;
    }

    if (movingRight && previousRight <= obstacle.x) {

        object.x = obstacle.x - object.width;
        object.vx = 0;
        return;

    }

    if (movingLeft && previousX >= obstacle.x + obstacle.width) {

        object.x = obstacle.x + obstacle.width;
        object.vx = 0;
        return;

    }

    /*
        めり込み状態になった場合は、
        X方向の重なりが小さい側へ押し出す。
    */

    const pushFromLeft =
        object.x + object.width - obstacle.x;

    const pushFromRight =
        obstacle.x + obstacle.width - object.x;

    if (pushFromLeft < pushFromRight) {
        object.x = obstacle.x - object.width;
    } else {
        object.x = obstacle.x + obstacle.width;
    }

    object.vx = 0;

}


/* =========================================================
   COLLISION
========================================================= */

function isColliding(a, b) {

    return (

        a.x <
        b.x + b.width &&

        a.x + a.width >
        b.x &&

        a.y <
        b.y + b.height &&

        a.y + a.height >
        b.y

    );

}


/* =========================================================
   GOAL
========================================================= */

function checkGoal() {

    if (
        isColliding(
            player,
            goal
        )
    ) {

        clearStage();

    }

}


/* =========================================================
   CLEAR
========================================================= */

function clearStage() {

    if (stageCleared) {
        return;
    }


    stageCleared = true;

    playSound("clear");

    spawnParticles(
        player.x + player.width / 2,
        player.y + player.height / 2,
        "#ffe052",
        32
    );

    gameStats.elapsed +=
        performance.now() - gameStats.startedAt;

    gameStats.startedAt = 0;

    progress.clearedStages[currentStage] = true;

    progress.unlockedStage = Math.min(
        MAX_STAGES,
        Math.max(progress.unlockedStage, currentStage + 1)
    );

    const previousBest =
        progress.bestTimes[currentStage];

    if (
        !previousBest ||
        gameStats.elapsed < previousBest
    ) {

        progress.bestTimes[currentStage] =
            gameStats.elapsed;

    }

    saveProgress();

    updateStageSelect();

    updateRunStats(true);

    stopGameLoop();

    jumpCharging = false;

    jumpChargeRatio = 0;

    updateJumpChargeUI();


    document.getElementById(
        "clearStageText"
    ).textContent =
        `STAGE ${currentStage} CLEAR!`;

    document.getElementById("clearStats").textContent =
        `TIME ${formatTime(gameStats.elapsed)}   DEATHS ${gameStats.deaths}   JUMPS ${gameStats.jumps}`;


    showScreen("clear");

}


function playerDied() {

    if (!gameRunning) {
        return;
    }

    gameStats.deaths++;

    playSound("death");

    spawnParticles(
        player.x + player.width / 2,
        player.y + player.height / 2,
        "#ff5268",
        22
    );

    gameStats.elapsed +=
        performance.now() - gameStats.startedAt;

    gameStats.startedAt = 0;

    stopGameLoop();

    jumpCharging = false;

    jumpChargeRatio = 0;

    updateJumpChargeUI();

    updateRunStats(true);

    document.getElementById("gameOverText").textContent =
        `STAGE ${currentStage}   TIME ${formatTime(gameStats.elapsed)}   DEATHS ${gameStats.deaths}`;

    showScreen("gameOver");

}


/* =========================================================
   DRAW BACKGROUND
========================================================= */

function drawGameBackground() {

    /*
        遠景の丘
    */

    ctx.fillStyle =
        "rgba(72,174,190,0.22)";

    ctx.beginPath();

    ctx.moveTo(0, 470);

    for (
        let x = 0;
        x <= canvas.width;
        x += 80
    ) {

        const y =
            455 +
            Math.sin(
                x * 0.012
            ) * 25;

        ctx.lineTo(
            x,
            y
        );

    }

    ctx.lineTo(
        canvas.width,
        600
    );

    ctx.lineTo(
        0,
        600
    );

    ctx.closePath();

    ctx.fill();


    /*
        雲
    */

    drawCloud(
        180,
        130,
        1.0
    );

    drawCloud(
        760,
        100,
        0.75
    );

    drawCloud(
        1050,
        210,
        0.9
    );

}


/* =========================================================
   CLOUD
========================================================= */

function drawCloud(
    x,
    y,
    scale
) {

    ctx.save();

    ctx.translate(
        x,
        y
    );

    ctx.scale(
        scale,
        scale
    );

    ctx.fillStyle =
        "rgba(255,255,255,0.68)";

    ctx.beginPath();

    ctx.arc(
        0,
        15,
        30,
        0,
        Math.PI * 2
    );

    ctx.arc(
        35,
        0,
        38,
        0,
        Math.PI * 2
    );

    ctx.arc(
        75,
        15,
        28,
        0,
        Math.PI * 2
    );

    ctx.roundRect(
        -20,
        15,
        115,
        35,
        20
    );

    ctx.fill();

    ctx.restore();

}


/* =========================================================
   MAGNET EFFECT
========================================================= */

function drawMagnetEffect(
    magnet,
    index
) {

    const time =
        performance.now() /
        1000;


    for (
        let i = 0;
        i < 3;
        i++
    ) {

        const progress =
            (
                time * 0.55 +
                index * 0.2 +
                i / 3
            ) % 1;


        const radius =
            20 +
            progress * magnet.radius;


        const alpha =
            (1 - progress) *
            0.4;


        ctx.beginPath();

        ctx.arc(
            magnet.x,
            magnet.y,
            radius,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle =
            `rgba(93,228,239,${alpha})`;

        ctx.lineWidth = 2;

        ctx.stroke();

    }

}


/* =========================================================
   DRAW OBSTACLES
========================================================= */

function drawObstacles() {

    obstacles.forEach(
        obstacle => {


            /*
                Shadow
            */

            ctx.fillStyle =
                "rgba(23,61,77,0.15)";

            ctx.fillRect(
                obstacle.x + 7,
                obstacle.y + 8,
                obstacle.width,
                obstacle.height
            );


            /*
                Block
            */

            const gradient =
                ctx.createLinearGradient(
                    0,
                    obstacle.y,
                    0,
                    obstacle.y +
                    obstacle.height
                );

            gradient.addColorStop(
                0,
                "#eaffff"
            );

            gradient.addColorStop(
                1,
                "#9ddde2"
            );


            ctx.fillStyle =
                gradient;

            ctx.strokeStyle =
                "#173d4d";

            ctx.lineWidth = 4;


            ctx.fillRect(
                obstacle.x,
                obstacle.y,
                obstacle.width,
                obstacle.height
            );

            ctx.strokeRect(
                obstacle.x,
                obstacle.y,
                obstacle.width,
                obstacle.height
            );


        }
    );

}


/* =========================================================
   DRAW MAGNETS
========================================================= */

function drawMagnets() {

    magnets.forEach(
        (magnet, index) => {

            drawMagnetEffect(
                magnet,
                index
            );

            drawMagnet(magnet);

        }
    );

}


/* =========================================================
   DRAW MAGNET
========================================================= */

function drawMagnet(
    magnet
) {

    ctx.save();

    ctx.translate(
        magnet.x,
        magnet.y
    );


    /*
        Magnet body
    */

    ctx.strokeStyle = magnet.polarity > 0
        ? "#d6334c"
        : "#315bce";

    ctx.lineWidth = 9;

    ctx.lineCap = "round";


    ctx.beginPath();

    ctx.moveTo(
        -15,
        -13
    );

    ctx.lineTo(
        -15,
        10
    );

    ctx.quadraticCurveTo(
        0,
        30,
        15,
        10
    );

    ctx.lineTo(
        15,
        -13
    );

    ctx.stroke();


    /*
        Blue side
    */

    ctx.strokeStyle = magnet.polarity > 0
        ? "#315bce"
        : "#d6334c";

    ctx.beginPath();

    ctx.moveTo(
        15,
        -13
    );

    ctx.lineTo(
        15,
        10
    );

    ctx.stroke();


    ctx.lineCap =
        "butt";

    ctx.fillStyle = "#173d4d";

    ctx.font = "bold 10px Trebuchet MS";

    ctx.textAlign = "center";

    ctx.fillText(
        magnet.polarity > 0 ? "N" : "S",
        -15,
        -18
    );

    ctx.fillText(
        magnet.polarity > 0 ? "S" : "N",
        15,
        -18
    );

    ctx.textAlign = "start";


    ctx.restore();

}


/* =========================================================
   DRAW MAGNETIC OBJECTS
========================================================= */

function drawMagneticObjects() {

    magneticObjects.forEach(
        object => {

            const centerX = object.x;

            const centerY = object.y;


            /*
                Glow
            */

            ctx.beginPath();

            ctx.arc(
                centerX,
                centerY,
                object.radius + 9,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                "rgba(255,240,150,0.22)";

            ctx.fill();


            /*
                Object
            */

            ctx.beginPath();

            ctx.arc(
                centerX,
                centerY,
                object.radius,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                object.color;

            ctx.fill();

            ctx.strokeStyle =
                "#173d4d";

            ctx.lineWidth = 3;

            ctx.stroke();

            ctx.font = "bold 12px Trebuchet MS";

            ctx.textAlign = "center";

            ctx.textBaseline = "middle";

            ctx.fillStyle = "#173d4d";

            ctx.fillText(
                object.polarity > 0 ? "N" : "S",
                centerX,
                centerY
            );

            ctx.textAlign = "start";

            ctx.textBaseline = "alphabetic";


            /*
                Shine
            */

            ctx.beginPath();

            ctx.arc(
                centerX - 5,
                centerY - 6,
                4,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                "rgba(255,255,255,0.8)";

            ctx.fill();

        }
    );

}


function drawParticles() {

    for (const particle of particles) {

        ctx.globalAlpha = particle.life;

        ctx.fillStyle = particle.color;

        ctx.beginPath();

        ctx.arc(
            particle.x,
            particle.y,
            particle.radius * particle.life,
            0,
            Math.PI * 2
        );

        ctx.fill();

    }

    ctx.globalAlpha = 1;

}


/* =========================================================
   DRAW GOAL
========================================================= */

function drawGoal() {

    /*
        Pole
    */

    ctx.strokeStyle =
        "#173d4d";

    ctx.lineWidth = 5;

    ctx.beginPath();

    ctx.moveTo(
        goal.x,
        goal.y +
        goal.height
    );

    ctx.lineTo(
        goal.x,
        goal.y
    );

    ctx.stroke();


    /*
        Flag
    */

    ctx.beginPath();

    ctx.moveTo(
        goal.x,
        goal.y
    );

    ctx.lineTo(
        goal.x + 90,
        goal.y + 25
    );

    ctx.lineTo(
        goal.x,
        goal.y + 50
    );

    ctx.closePath();

    ctx.fillStyle =
        "#ff5268";

    ctx.fill();

    ctx.stroke();


    /*
        Goal text
    */

    ctx.font =
        "bold 30px Trebuchet MS";

    ctx.fillStyle =
        "#173d4d";

    ctx.fillText(
        "GOAL",
        goal.x - 10,
        goal.y - 20
    );

}


/* =========================================================
   PLAYER IMAGE
========================================================= */

const playerImage =
    new Image();

playerImage.src =
    "assets/SkyMagnet_Nomal-removebg-preview.png";


/* =========================================================
   DRAW PLAYER
========================================================= */

function drawPlayer() {

    /*
        Shadow
    */

    ctx.beginPath();

    ctx.ellipse(
        player.x +
        player.width / 2,

        player.y +
        player.height +
        5,

        player.width * 0.42,

        8,

        0,

        0,

        Math.PI * 2
    );

    ctx.fillStyle =
        "rgba(23,61,77,0.18)";

    ctx.fill();


    /*
        Player
    */

    if (
        playerImage.complete &&
        playerImage.naturalWidth > 0
    ) {

        ctx.drawImage(
            playerImage,

            player.x,
            player.y,

            player.width,
            player.height
        );

    } else {

        ctx.fillStyle =
            "#63dbe4";

        ctx.fillRect(
            player.x,
            player.y,
            player.width,
            player.height
        );

        ctx.strokeStyle =
            "#173d4d";

        ctx.lineWidth = 3;

        ctx.strokeRect(
            player.x,
            player.y,
            player.width,
            player.height
        );

    }

}


/* =========================================================
   DRAW
========================================================= */

function draw() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
        背景
    */

    drawGameBackground();


    /*
        Ground
    */

    const groundGradient =
        ctx.createLinearGradient(
            0,
            WORLD.groundY,
            0,
            canvas.height
        );

    groundGradient.addColorStop(
        0,
        "#dff8e9"
    );

    groundGradient.addColorStop(
        1,
        "#a8d8c1"
    );


    ctx.fillStyle =
        groundGradient;

    let groundStart = 0;

    for (const pit of pits) {

        const pitStart = Math.max(0, pit.x);
        const pitEnd = Math.min(canvas.width, pit.x + pit.width);

        if (pitStart > groundStart) {

            ctx.fillRect(
                groundStart,
                WORLD.groundY,
                pitStart - groundStart,
                canvas.height - WORLD.groundY
            );

        }

        ctx.fillStyle = "#173d4d";

        ctx.fillRect(
            pitStart,
            WORLD.groundY,
            pitEnd - pitStart,
            canvas.height - WORLD.groundY
        );

        ctx.fillStyle = groundGradient;

        groundStart = pitEnd;

    }


    if (groundStart < canvas.width) {

        ctx.fillRect(
            groundStart,
            WORLD.groundY,
            canvas.width - groundStart,
            canvas.height - WORLD.groundY
        );

    }


    ctx.strokeStyle =
        "#173d4d";

    ctx.lineWidth = 5;

    let groundLineStart = 0;

    for (const pit of pits) {

        ctx.beginPath();

        ctx.moveTo(groundLineStart, WORLD.groundY);

        ctx.lineTo(Math.max(groundLineStart, pit.x), WORLD.groundY);

        ctx.stroke();

        groundLineStart = Math.min(
            canvas.width,
            pit.x + pit.width
        );

    }

    ctx.beginPath();

    ctx.moveTo(groundLineStart, WORLD.groundY);

    ctx.lineTo(canvas.width, WORLD.groundY);

    ctx.stroke();


    /*
        Obstacles
    */

    drawObstacles();


    /*
        Fixed magnets
    */

    drawMagnets();


    /*
        Magnetic objects
    */

    drawMagneticObjects();

    drawParticles();


    /*
        Goal
    */

    drawGoal();


    /*
        Player
    */

    drawPlayer();

}


/* =========================================================
   GAME LOOP
========================================================= */

function gameLoop() {

    gameLoopRequest = null;

    if (!gameRunning) {
        return;
    }

    update();
    draw();

    if (gameRunning) {
        gameLoopRequest = requestAnimationFrame(gameLoop);
    }

}


/* =========================================================
   INITIALIZE
========================================================= */

showScreen("home");

updateJumpChargeUI();

updateStageSelect();