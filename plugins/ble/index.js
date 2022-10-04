/*
Copyright 2022 The Drogue IoT Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const ENV_SERVICE = "0000181a-0000-1000-8000-00805f9b34fb";
const TEMP_CHAR = "00002a1f-0000-1000-8000-00805f9b34fb";

const BUTTONS_SERVICE = "b44fabf6-35b2-11ed-883f-d45d6455d2cc";
const PRESSES_CHAR = "b4ad9022-35b2-11ed-a76a-d45d6455d2cc"

const DFU_SERVICE = "00001000-b0cd-11ec-871f-d45ddf138840";

const ACCEL_SERVICE = "a2c21ba5-a2fa-455b-8e02-bcfca3e2ed64";
const DATA_CHAR = "ba080c41-b7e0-4a4a-9bfd-98a7c4c87deb";

class BlePluginInstance {

    #device;
    #state;
    #injector;
    #buttonScanner;
    #lastPresses;
    #reconnectTimer;
    #slide;

    active = false;

    onButton = (button) => {
    };

    /**
     * Set to receive events on these callbacks, rather than controlling the presentation.
     */
    externalizeEvents;

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
                BUTTONS_SERVICE,
                DFU_SERVICE,
                ACCEL_SERVICE
            ],
        })
            .then((device) => {
                // only mark active after the user selected a device.
                this.active = true;
                console.log("Got device:", device);
                this.#device = device;
                device.addEventListener("gattserverdisconnected", () => this.#onDisconnected());
                return this.#reconnect();
            })
            .catch((err) => {
                console.log("Failed to setup connection", err);
                this.#onDisconnected(err);
            })
        ;
    }

    disconnect() {
        this.active = false;
        if (this.#device) {
            this.#device.gatt.disconnect();
        }
    }

    async #reconnect() {
        if (!this.active) {
            return;
        }

        return await this.#device.gatt.connect()
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
                            .then((state) => {
                                return server.getPrimaryService(ACCEL_SERVICE)
                                    .then((service) => {
                                        return service.getCharacteristic(DATA_CHAR)
                                            .then((c) => c.startNotifications())
                                            .then((c) => {
                                                console.log("Subscribed to acceleration");
                                                return {
                                                    ...state, ...{
                                                        acceleration: {
                                                            service,
                                                            characteristics: {
                                                                data: c,
                                                            }
                                                        }
                                                    }
                                                };
                                            })
                                    })
                            })
                    })
            })
            .then((state) => this.#setState(state));
    }

    #onDisconnected(reason) {
        console.log("Disconnected", reason);
        this.#state = undefined;
        if (this.#injector) {
            window.clearInterval(this.#injector);
            this.#injector = undefined;
        }
        if (this.#buttonScanner) {
            window.clearInterval(this.#buttonScanner);
            this.#buttonScanner = undefined;
        }

        // trigger reconnect if we are still active
        if (this.active) {
            // trigger reconnect if none is pending
            if (!this.#reconnectTimer) {
                this.#reconnectTimer = window.setTimeout(() => {
                    this.#reconnectTimer = null;
                    return this.#reconnect();

                }, 500);
            }
        }
    }

    #setState(state) {
        this.#state = state;
        this.#injector = window.setInterval(() => {
            this.#inject();
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
            this.#lastPresses = {a: 0, b: 0};
            return;
        }

        if (this.#lastPresses.a !== presses.a) {
            // fire A
            this.#lastPresses.a = presses.a;
            console.info("Pressed A");
            this.#fireButtonEvent('a');
        }
        if (this.#lastPresses.b !== presses.b) {
            // fire B
            this.#lastPresses.b = presses.b;
            console.info("Pressed B");
            this.#fireButtonEvent('b');
        }
    }

    #fireButtonEvent(button) {
        if (this.externalizeEvents) {
            this.externalizeEvents.onButton?.(button);
        } else {
            this.onButton?.(button);
        }
    }

    #inject() {
        console.debug(`State - temp: ${this.temperature}, a: ${this.presses?.a}, b: ${this.presses?.b}, accel:`, this.acceleration);

        const elements = document.querySelectorAll("[data-ble]");
        for (const element of elements) {
            switch (element.dataset.ble) {
                case "temperature": {
                    // noinspection JSPrimitiveTypeWrapperUsage
                    element.innerText = this.temperature;
                    break;
                }
                case "acceleration": {
                    // noinspection JSPrimitiveTypeWrapperUsage
                    element.innerText = JSON.stringify(this.acceleration);
                    break;
                }
            }
        }
    }

    get acceleration() {
        const value = this.#state?.acceleration?.characteristics?.data?.value;
        if (!(value instanceof DataView)) {
            return null;
        }

        return {
            x: value.getInt32(0, true),
            y: value.getInt32(4, true),
            z: value.getInt32(8, true),
        };
    }

    get temperature() {
        const value = this.#state?.env?.characteristics?.temperature?.value;
        if (!(value instanceof DataView)) {
            return null;
        }

        return value.getUint16(0, true);
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

    slideChanged(slide) {
        this.#slide = slide;
        // inject right now
        this.#inject();
    }
}

const BlePlugin = {
    id: 'ble',

    init: async (deck) => {
        const instance = new BlePluginInstance();
        instance.onButton = (button) => {
            console.debug("Button pressed:", button);
            if (button === "a") {
                deck.prev();
            } else if (button === "b") {
                deck.next();
            }
        };

        deck.getConfig().ble = instance;

        deck.addKeyBinding(
            {keyCode: 67, key: 'C', description: "Connect bluetooth"},
            () => {
                instance
                    .connect();
            }
        );

        deck.addEventListener("slidechanged", (event) => {
            instance.slideChanged(event.currentSlide);
        })
    },

}

