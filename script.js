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
    clear: document.getElementById("clearScreen")
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
        obstacles: [
            { x: 430, y: 470, width: 70, height: 130 }
        ],
        magnets: [
            { x: 465, y: 445, radius: 260, strength: 0.9 }
        ],
        magneticObjects: [
            { x: 650, y: 300, radius: 15, mass: 1, color: "#f5b942" }
        ]
    },

    2: {
        goal: { x: 1120, y: 400, width: 20, height: 200 },
        obstacles: [
            { x: 350, y: 420, width: 70, height: 180 },
            { x: 700, y: 350, width: 70, height: 250 }
        ],
        magnets: [
            { x: 520, y: 330, radius: 360, strength: 0.75 },
            { x: 900, y: 300, radius: 360, strength: 0.75 }
        ],
        magneticObjects: [
            { x: 570, y: 190, radius: 15, mass: 1, color: "#ff7c66" },
            { x: 970, y: 200, radius: 15, mass: 1, color: "#9b8cff" }
        ]
    },

    3: {
        goal: { x: 1080, y: 350, width: 20, height: 250 },
        obstacles: [
            { x: 300, y: 460, width: 70, height: 140 },
            { x: 550, y: 350, width: 70, height: 250 },
            { x: 820, y: 430, width: 70, height: 170 }
        ],
        magnets: [
            { x: 460, y: 390, radius: 360, strength: 0.8 },
            { x: 930, y: 370, radius: 360, strength: 0.8 }
        ],
        magneticObjects: [
            { x: 400, y: 260, radius: 15, mass: 1, color: "#f5b942" },
            { x: 1000, y: 240, radius: 15, mass: 1, color: "#ff7c66" }
        ]
    },

    4: {
        goal: { x: 1120, y: 420, width: 20, height: 180 },
        obstacles: [
            { x: 280, y: 400, width: 70, height: 200 },
            { x: 500, y: 470, width: 70, height: 130 },
            { x: 700, y: 350, width: 70, height: 250 },
            { x: 920, y: 450, width: 70, height: 150 }
        ],
        magnets: [
            { x: 430, y: 330, radius: 350, strength: 0.75 },
            { x: 820, y: 300, radius: 370, strength: 0.85 }
        ],
        magneticObjects: [
            { x: 430, y: 230, radius: 15, mass: 1, color: "#9b8cff" },
            { x: 850, y: 190, radius: 15, mass: 1, color: "#f5b942" }
        ]
    },

    5: {
        goal: { x: 1080, y: 380, width: 20, height: 220 },
        obstacles: [
            { x: 280, y: 350, width: 70, height: 250 },
            { x: 500, y: 450, width: 70, height: 150 },
            { x: 720, y: 350, width: 70, height: 250 },
            { x: 940, y: 430, width: 70, height: 170 }
        ],
        magnets: [
            { x: 420, y: 300, radius: 370, strength: 0.85 },
            { x: 850, y: 280, radius: 390, strength: 1.2 }
        ],
        magneticObjects: [
            { x: 420, y: 200, radius: 15, mass: 1, color: "#ff7c66" },
            { x: 920, y: 180, radius: 15, mass: 1, color: "#9b8cff" }
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
    i <= 20;
    i++
) {

    const button =
        document.createElement(
            "button"
        );

    button.className =
        "stage-button";

    button.textContent =
        i;

    button.addEventListener(
        "click",
        () => loadStage(i)
    );

    stageGrid.appendChild(
        button
    );

}


/* =========================================================
   LOAD STAGE
========================================================= */

function loadStage(stageNumber) {

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


    /*
        Stage 6～20は後で個別設計する。
        現段階では既存データをベースに仮配置する。
    */

    const baseStage =
        ((stageNumber - 1) % 5) + 1;


    const stage =
        stageData[baseStage];


    obstacles =
        stage.obstacles.map(
            obstacle => ({ ...obstacle })
        );

    magnets =
        stage.magnets.map(
            magnet => ({ ...magnet })
        );

    magneticObjects =
        stage.magneticObjects.map(
            object => ({ ...object })
        );

    goal = { ...stage.goal };


    /*
        Stage 6～20の正式な構成は未確定。
        個別ステージを作るまで仮配置を使用する。
    */

    const cycle =
        Math.floor(
            (stageNumber - 1) / 5
        );


    if (cycle > 0) {

        obstacles =
            obstacles.map(
                (obstacle, index) => {

                    const shift =
                        ((cycle * 37) +
                        (index * 19)) % 70;

                    return {

                        ...obstacle,

                        x:
                            Math.min(
                                obstacle.x + shift,
                                1080
                            )

                    };

                }
            );

    }


    resetPlayer();

    stageCleared = false;

    gameRunning = true;

    jumpCharging = false;

    jumpChargeRatio = 0;

    updateJumpChargeUI();

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
        currentStage
    );

}


/* =========================================================
   NEXT STAGE
========================================================= */

function nextStage() {

    if (currentStage < 20) {

        currentStage++;

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

    checkGoal();

}


function applyMagneticForce(target, targetX, targetY) {

    let nearestMagnet = null;

    let nearestDistance = Infinity;

    for (const magnet of magnets) {

        const dx = magnet.x - targetX;

        const dy = magnet.y - targetY;

        const distance = Math.hypot(dx, dy);

        if (
            distance < magnet.radius &&
            distance < nearestDistance
        ) {

            nearestMagnet = magnet;

            nearestDistance = distance;

        }

    }


    if (!nearestMagnet || nearestDistance <= 0) {

        return false;

    }


    const force =
        nearestMagnet.strength *
        (1 - nearestDistance / nearestMagnet.radius) /
        (target.mass || 1);

    target.vx +=
        (nearestMagnet.x - targetX) /
        nearestDistance * force;

    target.vy +=
        (nearestMagnet.y - targetY) /
        nearestDistance * force;

    return true;

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


    applyMagneticForce(
        player,
        player.x + player.width / 2,
        player.y + player.height / 2
    );


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


    if (
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


    /*
        落下時は自動で初期位置へ戻さない。
        死亡・リトライの仕様は別途実装する。
    */

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

    stopGameLoop();

    jumpCharging = false;

    jumpChargeRatio = 0;

    updateJumpChargeUI();


    document.getElementById(
        "clearStageText"
    ).textContent =
        `STAGE ${currentStage} CLEAR!`;


    showScreen("clear");

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

    ctx.strokeStyle =
        "#d6334c";

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

    ctx.strokeStyle =
        "#315bce";

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

    ctx.fillRect(
        0,
        WORLD.groundY,
        canvas.width,
        canvas.height -
        WORLD.groundY
    );


    ctx.strokeStyle =
        "#173d4d";

    ctx.lineWidth = 5;

    ctx.beginPath();

    ctx.moveTo(
        0,
        WORLD.groundY
    );

    ctx.lineTo(
        canvas.width,
        WORLD.groundY
    );

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