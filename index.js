const apimap = require('./map');
const base = 'https://discordapp.com/api';
const requests = {};

const handler = {
	get: (target, name) => {
		const filter = ['inspect', require('util').inspect.custom, Symbol.iterator];
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
				// I want to use ipc to send this because
				// I only want one instance of the limit handler.
				const key = process.hrtime().join('.');
				const prom = new Promise((resolve, reject) => {
					process.send({
						method: name, 
						url: base + target.path, 
						data: data, 
						token: target.token, 
						major: target.major,
						key: key
					});
					// this way we can resolve or reject the promise
					// from outside. it was a hack to avoid sticking
					// a listener inside the promise tbh
					requests[key] = {resolve, reject};
				});
				return prom;
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

module.exports = {
	base: (token) => new Proxy({ path: '', map: apimap, token: token }, handler),
	requests: requests,
	requester: require('./limiter')
}