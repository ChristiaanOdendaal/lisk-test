import {Entity, PrimaryGeneratedColumn, Column} from "typeorm";

@Entity()
export class Monitoring {

    @PrimaryGeneratedColumn()
    id: number;

    @Column('mediumint')
    coin_id: number; // This should be set via a constant in the service / config

    @Column("mediumint") // '1 Deposits , 2 Withdraw, 3 Clearing, 4 Address, 5 SMS, 6 lastblock, 7 Email, 8 balanceCheck';
    type: number;

    @Column()
    name: string;

    @Column()
    lastrun: string;

    @Column()
    running: number;
}