import { Zte } from './zte.lib.js';

const router = new Zte(process.argv[2]);
const c = await router.connectIfNeeded();
console.log(c);
