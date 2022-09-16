const asciidoctor = require('@asciidoctor/core')();
const asciidoctorRevealjs = require('@asciidoctor/reveal.js');
asciidoctorRevealjs.register()

asciidoctor.convertFile('index.adoc', {
    safe: 'safe', backend: 'revealjs'
})
