import {Entity, PrimaryGeneratedColumn, Column} from "typeorm";

@Entity()
export class AddressTransaction {

    @PrimaryGeneratedColumn()
    id: number;

    @Column("mediumint")
    coin_id: number;

    @Column("varchar")
    txid: string;
}