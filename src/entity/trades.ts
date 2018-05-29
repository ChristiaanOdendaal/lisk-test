import {Markets} from "./markets";
import {Entity, PrimaryGeneratedColumn, Column, ManyToOne} from "typeorm";
@Entity()
export class Trades {

    @PrimaryGeneratedColumn()
    id: number;

    @Column('varchar')
    trade_id: string;

    @Column("bigint")
    buyer_id: number;

    @Column("varchar")
    buy_order_id: string;

    @Column("bigint")
    seller_id: number;

    @Column("varchar")
    sell_order_id: string;

    @Column("mediumint")
    market: number;

    @Column("tinyint")
    type: number;

    @Column("varchar")
    time: string;

    @Column("double")
    price: number;

    @Column("double")
    amount: number;

    @Column("double")
    total: number;

    @Column("double")
    buyer_fee: number;

    @Column("double")
    seller_fee: number;

    @Column("double")
    buyer_net_total: number;

    @Column("double")
    seller_net_total: number;
 
 		@ManyToOne(type => Markets)
    markets: Markets;   
}