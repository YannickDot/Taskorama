!function(n,t){"object"==typeof exports&&"object"==typeof module?module.exports=t():"function"==typeof define&&define.amd?define("taskorama",[],t):"object"==typeof exports?exports.taskorama=t():n.taskorama=t()}(this,function(){return function(n){function t(e){if(r[e])return r[e].exports;var u=r[e]={i:e,l:!1,exports:{}};return n[e].call(u.exports,u,u.exports,t),u.l=!0,u.exports}var r={};return t.m=n,t.c=r,t.i=function(n){return n},t.d=function(n,r,e){t.o(n,r)||Object.defineProperty(n,r,{configurable:!1,enumerable:!0,get:e})},t.n=function(n){var r=n&&n.__esModule?function(){return n.default}:function(){return n};return t.d(r,"a",r),r},t.o=function(n,t){return Object.prototype.hasOwnProperty.call(n,t)},t.p="",t(t.s=2)}([function(n,t,r){"use strict";function e(n){return Object.freeze({_isTask:!0,map:o,ap:c,chain:u,flatMap:u,then:f,fork:i(n),run:function(t){return n(t,console.error)}})}function u(n){var t=this,r=e(function(r,u){var o=void 0,c=t.fork(u,function(t){try{var c=n(t)||e.of(void 0),f=c.fork(u,r);return o=f.cancel,{cancel:f.cancel}}catch(n){u(n)}}),f=function(){o&&o(),c.cancel()};return{cancel:f}});return r}function o(n){var t=this,r=e(function(r,e){var u=t.fork(e,function(t){try{var u=n(t);r(u)}catch(n){e(n)}});return u});return r}function c(n){var t=this,r=e(function(r,e){var u=t.fork(e,function(t){try{n.fork(e,function(n){try{var u=n(t);r(u)}catch(n){e(n)}})}catch(n){e(n)}});return u});return r}function f(n){var t=this,r=e(function(r,u){var o=void 0,c=t.fork(u,function(t){try{var c=n(t)||e.of(void 0),f=void 0;f=c._isTask?c:e.of(c);var i=f.fork(u,r);return o=i.cancel,{cancel:i.cancel}}catch(n){u(n)}}),f=function(){o&&o(),c.cancel()};return{cancel:f}});return r}function i(n){return function(t,r){return n(r,t)}}function a(){}Object.defineProperty(t,"__esModule",{value:!0}),t.default=e,e.of=function(n){return n._isTask?n:e(function(t,r){return t(n),{cancel:a}})},e.reject=function(n){return e(function(t,r){return r(n),{cancel:a}})},e.resolve=e.of,e.all=function(n){return e(function(t,r){var e=n.length,u={},o=[],c=function(n){return function(r){u["t-"+n]=r;var c=o.filter(function(n){return!!u[n]}).length;if(c===e){var f=o.map(function(n){return u[n]});t(f)}}},f=function(n){return function(t){a(n),r(t)}},i=n.map(function(n,t){return u["t-"+t]=void 0,o=Object.keys(u),n.fork(f(t),c(t))}),a=function(){var n=arguments.length>0&&void 0!==arguments[0]?arguments[0]:null;null===n?i.forEach(function(n){return n.cancel()}):i.filter(function(t,r){return r!==n}).forEach(function(n){return n.cancel()})};return{cancel:a}})},e.race=function(n){return e(function(t,r){var e=function(n){return function(r){c(n),t(r)}},u=function(n){return function(t){c(n),r(t)}},o=n.map(function(n,t){return n.fork(u(t),e(t))}),c=function(){var n=arguments.length>0&&void 0!==arguments[0]?arguments[0]:null;null===n?o.forEach(function(n){return n.cancel()}):o.filter(function(t,r){return r!==n}).forEach(function(n){return n.cancel()})};return{cancel:c}})},e.fromPromise=function(n){return e(function(t,r){return n.then(t,r),{cancel:function(){return console.warn("A promise is not cancellable.")}}})},e.wait=function(n,t){return e(function(r,e){var u=setTimeout(function(n){return r(t)},n);return{cancel:function(){return clearTimeout(u)}}})}},function(n,t,r){"use strict";function e(n){return n&&n.__esModule?n:{default:n}}Object.defineProperty(t,"__esModule",{value:!0});var u=r(0),o=e(u);o.default.fetch=function(n){return(0,o.default)(function(t,r){var e=new XMLHttpRequest;e.open("get",n,!0),e.onerror=r,e.onreadystatechange=function(){var u;4==e.readyState&&(u=e.status,200==u?t({json:function(){return JSON.parse(e.responseText)},text:function(){return e.responseText},xhr:e,status:u,url:n}):r(u))},e.send();var u=function(){return e.abort()};return{cancel:u}})},t.default=o.default},function(n,t,r){n.exports=r(1)}])});