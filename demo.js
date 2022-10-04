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
            classType: Bullet
        });
    }

    fireBullet(x, y) {
        let bullet = this.getFirstDead(false);

        if (bullet) {
            bullet.fire(x, y);
        }
    }
}

class Target extends Phaser.Physics.Arcade.Image {
    constructor(scene, x, y, texture) {
        super(scene, x, y, texture);
    }

    preUpdate(time, delta) {
        if (this.y >= this.scene.physics.world.bounds.height) {
            this.kill();
        }
    }

    kill() {
        this.setActive(false);
        this.setVisible(false);
        this.destroy();
    }
}

class Targets extends Phaser.Physics.Arcade.Group {
    constructor(scene) {
        super(scene.physics.world, scene);
        this.classType = Target;
    }

    spawn(x, y) {
        const target = this.create(x, y, "ufo");
        target.scaleX = 4;
        target.scaleY = 4;
        target.setVelocityY(200);
    }
}

class DemoScene extends Phaser.Scene {
    #ship;
    #ble;

    maxTargets = 4;

    constructor(ble) {
        super();
        this.#ble = ble;
    }

    preload() {
        this.load.setBaseURL('https://labs.phaser.io');
        //this.load.image('sky', 'assets/skies/space3.png');
        this.load.image('ship', 'assets/sprites/fmship.png');
        this.load.image('ufo', 'assets/sprites/ufo.png');
        this.load.image('bullet', 'assets/sprites/crate32.png');
    }

    create() {
        //this.physics.world.setBounds(0, 0, 400, 300);
        this.physics.world.setBoundsCollision(true, true, true, true);

        const sx = this.physics.world.bounds.width / 2;
        const sy = this.physics.world.bounds.height - 200;

        this.#ship = this.physics.add.image(sx, sy, 'ship');
        this.#ship.scaleX = 4;
        this.#ship.scaleY = 4;
        this.#ship.setCollideWorldBounds(true);

        this.#ble.externalizeEvents = {
            onButton: (button) => this.#onButton(button),
        };

        this.bullets = new Bullets(this);
        this.targets = new Targets(this);
        this.physics.add.collider(
            this.bullets,
            this.targets,
            (bullet, target) => {
                bullet.kill();
                target.kill();
            },
        )

        this.time.addEvent({
            delay: 1000,
            loop: true,
            callback: () => {
                this.checkSpawn();
            }
        })
    }

    fire() {
        const sx = this.#ship.body.x + this.#ship.body.width / 2;
        const sy = this.#ship.body.y;

        this.bullets.fireBullet(sx, sy);
    }

    spawn() {
        let start = this.physics.world.bounds.width * Math.random() * 0.8;

        this.targets.spawn(start, 100);
    }

    checkSpawn() {
        const num = this.targets.getLength();
        //console.debug("Check spawn", num);
        if (num < this.maxTargets) {
            if (Math.random() < 0.75) {
                this.spawn();
            }
        }
    }

    #onButton(button) {
        if (button === "a") {
            this.fire();
        }
    }

    update() {

        const a = this.#ble.acceleration;

        if (a !== null) {
            this.#ship.setVelocityX(a.x / 2.0);
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
