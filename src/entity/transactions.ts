import {Entity, PrimaryGeneratedColumn, Column} from "typeorm";



@Entity()
export class Transactions {

    @PrimaryGeneratedColumn()
    id: number;

    @Column('bigint')
    user_id: number;

    @Column("mediumint")
    coin_id: number;

    @Column("mediumint")
    type: number;

    @Column("varchar")
    address: string;

    @Column("double")
    amount: number;

    @Column("double")
    fee: number;

    @Column("varchar")
    txid: string;

    @Column("varchar")
    time: string;

    @Column("mediumint")
    pending: number;

    @Column("mediumint")
    confirms: number;

}