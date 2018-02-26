# discord-mini-rest

This is a small package that can be used to work with Discord's REST API.

* [Quick Start](#quickstart)
* [More Details](#details)


## quickstart
```
npm install rei2hu/discord-mini-rest
```
or
```
yarn add https://github.com/rei2hu/discord-mini-rest
```

Here's an example of sending a message to a certain channel.

```js
const { RequestBuilder } = require('rest');
const base = RequestBuilder(token);

base.channels['304250407578763265'].messages.post({content: 'hello there!'});
```

The above code does the same as the following:

```js
request.post('https://discordapp.com/api/channels/304250407578763265/messages')
  .set('Authorization', 'Bot ' + token)
  .send({content: 'hello there!'})
```

Just knowing the endpoint and method is enough to work with this library. You can read more about them on
[Discord's official documentation](https://discordapp.com/developers/docs/intro).

## details

#### storing partial endpoints
I doubt I used the proper terminology in the section title but you can store a partially made `RequestBuilder`
```js
const guildEndpoint = base.guilds['292006672732520478'];
// base.guilds['292006672732520478']['audit-logs'].get().then(console.log);
guildEndpoint['audit-logs'].get().then(console.log);
// base.guilds['292006672732520478'].emojis.get().then(console.log);
guildEndpoint.emojis.get().then(console.log);
```

#### map.json
The layout of documented endpoints can be found in the `map.json` file and is used to verify that the endpoints you are
trying to access are valid.

```js
base.guilds['292006672732520478'].emojys['411702550077898762'].get().then(console.log).catch(console.error)
// Error: /guilds/292006672732520478/emojys is not part of a valid endpoint
```

However, it cannot verify IDs, tokens, and other variable inputs
```js
base.guilds['heheillsneakthisfakeidin'].emojis['heretoo'].get().then(console.log).catch(console.error)
// catch triggered (404)
base.guilds['123'].emojis['321'].get().then(console.log).catch(console.error)
// catch triggered (404)
```

#### rate limiter
There is also a built in rate limiter that should respect Discord's rate limits. It is exposed and you can access it like so

```js
const { Limiter } = require('rest');
console.log(Limiter.limits);
```

If you attempt to send off more requests then are allowed, they requests are queued and will be sent off as many as possible at
a time, resulting in a non-sequential output (well they're asynchronous anyways so you should expect it.)

```js
for (let i = 0; i < 10; i++) {
  base.channels['304250407578763265'].messages.post({content: i});
}
// 0, 2, 3, 1, 4, 6, 8, 9, 7, 5
// here, since the request limit is 5, it sends off the first 5 requests (0-4) then the
// last 5 requests (5 - 9)
```
