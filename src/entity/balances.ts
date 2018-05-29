import {Entity, PrimaryGeneratedColumn, Column, OneToMany} from "typeorm";

@Entity()
export class Balances {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    user_id: number;

    @Column()
    coin_id: number;

    @Column("double")
    balance_available: number;

    @Column("double")
    balance_pending_deposit: number;

    @Column("double")
    balance_pending_withdraw: number;

    @Column("double")
    balance_held: number;
}