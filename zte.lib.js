const { createHash } = await import('node:crypto');
import hex_md5 from 'md5-hex';

class AdCommandError extends Error {
    name = 'AdCommandError';
}

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

    async getCmd(cmd) {
        const cookie = await this.getLoginCookie();
        const r = await fetch(this.baseUrl+"goform/goform_get_cmd_process?multi_data=1&isTest=false&cmd="+cmd+"&_="+Date.now(), {
            headers: {
                referer: this.baseUrl,
                Cookie: cookie,
                signal: AbortSignal.timeout(this.timeout)
            }
        });
        return await r.json();
    }

    async getRD() {
        const cmd = await this.getCmd('RD');
        return cmd.RD;
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
        const rd = await this.getRD();
        const ad = hex_md5(hex_md5('MC801AV1.0.0B16') + rd);
        const cookie = await this.getLoginCookie();
        
        const params = new URLSearchParams();
        params.append('isTest', 'false');
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

    async isMonthlyQuotaExcedeed() {
        const state = await this.getCmd('monthly_tx_bytes,monthly_rx_bytes,data_volume_limit_size,data_volume_alert_percent,data_volume_limit_unit');
        
        if (state.data_volume_limit_unit != 'data') {
            console.log('Unsupported data usage setting');
            return false;
        }

        const consuption = parseInt(state.monthly_tx_bytes, 10) + parseInt(state.monthly_rx_bytes, 10);
        const ratio =  parseInt(state.data_volume_alert_percent) / 100;
        const limit = parseInt(state.data_volume_limit_size.replace('_1024', ''), 10) * 1024 * 1024 * 1024 * ratio;

        return consuption > limit;
    }

    async connectIfNeeded() {
        const status = await this.getStatus();
        if (status.ppp_status === 'ppp_disconnected') {
            if (status.loginfo !== 'ok') {
                this.cookie = null;
            }

            if (await this.isMonthlyQuotaExcedeed()) {
                console.log('Monthly quota excedeed');
                return false;
            }

            console.log('connect network');
            await this.connectNetwork();
            const connected = await this.waitConnexion(3);

            if (!connected) {
                throw new AdCommandError('Uneffective connection');
            }
        }

        return true;
    }

    async waitConnexion(times) {
        console.log('waitConnexion', times);
        const status = await this.getStatus();
        if (status.ppp_status === 'ppp_connected') {
            return true;
        }

        if (times > 0) {
            return new Promise((res) => setTimeout(() => res(this.waitConnexion(times - 1)), 2000));
        }

        console.log('waitConnexion timeout');
        return false;
    }
}

export { Zte };
