const { createHash } = await import('node:crypto');
import { hex_md5 } from './md5.js';

class AdCommandError extends Error {}

class Zte {
    password = null;
    cookie = null;
    baseUrl = 'http://192.168.0.1/';
    timeout = 2000;

    constructor(password) {
        if (!password) {
            throw new Error('password required');
        }
        this.password = password;
    }

    async getLD() {
        const r = await fetch(this.baseUrl+"goform/goform_get_cmd_process?isTest=false&cmd=LD&_="+Date.now(), {
            headers: {
                referer: this.baseUrl,
                signal: AbortSignal.timeout(this.timeout)
            }
        });
        const data = await r.json();
        return data.LD;
    }

    async getRD() {
        const cookie = await this.getLoginCookie();
        const r = await fetch(this.baseUrl+"goform/goform_get_cmd_process?isTest=false&cmd=RD&_="+Date.now(), {
            headers: {
                referer: this.baseUrl,
                Cookie: cookie,
                signal: AbortSignal.timeout(this.timeout)
            }
        });
        const data = await r.json();
        return data.RD;
    }

    async getLoginCookie() {
        if(this.cookie) {
            return this.cookie;
        }

        console.log('update login cookie');
        const ld = await this.getLD();
        const hashPassword = createHash('sha256').update(this.password).digest("hex").toUpperCase()
        const ztePass = createHash('sha256').update(hashPassword+ld).digest("hex").toUpperCase()
        const params = new URLSearchParams();
        params.append('isTest', 'false');
        params.append('goformId', 'LOGIN');
        params.append('password', ztePass);

        const response = await fetch(this.baseUrl+"goform/goform_set_cmd_process", {
            method: "POST", 
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                referer: this.baseUrl,
                signal: AbortSignal.timeout(this.timeout)
            },
            body: params.toString()
        });

        this.cookie = response.headers.get('Set-Cookie').split(';')[0];
        return this.cookie;
    }

    async getStatus() {
        const cookie = await this.getLoginCookie();
        const r = await fetch(
            this.baseUrl+"goform/goform_get_cmd_process?multi_data=1&isTest=false&sms_received_flag_flag=0&sts_received_flag_flag=0&cmd=ppp_status,loginfo&_="+Date.now(), 
            {
                headers: {
                    referer: this.baseUrl,
                    Cookie: cookie,
                    signal: AbortSignal.timeout(this.timeout)
                }
            })
        const data = await r.json();
        return data;
    }

    async sendAdCommand(command) {
        const rd0 = 'MC801AV1.0.0B16';
        const rd1 = '';

        const rd = await this.getRD();
        const ad = hex_md5(hex_md5(rd0 + rd1) + rd);
        const cookie = await this.getLoginCookie();
        
        const params = new URLSearchParams();
        params.append('isTest', 'false');
        //params.append('notCallback', 'true');
        params.append('goformId', command);
        params.append('AD', ad);

        const response = await fetch(this.baseUrl+"goform/goform_set_cmd_process", {
            method: "POST", 
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                Cookie: cookie,
                referer: this.baseUrl,
                signal: AbortSignal.timeout(this.timeout)
            },
            body: params.toString()
        });

        const data = await response.json();
        
        if (data.result !== 'success') {
            throw new AdCommandError(data.result);
        }

        return true;
    }

    async rebootDevice() {
        return this.sendAdCommand('REBOOT_DEVICE');
    }

    async connectNetwork() {
        return this.sendAdCommand('CONNECT_NETWORK');
    }

    async connectIfNeeded() {
        const status = await this.getStatus();
        if (status.ppp_status === 'ppp_disconnected') {
            if (status.loginfo !== 'ok') {
                this.cookie = null;
            }
            console.log('connect network');
            const c = await this.connectNetwork();
            const connected = await this.waitConnexion(3);

            if (!connected) {
                throw new AdCommandError('Uneffective connection');
            }
        }

        return true;
    }

    async waitConnexion(times) {
        const status = await this.getStatus();
        if (status.ppp_status === 'ppp_connected') {
            return true;
        }

        if (times < 3) {
            return new Promise((res) => setTimeout(() => res(this.waitConnexion(times + 1)), 500));
        }

        return false;
    }
}

export { Zte };
