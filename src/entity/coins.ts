import {Entity, PrimaryGeneratedColumn, Column} from "typeorm";

@Entity()
export class Coins {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    code: string;

    @Column()
    coin_type: string;

    @Column()
    token_contract: string;

    @Column()
    cron_address: number;

    @Column()
    cron_deposit: number;

    @Column()
    cron_clearing: number;

    @Column()
    cron_withdraw: number;

    @Column()
    withdraw_fee: number;

    @Column()
    balance_check: number;

    @Column('bigint')
    blockHeight: number;

    @Column('tinytext')
    lastblock: string;

    @Column('mediumint')
    req_confirms: number;
}