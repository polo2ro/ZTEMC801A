const { createHash } = await import('node:crypto');
import { hex_md5 } from './md5.js';

class Zte {
    password = null;
    cookie = null;
    lastId = null;

    constructor(password) {
        if (!password) {
            throw new Error('password required');
        }
        this.password = password;
    }

    async getLD() {
        return fetch("http://192.168.0.1/goform/goform_get_cmd_process?isTest=false&cmd=LD&_="+Date.now(), {headers: {'referer': 'http://192.168.0.1/'}})
            .then(r => r.json())
            .then(data => data.LD);
    }

    async getRD() {
        const cookie = await this.getLoginCookie();
        const r = await fetch("http://192.168.0.1/goform/goform_get_cmd_process?isTest=false&cmd=RD&_="+Date.now(), {
            headers: {
                'referer': 'http://192.168.0.1/',
                'Cookie': cookie
            }
        });
        const data = await r.json();
        return data.RD;
    }

    async getLoginCookie() {
        if(this.cookie) {
            return Promise.resolve(this.cookie);
        }

        const ld = await this.getLD();
        const hashPassword = createHash('sha256').update(this.password).digest("hex").toUpperCase()
        const ztePass = createHash('sha256').update(hashPassword+ld).digest("hex").toUpperCase()
        const params = new URLSearchParams();
        params.append('isTest', 'false');
        params.append('goformId', 'LOGIN');
        params.append('password', ztePass);

        return fetch("http://192.168.0.1/goform/goform_set_cmd_process", {
            method: "POST", 
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'referer': 'http://192.168.0.1/'
            },
            body: params.toString()
        })
        .then((response) => {
            this.cookie = response.headers.get('Set-Cookie').split(';')[0];
            return this.cookie;
        })
        .catch((e) => {
            console.log("ERROR: login() failed.", e);
        })
    }

    async getPppStatus() {
        const cookie = await this.getLoginCookie();
        const r = await fetch(
            "http://192.168.0.1/goform/goform_get_cmd_process?multi_data=1&isTest=false&sms_received_flag_flag=0&sts_received_flag_flag=0&cmd=ppp_status&_="+Date.now(), 
            {
                headers: {
                    'referer': 'http://192.168.0.1/',
                    'Cookie': cookie
                }
            })
        const data = await r.json();
        return data.ppp_status === 'ppp_connected';
    }

    async connectNetwork() {
        const rd0 = 'MC801AV1.0.0B16';
        const rd1 = '';

        const rd = await this.getRD();
        const ad = hex_md5(hex_md5(rd0 + rd1) + rd);
        const cookie = await this.getLoginCookie();
        
        const params = new URLSearchParams();
        params.append('isTest', 'false');
        params.append('notCallback', 'true');
        params.append('goformId', 'CONNECT_NETWORK');
        params.append('AD', ad);

        const response = await fetch("http://192.168.0.1/goform/goform_set_cmd_process", {
            method: "POST", 
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'Cookie': cookie,
                'referer': 'http://192.168.0.1/'
            },
            body: params.toString()
        });

        const data = await response.json();
        
        if (data.result !== 'success') {
            throw new Error(data.result);
        }

        return true;
    }

    async connectIfNeeded() {
        const ppp = await this.getPppStatus();
        if (!ppp) {
            console.log('connect');
            return this.connectNetwork();
        }

        return Promise.resolve(true);
    }
}

export { Zte };
