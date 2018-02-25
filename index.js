class LimitHandler {
	constructor() {
		this.limits = {};
		this.checking = false;
	}

	checkQueue() {
		let checkAgain = false;
		for (const major in this.limits) {
			if (!this.limits[major].executing && this.limits[major].remaining > 0) {
				const funcs = this.limits[major].queue.splice(0, this.limits[major].remaining);
				this.limits[major].remaining -= funcs.length;
				this.limits[major].executing = true;
				Promise.all(funcs.map((f) => f())).then(() => {
					this.limits[major].executing = false;
				});
			} else if (!this.limits[major].executing) {
				if (Date.now() > this.limits[major].reset) {
					this.limits[major].remaining = this.limits[major].limit;
				}
			}
			if (this.limits[major].queue.length > 0) {
				checkAgain = true;
			}
		}
		if (checkAgain) {
			setTimeout(this.checkQueue.bind(this), 100);
		} else {
			this.checking = false;
		}
	}

	request(method, url, data, token, major = 'global') {
		if (!this.limits[major]) {
			this.limits[major] = {
				limit: 5,
				reset: 0,
				remaining: 5,
				queue: [],
				executing: false
			}
		}
		return new Promise((resolve, reject) => {
			const func = (() => {
				request[method](url)
					.set('Authorization', 'Bot ' + token)
					.send(data)
					.then((res) => {
						this.limits[major].limit = res.headers['x-ratelimit-limit'] || this.limits[major].limit;
						if (this.limits[major].reset === 0) {
							this.limits[major].reset = res.headers['x-ratelimit-reset'];
						} else if (res.headers['x-ratelimit-reset'] > this.limits[major].reset) {
							this.limits[major].reset = res.headers['x-ratelimit-reset'];
							this.limits[major].remaining = res.headers['x-ratelimit-remaining'];
						} else {
							this.limits[major].remaining = Math.min(res.headers['x-ratelimit-remaining'] || this.limits[major].limit, this.limits[major].remaining);
						}
						resolve(res.body);
					})
					.catch((err) => {
						if (err.response.status === 429) {
							setTimeout(() => resolve(func()), err.response.body.retry_after);
						} else {
							reject(err);
						}
					});
			});
			this.limits[major].queue.push(func);
			if (!this.checking) {
				this.checking = true;
				this.checkQueue();
			}
		});
	}
}

const limiter = new LimitHandler();
const request = require('superagent');
const util = require('util');
const apimap = require('./map');
const base = 'https://discordapp.com/api';
const handler = {
	get: (target, name) => {
		const filter = ['inspect', util.inspect.custom, Symbol.iterator];
		if (filter.includes(name)) {
			return;
		}
		const path = target.path + '/' + name;
		name = name.toLowerCase();
		let key, m;
		if (target.map[name] && !name.startsWith('{')) {
			return new Proxy({ path: path, map: target.map[name], major: target.major, token: target.token }, handler);
		} else if (target.map.methods && target.map.methods.includes(name.toUpperCase())) {
			return (data) => {
				return limiter.request(name, base + target.path, data, target.token, target.major);
			}
		} else if ((key = Object.keys(target.map).find((key) => /{.*?}/.exec(key)))) {
			if (m = key.match(/(guild)|(channel)/)) {
				m = m[0];
			}
			return new Proxy({ path: path, map: target.map[key], major: m ? m + name : target.major, token: target.token }, handler);
		} else {
			throw new Error(path + ' is not part of a valid endpoint');
		}
	}
}

function requestBuilder(token) {
	return new Proxy({ path: '', map: apimap, token: token }, handler);
}

module.exports = {
	RequestBuilder: requestBuilder,
	Limiter: limiter
}
