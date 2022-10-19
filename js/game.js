class Points {

    hits;
    bugs;
    lives;
    startTime;
    score;
    #labelHits;
    #labelLives;
    #heart;

    constructor(scene) {
        this.#labelHits = scene.add.bitmapText(20, 10, "font", "");
        this.#labelLives = scene.add.bitmapText(680, 10, "font", "");
        this.#heart = scene.add.image(650, 30, "heart");
        this.#heart.setScale(3);
        this.resetScore();
    }

    addHit() {
        this.hits += 1;
        this.#updateLabel();
    }

    addBugs(inc) {
        this.bugs += inc;
        this.#updateLabel();
    }

    removeLife() {
        if (this.lives > 0) {
            this.lives -= 1;
            this.#updateLabel();
        }
    }

    computeScore() {
        const elapsed = (Date.now() - this.startTime) / 1000;
        // the score calculation tries to takes into account
        // - the play time
        // - how many bugs you've killed
        // - how many successfully went across the screen
        const score = (elapsed * this.hits) / Math.max(this.bugs, 1);
        console.log("score", score, "elapsed", elapsed, "bugs", Math.min(this.bugs, 1));
        return Math.floor(score);
    }

    #updateLabel() {
        this.#labelHits.setText(`Hits: ${this.hits} `);
        this.#labelLives.setText(`${this.lives}`);
    }

    resetScore() {
        this.hits = 0;
        this.bugs = 0;
        this.lives = 5;
        this.startTime = Date.now();

        this.#updateLabel()
    }

}

class Bullet extends Phaser.Physics.Arcade.Image {
    constructor(scene, x, y, texture) {
        super(scene, x, y, texture);
    }

    fire(x, y) {
        this.body.reset(x, y);

        this.setActive(true);
        this.setVisible(true);

        this.setVelocityY(-300);
    }

    preUpdate(time, delta) {
        if (this.y <= -32) {
            this.kill();
        }
    }

    kill() {
        this.setActive(false);
        this.setVisible(false);
        // work around an issue that inactive objects still cause collisions
        this.body.reset(0, 0);
    }
}

class Bullets extends Phaser.Physics.Arcade.Group {
    constructor(scene) {
        super(scene.physics.world, scene);

        this.createMultiple({
            frameQuantity: 5,
            key: 'bullet',
            active: false,
            visible: false,
            classType: Bullet,
        }).forEach(b => {
            b.setScale(4);
        });
    }

    fireBullet(x, y) {
        let bullet = this.getFirstDead(false);

        if (bullet) {
            bullet.fire(x, y);
        }
    }
}

class Target extends Phaser.Physics.Arcade.Sprite {
    #points;

    constructor(scene, x, y, texture, frame) {
        super(scene, x, y, texture, frame);
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);

        if (this.y >= this.scene.physics.world.bounds.height) {
            this.kill();
            this.#points.addBugs(1);
        }
    }

    kill() {
        this.setActive(false);
        this.setVisible(false);
        this.destroy();
    }

    set points(points) {
        this.#points = points;
    }
}

class Targets extends Phaser.Physics.Arcade.Group {
    #points;

    constructor(scene, points) {
        super(scene.physics.world, scene);
        this.#points = points;
        this.classType = Target;
    }

    spawn(x, y) {
        const target = this.create(x, y);
        target.points = this.#points;
        target.setSize(34, 20, false); // fix collision box
        target.setScale(2);
        target.setVelocityY(150);
        target.play("bugs");
    }
}

class GetReady extends Phaser.Scene {
    #ble;

    constructor(ble) {
        super("GetReady");
        this.#ble = ble;
    }

    preload() {
        this.load.setBaseURL("https://labs.phaser.io");
        this.load.bitmapFont("font", "assets/fonts/bitmap/carrier_command.png", "assets/fonts/bitmap/carrier_command.xml");
    }

    init() {
        this.#ble.externalizeEvents = {
            onButton: (button) => this.#onButton(button),
        };
    }

    create() {

        const screenCenterX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.worldView.y + this.cameras.main.height / 2;

        const text = this.add.bitmapText(
            screenCenterX, screenCenterY,
            "font",
            "Press A to start",
            30
        ).setOrigin(0.5);

        this.tweens.add({
            targets: text,
            duration: 750,
            ease: "Linear",
            alpha: 0,
            repeat: -1,
            delay: 0,
            yoyo: true
        })
    }

    #onButton(button) {
        if (button === "a") {
            this.scene.start("Main");
        }
    }
}

class MainScene extends Phaser.Scene {
    #ship;
    #ble;

    maxTargets = 4;

    constructor(ble) {
        super("Main");
        this.#ble = ble;
    }

    preload() {
        this.load.image("ship", new URL("assets/ferris.png", document.baseURI).href);
        this.load.image("bullet", new URL("assets/bullet1.png", document.baseURI).href);
        this.load.image("heart", new URL("assets/heart.png", document.baseURI).href);
        this.load.spritesheet("target", new URL("assets/bugs1.png", document.baseURI).href, {
            frameWidth: 34, frameHeight: 20
        });
        this.load.setBaseURL("https://labs.phaser.io");
        this.load.bitmapFont("font", "assets/fonts/bitmap/carrier_command.png", "assets/fonts/bitmap/carrier_command.xml");
    }

