import * as crypto from 'crypto';

import { config } from '../../configuration';
import { logLine, isAddress, sendPushMessage, sendEmail } from '../util/util';

import { Markets } from '../entity/markets';
import { Trades } from '../entity/trades';
import { Balances } from '../entity/balances';
import { Transactions } from '../entity/transactions';
import { PendingWithdraw } from '../entity/pending-withdraw';

import * as Xrp from 'ripple-lib';

export async function processWithdrawals(xrp, connection, coin) {

    const tradesRepository = connection.getRepository(Trades);
    const balancesRepository = connection.getRepository(Balances);
    const transactionRepository = connection.getRepository(Transactions);
    const pendingWithdrawRepository = connection.getRepository(PendingWithdraw);

    let withdrawalArray = [];
    let txFee = 0;
    let processingTransactions = [];
    let unlocked = false;

    if (coin.cron_withdraw < 0) {
        logLine('Coin withdraw disabled:', coin.name);
        return;
    }

    logLine('Processing coin:', coin.name);


    // First process already withdrawn transactions...
    let transactions = await transactionRepository.find({
        type: 1,
        pending: 1,
        coin_id: coin.id
    });

    for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        const xrpTx = await xrp.getTransaction(tx.txid);
        if (!xrpTx) {
            logLine('ERROR: Transaction has gone missing...');
            coin.cron_withdraw = -1;
            return;
        }
        if (xrpTx.outcome.result == 'tesSUCCESS') {
            logLine('Confirming ' + tx.txid);
            tx.pending = 0;
            //tx.fee = Number(xrpTx.outcome.fee).toFixed(8);
            await connection.manager.save(tx);

            // Get the users existing balance
            // BALANCE
            const balance = await balancesRepository.findOne({
                user_id: tx.user_id,
                coin_id: tx.coin_id,
            });

            const newWithdrawBalance = balance.balance_pending_withdraw - tx.amount;
            logLine('Updating balance_pending_withdraw to', newWithdrawBalance);

            balance.balance_pending_withdraw = newWithdrawBalance;

            await connection.manager.save(balance);
        }
    }

    async function processWithdrawal(_withdrawals) {
        if (_withdrawals.length === 0) {
            if (withdrawalArray && withdrawalArray.length > 0) {
                await dotransactions(withdrawalArray);
            }
            await processpending(processingTransactions);
            return;
        }
        const withdrawal = _withdrawals.shift();

        // Validate the hash
        if (!validateHash(withdrawal.hash, withdrawal.address + parseInt(withdrawal.amount) + withdrawal.time)) {
            logLine(`ERROR: User ${withdrawal.user_id} Withdraw hash appears invalid. STOPPING WITHDRAW.`);
            await processWithdrawal(_withdrawals);
            // Skip adding this transaction
            return;
        }

        // We're good
        logLine('Withdraw hash validates ok.');

        // Do the account audit
        if (!await accountAudit(balancesRepository, tradesRepository, transactionRepository, coin.id, withdrawal.user_id)) {
            logLine(`ERROR: Withdrawal for user ${withdrawal.user_id} stopped as account audit doesn't tally. STOPPING WITHDRAW.`);
            await processWithdrawal(_withdrawals);
            // Skip adding this transaction
            return;
        }
        // We're good
        logLine('Withdrawal passes account audit.');

        const balance = await balancesRepository.findOne({
            coin_id: coin.id,
            user_id: withdrawal.user_id
        });

        logLine('Balance pending withdraw:', balance.balance_pending_withdraw);

        if (balance.balance_pending_withdraw < withdrawal.amount) {
            logLine(`ERROR: User ${withdrawal.user_id} trying to withdraw more coins than they have. Coin ID: ${coin.id}, Amount attempted: ${withdrawal.amount} STOPPING WITHDRAW.`);
            await processWithdrawal(_withdrawals);
            // Skip adding this transaction
            return;
        }
        // We're good
        logLine('Withdrawal has enough balance.');

        if (!await isAddress(withdrawal.address)) {
            // Log the problem
            logLine(`ERROR: Address ${withdrawal.address} is not valid, setting withdrawal to unsuccessful.`);
            // Set to unsuccessful
            await pendingWithdrawRepository
                .createQueryBuilder()
                .update(PendingWithdraw)
                .set({ email_confirm: '-1' })
                .where('id = :id', { id: withdrawal.id })
                .execute();

            await processWithdrawal(_withdrawals);
            return;
        }

        if (!await verifyWithdrawLimit(
            transactionRepository, coin,
            withdrawal.user_id, withdrawal.amount,
            withdrawal.email_confirm, withdrawal, connection)) {
            logLine('ERROR: verifyWithdrawLimit');
            withdrawal.email_confirm = -2;
            await pendingWithdrawRepository
                .createQueryBuilder()
                .update(PendingWithdraw)
                .set({ email_confirm: '-2' })
                .where('id = :id', { id: withdrawal.id })
                .execute();

            await processWithdrawal(_withdrawals);
            return;
        }

        const withdrawalEntry = {
            address: withdrawal.address,
            amount: withdrawal.amount - coin.withdraw_fee
        };

        const found = withdrawalArray.findIndex(element => element.address === withdrawal.address);
        if (found > -1) {
            // console.log(found);
            const foundEntry = withdrawalArray[found];
            const newAmount = +(foundEntry.amount + (withdrawal.amount - coin.withdraw_fee)).toFixed(8);
            logLine(`FOUND ENTRY: Updating amount from ${foundEntry.amount} (${withdrawal.amount}) to: ${newAmount}`);
            withdrawalEntry.amount = newAmount;
            withdrawalArray[found] = withdrawalEntry;
            // console.log(withdrawalEntry);
        } else {
            withdrawalArray.push(withdrawalEntry);
        }


        //logLine('withdrawalArray after duplicate check');
        //logLine(withdrawalArray);

        withdrawal.coin = coin;
        processingTransactions.push(withdrawal);
        await processWithdrawal(_withdrawals);
    }

    async function dotransactions(_transactions) {
        if (_transactions.length === 0) {
            //cleanup();
            return;
        }
        const transaction = _transactions.shift();
        
        let fee = 0;
        await xrp.getServerInfo().then(function (server) {
            fee = parseFloat(server.validatedLedger.baseFeeXRP);
        });

        //logLine("fee: " + fee);
        if (fee > parseFloat(coin.withdraw_fee)) {
            logLine('Withdraw fee is too high!!!');
            throw Error('Fee is too high');
        }

        logLine(`trying to send from ${config.fromAddress} to ${transaction.address} amount ${transaction.amount}`);

        const accInfo = await xrp.getAccountInfo(config.fromAddress);
        //logLine(accInfo);

        //logLine(transaction);
        //process.exit(0);
        let txfee = fee * 1000 * 1000;
        let txamount = parseFloat(transaction.amount) * 1000 * 1000;
        let xrptransaction = {
            "TransactionType": "Payment",
            "Account": config.fromAddress,
            "Fee": txfee + "",
            "Destination": transaction.address,
            "DestinationTag" : transaction.payment_id,
            "Amount": txamount + "",
            "Sequence": accInfo.sequence
        }

        //logLine(xrptransaction);

        let txJSON = JSON.stringify(xrptransaction);

        //logLine(txJSON);

        if (typeof config.fromSecret === 'undefined') {
            logLine("ERROR: No secret");
            process.exit(1);
        }

        let signedTx = await xrp.sign(txJSON, config.fromSecret);
        //logLine(signedTx);
        //logLine('-------- SUBMITTING TRANSACTION --------');

        const result = await xrp.submit(signedTx.signedTransaction)
            .catch(function (e) {
                logLine('ERROR: SUBMITTING TRANSACTION: ', e)
                process.exit(1);
            });

        //logLine(result);

        logLine('updating txids to', signedTx.id);

        const found = processingTransactions.filter(element => element.address === transaction.address);
        found.forEach(element => element.txid = signedTx.id);

        await dotransactions(_transactions);
    }

    async function processpending(_pendingTransactions) {
        if (_pendingTransactions.length === 0) {
            //cleanup();
            return;
        }
        const transaction = _pendingTransactions.shift();

        logLine('Creating new transaction', transaction.txid);

        const tx = new Transactions();

        tx.user_id = transaction.user_id;
        tx.coin_id = transaction.coin_id;
        tx.type = 1;
        tx.address = transaction.address;
        tx.amount = transaction.amount;
        tx.fee = coin.withdraw_fee;
        tx.txid = transaction.txid;
        tx.time = new Date().getTime().toString().substr(0, 10);
        tx.pending = 1;

        await connection.manager.save(tx);

        logLine('Deleting the pending withdrawal entry:', transaction.id);
        await pendingWithdrawRepository.remove(transaction);

        await sendEmail(connection, tx.user_id, "withdraw", tx.amount, tx.address, coin.code);

        await sendPushMessage({
            'feed': crypto.createHash('md5').update(tx.user_id + '@ChainEX').digest("hex"),
            'title': 'Withdraw Processed',
            'tag': crypto.createHash('md5').update(tx.txid + 'withdraw').digest("hex"),
            'message': 'Your withdrawal of ' + tx.amount + ' ' + coin.code + ' has been processed'
        });

        await processpending(_pendingTransactions);
    }

    // Get pending transactions
    const withdrawals = await pendingWithdrawRepository
        .createQueryBuilder('pending_withdraw')
        .select([
            'pending_withdraw.id',
            'pending_withdraw.user_id',
            'pending_withdraw.address',
            'pending_withdraw.amount',
            'pending_withdraw.email_confirm',
            'pending_withdraw.time',
            'pending_withdraw.hash',
            'pending_withdraw.coin_id',
        ])
        .where('pending_withdraw.coin_id = (:coinId) AND pending_withdraw.email_confirm IN (:statuses)', {
            statuses: [1, 2],
            coinId: coin.id
        })
        .getMany();

    if (!withdrawals || !withdrawals.length) {
        logLine('No pending withdraws. Nothing to do.');
        return;
    }

    // send to processWithdrawal regardless so that it can run cleanup
    await processWithdrawal(withdrawals);
}

