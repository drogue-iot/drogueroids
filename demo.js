class Points {

    hits;
    bugs;
    lives;
    start_time;
    score;
    #label_hits;
    #label_lives;
    #heart;

    constructor(scene) {
        this.#label_hits = scene.add.bitmapText(20, 10, "font", "");
        this.#label_lives = scene.add.bitmapText(680, 10, "font", "");
        this.resetScore();
        this.#heart = scene.add.image(650, 30, "heart");
        this.#heart.setScale(3);
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
        var elapsed = (Date.now() - this.start_time) / 1000;
        // the score calculation tries to takes into account
        // - the play time
        // - how many bugs you've killed
        // - how many successfully went accross the screen
        this.score = ( elapsed * this.hits ) / this.bugs;
        return Math.floor(this.score);
    }

    #updateLabel() {
        this.#label_hits.setText(`Hits: ${this.hits} `);
        this.#label_lives.setText(`${this.lives}`);
    }

    resetScore() {
        this.hits = 0;
        this.bugs = 0;
        this.lives = 10;
        this.start_time = Date.now();

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
        this.body.reset(0,0);
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

class DemoScene extends Phaser.Scene {
    #ship;
    #ble;

    maxTargets = 4;
    gameIsOver = false;

    #gameOverLabel;

    constructor(ble) {
        super();
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
        this.load.bitmapFont("font", "assets/fonts/bitmap/carrier_command.png", "assets/fonts/bitmap/carrier_command.xml")
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

        // hide the "Game Over" text until the game is actually over
        this.#gameOverLabel = this.add.bitmapText(40, 280, "font", ``, 40);
        this.#gameOverLabel.visible = false;

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
                this.checkGameOver(this.points);
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
        var difficulty = this.difficulty();
        if ( ! this.gameIsOver) {
            if (num < (this.maxTargets + difficulty)) {
                // increase spawnrate as difficulty goes
                if (Math.random() < (0.75+(difficulty/100))) {
                    this.spawn();
                }
            }
        }
    }

    // every 10 s, the game gets harder by adding a bug
    difficulty() {
        var secs_elapsed = (Date.now() - this.points.start_time) / 1000
        return Math.floor(secs_elapsed / 10)
    }

    #onButton(button) {
        if (button === "a") {
            this.fire();
        } else if (button === "b" && this.gameIsOver) {
            this.points.resetScore();
            this.#gameOverLabel.visible = false;
            this.gameIsOver = false;
        }
    }

    update() {
        super.update();

        const a = this.#ble.acceleration;

        if (a?.x !== undefined) {
            this.#ship.setVelocityX(a.x / 2.0);
        }
    }

    checkGameOver(points) {
        if (points.lives <= 0) {
            // fixme : find a way to delete the current targets
            this.gameOver(points);
            this.gameIsOver = true;
        }
    }

    gameOver(points) {
        // check if game was already over to avoid scrambling the display
       if (!this.gameIsOver) {
           let score = points.computeScore();
           this.#gameOverLabel.setText(`Game Over!\n\nScore: ${score} \n\nPress B to restart`);
           this.#gameOverLabel.visible = true;
           console.log("Game over ! Score: "+score);
       }
    }
}

class Demo {

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
                scene: new DemoScene(this.#ble),
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
