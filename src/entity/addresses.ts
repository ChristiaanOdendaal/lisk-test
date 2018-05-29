import {Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn} from "typeorm";
import { Balances } from "./balances";

@Entity()
export class Addresses {

    @PrimaryGeneratedColumn()
    address_id: number;

    @Column()
    address_balance_id: number; // This should be set via a constant in the service / config

    @Column()
    address_address: string; // Plain text to store the address

    @Column()
    address_created: string; // Plain text to store the address

    @OneToOne(type => Balances)
    @JoinColumn({ name: 'address_balance_id',  referencedColumnName: 'id' })
    balance: Balances;
}