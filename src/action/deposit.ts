import * as crypto from 'crypto';

import { config } from '../../configuration';
import { logLine, sendEmail, sendPushMessage } from '../util/util';

import { Addresses } from '../entity/addresses';
import { Balances } from '../entity/balances';
import { Transactions } from "../entity/transactions";
import { Monitoring } from '../entity/monitoring';

import * as Xrp from 'ripple-lib';

export async function processDeposits(xrp, connection, coin, monitoringRepository, cleanup) {

    const addressRepository = connection.getRepository(Addresses);
    const balancesRepository = connection.getRepository(Balances);
    const transactionRepository = connection.getRepository(Transactions);

    if (coin.cron_deposit < 0) {
        logLine('Coin withdraw disabled:', coin.name);
        cleanup();
        return;
    }

    const depositTransactions = async (_transactions, maxLedgerVersion) => {
        if (_transactions.length === 0) {
            let monitoring = await monitoringRepository.findOne({ coin_id: coin.id, type: 6 });

            if (!monitoring) {
                monitoring = new Monitoring();
                monitoring.coin_id = coin.id;
                monitoring.type = 6;
            }
            monitoring.lastrun = (new Date().getTime() / 1000).toFixed();;

            await connection.manager.save(monitoring);

            logLine('Latest Ledger:', maxLedgerVersion);
            coin.lastblock = maxLedgerVersion;
            await cleanup(); // Will save coin..
            return;
        }

        const result = _transactions.shift();

        //only process tesSUCCESS
        if (result.outcome.result !== 'tesSUCCESS') {
            await depositTransactions(_transactions, maxLedgerVersion);
        }
        else {
            await processTransaction(result, () => depositTransactions(_transactions, maxLedgerVersion), coin);
        }
    };

    const isDuplicateTX = async (txid, address): Promise<boolean> => {
        // Check if we have data for this transaction already
        let transaction = await transactionRepository.findOne({
            txid: txid,
            address: address,
            type: 0
        });

        // Check if we have any data
        if (transaction) {
            // We have a duplicate transaction - assume no new block since we last ran
            logLine('DUPLICATE! Skipping - Assuming no new block has been generated', transaction.txid);
            return true;
        }
        return false;
    }


    const processTransaction = async (transaction, callback, coin) => {
        logLine('Processing transaction', transaction.id, 'for coin', coin.code);

        if (await isDuplicateTX(transaction.id, transaction.specification.destination.tag)) {
            callback();
        }

        let address = await addressRepository.findOne({ address_address: transaction.specification.destination.tag }); // Use user address table...
        let deliveredAmount = Number(transaction.outcome.deliveredAmount.value);

        if (transaction.specification.destination.tag !== undefined) {
            if (address) {
                // Output some information
                logLine('New transaction! TO Address', address.address_address, "Amount", deliveredAmount.toFixed(8));

                // Get the users existing pending balance based on the deposit address
                let balance = await balancesRepository.findOne({ id: address.address_balance_id });

                if (balance) {
                    // Log the users existing balance
                    logLine('Found users (ID:', balance.user_id + ') existing pending balance:', balance.balance_pending_deposit);

                    const xrpTx = await xrp.getTransaction(transaction.id);
                    if (xrpTx) {

                        const txn = new Transactions();

                        txn.coin_id = coin.id;
                        txn.txid = xrpTx.id;
                        txn.type = 0;
                        txn.user_id = balance.user_id;
                        txn.address = xrpTx.specification.destination.tag;
                        txn.amount = +Number(xrpTx.outcome.deliveredAmount.value).toFixed(8);

                        txn.pending = 0;
                        txn.confirms = 0;
                        txn.time = new Date().getTime().toString().substr(0, 10);
                        txn.fee = +Number(xrpTx.outcome.fee).toFixed(8);
                        await connection.manager.save(txn);

                        // TOTAL Available Balance
                        const totalBalance = +(balance.balance_available + txn.amount).toFixed(8);
                        balance.balance_available = totalBalance;

                        await connection.manager.save(balance);

                        // Log it
                        logLine('Transaction applied to users balance. NEW Pending Balance:', totalBalance);

                        await sendEmail(connection, balance.user_id, "deposit", txn.amount, txn.address, coin.code);

                        sendPushMessage({
                            'feed': crypto.createHash('md5').update(balance.user_id + '@ChainEX').digest("hex"),
                            'title': 'New Deposit Received',
                            'tag': crypto.createHash('md5').update(txn.txid + 'deposit').digest("hex"),
                            'message': 'A new ' + txn.amount + ' ' + coin.code + ' deposit has been detected. New available balance: ' + totalBalance,
                        });

                        callback();
                    } else {
                        logLine('ERROR: Cannot find transaction', transaction.specification.destination.tag, transaction.id);
                        callback();        
                    }
                }
            } else {
                // Skipping transaction
                logLine('SKIPPING Transaction. Unknown Destination Tag: ', transaction.specification.destination.tag, transaction.id);
                callback();
            }
        } else {
            // Skipping transaction
            //logLine('SKIPPING Transaction. NO destination tag: ', transaction.id);
            callback();
        }
    }

    const serverInfo = await xrp.getServerInfo();
    const ledgers = serverInfo.completeLedgers.split('-');
    //const minLedgerVersion = Number(ledgers[0]);
    const minLedgerVersion = Number(coin.lastblock?coin.lastblock:ledgers[0]);
    const maxLedgerVersion = Number(ledgers[1]);
    
    const transactions = await xrp.getTransactions(config.fromAddress, {
        minLedgerVersion,
        maxLedgerVersion,
    });
    await depositTransactions(transactions, maxLedgerVersion);
}