/** Function to validate if the user is allowed to withdraw the amount they want to */
async function verifyWithdrawLimit(
    transactionRepository, coin, userId,
    amount, emailConfirm, withdrawal, connection) {
    const coinId = coin.id;
    const maxWithdraw = coin.code === 'ETH' ? 100 : 10000; // TODO: URGENT: read from config
    const maxLimit = coin.code === 'ETH' ? 1000 : 100000; // TODO: URGENT: read from config

    // Check if email confim is set to 2 - if so, we are forcing this through
    if (emailConfirm === 2) {
        logLine('SKIPPING limits check email_confirm set to 2');
        return true;
    }

    // Check if we are even doing limits on this coin
    if (!!maxWithdraw && !!maxLimit) {
        // Log it
        logLine('LIMIT Validating user withdraw limits');
        // Check if this tops the single Tx limit
        if (amount <= maxWithdraw) {
            logLine('LIMIT Transaction passes single TX limit of', maxWithdraw);
            // Lets TRY to get the users withdraw history for this coin

            // WITHDRAWALS
            const withdrawals = await transactionRepository.createQueryBuilder('transactions')
                .select('sum(amount)', 'amount')
                .where('coin_id = :coinId AND user_id = :userId AND type = 1', {
                    userId: userId,
                    coinId: coinId,
                })
                .groupBy('amount')
                .getRawMany();

            let withdrawals_total = 0;
            if (!withdrawals) {
                //let withdrawals = {amount: '0.00000000'}; // TODO..
            } else {
                logLine('LIMIT withdrawals:', withdrawals);
                for (let i = 0; i < withdrawals.length; i++) {
                    withdrawals_total += withdrawals[i].amount;
                }
            }
            logLine('LIMIT withdrawals_total:', withdrawals_total);

            // Check for a result
            if (withdrawals_total > 0) {
                // Verify this transaction won't take them over the 24hr limit
                let dayAmount = withdrawals_total + amount;
                if (dayAmount > maxLimit) {
                    // User has exceeded his 24hr limit!
                    logLine(`LIMITS_FAIL User (ID: ${userId}) has exceeded the 24hr TX limit.`,
                        `Requested ${amount} Current 24hr volume: ${withdrawals_total}`);
                    // Return bad
                    return false;
                } else {
                    // Transaction is good.
                    logLine('LIMIT Limit check PASSED. Transaction is ok to proceed. New 24hr volume:', dayAmount);
                    // Return good!
                    return true;
                }
            } else {
                // User limit check has passed
                logLine('LIMIT Transaction does not exceed limits. Approved.');
                // Allow it
                return true;
            }
        } else {
            // Log it
            logLine(`LIMITS_FAIL User (ID: ${userId}) has exceeded the single TX limit. Requested ${amount}`);
            // Return an error - no withdraw
            return false;
        }
    } else {
        // Log it
        logLine('NOT checking user limits for this coin. Set maxWithrdaw in configuration.php');
        // Lets just accept this. we'll take the risk
        return true;
    }


}

