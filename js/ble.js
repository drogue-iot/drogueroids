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
const DFU_OFFSET_CHAR = "00001005-b0cd-11ec-871f-d45ddf138840";
const DFU_VERSION_CHAR = "00001001-b0cd-11ec-871f-d45ddf138840";

const ACCEL_SERVICE = "a2c21ba5-a2fa-455b-8e02-bcfca3e2ed64";
const DATA_CHAR = "ba080c41-b7e0-4a4a-9bfd-98a7c4c87deb";

class BleConnector {

    #device;
    #state;
    #lastPresses;
    #reconnectTimer;

    active = false;

    onButton = (button) => {
    };

    constructor() {
    }

    /**
     * Connect to device. Must be called from a user-guesture context.
     *
     * @returns {Promise<void>}
     */
    async connect() {

        const device = await navigator.bluetooth.requestDevice({
            filters: [
                {name: "Drogue Presenter"}
            ],
            optionalServices: [
                BUTTONS_SERVICE,
                ACCEL_SERVICE
            ],
        });
        this.active = true;
        console.log("Got device:", device);
        this.#device = device;
        device.addEventListener("gattserverdisconnected", () => this.#onDisconnected());

        try {
            await this.#reconnect();
        } catch (err) {
            console.log("Failed to setup connection", err);
            this.#onDisconnected(err);
        }

    }

    disconnect() {
        this.active = false;
        if (this.#device) {
            this.#device.gatt.disconnect();
        }
    }

    async #reconnect() {

        console.log("Reconnect", this.active);

        if (!this.active) {
            return;
        }

        try {
            const server = await this.#device.gatt.connect();
            console.info("Server connected:", server);

            const buttonsService = await server.getPrimaryService(BUTTONS_SERVICE);
            const presses = await buttonsService.getCharacteristic(PRESSES_CHAR);

            try {
                const initial = await presses.readValue();
                console.info("Initial data", initial);
            }
            catch (err) {
                console.warn("Failed to read initial data", err);
            }
            await new Promise(r => setTimeout(r, 500));

            await presses.stopNotifications();
            await presses.startNotifications();
            console.log("Buttons subscribed");

            const accelService = await server.getPrimaryService(ACCEL_SERVICE);
            const data = await accelService.getCharacteristic(DATA_CHAR);
            data.addEventListener('characteristicvaluechanged', (v) => {
                this.#scanButtons();
            });
            await data.stopNotifications();
            await data.startNotifications();
            console.log("Acceleration subscribed");

            this.#setState({
                server,
                buttons: {
                    service: buttonsService,
                    characteristics: {
                        presses,
                    }
                },
                acceleration: {
                    service: accelService,
                    characteristics: {
                        data,
                    }
                }
            });
        } catch (err) {
            this.#onDisconnected(err);
        }
    }

    #onDisconnected(reason) {
        console.log("Disconnected", reason, "active:", this.active);

        this.#state?.server?.disconnect();

        this.#state = undefined;

        // trigger reconnect if we are still active
        if (this.active) {
            // trigger reconnect if none is pending
            if (this.#reconnectTimer === undefined) {
                this.#reconnectTimer = window.setTimeout(() => {
                    this.#reconnectTimer = undefined;
                    return this.#reconnect();
                }, 500);
            }
        }
    }

    #setState(state) {
        this.#state = state;
    }

    #scanButtons() {
        const presses = this.presses;
        if (!presses) {
            console.debug("No presses");
            this.#lastPresses = undefined;
            return;
        }

        // console.debug("Checking - last:", this.#lastPresses, "new:", presses);

        if (!this.#lastPresses) {
            this.#lastPresses = presses;
            return;
        }

        if (this.#lastPresses.a !== presses.a) {
            // fire A
            this.#lastPresses.a = presses.a;
            console.debug("Pressed A");
            this.#fireButtonEvent('a');
        }
        if (this.#lastPresses.b !== presses.b) {
            // fire B
            this.#lastPresses.b = presses.b;
            console.debug("Pressed B");
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

    get acceleration() {
        const value = this.#state?.acceleration?.characteristics?.data?.value;

        try {
            return {
                x: value.getInt32(0, true),
                y: value.getInt32(4, true),
                z: value.getInt32(8, true),
            };
        } catch (err) {
            return null;
        }
    }

    get presses() {
        const value = this.#state?.buttons?.characteristics?.presses?.value;
        try {
            return {
                a: value.getUint16(0, true),
                b: value.getUint16(2, true)
            };
        } catch (err) {
            return null;
        }
    }

    get connected() {
        return this.#state?.server?.connected || false;
    }

}
