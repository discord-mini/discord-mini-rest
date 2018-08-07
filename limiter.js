const fetch = require('node-fetch');
class LimitHandler {
	constructor() {
		this.limits = {};
		this.checking = false;
	}

	checkQueue() {
		let checkAgain = false;
		for (const major in this.limits) {
			if (!this.limits[major].executing && this.limits[major].remaining > 0) {
				// execute requests equal to the number of remaining requests
				const funcs = this.limits[major].queue.splice(0, this.limits[major].remaining);
				this.limits[major].remaining -= funcs.length;
				this.limits[major].executing = true;
				Promise.all(funcs.map((f) => f())).then(() => {
					this.limits[major].executing = false;
				});
			} else if (!this.limits[major].executing) {
				if (Date.now() > this.limits[major].reset) {
					// reset limits
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

	request({method, url, data, token, major = 'global', key}) {
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
				fetch(url, {
                    method: method,
                    headers: {
                        Authorization: 'Bot ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                })
                .then((res) => {
                    if (res.ok || res.status === 429) {
                        // set limit as most recent one
                        this.limits[major].limit = res.headers['x-ratelimit-limit'] || this.limits[major].limit;
                        if (this.limits[major].reset === 0) {
                            // if we never got a reset time, set it
                            this.limits[major].reset = res.headers['x-ratelimit-reset'];
                        } else if (res.headers['x-ratelimit-reset'] > this.limits[major].reset) {
                            // if the reset time comes after our known reset, then we must have been reset
                            this.limits[major].reset = res.headers['x-ratelimit-reset'];
                            this.limits[major].remaining = res.headers['x-ratelimit-remaining'];
                        } else {
                            // or else our remaining is the smallest of our remaining or what the header says
                            // because we kind of send out multiple requests at the same time
                            this.limits[major].remaining = Math.min(res.headers['x-ratelimit-remaining'] || this.limits[major].limit, this.limits[major].remaining);
                        }
                        if (res.ok) {
                            // only way to resolve is with an ok status
                            resolve(Promise.all([key, res.json()]));
                        } else {
                            // retry if not res.ok because rate limited
                            this.limits[major].queue.unshift(func)
                        }
                    } else {
                        // some non rate limit, non ok error
                        reject(Promise.all([key, res.json()]));
                    }
                    
                })
                // reject on some other error
                .catch((err) => {
                    reject(Promise.all([key, err]));
                });
            });
            // actually add the function
            this.limits[major].queue.push(func)
            // start checking for requests
			if (!this.checking) {
				this.checking = true;
				this.checkQueue();
			}
		});
	}
}
const limiter = new LimitHandler();

module.exports = () => limiter;