import { config } from '../../configuration';
import { logLine } from '../util/util';

import { Addresses } from '../entity/addresses';
import { Balances } from '../entity/balances';

import * as Xrp from 'ripple-lib';

export async function balanceCheck(xrp, connection, coin, eth) {

    const balancesRepository = connection.getRepository(Balances);
    let decimals = 18;

    logLine(`Checking balances for coin: ${coin.code}, type: ${coin.coin_type}`);
    let walletTotal;

    // CHAINEX BALANCE
    const balanceData = await balancesRepository.createQueryBuilder('balances')
        .select('sum(balance_available + balance_pending_withdraw + balance_held)', 'total')
        .where('coin_id = :coinId', {
            coinId: coin.id,
        })
        .getRawOne();

    const pendingDepositData = await balancesRepository.createQueryBuilder('balances')
        .select('sum(balance_pending_deposit)', 'total')
        .where('coin_id = :coinId', {
            coinId: coin.id,
        })
        .getRawOne();

    let balance = 0;
    let pendingDeposit = 0;

    if (!!balanceData) {
        balance = balanceData.total || 0;
    }
    if (!!balanceData) {
        pendingDeposit = pendingDepositData.total || 0;
    }

    // Expected storage
    // $expectedStorage = number_format($COLDStorage + $walletData[''], 8, '.', '');
    // echo "[" . date('M j y H:i:s', time()) . " ".$walletServer.":".$coinName."] Actual Balance: " . $expectedStorage . "\n";
    logLine('Expected Total:', balance);

    walletTotal = await xrp.getBalances(config.fromAddress);
    walletTotal = walletTotal[0].value;
    logLine(`Initial Balance: ${walletTotal}`);

    if (walletTotal - pendingDeposit >= coin.balance_check) {
        /// Funds possibly not cleared yet, and should not yet be profit...
        walletTotal -= pendingDeposit;
    }


    // Output some data
    // TODO: logLine(`COLD Storage: ${coldstorage}`);
    logLine(`Balance: ${walletTotal}`);


    // Get the difference
    const difference = +(walletTotal - balance).toFixed(8);
    logLine('Difference:', difference);
    logLine('Total profit last run:', coin.balance_check);

    // Difference between the two runs
    const differenceRuns = +(difference - coin.balance_check).toFixed(8);
    logLine('Difference:', differenceRuns);

    if (differenceRuns >= 0) {
        logLine('We\'re all good!');
    } else {
        logLine(`BALANCE-ERROR: Profit gone DOWN. Last: ${coin.balance_check}  This: ${difference}`);
        logLine('Killed coins crons');
        eth.cron_deposit = -1;
        eth.cron_clearing = -1;
        eth.cron_withdraw = -1;
        coin.cron_deposit = -1;
        coin.cron_clearing = -1;
        coin.cron_withdraw = -1;
    }

    coin.balance_check = difference;
    logLine('========================================');
};