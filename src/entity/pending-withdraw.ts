import {Entity, PrimaryGeneratedColumn, Column} from "typeorm";

@Entity()
export class PendingWithdraw {

    @PrimaryGeneratedColumn()
    id: number;

    @Column('bigint')
    user_id: number;

    @Column("mediumint")
    coin_id: number;

    @Column("varchar")
    address: string;

    @Column("double")
    amount: number;

    @Column("varchar")
    time: string;

    @Column("tinyint")
    email_confirm: number;

    @Column("varchar")
    hash: string;

    @Column("mediumint")
    risk: number;

    @Column("varchar",{ nullable: true })
    payment_id: string;
}