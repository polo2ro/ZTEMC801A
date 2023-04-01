import { Zte } from './zte.lib.js';

const router = new Zte(process.argv[2]);

let rebootCount = 0;
let first = true;

const loopMonitor = async () => {
    try {
        const status = await router.connectIfNeeded();
        if (status) {
            if (first) {
                console.log('all good, check connexion every 10s...');
                first = false;
            }
            setTimeout(loopMonitor, 10000);
        }
    } catch (err) {
        first = true;
        if (err.name === 'TimeoutError' || err.name ===  'TypeError') {
            console.log('restarting or unplugged device, retry...');
            setTimeout(loopMonitor, 2000);
            return;
        }

        if (err.name === 'AdCommandError') {
            if (rebootCount < 2) {
                console.log('Ad command failed, try with a reboot');
                const rebootStatus = await router.rebootDevice();
                rebootCount++;

                if (rebootStatus) {
                    console.log('sleep 60s while rebooting device');
                    setTimeout(loopMonitor, 60000);
                    return;
                }
            } else {
                console.log('reboot limit');
            }
        }

        console.error(err, err.name);
        console.error('Unknown error, break loop');
    }
}

loopMonitor();
