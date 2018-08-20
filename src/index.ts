import "reflect-metadata";
import { createAddresses } from './action/address'
import { processDeposits, clearDeposits } from './action/deposit';
import { processWithdrawals } from './action/withdraw';
import { balanceCheck } from './action/balance';
import { Coins } from "./entity/coins";
import { Monitoring } from "./entity/monitoring";
import { logLine, sendPushMessage } from './util/util';
import { config } from '../configuration';
import * as Xrp from 'ripple-lib';
import { createConnection, ConnectionOptions } from "typeorm";

import { truncate } from "fs";
import { connect } from "tls";
import { dirname } from "path";

const VERSION = '0.0.1';

const xrp = new Xrp.RippleAPI({ server: config.provider });

xrp.on('error', (errorCode, errorMessage) => {
    console.log(errorCode + ': ' + errorMessage);
});
xrp.on('disconnected', (code) => {
    console.log('disconnected, code:', code);
});

let locked = true;
let cleaned = false;

createConnection().then(async connection => {

    logLine('========================================');
    logLine(`Starting ${process.argv[2]} ${VERSION}.`);

    // Find Coin
    const coinRepository = connection.getRepository(Coins);
    // const coin = await coinRepository.findOne({code: 'ETH', coin_type: 'Ethereum'});
    const coin = await coinRepository.findOne({ code: config.coincode }); // read the coincode from the config file
    const monitoringRepository = connection.getRepository(Monitoring);

    const job = 'cron_' + process.argv[2];

    if (!coin) {
        throw Error('Unable to locate COIN');
    }

    if (coin[job] !== 0 && process.argv[3] !== 'force') {
        if (coin[job] === 1) {
            logLine('ERROR: The cron job is still running from before, potentially looping or stuck.');
        } else {
            // We've changed it to something else, do not run.
            logLine('Cron flag manually changed, do not want to run.');
        }
        connection.close();
        return;
    }

    // Save cron type :)
    if (process.argv[3] !== 'force') {
        let type = 0;
        // '1 Deposits , 2 Withdraw, 3 Clearing, 4 Address, 5 SMS, 6 lastblock, 7 Email, 8 balanceCheck';
        switch (process.argv[2]) {
            case 'deposit': type = 1; break;
            case 'withdraw': type = 2; break;
            case 'clearing': type = 3; break;
            case 'address': type = 4; break;
            case 'balance': type = 8; break;
            default: type = 0;
        }
        let monitoring = await monitoringRepository.findOne({ coin_id: coin.id, type });

        if (!monitoring) {
            // Save the address to the database
            monitoring = new Monitoring();

            monitoring.coin_id = coin.id;
            monitoring.type = type;
        }
        monitoring.lastrun = (new Date().getTime() / 1000).toFixed();;

        await connection.manager.save(monitoring);

        coin[job] = 1;
    }

    await connection.manager.save(coin);
    
    const cleanup = async () => {
        cleaned = true;
        logLine("cleaning up");
        // TODO: See if command is valid...
        if (process.argv[3] !== 'force') {
            coin[job] = 0;
        }
        connection.manager.save(coin)
            .then(_ => connection.close())
            .catch(console.error);
    }

    //try to connect to Ripple before doing any processing
    xrp.connect().then(async () => {

        switch (process.argv[2]) {
            case 'address':
                await createAddresses(connection, coin, cleanup);
            break;
            case 'deposit':
                await processDeposits(xrp, connection, coin, monitoringRepository, cleanup);
                break;
            case 'clearing':
                await clearDeposits(xrp, connection, coin, monitoringRepository, cleanup);
                break;
            case 'withdraw':
                await processWithdrawals(xrp, connection, coin);
                await cleanup();
                break;

            case 'balance':
                await balanceCheck(xrp, connection, coin);
                await cleanup();
                break;

            default:
                await cleanup();
                throw Error('unknown command: ' + process.argv[2]);
        }
    }).then(async () => {
        if (cleaned === false) { await cleanup(); }
        return xrp.disconnect();
    }).catch(error => {
        logLine(error);
        process.exit(1);
    });
}).catch(error => {
    logLine(error);
    process.exit(1);
});
