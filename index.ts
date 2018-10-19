const lisk = require('lisk-elements').default;
//const commander = require('lisk-commander/dist');
const cmd = require('node-cmd');
const { exec } = require('child_process');

const beddowAmount = lisk.transaction.utils.convertLSKToBeddows('1');
const lskAmount = lisk.transaction.utils.convertBeddowsToLSK('1');

let processing = false;
let endTime;
let currentTime;
let transactionID;

let apiclient;

main();

async function main()
{
    //This program tests the Lisk-Elements functionality. Comment and uncomment as needed

    console.log("Creating APIClient");
    apiclient =  lisk.APIClient.createTestnetAPIClient();
    console.log("Client created")
    console.log();
    
    await executeLiskCommander('get account 7499353702925881868L');
    //await executeLiskCommander('create account');

    /**console.log('Will transfer '+lskAmount+' LSK');
    console.log('Will transfer '+beddowAmount+' Beddows');
    console.log('==========================');

    console.log('Test account passphrase:');
    console.log('apple barely matter orient arch reveal device buyer diary melody custom company');
    console.log('Test Address: 7499353702925881868L');
    
    await getAccount('7499353702925881868L');

    await transferToFaucet('6076671634347365051L');

    transactionID = '17470043602063335913';
    await fetchCompleteTransaction();

    await getNodeConstants();

    //const blockID = await getBlockfromTransaction('192106590504033228');
    //const block = await getBlock(blockID);
    const block = await getBlockbyHeight('6479174');

    await showAllTransactions(block);

    //EXPERIMENTAL! Be sure to use a loop here instead, recursion uses memory
    //await logNextBlocks(block);*/

    console.log("End program");
}

//Executes a command line operation using Lisk Commander
//Be sure to remove the maximum node versions from /usr/local/lib/node_modules/lisk-commander/package.json
//Also be sure to set "network" to "test" in /home/user/.lisk-commander/config.json
async function executeLiskCommander(command)
{
    console.log('==========================');
    console.log('Executing command \''+command+'\' on Lisk Commander..');
    
    let JSONResultString;

    //Start a promise so that the child process finishes before continuing
    await doCommandLinePromise('lisk '+command).then(result => JSONResultString=result);

    console.log('Received string '+JSONResultString);
    console.log('Converting to JSON object..');
    let resultJSON = JSON.parse(JSONResultString);
    console.log('Stringified object: '+JSON.stringify(resultJSON));
    
    if (resultJSON.error == undefined)
    {
    console.log('Address (where applicable): '+resultJSON.address);
    console.log('Passphrase (where applicable): '+resultJSON.passphrase);
    console.log('Private key (where applicable): '+resultJSON.privatekey);
    console.log('Public key (where applicable): '+resultJSON.publicKey);
    console.log('Lisk address (where applicable): '+resultJSON.address);
    }
    else
    {
        console.log('ERROR: '+resultJSON.error);
    }
}

async function doCommandLinePromise(command){
    return new Promise((resolve, reject) => {
        exec(command, (err, data, stderr)=> //exec is a child-process library, see the required imports above
        {
            resolve(data); //send back the data or output produced
            //If needed, err and stderr can also be sent back using an array
        });
    });
}


async function showAllTransactions(block)
{
    console.log("___________________________________");
    console.log("Showing all transactions in block..");
    if (block.data.length > 0)
    {
        let numberOfTransactions = Number(block.data[0].numberOfTransactions);
        console.log('Block ID '+block.data[0].id);
        console.log('Number of transactions in block: '+block.data[0].numberOfTransactions);
        if (numberOfTransactions>0)
        {
            let transactions;
            await apiclient.transactions.get({ 
                blockId: block.data[0].id,
                limit: 100
            }).then(results=>
                {
                    console.log(results);
                    transactions = results;
                }, failure=>outputFailure(failure, null));
            let i;
            for(i=0; i<numberOfTransactions; i++)
            {
                let element = transactions.data[i];
                console.log('Next Transaction: ' +JSON.stringify(element));
                console.log('\            /');
            };
        }
        else
        {
            console.log('No transactions in this block.');
        }
    }
    else {
        console.log('Empty block.');
    }
}

async function getBlockbyHeight(blockHeight)
{
    console.log("_________________________");
    console.log("Block Height "+blockHeight);
    let block;
    await apiclient.blocks.get({
        height: blockHeight
    }).then(result=>{
        block = result;
    }, reason=>console.log(reason));
    console.log(JSON.stringify(block));
    return block;
}

async function logNextBlocks(currentBlock)
{
    console.log("+++++++++++++++++++++++++");
    console.log("Attempting to get the next blocks in the chain.");
    console.log("Starting with block "+JSON.stringify(currentBlock));
    await nextBlockRecurse(currentBlock);
    console.log('+++++++++++++++++++++++++');
}