    create() {
        this.physics.world.setBoundsCollision(true, true, true, true);

        const sx = this.physics.world.bounds.width / 2;
        const sy = this.physics.world.bounds.height - 50;

        this.#ship = this.physics.add.image(sx, sy, "ship");
        this.#ship.setScale(4);
        this.#ship.setCollideWorldBounds(true);

        this.anims.create({
            key: "bugs",
            frames: "target",
            frameRate: 3,
            repeat: -1
        });

        this.points = new Points(this);

        this.bullets = new Bullets(this);
        this.targets = new Targets(this, this.points);
        this.physics.add.collider(
            this.bullets,
            this.targets,
            (bullet, target) => {
                bullet.kill();
                target.kill();
                this.points.addHit();
            },
        );
        this.physics.add.collider(
            this.#ship,
            this.targets,
            (o1, o2) => {
            },
            (o1, o2) => {
                if (o1 instanceof Target) {
                    o1.kill();
                }
                if (o2 instanceof Target) {
                    o2.kill();
                }
                this.points.addBugs(5);
                this.points.removeLife();
                this.checkGameOver();
                return false;
            }
        );

        this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                this.checkSpawn();
            }
        });


        this.#ble.externalizeEvents = {
            onButton: (button) => this.#onButton(button),
        };

    }

    fire() {
        const sx = this.#ship.body.x + this.#ship.body.width / 2;
        const sy = this.#ship.body.y;

        this.bullets.fireBullet(sx, sy);
    }

    spawn() {
        const start = this.physics.world.bounds.width * Math.random() * 0.8;
        this.targets.spawn(start, 100);
    }

    checkSpawn() {
        const num = this.targets.getLength();
        const difficulty = this.difficulty();
        if (num < (this.maxTargets + difficulty)) {
            // increase spawnrate as difficulty goes
            if (Math.random() < (0.75 + (difficulty / 100))) {
                this.spawn();
            }
        }
    }

    // every 10 s, the game gets harder by adding a bug
    difficulty() {
        const secondsElapsed = (Date.now() - this.points.startTime) / 1000
        return Math.floor(secondsElapsed / 10)
    }

    #onButton(button) {
        if (button === "a") {
            this.fire();
        } else if (button === "b") {
            this.gameOver();
        }
    }

    update() {
        super.update();

        const a = this.#ble.acceleration;

        if (a?.x !== undefined) {
            this.#ship.setVelocityX(a.x / 2.0);
        }
    }

    checkGameOver() {
        if (this.points.lives <= 0) {
            this.gameOver();
        }
    }

    gameOver() {
        // check if game was already over to avoid scrambling the display
        const score = this.points.computeScore();
        console.log("Game over! Score:", score);

        // fixme allow user to input username !
        // publishScore("boothUser", score);

        this.scene.start("GameOver", {
            score
        });
    }
}

class GameOver extends Phaser.Scene {
    #ble;
    #score;

    constructor(ble) {
        super("GameOver");
        this.#ble = ble;
    }

    init() {
        this.#ble.externalizeEvents = {
            onButton: (button) => this.#onButton(button),
        };
    }

    preload() {
        this.load.setBaseURL("https://labs.phaser.io");
        this.load.bitmapFont("font", "assets/fonts/bitmap/carrier_command.png", "assets/fonts/bitmap/carrier_command.xml");
    }

    create(data) {
        this.#score = data.score;

        const screenCenterX = this.cameras.main.worldView.x + this.cameras.main.width / 2;
        const screenCenterY = this.cameras.main.worldView.y + this.cameras.main.height / 2;

        this.add.bitmapText(
            screenCenterX, 180,
            "font",
            "Game Over!",
            40
        ).setOrigin(0.5);

        this.add.bitmapText(
            screenCenterX, 330,
            "font",
            `Score: ${this.#score}`,
            30
        ).setOrigin(0.5);

        const text = this.add.bitmapText(
            screenCenterX, 420,
            "font",
            "Press A to start",
            30
        ).setOrigin(0.5);

        this.tweens.add({
            targets: text,
            duration: 750,
            ease: "Linear",
            alpha: 0,
            repeat: -1,
            delay: 0,
            yoyo: true
        })
    }

    #onButton(button) {
        if (button === "a") {
            this.scene.start("GetReady");
        }
    }
}

class Game {

    #config;
    #ble;

    #disposed;
    #game;

    constructor(ble, config) {
        this.#ble = ble;
        this.#config = config || {};

        console.log("Start demo");
        this.#init();
    }

    #init() {
        const config = {
            ...{
                type: Phaser.AUTO,
                parent: "game",
                pixelArt: true,
                physics: {
                    default: 'arcade',
                    arcade: {
                        debug: false,
                    }
                },
                scene: [
                    new GetReady(this.#ble),
                    new MainScene(this.#ble),
                    new GameOver(this.#ble)
                ],
            }, ...this.#config
        };
        console.info("Game config", config);
        this.#game = new Phaser.Game(config);
    }

    dispose() {
        this.#disposed = true;
        this.#ble.externalizeEvents = undefined;
        console.log("End demo");
        this.#game.destroy({
            removeCanvas: false
        });
    }
}
