const ENV_SERVICE = "0000181a-0000-1000-8000-00805f9b34fb";
const TEMP_CHAR = "00002a1f-0000-1000-8000-00805f9b34fb";

const BUTTONS_SERVICE = "b44fabf6-35b2-11ed-883f-d45d6455d2cc";
const PRESSES_CHAR = "b4ad9022-35b2-11ed-a76a-d45d6455d2cc"

class BlePluginInstance {

    #state;
    #logger;
    #buttonScanner;
    #lastPresses;

    onButton = (button) => {
    };

    /**
     * Connect to device. Must be called from a user-guesture context.
     *
     * @returns {Promise<void>}
     */
    async connect() {
        await navigator.bluetooth.requestDevice({
            filters: [
                {name: "Drogue Presenter"}
            ],
            optionalServices: [
                ENV_SERVICE,
                BUTTONS_SERVICE
            ],
        })
            .then((device) => {
                console.log("Got device:", device);
                device.addEventListener("gattserverdisconnected", () => this.#onDisconnected());
                return device.gatt.connect();
            })
            .then((server) => {
                console.info("Server connected:", server);
                return server.getPrimaryService(ENV_SERVICE)
                    .then((service) => {
                        return service.getCharacteristic(TEMP_CHAR)
                            .then((c) => c.startNotifications())
                            .then((c) => {
                                console.log("Subscribed to temperature");
                                return {
                                    env: {
                                        service, characteristics: {
                                            temperature: c,
                                        }
                                    }
                                }
                            })
                            .then((state) => {
                                return server.getPrimaryService(BUTTONS_SERVICE)
                                    .then((service) => {
                                        return service.getCharacteristic(PRESSES_CHAR)
                                            .then((c) => c.startNotifications())
                                            .then((c) => {
                                                console.log("Subscribed to buttons");
                                                return {
                                                    ...state, ...{
                                                        buttons: {
                                                            service,
                                                            characteristics: {
                                                                presses: c,
                                                            }
                                                        }
                                                    }
                                                };
                                            })
                                    })
                            })
                    })
            })
            .then((state) => this.#setState(state))
            .catch((err) => {
                console.log("Failed to setup connection", err);
                this.#onDisconnected(err);
            })
        ;
    }

    #onDisconnected(reason) {
        console.log("Disconnected", reason);
        this.#state = undefined;
        if (this.#logger) {
            window.clearInterval(this.#logger);
            this.#logger = undefined;
        }
        if (this.#buttonScanner) {
            window.clearInterval(this.#buttonScanner);
            this.#buttonScanner = undefined;
        }
    }

    #setState(state) {
        this.#state = state;
        this.#logger = window.setInterval(() => {
            this.#log();
        }, 1000);
        this.#buttonScanner = window.setInterval(() => {
            this.#scanButtons();
        }, 100);
    }

    #scanButtons() {
        const presses = this.presses;
        if (!presses) {
            console.debug("No presses");
            this.#lastPresses = undefined;
            return;
        }

        console.debug("Checking - last:", this.#lastPresses, "new:", presses);

        if (!this.#lastPresses) {
            this.#lastPresses = presses;
            return;
        }

        if (this.#lastPresses.a !== presses.a) {
            // fire A
            this.#lastPresses.a = presses.a;
            console.info("Pressed A");
            this.onButton?.('a');
        }
        if (this.#lastPresses.b !== presses.b) {
            // fire B
            this.#lastPresses.b = presses.b;
            console.info("Pressed B");
            this.onButton?.('b');
        }
    }

    #log() {
        const presses = this.presses;
        console.log(`State - temp: ${this.temperature}, a: ${presses.a}, b: ${presses.b}`);
    }

    get temperature() {
        const value = this.#state?.env?.characteristics?.temperature?.value;
        if (!(value instanceof DataView)) {
            return null;
        }

        return value.getUint16(0, true) / 10;
    }

    get presses() {
        const value = this.#state?.buttons?.characteristics?.presses?.value;
        if (!(value instanceof DataView)) {
            return null;
        }

        return {
            a: value.getUint8(0),
            b: value.getUint8(1)
        };
    }

}

const BlePlugin = {
    id: 'ble',

    init: async (deck) => {
        const instance = new BlePluginInstance();
        instance.onButton = (button) => {
            console.log("Button pressed:", button);
            if (button === "a") {
                deck.left();
            } else if (button === "b") {
                deck.right();
            }
        };

        deck.addKeyBinding(
            {keyCode: 67, key: 'C', description: "Connect bluetooth"},
            () => {
                instance
                    .connect();
            }
        )
    },

}