async function nextBlockRecurse(currentBlock)
{
    console.log("_________________________");
    let currentheight = parseInt(currentBlock.data[0].height);
    currentheight++;
    let newheight = currentheight.toString();
    let foundBlock;
    console.log("Block Height "+newheight);
    await apiclient.blocks.get({
        height: newheight
    }).then(async result=>{
        foundBlock = result;
    }, reason=>console.log('Recursion ended: '+reason));

    if (foundBlock.data.length > 0)
    {
        console.log('Block ID '+foundBlock.data[0].id);
        console.log('Number of transactions in block: '+foundBlock.data[0].numberOfTransactions);
        if (Number(foundBlock.data[0].numberOfTransactions)>0)
        {
        console.log(await getTransactionFromBlock(foundBlock));
        }
        await nextBlockRecurse(foundBlock);
    }
    else {
        console.log('Head block reached.');
    }
}

async function getTransactionFromBlock(block)
{
    console.log('Looking up transactions for block id '+block.data[0].id);
    let transaction;
    await apiclient.transactions.get({ blockId: block.data[0].id, limit: 100}).then(results=>
        {
            transaction = results;
        }, failure=>outputFailure(failure, null));
    return transaction;
}

async function getBlock(blockID)
{
    console.log('==========================');
    console.log('Fetching block with ID '+blockID);
    let block;
    await apiclient.blocks.get({
        blockId: blockID
    }).then(result=>{
        outputBlock(result);
        block = result;
    }, reason=>outputFailure);
    console.log('==========================');
    return block;
}

function outputBlock(block)
{
    console.log('Stringified block: '+JSON.stringify(block));
    console.log('Block ID: '+block.data[0].id);
    console.log('Block timestamp: '+block.data[0].timestamp);
    console.log('Block timestamp(converted): '+ outputTimestamp(block.data[0].timestamp));
    console.log('Block height: '+block.data[0].height);
    console.log('Number of transactions in block: '+block.data[0].numberOfTransactions);
    console.log('previousBlockId: '+block.data[0].previousBlockId);
}

async function getBlockfromTransaction(transactionID)
{
    console.log('==========================');
    console.log('Fetching transaction in order to find block ID..');
    console.log('Looking up transaction id '+transactionID);
    let blockID;
    await apiclient.transactions.get({ id: transactionID}).then(results=>
        {
            console.log('Found block for transaction ID '+results.data[0].id+'.');
            console.log('Block Height: '+results.data[0].height);
            console.log('Block ID: '+results.data[0].blockId);
            blockID = results.data[0].blockId;
        }, failure=>outputFailure(failure, null));
    console.log('==========================');
    return blockID;    
}

async function getNodeConstants()
{
    console.log('==========================');
    console.log('Fetching node constants..')
    await apiclient.node.getConstants(
    ).then(result => {
        outputConstants(result);
    }, reason => outputFailure(reason,null));
    console.log('==========================');
}

function outputConstants(constants)
{
    console.log('Node constants received!');
    console.log('Stringified constants: '+JSON.stringify(constants));
    console.log('Epoch date: '+constants.data.epoch);
    console.log('All fees are in Beddows (convert with API)')
    console.log('Sending fee: '+constants.data.fees.send);
    console.log('Voting fee: '+constants.data.fees.vote);
    console.log('Register Second Signature fee: '+constants.data.fees.secondSignature);
    console.log('Register Delegate fee: '+constants.data.fees.delegate);
    console.log('Register Mulitsignature fee: '+constants.data.fees.mulitsignature);
    console.log('Withdraw Lisk from Dapp Sidechain fee: '+constants.data.fees.dappWithdrawal);
    console.log('Deposit Lisk into Dapp Sidechain fee: '+constants.data.fees.dappDeposit);
    console.log('Nethash: '+constants.data.nethash);
    console.log('What\'s a nonce?: '+constants.data.nonce);
    console.log('Current milestone (affects forging rewards): '+constants.data.milestone);
    console.log('Reward: '+constants.data.reward);
    console.log('Supply: '+constants.data.supply);
    console.log('Lisk version: '+constants.data.version);
}

function outputTimestamp(timestamp)
{
    let timestampDate = new Date(liskTimeToUnix(timestamp));
    return timestampDate.toLocaleString();
    
}

function liskTimeToUnix(liskTimestamp)
{
    let genesisDate = new Date(lisk.constants.EPOCH_TIME_MILLISECONDS);
    //console.log('Genesis millis: '+genesisDate.getTime());
    genesisDate.setTime(genesisDate.getTime()+(parseInt(liskTimestamp)*1000)); //To get the date of the Lisk timestamp:
    //console.log('Unix millis: '+genesisDate.getTime());                      //Timestamp in seconds*1000+Lisk Epoch Time(1464109200000 millis in UNIX)
    return genesisDate;
}

function waitSynchronous()
{
    processing = true;
    endTime = new Date();
    endTime.setSeconds(endTime.getSeconds()+30)
    console.log('endTime is '+endTime.toTimeString());
    currentTime = new Date();
    waitRecurse();
}

function waitRecurse()
{
    console.log('At '+currentTime.toTimeString());
    currentTime.setSeconds(currentTime.getSeconds()+1)
    setTimeout(function(){
        if (processing || currentTime < endTime)
        {
            console.log('Recursing..');
            waitRecurse();
        }
        else
        {
            console.log('Not processing and currenttime >= endtime');
        }
    }, 1000);
}

