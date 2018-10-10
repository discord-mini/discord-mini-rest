# discord-mini-rest

This is a small package that can be used to work with Discord's REST API. This is more for
people who want to use Node's `cluster` module or `child_processes` so it really only works
for those. Mainly because I have a process.send nested in the code somewhere right now so yeah.

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

It's a little difficult to get setup honestly. First, you'll need one 
parent/master process run the requester or limiter; I haven't settled
on a name yet.
```js
const cluster = require('cluster');
if (cluster.isMaster) {
  const api = require('rest').requester();
}
```
However, now I use IPC because I only want one instance of the
requester to exist, so you also have to forward messages sent from
child processes/workers to the requester. And then send the info back
to the same worker.
```js
// still assuming only master will run this
cluster.on('message', (worker, obj) => {
  if (obj.type === 'REST') {
    api.request(obj.data)
      .then((r) => {
          const [key, res] = r;
          worker.send({type: 'REST', err: false, key, res})
      })
      .catch((e) => {
          const [key, err] = e;
          worker.send({type: 'REST', err: true, key, res: err})
      });
  }
});
```

You can still make requests in the same way though as long as you have
the previous bit set up.
```js
const base = require('rest').base(token);
base.channels['304250407578763265'].messages.post({content: 'hi'})
  .then(console.log)
  .catch(console.error)
```

The above code does the same as making a `POST` request with `{content: 'hi'}`
to `https://discordapp.com/api/channels/304250407578763265/messages` using
your token as the authorization header.

If you don't want to use `cluster`, you can use `child_process` to fork another
node process.
```js
    // index.js
    const api = require('rest').requester();
    const ch = require('child_process').fork(__dirname + '/main.js');
    ch.on('message', (obj) => {
        if (obj.type === 'REST') {
          // ...
        }
    });
    
    // main.js
    const base = require('rest').base(token);
    // ...
```

Just knowing the endpoint and method is enough to work with this library.
You can read more about them on
[Discord's official documentation](https://discordapp.com/developers/docs/intro).

## details

(may be outdated)

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