function validateHash(passwordHash, password) {
    // Get the salt
    const salt = passwordHash.substr(passwordHash.length - 15, passwordHash.length);

    // Now hash the plaintext password and check if it's the same as the password hash
    return (crypto.createHash('sha1').update(password + salt).digest('hex') + salt === passwordHash);
}


async function accountAudit(balancesRepository, tradesRepository, transactionRepository, coinId, userId) {

    // DEPOSITS
    const deposits = await transactionRepository.createQueryBuilder('transactions')
        .select('sum(amount)', 'amount')
        .where('coin_id = :coinId AND user_id = :userId AND type = 0', { userId: userId, coinId: coinId })
        .getRawOne();
    let deposits_total = 0;
    if (!!deposits) {
        deposits_total = deposits.amount;
    }
    logLine('AUDIT deposits_total:', deposits_total);

    // WITHDRAWALS
    const withdrawals = await transactionRepository.createQueryBuilder('transactions')
        .select('sum(amount)', 'amount')
        .where('coin_id = :coinId AND user_id = :userId AND type = 1', { userId: userId, coinId: coinId })
        .getRawOne();
    let withdrawals_total = 0;
    if (!!withdrawals) {
        withdrawals_total = withdrawals.amount;
    }
    logLine('AUDIT withdrawals_total:', withdrawals_total);

    // SELL
    const sells = await tradesRepository.createQueryBuilder('trades')
        .select('sum(amount)', 'amount')
        .where('trades.seller_id = :sellerId AND market IN (SELECT market_id FROM markets WHERE coin = :coinId)', {
            sellerId: userId,
            coinId: coinId
        })
        // .printSql()
        .getRawOne();

    // logLine('sells:', sells);

    let sells_total = 0;
    if (!!sells && sells.amount) {
        sells_total = sells.amount;
    }
    logLine('AUDIT sells_total:', sells_total);

    // BUY
    const buys = await tradesRepository.createQueryBuilder('trades')
        .select('sum(amount)', 'amount')
        .where('trades.buyer_id = :buyer_id AND market IN (SELECT market_id FROM markets WHERE coin = :coinId)', {
            buyer_id: userId,
            coinId: coinId
        })
        .getRawOne();

    // logLine('buys:', buys);

    let buys_total = 0;
    if (!!buys && buys.amount) {
        buys_total = buys.amount;
        //let buys_total = {amount: '0.00000000'};
    }
    logLine('AUDIT buys_total:', buys_total);

    // BALANCE
    const balance = await balancesRepository.createQueryBuilder('balances')
        .select('sum(balance_available + balance_pending_deposit + balance_pending_withdraw + balance_held)', 'amount')
        .where('coin_id = :coinId AND user_id = :userId', {
            userId: userId,
            coinId: coinId,
        })
        .getRawOne();

    let balance_total = 0;
    if (!!balance) {
        balance_total = balance.amount;
    }
    logLine('AUDIT balance_total:', balance_total);

    // Work out differences
    const txDifference = +(deposits_total - withdrawals_total).toFixed(8);
    // We want to take the buy minus sell for current coins in account
    const tradeDifference = +(buys_total - sells_total).toFixed(8);
    // Add the two diferences to get net total
    const netTotal = +(txDifference + tradeDifference).toFixed(8);

    // We want the balance to be less than the net total then we know it's fine to send, add 1 for rounding errors
    logLine('AUDIT nettotal:', netTotal);

    return (netTotal + 1 >= balance_total);
}


