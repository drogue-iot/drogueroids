class DemoScene extends Phaser.Scene {
    #ship;
    #ble;
    #move = 0;
    #targets = [];

    maxTargets = 4;

    #counter = 0;

    constructor(ble) {
        super();
        this.#ble = ble;
    }

    preload() {
        this.load.setBaseURL('https://labs.phaser.io');
        //this.load.image('sky', 'assets/skies/space3.png');
        this.load.image('ship', 'assets/sprites/fmship.png');
        this.load.image('ufo', 'assets/sprites/ufo.png');
    }

    create() {
        //this.cameras.main.setBounds(0, 0, 1024, 2048);

        this.physics.world.setBoundsCollision(false, false, false, true);
        this.physics.world.on("worldbounds", (body) => {
            console.log("worldbounds", body);
            this.removeTarget(body);
        });

        this.cursors = this.input.keyboard.createCursorKeys();

        this.#ship = this.physics.add.image(300, 300, 'ship');
        this.#ship.scaleX = 4;
        this.#ship.scaleY = 4;

        this.#ble.externalizeEvents = {
            onButton: (button) => {
                console.log("Button", button);
                if (button === "a") {
                    this.#move -= 1;
                } else {
                    this.#move += 1;
                }
                console.log("Move", this.#move);
            }
        };

        this.time.addEvent({
            delay: 2000,
            loop: true,
            callback: () => {
                this.checkSpawn();
            }
        })
    }

    spawn() {
        let start = this.physics.world.bounds.width / 2 + ((Math.random() - 0.5) * this.physics.world.bounds.width / 4);
        const target = this.physics.add.image(start, 0, 'ufo');
        target.scaleX = 4;
        target.scaleY = 4;
        target.setVelocityY(200);

        target.setCollideWorldBounds(true);
        target.body.onWorldBounds = true;

        target.id = this.#counter;
        this.#counter += 1;

        console.log("Spawned", target);

        this.#targets.push(target);
    }

    checkSpawn() {
        console.log("Check spawn", this.#targets.length);
        if (this.#targets.length < this.maxTargets) {
            if (Math.random() < 0.05) {
                this.spawn();
            }
        }
    }

    removeTarget(target) {
        this.#targets = this.#targets.filter((ele)=> {
            return ele.id !== target.gameObject.id;
        });
        target.gameObject.destroy();
    }

    update() {

        this.checkSpawn();

        this.#ship.setVelocity(0);

        if (this.#move < 0) {
            this.#ship.setAngle(-90).setVelocityX(-200);
        } else if (this.#move > 0) {
            this.#ship.setAngle(90).setVelocityX(200);
        } else {
            this.#ship.setAngle(0).setVelocityX(0);
        }

        if (this.cursors.left.isDown) {
            this.#ship.setAngle(-90).setVelocityX(-200);
        } else if (this.cursors.right.isDown) {
            this.#ship.setAngle(90).setVelocityX(200);
        }

        if (this.cursors.up.isDown) {
            this.#ship.setAngle(0).setVelocityY(-200);
        } else if (this.cursors.down.isDown) {
            this.#ship.setAngle(-180).setVelocityY(200);
        }
    }
}

class Demo {
    #target;
    #disposed;
    #game;
    #ble;

    constructor(target) {
        this.#target = target;

        console.log("Start demo");
        this.#init();
    }

    #init() {
        this.#ble = Reveal.getConfig().ble;
        this.#game = new Phaser.Game({
            type: Phaser.AUTO,
            //canvas: this.#target,
            parent: "demo",
            pixelArt: true,
            physics: {
                default: 'arcade',
            },
            scene: new DemoScene(this.#ble),
        });
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
