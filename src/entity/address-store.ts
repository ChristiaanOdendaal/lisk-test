import {Entity, PrimaryGeneratedColumn, Column} from "typeorm";

@Entity()
export class AddressStore {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    coin_id: number; // This should be set via a constant in the service / config

    @Column()
    address: string; // Plain text to store the address
}