async function transferToFaucet(faucetID)
{
    console.log('Faucet address: 6076671634347365051L');
    console.log('==========================');

    let transaction = lisk.transaction.transfer({
        amount: beddowAmount,
        recipientId: '6076671634347365051L',
        passphrase: 'apple barely matter orient arch reveal device buyer diary melody custom company'
        //passphrase: 'apple barely matter orient arch reveal device buyer diary melody custom company'
    });

    //Transaction ID gets assigned as soon as a transaction is created
    transactionID = transaction.id;

    console.log("Transaction for transfer created.")
    console.log('Broadcasting transfer to faucet at https://testnet-faucet.lisk.io/..');
    await apiclient.transactions.broadcast(transaction).then(result=>{
        outputSuccess(result,transaction);
        console.log('Data was '+JSON.stringify(result.data));
    }, reason=>outputFailure(reason, transaction));
}

async function getAccount(accountID)
{
    console.log('Attempting to get account details..');
    console.log('==========================');

    let account = await apiclient.accounts.get({
        address: '7499353702925881868L' 
    }).then(result=>{
        console.log('-------------------------');
        console.log("Account Details Received!");
        outputAccount(result);
        console.log('-------------------------');
        processing = false;
    });
    console.log('==========================');
}

function outputAccount(account)
{
    console.log('Stringified account: '+JSON.stringify(account));
    console.log('Lisk addres: '+account.data[0].address);
    console.log('Balance: '+account.data[0].balance);
    console.log('Public key: '+account.data[0].publicKey);
    console.log('Second public key: '+account.data[0].balance);
}

async function fetchCompleteTransaction()
{
    console.log('==========================');
    console.log('Fetching completed transaction..');
    console.log('Looking up transaction id '+transactionID);
    
    await apiclient.transactions.get({ id: transactionID}).then(results=>
        outputCompletedTransaction(results), failure=>outputFailure(failure, null));
    console.log('==========================');
    
}

//Fetches transaction from the blockchain. Assumes valid id is assigned to transactionID.
function outputCompletedTransaction(results)
{
    console.log('*************************');
    console.log('Received response for completed transaction!')
    //if (results.data[0].id != undefined)
    if (typeof results.data !== undefined && results.data.length > 0)
    {

        console.log('Completed transaction: '+JSON.stringify(results));
        console.log('Transaction ID: '+results.data[0].id);
        console.log('Block Height: '+results.data[0].height);
        console.log('Block ID: '+results.data[0].blockId);
        console.log('Transaction Type: '+results.data[0].type);
        console.log('Timestamp: '+ results.data[0].timestamp);
        console.log('Timestamp(converted): '+ outputTimestamp(results.data[0].timestamp));
        console.log('Sender Public Key: '+results.data[0].senderPublicKey);
        console.log('Sender ID: '+results.data[0].senderId);
        console.log('Recipient Public Key: '+results.data[0].recipientPublicKey);
        console.log('Recipient ID: '+results.data[0].recipientId);
        console.log('Amount: '+results.data[0].amount);
        console.log('Fee: '+results.data[0].fee);
        console.log('Signature: '+results.data[0].signature);
        console.log('Confirmations: '+results.data[0].confirmations);
        console.log('***');
    }
    else
    {
        console.log('Stringified response was '+ JSON.stringify(results));
        console.log('Transaction not available. Retrying in 10 seconds..')
        setTimeout(fetchCompleteTransaction, 10000)
    }
    console.log('*************************');
}

function outputTransaction(transaction)
{
    console.log('-+-+-+-+-+-+-+-+-+-');

    console.log('Entire transaction: '+JSON.stringify(transaction));
    console.log('Transaction ID: '+transaction.id);
    if (transaction.recipientId)
    {
        console.log('Recipient ID:' + transaction.recipientId);
    }
    if(transaction.senderID)
    {
        console.log('Sender ID:'+transaction.senderID);
    }
    else
    {
        console.log('Sender ID not found. Converted ID: '+lisk.cryptography.getAddressFromPublicKey(transaction.senderPublicKey));
    }
    console.log('Sender Public Key:' + transaction.senderPublicKey);
    
    console.log('Transaction Type: '+ transaction.type);
    console.log('Amount: '+ transaction.amount);
    
    console.log('-+-+-+-+-+-+-+-+-+-');
}

function outputFailure(reason, transaction)
{
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('Transaction failed! Details are as follows:');
    console.log("Reason: "+reason);
    if (transaction)
    {
        outputTransaction(transaction);
    }
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!');

    //Error types so far:
    //Incorrect pass phrase: Error: Status 409 : Account does not have enough LSK: 11756279743363357022L balance: 0
}

function outputSuccess(result, transaction)
{
    let message = result.data.message;
    console.log('-------------------------');
    console.log('Transaction complete! Details are as follows:');
    console.log("Stringified transaction result:"+JSON.stringify(result));
    console.log('Status: ' +result.meta.status);
    console.log('Message: ' +result.data.message);

    outputTransaction(transaction);

    console.log('-------------------------');
}