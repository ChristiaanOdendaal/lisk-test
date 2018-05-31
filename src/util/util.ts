import { SHA3 } from 'crypto-js';
import { config } from '../../configuration';
import { Users } from '../entity/users';
import { Mail_Queue } from '../entity/mail_queue';
import * as WAValidator from 'wallet-address-validator';
import * as zmq from 'zmq';

export let logLine = (...args): void => {
    var now = new Date().toISOString();
    console.log(`[${now.slice(0, 10)} ${now.slice(11, 19)} ${config.provider}:${config.coincode}]`, ...args);
}

export let sha3 = (value: string): string => {
    return SHA3(value, { outputLength: 256 }).toString();
}

export let isAddress = (address: string): boolean => {
    return WAValidator.validate(address, config.coincode);
};

export let sendPushMessage = (message): void => {
    const sock = zmq.socket('push');
    sock.connect(config.pushServer);
    sock.send(JSON.stringify(message));
    setTimeout(sock ? sock.close : false, 150);

}

const readFile = filePath => new Promise((resolve, reject) => {
    let fs = require('fs');
    fs.readFile(filePath, (err, data) => {
        if (err) reject(err);
        else { resolve(data); }
    });
});

export let sendEmail = async (connection, user_id: number, type: string, amount: number, address: string, cointype: string): Promise<boolean> => {
    //let user = {email:'',first_name:'',last_name:''};
    const userRepository = connection.getRepository(Users);
    const mailRepository = connection.getRepository(Mail_Queue);
    const user = await userRepository.findOne({ id: user_id });
    if (!user) {
        return false;
    }
    let params = {
        "email": user.email,
        "amount": amount,
        "wallet": cointype,
        "address": address,
        "fullname": ""
    };
    if (user.first_name !== undefined) {
        params.fullname = user.first_name;
    }
    if (user.last_name !== undefined) {
        params.fullname += " " + user.last_name;
    }
    let header = (await readFile(__dirname + "/emailTemplates/tpl-header.html")).toString();
    let footer = (await readFile(__dirname + "/emailTemplates/tpl-footer.html")).toString();
    let content = "";
    let subject = "";
    if (type === "withdraw") {
        subject = 'ChainEX - Withdrawal Processed';
        content = await (await readFile(__dirname + "/emailTemplates/withdrawalReceived-tpl.html")).toString();
    }
    else {
        subject = 'ChainEX - Deposit Received';
        content = await (await readFile(__dirname + "/emailTemplates/depositReceived-tpl.html")).toString();
    }
    let html = header + content + footer;
    html = html.replace(/!APP_URL/g, config.APP_URL);
    html = html.replace(/\!SUPPORT_URL/g, config.SUPPORT_URL);
    html = html.replace(/\!USER_EMAIL/g, user.email);
    html = html.replace(/\!PARAM_FULLNAME/g, params.fullname);
    html = html.replace(/\!PARAM_WALLET/g, params.wallet);
    html = html.replace(/\!PARAM_AMOUNT/g, params.amount.toString());
    html = html.replace(/\!PARAM_ADDRESS/g, params.address);

    const mq = new Mail_Queue();

    mq.user_id = user_id;
    mq.email_address = user.email;
    mq.subject = subject;
    mq.html = html;
    mq.datecreated = new Date().getTime().toString().substr(0, 10);
    await connection.manager.save(mq);

    return true;
}

export let random = function (n) {
    var add = 1, max = 12 - add;
    if (n > max) {
        return random(max) + random(n - max);
    }
    max = Math.pow(10, n + add);
    var min = max / 10;
    var number = Math.floor(Math.random() * (max - min + 1)) + min;
    return ("" + number).substring(add);
}