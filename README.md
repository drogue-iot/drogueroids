# Rust: Embedded, Async, all the way!

This is a talk about Rust on embedded (microcontroller) devices.

## Pre-reqs

* Enable the Web Bluetooth API ([chrome://flags/#enable-web-bluetooth](chrome://flags/#enable-web-bluetooth))
* Install node dependencies : `npm install`
* Install a local webserver (e.g `miniserve`)
  ```shell
  cargo install miniserve
  ```

## Run

Serve the files locally:

```shell
miniserve .
```

Then:

* Power on the presenter
* Open http://localhost:8080/index.html
* Press `c` to connect to the presenter
* Press `s` for the speaker notes
* Press `F11` to go fullscreen
