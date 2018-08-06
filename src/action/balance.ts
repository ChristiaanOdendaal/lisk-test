import { config } from '../../configuration';
import { logLine } from '../util/util';

import { Addresses } from '../entity/addresses';
import { Balances } from '../entity/balances';

import * as Xrp from 'ripple-lib';

export async function balanceCheck(xrp, connection, coin) {

    const addressRepository = connection.getRepository(Addresses);
    const balancesRepository = connection.getRepository(Balances);

    let decimals = 18;

    let checkCount = 0;

    logLine(`Checking balances for coin: ${coin.code}, type: ${coin.coin_type}`);
    let walletTotal;

    const actualCheck = async () => {
        checkCount++;

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

        // TODO: Check how many Address creation and ERC20 transactions have gone out, and get the exact
        // amount that should be missing, so that we aren't potentially leaking profits...
        if (differenceRuns >= 0) {
            if (differenceRuns === 0) {
                logLine('We\'re all good!');
            } else {
                if (checkCount < 3 && differenceRuns > 0) {
                    logLine(`Retrying: try ${checkCount} of 3 - could not be profit...`);
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds...
                    await actualCheck();
                    return;
                } else {
                    logLine('We\'re all good!');
                }
            }
        } else {
            if (checkCount >= 3) {
                logLine(`BALANCE-ERROR: Profit gone DOWN. Last: ${coin.balance_check}  This: ${difference}`);
                logLine('Killed coins crons');
                coin.cron_deposit = -1;
                coin.cron_clearing = -1;
                coin.cron_withdraw = -1;
            } else {
                logLine(`BALANCE-ERROR: Profit gone DOWN. Last: ${coin.balance_check}  This: ${difference}`);
                logLine(`Retrying: try ${checkCount} of 3`);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds...
                await actualCheck();
                return;
            }
        }

        coin.balance_check = difference;
    }

    await actualCheck();

    logLine('========================================');
};